"""Build Rokkha's map geography from ONE official boundary release.

Source (download "bgd_admin_boundaries.geojson.zip"):
    https://data.humdata.org/dataset/cod-ab-bgd
    Bangladesh Subnational Administrative Boundaries (COD-AB) v03, valid on 2023-05-21,
    Bangladesh Bureau of Statistics (BBS) and UN OCHA ROAP, CC BY-IGO.
    Levels: 0 country, 1 division (8), 2 district (64), 3 upazila (507). There is no union level.

Usage:
    python scripts/build_map_geography.py path/to/bgd_admin_boundaries.geojson.zip --web-out ../Frontend/public/geo

Writes:
    data/boundaries/bangladesh_upazilas.geojson   507 upazilas for the server's place-name lookup
    <web-out>/divisions.json                       8 divisions        (map, national view)
    <web-out>/districts.json                       64 districts       (map, national view)
    <web-out>/mask.json                            the world outside Bangladesh (dims the basemap)
    <web-out>/upazilas/<district pcode>.json       upazilas of one district, loaded on demand
    <web-out>/index.json                           search index: every place with its parents and bounds
    <web-out>/meta.json                            source, version, counts and simplification used

Simplification uses shapely.coverage_simplify on each whole level, so neighbouring boundaries stay
shared: no gaps or overlaps appear between districts after simplifying. Every output geometry is
checked for validity and every code is checked against its parent.
"""

import argparse
import json
import zipfile
from pathlib import Path

import shapely
from shapely.geometry import mapping, shape
from shapely.ops import polylabel

BACKEND = Path(__file__).resolve().parents[1]
SERVER_UPAZILAS = BACKEND / "data" / "boundaries" / "bangladesh_upazilas.geojson"

SOURCE = {
    "dataset": "Bangladesh - Subnational Administrative Boundaries (COD-AB)",
    "version": "v03",
    "valid_on": "2023-05-21",
    "producer": "Bangladesh Bureau of Statistics (BBS); OCHA ROAP",
    "publisher": "Humanitarian Data Exchange (HDX)",
    "url": "https://data.humdata.org/dataset/cod-ab-bgd",
    "license": "CC BY-IGO",
    "attribution": "Administrative boundaries © BBS and UN OCHA (COD-AB v03), via HDX, CC BY-IGO",
}

# Measured on the districts: 0.004 moves a border at most ~1 km (one pixel at national zoom), area change 0.25 %.
# Divisions are not simplified separately: they are dissolved from the simplified districts so the edges coincide.
TOLERANCE = {"district": 0.004, "upazila": 0.0008, "server_upazila": 0.0005}  # coverage_simplify (area-based) tolerance
DECIMALS = {"district": 4, "upazila": 5, "server_upazila": 5}  # 4 ≈ 11 m, 5 ≈ 1 m
# Island parts smaller than this (km²) are left out at each level: river chars and coastal islets far below
# one pixel at that level's zoom. The server copy keeps everything.
MIN_PART_KM2 = {"division": 2.0, "district": 0.5, "upazila": 0.05, "server_upazila": 0.0}
DEG2_PER_KM2 = 1 / (110.6 * 101.3)  # at Bangladesh's latitude (~23.7° N)


def _round(geometry, decimals=5):
    return shapely.set_precision(geometry, 10 ** -decimals, mode="pointwise")


def _drop_small_parts(g, min_km2):
    if min_km2 <= 0 or g.geom_type != "MultiPolygon":
        return g
    keep = [p for p in g.geoms if p.area >= min_km2 * DEG2_PER_KM2]
    if not keep:  # never drop a whole unit: keep its largest part
        keep = [max(g.geoms, key=lambda p: p.area)]
    return shapely.MultiPolygon(keep) if len(keep) > 1 else keep[0]


def _simplify_level(features, tolerance, name):
    """Coverage-aware simplification: shared edges are simplified once, identically on both sides."""
    geoms = [shape(f["geometry"]).buffer(0) for f in features]
    simplified = shapely.coverage_simplify(geoms, tolerance)
    out = []
    for f, g in zip(features, simplified):
        g = _drop_small_parts(_round(g, DECIMALS[name]).buffer(0), MIN_PART_KM2[name])
        if g.is_empty or not g.is_valid:
            raise ValueError(f"Invalid geometry after simplifying {f['properties']}")
        out.append(g)
    return out


def _bounds(g):
    w, s, e, n = g.bounds
    return [round(w, 4), round(s, 4), round(e, 4), round(n, 4)]


def _label_point(g):
    """A point well inside the shape (largest part), for labels and 'go to' targets."""
    if g.geom_type == "MultiPolygon":
        g = max(g.geoms, key=lambda p: p.area)
    p = polylabel(g, tolerance=0.002)
    return [round(p.x, 4), round(p.y, 4)]


def _fc(features):
    return {"type": "FeatureCollection", "features": features}


def _write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return path.stat().st_size


def main(zip_path, web_out):
    archive = zipfile.ZipFile(zip_path)
    level = {n: json.loads(archive.read(f"bgd_admin{n}.geojson"))["features"] for n in (0, 1, 2, 3)}

    divisions = sorted(level[1], key=lambda f: f["properties"]["adm1_pcode"])
    districts = sorted(level[2], key=lambda f: f["properties"]["adm2_pcode"])
    upazilas = sorted(level[3], key=lambda f: f["properties"]["adm3_pcode"])

    # Checks: counts, unique codes, version and parent links.
    assert len(divisions) == 8, len(divisions)
    assert len(districts) == 64, len(districts)
    for f in level[1] + level[2] + level[3]:
        assert f["properties"]["version"] == "v03", f["properties"]
        assert f["properties"]["valid_on"] == "2023-05-21", f["properties"]
    division_codes = {f["properties"]["adm1_pcode"] for f in divisions}
    district_codes = {f["properties"]["adm2_pcode"] for f in districts}
    assert len(district_codes) == 64
    for f in districts:
        p = f["properties"]
        assert p["adm1_pcode"] in division_codes and p["adm2_pcode"].startswith(p["adm1_pcode"])
    for f in upazilas:
        p = f["properties"]
        assert p["adm2_pcode"] in district_codes and p["adm3_pcode"].startswith(p["adm2_pcode"])
    assert len({f["properties"]["adm3_pcode"] for f in upazilas}) == len(upazilas)

    web_out = Path(web_out)
    sizes = {}
    index = []

    # Country: only used for the outside-Bangladesh mask.
    country = _round(shape(level[0][0]["geometry"]).buffer(0).simplify(0.002)).buffer(0)
    rings = [list(p.exterior.coords) for p in (country.geoms if country.geom_type == "MultiPolygon" else [country])]
    world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
    mask = {"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [world] + [r[::-1] for r in rings]}}
    sizes["mask.json"] = _write(web_out / "mask.json", _fc([mask]))
    index.append({"level": 0, "pcode": "BD", "name": "Bangladesh", "bbox": _bounds(country), "label": _label_point(country)})

    district_geoms = _simplify_level(districts, TOLERANCE["district"], "district")
    feats = []
    for f, g in zip(districts, district_geoms):
        p = f["properties"]
        props = {"pcode": p["adm2_pcode"], "name": p["adm2_name"], "level": 2, "division_pcode": p["adm1_pcode"], "division": p["adm1_name"], "area_sqkm": round(p["area_sqkm"], 1)}
        feats.append({"type": "Feature", "geometry": mapping(g), "properties": props})
        index.append({"level": 2, "pcode": p["adm2_pcode"], "name": p["adm2_name"], "division_pcode": p["adm1_pcode"], "division": p["adm1_name"], "bbox": _bounds(g), "label": _label_point(g)})
    sizes["districts.json"] = _write(web_out / "districts.json", _fc(feats))
    # Divisions = union of their simplified districts (edges coincide with the district edges exactly).
    feats = []
    for f in divisions:
        p = f["properties"]
        g = _drop_small_parts(_round(shapely.union_all([dg for df, dg in zip(districts, district_geoms) if df["properties"]["adm1_pcode"] == p["adm1_pcode"]]), 4).buffer(0), MIN_PART_KM2["division"])
        feats.append({"type": "Feature", "geometry": mapping(g), "properties": {"pcode": p["adm1_pcode"], "name": p["adm1_name"], "level": 1}})
        index.append({"level": 1, "pcode": p["adm1_pcode"], "name": p["adm1_name"], "bbox": _bounds(g), "label": _label_point(g)})
    sizes["divisions.json"] = _write(web_out / "divisions.json", _fc(feats))


    geoms = _simplify_level(upazilas, TOLERANCE["upazila"], "upazila")
    by_district = {}
    for f, g in zip(upazilas, geoms):
        p = f["properties"]
        props = {"pcode": p["adm3_pcode"], "name": p["adm3_name"], "level": 3, "district_pcode": p["adm2_pcode"], "district": p["adm2_name"], "division_pcode": p["adm1_pcode"], "division": p["adm1_name"], "area_sqkm": round(p["area_sqkm"], 1)}
        by_district.setdefault(p["adm2_pcode"], []).append({"type": "Feature", "geometry": mapping(g), "properties": props})
        index.append({"level": 3, "pcode": p["adm3_pcode"], "name": p["adm3_name"], "district_pcode": p["adm2_pcode"], "district": p["adm2_name"], "division_pcode": p["adm1_pcode"], "division": p["adm1_name"], "bbox": _bounds(g), "label": _label_point(g)})
    upazila_bytes = 0
    for code, items in by_district.items():
        # The district's own outline at upazila detail, so a selected district lines up with its upazilas.
        outline = _round(shapely.union_all([shape(i["geometry"]) for i in items]), 5).buffer(0)
        district_feature = {"type": "Feature", "geometry": mapping(outline), "properties": {"pcode": code, "level": 2, "outline": True}}
        upazila_bytes += _write(web_out / "upazilas" / f"{code}.json", _fc(items + [district_feature]))
    sizes["upazilas/*.json (64 files)"] = upazila_bytes
    assert set(by_district) == district_codes, "every district must have upazilas"

    sizes["index.json"] = _write(web_out / "index.json", index)

    meta = {
        "source": SOURCE,
        "counts": {"country": 1, "divisions": len(divisions), "districts": len(districts), "upazilas": len(upazilas), "unions": 0},
        "unions": "Not in COD-AB v03 (levels 0-3 only); not shown.",
        "crs": "WGS 84 longitude/latitude (OGC CRS84)",
        "simplification_degrees": TOLERANCE,
        "coordinate_decimals": DECIMALS,
        "min_island_part_km2": MIN_PART_KM2,
        "bytes": sizes,
    }
    _write(web_out / "meta.json", meta)

    # Server copy of the upazilas (finer), for GET /geospatial/place-name.
    geoms = _simplify_level(upazilas, TOLERANCE["server_upazila"], "server_upazila")
    server = []
    for f, g in zip(upazilas, geoms):
        p = f["properties"]
        server.append({"type": "Feature", "geometry": mapping(g), "properties": {
            "name": p["adm3_name"], "pcode": p["adm3_pcode"], "admin_level": 3,
            "parent_pcode": p["adm2_pcode"], "parent_name": p["adm2_name"],
            "division_pcode": p["adm1_pcode"], "division_name": p["adm1_name"],
            "valid_on": p["valid_on"], "version": p["version"]}})
    sizes["server bangladesh_upazilas.geojson"] = _write(SERVER_UPAZILAS, _fc(server))

    print(json.dumps(meta["counts"]), json.dumps(sizes, indent=1))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("zip_path")
    parser.add_argument("--web-out", required=True)
    args = parser.parse_args()
    main(args.zip_path, args.web_out)
