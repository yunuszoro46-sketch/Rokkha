"""Build the map's geographic context layers (rivers, headquarters, Bangla upazila names, terrain).

Inputs (each documented in the portal's docs/BANGLADESH_GEOGRAPHIC_DATA.md):
    --osm-rivers   Overpass JSON: way["waterway"="river"] inside Bangladesh, `out tags geom;`   (© OpenStreetMap, ODbL)
    --osm-admin    Overpass JSON: admin_level 4/5/6 relations inside Bangladesh, `out tags center;` (© OpenStreetMap, ODbL)
    --hdx-admin-zip  COD-AB v03 archive (bgd_admin3.geojson, bgd_admincapitals.geojson)          (BBS/OCHA, CC BY-IGO)
    --dem-dir      Copernicus DEM GLO-90 1° tiles (Copernicus_DSM_COG_30_N??_00_E???_00_DEM.tif)  (© DLR/Airbus, ESA/EU licence)
    --web-out      Frontend/public/geo

Writes into --web-out:
    rivers.json           named rivers merged by name, ranked by length (1 ≥ 150 km, 2 ≥ 40 km, 3 shorter)
    rivers-minor.json     unnamed river lines ≥ 3 km (loaded only when zoomed in)
    river-labels.json     label points along each named river, English and Bangla names as tagged in OSM
    places.json           division and district headquarters (COD-AB admin capitals)
    names-bn.json         Bangla upazila names, ONLY where an OSM upazila and a COD-AB upazila agree on both
                          location (OSM centre inside the COD-AB polygon) and English name
    terrain/{z}/{x}/{y}.png  colour-relief + hillshade tiles, zoom 6-9 (Web Mercator, 256 px)
    terrain-stats.json    per district / upazila elevation statistics (median, share below 5 m / 10 m)
    context-meta.json     sources, versions, counts
"""

import argparse
import json
import math
import re
import zipfile
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import LineString, MultiLineString, Point, mapping, shape
from shapely.ops import linemerge

BENGALI = re.compile(r"[ঀ-৿]")
KM_PER_DEG = 104.0  # good enough for lengths at ~23.7° N (mean of 110.6 lat / 101.3 lon)


def _write(path: Path, data) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return path.stat().st_size


def _r(g, decimals=4):
    return shapely.set_precision(g, 10 ** -decimals, mode="pointwise")


def _norm_en(name: str) -> str:
    n = re.sub(r"\b(river|nadi|nodi|khal)\b", "", name.lower())
    return re.sub(r"[^a-z]", "", n)


def _clip(g, area):
    """Part of g inside the (prepared) area; cheap when g is fully inside."""
    if area.contains(g):
        return g
    if not area.intersects(g):
        return g.__class__()
    return g.intersection(area)


def build_rivers(osm_rivers: Path, country, web_out: Path):
    ways = json.loads(osm_rivers.read_text(encoding="utf-8"))["elements"]
    # Clip against a simplified outline (~300 m): exact enough for drawing, much faster than the full border.
    near = country.simplify(0.003).buffer(0.05)
    inside = country.simplify(0.003)
    shapely.prepare(near)
    shapely.prepare(inside)
    named: dict[str, dict] = {}
    minor = []
    for w in ways:
        coords = [(p["lon"], p["lat"]) for p in w.get("geometry", []) if p]
        if len(coords) < 2:
            continue
        line = LineString(coords)
        t = w.get("tags", {})
        raw = t.get("name", "")
        bn = t.get("name:bn") or (raw if BENGALI.search(raw) else None)
        en = t.get("name:en") or (raw if raw and not BENGALI.search(raw) else None)
        key = _norm_en(en) if en else (bn or "")
        if not key:
            minor.append(line)
            continue
        item = named.setdefault(key, {"en": en, "bn": bn, "lines": [], "osm_ids": []})
        item["en"] = item["en"] or en
        item["bn"] = item["bn"] or bn
        item["lines"].append(line)
        item["osm_ids"].append(w["id"])

    features, labels = [], []
    for key, item in named.items():
        merged = linemerge(MultiLineString(item["lines"]))
        merged = _clip(merged, near)  # keep the part in and just around Bangladesh
        if merged.is_empty:
            continue
        km = merged.length * KM_PER_DEG
        rank = 1 if km >= 150 else 2 if km >= 40 else 3
        tol = {1: 0.0015, 2: 0.0012, 3: 0.0008}[rank]
        geom = _r(merged.simplify(tol))
        if geom.is_empty:
            continue
        en = re.sub(r"\s+River$", "", item["en"]) if item["en"] else None
        bn = item["bn"]
        features.append({"type": "Feature", "geometry": mapping(geom), "properties": {"en": en, "bn": bn, "rank": rank, "km": round(km)}})
        # Label points spread along the longest piece: one per ~70 km, at most 4.
        parts = list(geom.geoms) if geom.geom_type == "MultiLineString" else [geom]
        longest = max(parts, key=lambda g: g.length)
        n = max(1, min(4, int(longest.length * KM_PER_DEG // 70)))
        for i in range(n):
            p = longest.interpolate((i + 0.5) / n, normalized=True)
            labels.append({"en": en, "bn": bn, "rank": rank, "at": [round(p.x, 4), round(p.y, 4)]})

    minor_feats = []
    for line in minor:
        clipped = _clip(line, inside)
        if clipped.is_empty or clipped.length * KM_PER_DEG < 3:
            continue
        minor_feats.append({"type": "Feature", "geometry": mapping(_r(clipped.simplify(0.0008))), "properties": {}})

    features.sort(key=lambda f: f["properties"]["rank"])
    sizes = {
        "rivers.json": _write(web_out / "rivers.json", {"type": "FeatureCollection", "features": features}),
        "rivers-minor.json": _write(web_out / "rivers-minor.json", {"type": "FeatureCollection", "features": minor_feats}),
        "river-labels.json": _write(web_out / "river-labels.json", labels),
    }
    counts = {
        "named_rivers": len(features),
        "by_rank": {r: sum(f["properties"]["rank"] == r for f in features) for r in (1, 2, 3)},
        "with_bangla_name": sum(bool(f["properties"]["bn"]) for f in features),
        "with_english_name": sum(bool(f["properties"]["en"]) for f in features),
        "unnamed_lines": len(minor_feats),
    }
    return sizes, counts


def build_places(archive: zipfile.ZipFile, web_out: Path):
    caps = json.loads(archive.read("bgd_admincapitals.geojson"))["features"]
    out = []
    for f in caps:
        p = f["properties"]
        lvl = p["adm_p_lvl"]
        if lvl not in (0, 1, 2):
            continue
        code = p["adm0_pcode"] if lvl == 0 else p["adm1_pcode"] if lvl == 1 else p["adm2_pcode"]
        out.append({"name": p["name"], "level": lvl, "pcode": code, "at": [round(p["x_coord"], 4), round(p["y_coord"], 4)]})
    return {"places.json": _write(web_out / "places.json", out)}, {"capitals": {lvl: sum(o["level"] == lvl for o in out) for lvl in (0, 1, 2)}}


def build_bangla_names(archive: zipfile.ZipFile, osm_admin: Path, web_out: Path):
    upazilas = json.loads(archive.read("bgd_admin3.geojson"))["features"]
    shapes = [(shape(f["geometry"]), f["properties"]) for f in upazilas]
    for s, _ in shapes:
        shapely.prepare(s)
    rels = [e for e in json.loads(osm_admin.read_text(encoding="utf-8"))["elements"] if e["tags"].get("admin_level") == "6" and "center" in e]
    names, rejected = {}, 0
    for rel in rels:
        t = rel["tags"]
        bn = t.get("name:bn") or (t.get("name") if BENGALI.search(t.get("name", "")) else None)
        en = t.get("name:en") or (t.get("name") if not BENGALI.search(t.get("name", "")) else None)
        if not bn or not en:
            continue
        pt = Point(rel["center"]["lon"], rel["center"]["lat"])
        hit = next((p for s, p in shapes if s.covers(pt)), None)
        if not hit:
            rejected += 1
            continue
        a = _norm_en(re.sub(r"(sub ?district|upazila|thana)", "", en, flags=re.I))
        b = _norm_en(hit["adm3_name"])
        # Second, independent check: the English names must agree (same start), not just the location.
        if not a or not b or a[:4] != b[:4]:
            rejected += 1
            continue
        names[hit["adm3_pcode"]] = re.sub(r"\s*উপজেলা$", "", bn).strip()
    return {"names-bn.json": _write(web_out / "names-bn.json", names)}, {"bangla_upazila_names": len(names), "of_upazilas": len(upazilas), "osm_upazilas_rejected": rejected}


# ---------- terrain ----------

TERRAIN_STEPS = [  # (upper bound m, RGB) — low ground in detail, where floods matter
    (2, (46, 111, 120)), (5, (93, 155, 150)), (10, (151, 193, 160)), (20, (204, 220, 170)),
    (50, (229, 216, 160)), (100, (214, 180, 128)), (300, (184, 140, 98)), (800, (150, 112, 86)), (1e9, (128, 98, 82)),
]


def _mosaic(dem_dir: Path):
    import rasterio
    from rasterio.merge import merge

    files = sorted(dem_dir.glob("Copernicus_DSM_COG_30_*_DEM.tif"))
    srcs = [rasterio.open(f) for f in files if f.stat().st_size > 10000]
    arr, transform = merge(srcs, bounds=(88.0, 20.5, 92.75, 26.7), nodata=-9999)
    for s in srcs:
        s.close()
    return arr[0].astype("float32"), transform, [f.name for f in files if f.stat().st_size > 10000]


def _tile_bounds(z, x, y):
    n = 2 ** z
    lon0 = x / n * 360 - 180
    lon1 = (x + 1) / n * 360 - 180
    lat0 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    lat1 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lon0, lat0, lon1, lat1


def build_terrain(dem_dir: Path, country, web_out: Path, zooms=(6, 7, 8, 9)):
    import rasterio
    from rasterio.features import geometry_mask

    dem, transform, files = _mosaic(dem_dir)
    dem[dem <= -9000] = np.nan
    inside = ~geometry_mask([mapping(country)], out_shape=dem.shape, transform=transform)
    res_deg = transform.a
    total = 0
    count = 0
    w, s, e, n = country.bounds
    for z in zooms:
        nt = 2 ** z
        x0 = int((w + 180) / 360 * nt)
        x1 = int((e + 180) / 360 * nt)
        y0 = int((1 - math.asinh(math.tan(math.radians(n))) / math.pi) / 2 * nt)
        y1 = int((1 - math.asinh(math.tan(math.radians(s))) / math.pi) / 2 * nt)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                lon0, lat0, lon1, lat1 = _tile_bounds(z, x, y)
                px = np.linspace(0, 1, 256, endpoint=False) + 0.5 / 256
                lons = lon0 + px * (lon1 - lon0)
                # Mercator rows: latitude of each pixel centre
                yy = (y + px) / nt
                lats = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * yy))))
                cols = ((lons - transform.c) / transform.a).astype(int)
                rows = ((lats - transform.f) / transform.e).astype(int)
                valid_c = (cols >= 0) & (cols < dem.shape[1])
                valid_r = (rows >= 0) & (rows < dem.shape[0])
                cc = np.clip(cols, 0, dem.shape[1] - 1)
                rr = np.clip(rows, 0, dem.shape[0] - 1)
                h = dem[rr[:, None], cc[None, :]]
                msk = inside[rr[:, None], cc[None, :]] & valid_r[:, None] & valid_c[None, :] & ~np.isnan(h)
                if not msk.any():
                    continue
                rgb = np.zeros((3, 256, 256), dtype="float32")
                hv = np.nan_to_num(h, nan=0.0)
                for upper, col in reversed(TERRAIN_STEPS):
                    sel = hv < upper
                    for k in range(3):
                        rgb[k][sel] = col[k]
                # Hillshade (sun from north-west, 45°), on a pixel grid of this zoom.
                m_per_px = 156543.03 * math.cos(math.radians((lat0 + lat1) / 2)) / nt
                gy, gx = np.gradient(hv, m_per_px)
                slope = np.arctan(np.hypot(gx, gy) * 2.0)
                aspect = np.arctan2(-gx, gy)
                az, alt = math.radians(315), math.radians(45)
                shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
                shade = np.clip(0.55 + 0.45 * shade, 0.55, 1.05)
                out = np.clip(rgb * shade[None], 0, 255).astype("uint8")
                alpha = np.where(msk, 255, 0).astype("uint8")
                path = web_out / "terrain" / str(z) / str(x) / f"{y}.png"
                path.parent.mkdir(parents=True, exist_ok=True)
                with rasterio.open(path, "w", driver="PNG", width=256, height=256, count=4, dtype="uint8") as dst:
                    dst.write(np.concatenate([out, alpha[None]], axis=0))
                total += path.stat().st_size
                count += 1
    for aux in (web_out / "terrain").rglob("*.aux.xml"):
        aux.unlink()
    return dem, transform, inside, {"terrain tiles": total}, {"terrain_tiles": count, "dem_files": len(files), "dem_res_deg": res_deg}


def terrain_stats(dem, transform, archive: zipfile.ZipFile, web_out: Path):
    from rasterio.features import geometry_mask

    stats = {}
    for lvl, code_key in ((2, "adm2_pcode"), (3, "adm3_pcode")):
        for f in json.loads(archive.read(f"bgd_admin{lvl}.geojson"))["features"]:
            g = shape(f["geometry"])
            w, s, e, n = g.bounds
            c0 = max(0, int((w - transform.c) / transform.a))
            c1 = min(dem.shape[1], int((e - transform.c) / transform.a) + 1)
            r0 = max(0, int((n - transform.f) / transform.e))
            r1 = min(dem.shape[0], int((s - transform.f) / transform.e) + 1)
            sub = dem[r0:r1, c0:c1]
            if sub.size == 0:
                continue
            from rasterio.transform import Affine
            t = Affine(transform.a, 0, transform.c + c0 * transform.a, 0, transform.e, transform.f + r0 * transform.e)
            m = ~geometry_mask([mapping(g)], out_shape=sub.shape, transform=t, all_touched=False)
            v = sub[m]
            v = v[~np.isnan(v)]
            if v.size < 10:
                continue
            stats[f["properties"][code_key]] = {
                "median_m": round(float(np.median(v)), 1),
                "below_5m": round(float((v < 5).mean()), 3),
                "below_10m": round(float((v < 10).mean()), 3),
                "cells": int(v.size),
            }
    return {"terrain-stats.json": _write(web_out / "terrain-stats.json", stats)}, {"terrain_stats_areas": len(stats)}


def main(a):
    web_out = Path(a.web_out)
    archive = zipfile.ZipFile(a.hdx_admin_zip)
    country = shape(json.loads(archive.read("bgd_admin0.geojson"))["features"][0]["geometry"]).buffer(0)
    sizes, counts = {}, {}
    for part in (
        build_rivers(Path(a.osm_rivers), country, web_out),
        build_places(archive, web_out),
        build_bangla_names(archive, Path(a.osm_admin), web_out),
    ):
        sizes.update(part[0])
        counts.update(part[1])
    if a.dem_dir:
        dem, transform, inside, s1, c1 = build_terrain(Path(a.dem_dir), country, web_out)
        sizes.update(s1)
        counts.update(c1)
        s2, c2 = terrain_stats(dem, transform, archive, web_out)
        sizes.update(s2)
        counts.update(c2)
    meta = {
        "sources": {
            "rivers, Bangla upazila names": "© OpenStreetMap contributors, ODbL 1.0 (Overpass API extract, 19 Nov 2026)",
            "headquarters": "COD-AB v03 admin capitals, BBS/OCHA via HDX, CC BY-IGO",
            "terrain": "Copernicus DEM GLO-90 (© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA)",
        },
        "counts": counts,
        "bytes": sizes,
    }
    _write(web_out / "context-meta.json", meta)
    print(json.dumps(meta, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--osm-rivers", required=True)
    ap.add_argument("--osm-admin", required=True)
    ap.add_argument("--hdx-admin-zip", required=True)
    ap.add_argument("--dem-dir")
    ap.add_argument("--web-out", required=True)
    main(ap.parse_args())
