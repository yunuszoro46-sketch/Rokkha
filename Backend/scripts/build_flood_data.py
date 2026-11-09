"""
Build Climate Shield's flood data for Bangladesh.

This is an offline data-preparation script. It needs the extra packages in
requirements-dev.txt (rasterio, pyogrio). The API itself does NOT need them:
it only reads the small GeoJSON/JSON files this script writes.

Inputs (download first, see data/flood/README.md for every URL):
    --hdx-admin-zip   HDX COD-AB "bgd_admin_boundaries.geojson.zip"
    --jrc-dir         folder with the JRC GloFAS flood-hazard tiles:
                          ID192_N30_E80_RP10_depth_reclass.tif
                          ID200_N30_E90_RP10_depth_reclass.tif
                          ID192_N30_E80_RP100_depth_reclass.tif
                          ID200_N30_E90_RP100_depth_reclass.tif
                          ID192_N30_E80_permanent_water.tif
                          ID200_N30_E90_permanent_water.tif
    --unosat-dir      folder with the UNOSAT event packages named <PACKAGE>.zip
                      (see EVENTS below)

Usage (from the Backend folder):
    python scripts/build_flood_data.py --hdx-admin-zip PATH --jrc-dir PATH --unosat-dir PATH

Outputs:
    data/boundaries/bangladesh_districts.geojson   64 districts (simplified)
    data/flood/district_flood_history.json         per-district observed flood history
    data/flood/flood_grid.npz                      ~90 m grid: per-event observed/flooded bits, JRC hazard

Method (observed floods):
    Every UNOSAT layer is rasterised onto the JRC 3-arc-second grid (~90 m).
    flooded = detected water AND NOT JRC permanent water
    This one rule is applied to every event, because older UNOSAT products map
    ALL water (rivers included) while newer ones separate pre-flood water.
"""

import argparse
import json
import os
import re
import tempfile
import zipfile
from datetime import date
from pathlib import Path

import numpy as np
import pyogrio
import pyogrio.raw as ogr_raw
import rasterio
import shapely
from rasterio.features import rasterize
from rasterio.merge import merge
from shapely.geometry import mapping, shape

# Read each multi-part polygon without GDAL re-assembling its holes (very slow
# for national layers). Holes are rebuilt below with an even-odd fill.
os.environ["OGR_ORGANIZE_POLYGONS"] = "SKIP"

BACKEND = Path(__file__).resolve().parent.parent
DATA = BACKEND / "data"

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------

SIMPLIFY_DEGREES = 0.0005          # ~50 m; max border shift measured at ~72 m
COORDINATE_DECIMALS = 5            # ~1 m
FLOOD_WATER_CLASSES = {1, 2, 3, 4, 99}
# 0 pre-flood water, 6 possibly saturated soil, 9 aquaculture, 14 tsunami
EXCLUDED_LAYER_PREFIXES = ("NOAA_",)   # 375 m VIIRS products: too coarse

# A district counts as "observed" in an event when at least this share of it
# was inside the satellite analysis extent, and as "flooded" when at least
# this share of its observed land was flood water.
MIN_OBSERVED_SHARE = 0.5
MIN_FLOODED_SHARE = 0.02


UNOSAT_HDX = "https://data.humdata.org/organization/unosat"

EVENTS = [
    {
        "event_id": "2016-07-monsoon",
        "name": "Monsoon flood, central and eastern Bangladesh",
        "start": "2016-06-30", "end": "2016-07-24",
        "packages": ["FL20160725BGD"],
    },
    {
        "event_id": "2017-05-cyclone-mora",
        "name": "Cyclone Mora, Chattogram and Cox's Bazar",
        "start": "2017-05-30", "end": "2017-06-01",
        "packages": ["TC20170529BGD"],
    },
    {
        "event_id": "2017-08-monsoon",
        "name": "Monsoon flood, central, northern and southern Bangladesh",
        "start": "2017-08-12", "end": "2017-08-22",
        "packages": ["FL20170815BGD"],
    },
    {
        "event_id": "2018-06-sylhet",
        "name": "Flash flood, Sylhet Division",
        "start": "2018-06-15", "end": "2018-06-15",
        "packages": ["FL20180619BGD"],
    },
    {
        "event_id": "2020-05-cyclone-amphan",
        "name": "Cyclone Amphan, Khulna Division",
        "start": "2020-05-25", "end": "2020-05-31",
        "packages": ["TC20200518BGD"],
    },
    {
        "event_id": "2020-07-monsoon",
        "name": "Monsoon flood, nationwide",
        "start": "2020-07-09", "end": "2020-08-08",
        "packages": ["FL20200713BGD"],
    },
    {
        "event_id": "2021-07-chattogram",
        "name": "Flood, Chattogram Division",
        "start": "2021-07-27", "end": "2021-08-10",
        "packages": ["FL20210729BGD"],
    },
    {
        "event_id": "2022-05-northeast",
        "name": "Flood, Sylhet and north-east Bangladesh",
        "start": "2022-05-25", "end": "2022-06-21",
        "packages": ["FL20220525BGD"],
    },
    {
        "event_id": "2024-05-cyclone-remal",
        "name": "Cyclone Remal, southern Bangladesh",
        "start": "2024-06-01", "end": "2024-06-01",
        "packages": ["FL20240502BGD-3865", "TC20240502BGD-3878"],
    },
    {
        "event_id": "2024-06-monsoon",
        "name": "Monsoon flood, Sylhet then nationwide",
        "start": "2024-06-19", "end": "2024-07-23",
        "packages": ["TC20240502BGD-3885", "TC20240502BGD-3897", "TC20240502BGD-3903"],
    },
    {
        "event_id": "2024-08-eastern",
        "name": "Flash flood, eastern Bangladesh",
        "start": "2024-08-18", "end": "2024-09-04",
        "packages": ["FL20240825BGD"],
    },
]



# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def round_coordinates(value):
    if isinstance(value, (list, tuple)):
        return [round_coordinates(item) for item in value]
    return round(value, COORDINATE_DECIMALS)


def clean_geometry(geometry):
    geometry = shapely.make_valid(geometry)
    if geometry.geom_type == "GeometryCollection":
        polygons = [g for g in shapely.get_parts(geometry) if g.geom_type in ("Polygon", "MultiPolygon")]
        geometry = shapely.union_all(polygons) if polygons else shapely.Polygon()
    return geometry


def to_geojson_geometry(geometry):
    """Round coordinates, then re-check validity: rounding can make a
    valid polygon touch itself. Returns a GeoJSON geometry dict."""
    rounded = shape({
        "type": geometry.geom_type,
        "coordinates": round_coordinates(mapping(geometry)["coordinates"]),
    })
    if not rounded.is_valid:
        rounded = clean_geometry(rounded)
    if not rounded.is_valid or rounded.is_empty:
        raise ValueError("Geometry invalid after rounding")
    return {
        "type": rounded.geom_type,
        "coordinates": round_coordinates(mapping(rounded)["coordinates"]),
    }


def build_districts(hdx_admin_zip):
    archive = zipfile.ZipFile(hdx_admin_zip)
    source = json.loads(archive.read("bgd_admin2.geojson"))["features"]
    features = []
    for feature in sorted(source, key=lambda f: f["properties"]["adm2_pcode"]):
        p = feature["properties"]
        geometry = shape(feature["geometry"]).simplify(SIMPLIFY_DEGREES, preserve_topology=True)
        if not geometry.is_valid:
            raise ValueError(f"Invalid simplified district: {p['adm2_name']}")
        features.append({
            "type": "Feature",
            "id": p["adm2_pcode"],
            "geometry": to_geojson_geometry(geometry),
            "properties": {
                "name": p["adm2_name"],
                "pcode": p["adm2_pcode"],
                "admin_level": 2,
                "parent_name": p["adm1_name"],
                "parent_pcode": p["adm1_pcode"],
                "area_sqkm": round(p["area_sqkm"], 2),
                "valid_on": p["valid_on"],
                "version": p["version"],
            },
        })
    return {"type": "FeatureCollection", "features": features}


def mosaic(paths, bounds):
    sources = [rasterio.open(p) for p in paths]
    array, transform = merge(sources, bounds=bounds)
    nodata = sources[0].nodata
    for s in sources:
        s.close()
    return array[0], transform, nodata


def rings_to_mask(geometry_wkbs, shape_, transform):
    """Even-odd fill: every ring toggles the cells it encloses, so holes
    (rings inside rings) come out correctly without assembling polygons."""
    counts = np.zeros(shape_, dtype=np.uint16)
    rings = []
    for wkb in geometry_wkbs:
        if wkb is None:
            continue
        geometry = shapely.from_wkb(wkb)
        for part in shapely.get_parts(geometry):
            if part.geom_type != "Polygon":
                continue
            rings.append(shapely.Polygon(part.exterior))
            rings.extend(shapely.Polygon(r) for r in part.interiors)
    if rings:
        counts = rasterize(
            ((ring, 1) for ring in rings),
            out_shape=shape_, transform=transform,
            merge_alg=rasterio.enums.MergeAlg.add, dtype="uint16",
        )
    return (counts % 2).astype(bool)


def package_sources(unosat_dir, package, work_dir):
    target = work_dir / package
    if not target.is_dir():
        zipfile.ZipFile(unosat_dir / f"{package}.zip").extractall(target)
    gdbs = sorted(str(p) for p in target.rglob("*.gdb"))
    if gdbs:
        return [(gdb, name) for gdb in gdbs for name, kind in pyogrio.list_layers(gdb) if kind is not None]
    return [(str(p), None) for p in sorted(target.rglob("*.shp"))]


def layer_label(path, layer):
    return layer or Path(path).stem


def is_analysis_layer(label):
    # Tolerates UNOSAT's own typo "AnglysisExtent" (2024 Sunamganj layers).
    return re.search(r"an\w{0,2}lysis", label.lower()) is not None


# Impact / context layers that are not water detections: building damage,
# flooded building footprints, affected roads and cropland, cloud masks.
NON_WATER_WORDS = (
    "aoi", "damage", "cloud", "obstruction", "cropland", "wetland",
    "structure", "road",
)


def is_water_layer(label):
    lower = label.lower()
    if label.startswith(EXCLUDED_LAYER_PREFIXES):
        return False
    if is_analysis_layer(label) or any(word in lower for word in NON_WATER_WORDS):
        return False
    return "water" in lower or "flood" in lower


def image_date(label):
    # Layer names carry the image date, e.g. "S1_20220525_FloodExtent_NE".
    match = re.search(r"(19|20)\d{6}", label)
    return match.group(0) if match else None


def read_layer(path, layer, shape_, transform, bounds, class_filter):
    meta, _, geometries, fields = ogr_raw.read(path, layer=layer, bbox=bounds)
    names = list(meta["fields"])
    if class_filter and "Water_Class" in names:
        classes = fields[names.index("Water_Class")]
        keep = [g for g, c in zip(geometries, classes) if c is not None and not np.isnan(c) and int(c) in FLOOD_WATER_CLASSES]
    else:
        keep = list(geometries)
    return rings_to_mask(keep, shape_, transform), len(keep), len(geometries)


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------

def main(args):
    unosat_dir = Path(args.unosat_dir)
    jrc_dir = Path(args.jrc_dir)
    work_dir = Path(args.work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    # 1. Districts -------------------------------------------------------
    districts = build_districts(args.hdx_admin_zip)
    out = DATA / "boundaries" / "bangladesh_districts.geojson"
    out.write_text(json.dumps(districts, separators=(",", ":")), encoding="utf-8")
    print(f"[districts] wrote {len(districts['features'])} districts to {out}")

    district_geoms = [shape(f["geometry"]) for f in districts["features"]]
    bounds = shapely.union_all(district_geoms).buffer(0.01).bounds

    # 2. Common grid = JRC grid ---------------------------------------------
    permanent, transform, nodata = mosaic(sorted(jrc_dir.glob("*_permanent_water.tif")), bounds)
    permanent = permanent == 1
    grid_shape = permanent.shape
    print(f"[grid] {grid_shape[1]} x {grid_shape[0]} cells, permanent water cells: {int(permanent.sum())}")

    district_ids = rasterize(
        ((g, i + 1) for i, g in enumerate(district_geoms)),
        out_shape=grid_shape, transform=transform, dtype="uint8",
    )
    n_districts = len(district_geoms)
    land = ~permanent

    # Real area of one grid cell in km2. Cells get narrower towards the
    # poles (longitude shrinks by cos(latitude)), so compute it per row.
    row_latitudes = transform.f + (np.arange(grid_shape[0]) + 0.5) * transform.e
    cell_width_km = abs(transform.a) * 111.320 * np.cos(np.radians(row_latitudes))
    cell_height_km = abs(transform.e) * 110.574
    cell_area_sqkm = (cell_width_km * cell_height_km)[:, None]

    # 3. Observed events -------------------------------------------------------
    # One bit per event: bit k set = cell observed / flooded in event k.
    observed_mask = np.zeros(grid_shape, dtype=np.uint16)
    flooded_mask = np.zeros(grid_shape, dtype=np.uint16)
    event_rows = []
    skipped_events = []
    history = {i: [] for i in range(n_districts)}

    for event in EVENTS:
        water = np.zeros(grid_shape, dtype=bool)
        analysed = np.zeros(grid_shape, dtype=bool)
        used_layers, skipped_layers = [], []

        window = (event["start"].replace("-", ""), event["end"].replace("-", ""))

        def in_window(label):
            # UNOSAT packages are cumulative: a later package can repeat
            # layers from an earlier event. Keep only this event's dates.
            date_ = image_date(label)
            return date_ is None or window[0] <= date_ <= window[1]

        for package in event["packages"]:
            sources = [
                (p, l) for p, l in package_sources(unosat_dir, package, work_dir)
                if in_window(layer_label(p, l))
            ]
            water_sources = [(p, l) for p, l in sources if is_water_layer(layer_label(p, l))]
            water_dates = {image_date(layer_label(p, l)) for p, l in water_sources}

            for path, layer in water_sources:
                label = layer_label(path, layer)
                mask, kept, total = read_layer(path, layer, grid_shape, transform, bounds, class_filter=True)
                water |= mask
                used_layers.append(f"{package}/{label} ({kept}/{total} features)")

            for path, layer in sources:
                label = layer_label(path, layer)
                if not is_analysis_layer(label):
                    continue
                # Only extents that belong to a water analysis count as
                # "observed": same image date, or no date (package-wide).
                # Damage-survey extents (no water layer) must not count,
                # or unchecked areas would look "observed dry".
                date_ = image_date(label)
                if date_ is not None and date_ not in water_dates:
                    skipped_layers.append(f"{package}/{label}")
                    continue
                mask, _, _ = read_layer(path, layer, grid_shape, transform, bounds, class_filter=False)
                analysed |= mask

        if not analysed.any():
            # Without an analysis extent we cannot tell "dry" from "not
            # looked at", so the event cannot be used.
            print(f"[event] {event['event_id']}: no analysis extent, skipped")
            skipped_events.append({**event, "reason": "no analysis extent"})
            continue

        if not water.any():
            # Every water detection was excluded (e.g. only "possibly
            # saturated soil"). Counting its analysis area as observed would
            # record flooded places as "observed dry", so skip the event.
            print(f"[event] {event['event_id']}: no usable flood-water layers, skipped")
            skipped_events.append({**event, "reason": "no usable flood-water classes (only excluded classes such as 6 'possibly saturated soil')"})
            continue

        flooded = water & analysed & land
        observed = analysed & land

        bit = np.uint16(1 << len(event_rows))
        observed_mask[observed] |= bit
        flooded_mask[flooded] |= bit

        obs_cells = np.bincount(district_ids[observed], minlength=n_districts + 1)
        flood_cells = np.bincount(district_ids[flooded], minlength=n_districts + 1)
        land_cells = np.bincount(district_ids[land], minlength=n_districts + 1)

        for i in range(n_districts):
            observed_share = obs_cells[i + 1] / land_cells[i + 1] if land_cells[i + 1] else 0.0
            flooded_share = flood_cells[i + 1] / obs_cells[i + 1] if obs_cells[i + 1] else 0.0
            was_observed = observed_share >= MIN_OBSERVED_SHARE
            history[i].append({
                "event_id": event["event_id"],
                "observed_share": round(float(observed_share), 4),
                "flooded_share": round(float(flooded_share), 4) if was_observed else None,
                "status": (
                    "not_observed" if not was_observed
                    else "flooded" if flooded_share >= MIN_FLOODED_SHARE
                    else "not_flooded"
                ),
            })

        event_rows.append({
            **{k: event[k] for k in ("event_id", "name", "start", "end")},
            "unosat_packages": event["packages"],
            "layers_used": used_layers,
            "analysis_extents_skipped": skipped_layers,
            "flooded_area_sqkm": round(float((flooded * cell_area_sqkm).sum()), 1),
        })
        print(f"[event] {event['event_id']}: {len(used_layers)} water layers, "
              f"observed {observed.sum()} cells, flooded {flooded.sum()} cells")

    # 4. District history -------------------------------------------------------
    district_rows = []
    for i, feature in enumerate(districts["features"]):
        rows = history[i]
        flooded_events = [r["event_id"] for r in rows if r["status"] == "flooded"]
        observed_events = [r["event_id"] for r in rows if r["status"] != "not_observed"]
        shares = [r["flooded_share"] for r in rows if r["flooded_share"] is not None]
        district_rows.append({
            "pcode": feature["id"],
            "name": feature["properties"]["name"],
            "division": feature["properties"]["parent_name"],
            "events_observed": len(observed_events),
            "events_flooded": len(flooded_events),
            "max_flooded_share": round(max(shares), 4) if shares else None,
            "flooded_event_ids": flooded_events,
            "events": rows,
        })

    ranked = sorted(
        district_rows,
        key=lambda r: (r["events_flooded"], r["max_flooded_share"] or 0),
        reverse=True,
    )
    for rank, row in enumerate(ranked, start=1):
        row["rank"] = rank

    history_doc = {
        "generated_on": date.today().isoformat(),
        "method": {
            "grid": "JRC GloFAS 3 arc-second grid (~90 m)",
            "flooded_cell": "UNOSAT detected water AND NOT JRC permanent water",
            "water_classes_used": sorted(FLOOD_WATER_CLASSES),
            "excluded_layers": "NOAA VIIRS (375 m) products",
            "observed_rule": f"district observed if >= {MIN_OBSERVED_SHARE:.0%} of its land was inside the analysis extent",
            "flooded_rule": f"district flooded if >= {MIN_FLOODED_SHARE:.0%} of its observed land was flood water",
        },
        "events": event_rows,
        "skipped_events": [
            {k: e[k] for k in ("event_id", "name", "start", "end", "packages", "reason")}
            for e in skipped_events
        ],
        "districts": sorted(district_rows, key=lambda r: r["rank"]),
    }
    out = DATA / "flood" / "district_flood_history.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(history_doc, indent=1), encoding="utf-8")
    print(f"[history] wrote {out}")

    # 5. Flood grid -------------------------------------------------------------
    # Stored as compressed numpy arrays on the ~90 m JRC grid. Polygons of
    # fragmented flood patterns were ~38 MB for only 9 districts; the grid
    # covers all of Bangladesh exactly in a few MB, and looking up a point is
    # just a row/column calculation.
    hazard_byte = np.zeros(grid_shape, dtype=np.uint8)
    for rp, shift in (("RP10", 0), ("RP100", 3)):
        array, rp_transform, _ = mosaic(sorted(jrc_dir.glob(f"*_{rp}_depth_reclass.tif")), bounds)
        if array.shape != grid_shape or rp_transform != transform:
            raise ValueError(f"{rp} grid does not match the permanent-water grid")
        depth_class = np.where((array >= 1) & (array <= 4), array, 0).astype(np.uint8)
        hazard_byte |= depth_class << shift
    hazard_byte |= permanent.astype(np.uint8) << 6

    # Only keep values inside Bangladesh's districts; zero elsewhere.
    outside = district_ids == 0
    hazard_byte[outside] = 0
    observed_mask[outside] = 0
    flooded_mask[outside] = 0

    out = DATA / "flood" / "flood_grid.npz"
    np.savez_compressed(
        out,
        # Affine transform (a, b, c, d, e, f): lon = c + col*a, lat = f + row*e
        transform=np.array(tuple(transform)[:6], dtype=np.float64),
        event_ids=np.array([e["event_id"] for e in event_rows]),
        observed_mask=observed_mask,
        flooded_mask=flooded_mask,
        # bits 0-2: JRC 10-year depth class, bits 3-5: 100-year depth class,
        # bit 6: JRC permanent water
        hazard=hazard_byte,
    )
    print(f"[grid] wrote {out} ({out.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--hdx-admin-zip", required=True)
    parser.add_argument("--jrc-dir", required=True)
    parser.add_argument("--unosat-dir", required=True)
    parser.add_argument(
        "--work-dir",
        default=os.path.join(tempfile.gettempdir(), "climate_shield_flood_build"),
        help="where UNOSAT packages are unzipped (default: system temp folder)",
    )
    main(parser.parse_args())
