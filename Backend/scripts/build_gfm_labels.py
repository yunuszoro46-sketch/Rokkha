"""
Build satellite flood observations per district from Copernicus GFM.

GFM (Global Flood Monitoring, Copernicus Emergency Management Service) maps
flood water on every Sentinel-1 radar pass since 2015. For each district and
each pass (UTC day) this script measures:

    observed share  = part of the district's land the satellite could map
                      (covered by the pass AND not in GFM's exclusion mask)
    flooded share   = part of the OBSERVED land that GFM marked as flood
                      (GFM already removes normal permanent + seasonal water)
    advisory share  = part of the observed land with a GFM advisory flag
                      (dry soil / frost / wind-roughened water: use with care)

These are OBSERVATIONS, the candidate labels for the flood model. Nothing here
is a forecast or a modelled hazard.

This is an offline data-preparation script: it needs requirements-dev.txt
(rasterio). The API only reads the JSON file it writes. No account is needed;
files are read over HTTP from EODC's open GFM archive (cloud-optimised GeoTIFF,
only the part over Bangladesh is read).

Usage (from the Backend folder):
    python scripts/build_gfm_labels.py fetch --start 2022-07 --end 2022-07
    python scripts/build_gfm_labels.py fetch --start 2016-04 --end 2024-11
    python scripts/build_gfm_labels.py assemble

`fetch` saves one cache file per month in data/labels/.cache/ (not committed)
and skips months already cached, so an interrupted run can simply be started
again. `assemble` combines the cache into data/labels/district_flood_observations.json.
"""

import argparse
import json
import os
import sys
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path

# GDAL settings for reading cloud-optimised GeoTIFFs over HTTP. Without them
# GDAL lists the remote "folder" on every open and makes many small requests.
os.environ.update(
    GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
    CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
    GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
    GDAL_HTTP_MULTIPLEX="YES",
    GDAL_HTTP_VERSION="2",
    GDAL_HTTP_MAX_RETRY="3",
    GDAL_HTTP_RETRY_DELAY="5",
    VSI_CACHE="TRUE",
)

import warnings  # noqa: E402

import httpx  # noqa: E402
import numpy as np  # noqa: E402
import rasterio  # noqa: E402
from rasterio.features import rasterize  # noqa: E402
from rasterio.warp import transform_bounds, transform_geom  # noqa: E402
from rasterio.errors import NotGeoreferencedWarning, RasterioIOError  # noqa: E402
from rasterio.windows import Window, from_bounds  # noqa: E402

# rasterize() works on an internal in-memory raster and warns about it even
# though it receives a proper transform (checked: Sunamganj lands in place).
warnings.filterwarnings("ignore", category=NotGeoreferencedWarning)

BACKEND = Path(__file__).resolve().parent.parent
DATA = BACKEND / "data"
DISTRICTS_FILE = DATA / "boundaries" / "bangladesh_districts.geojson"
LABELS_DIR = DATA / "labels"
CACHE_DIR = LABELS_DIR / ".cache"
OUTPUT_FILE = LABELS_DIR / "district_flood_observations.json"

STAC_SEARCH = "https://stac.eodc.eu/api/v1/search"
COLLECTION = "GFM"
USER_AGENT = "ClimateShield-Rokkha/0.4 (AI Builders Congress; offline label build)"

# Bangladesh with a small margin, lon/lat.
BANGLADESH_BBOX = (88.0, 20.5, 92.7, 26.7)

# Read GFM's 20 m rasters at 1/4 resolution (80 m), close to the 90 m flood
# grid of Milestone 14. Shares per district barely change; reading is lighter.
OVERVIEW_FACTOR = 4

# Rows where the pass saw less than this share of a district are not stored:
# a sliver at the edge of a pass says nothing about the district.
MIN_STORED_OBSERVED_SHARE = 0.05

WORKERS = 8

# Label rule (chosen after comparing with UNOSAT and the Sunamganj trial; see
# data/labels/README.md): a pass is a FLOOD observation for a district when it
# saw at least half the district and at least 10 % of what it saw was flood.
LABEL_MIN_OBSERVED_SHARE = 0.5
LABEL_FLOODED_SHARE = 0.10

# GFM pixel values (GFM Product User Manual, sections 3.1, 3.4, 3.6).
NO_DATA = 255          # all layers: not covered by this Sentinel-1 scene
FLOOD = 1              # ensemble_flood_extent: 1 = flood, 0 = no flood
EXCLUDED = 1           # exclusion_mask: 1 = flood mapping not possible here
# advisory_flags: 0 = none, 1 = low regional backscatter, 2 = rough water, 3 = both

ATTRIBUTION = (
    "Contains modified Copernicus Emergency Management Service information "
    "[2016-2024] (Global Flood Monitoring, GFM)."
)

_print_lock = threading.Lock()


def log(*parts):
    with _print_lock:
        print(*parts, flush=True)


# ------------------------------------------------------------------
# Districts
# ------------------------------------------------------------------

def load_districts():
    features = json.loads(DISTRICTS_FILE.read_text())["features"]
    districts = [
        {
            "pcode": f["properties"]["pcode"],
            "name": f["properties"]["name"],
            "division": f["properties"]["parent_name"],
            "geometry": f["geometry"],
        }
        for f in features
    ]
    return sorted(districts, key=lambda d: d["pcode"])


# ------------------------------------------------------------------
# Counting (pure numpy, unit-tested)
# ------------------------------------------------------------------

def pass_counts(labels, flood, exclusion, advisory, district_count):
    """Per-district pixel counts for one pass on one tile.

    labels      int array, 0 = outside every district, k = district index k-1
    flood       GFM ensemble flood extent (0, 1, 255)
    exclusion   GFM exclusion mask (0, 1, 255)
    advisory    GFM advisory flags (0-3, 255)

    Returns three int arrays of length district_count:
    observed, flooded, flagged.
    """
    observed = (labels > 0) & (flood != NO_DATA) & (exclusion == 0)
    flooded = observed & (flood == FLOOD)
    flagged = observed & (advisory != 0) & (advisory != NO_DATA)

    def count(mask):
        return np.bincount(labels[mask], minlength=district_count + 1)[1:]

    return count(observed), count(flooded), count(flagged)


def land_counts(labels, district_count):
    return np.bincount(labels.ravel(), minlength=district_count + 1)[1:]


def shares(land, observed, flooded, flagged, advisory_known=None):
    """Shares for one district-pass, rounded for storage.

    advisory_known: observed pixels whose advisory flag is known (some archive
    files are missing); defaults to all observed pixels.
    """
    if advisory_known is None:
        advisory_known = observed
    observed_share = observed / land if land else 0.0
    flooded_share = flooded / observed if observed else None
    advisory_share = flagged / advisory_known if advisory_known else None

    def rnd(value):
        return None if value is None else round(float(value), 4)

    return rnd(observed_share), rnd(flooded_share), rnd(advisory_share)


# ------------------------------------------------------------------
# Tiles: window over Bangladesh + district label raster, computed once
# ------------------------------------------------------------------

_tiles = {}
_tiles_lock = threading.Lock()


def tile_grid(src, tile, districts):
    with _tiles_lock:
        if tile in _tiles:
            return _tiles[tile]

    bounds = transform_bounds("EPSG:4326", src.crs, *BANGLADESH_BBOX)
    window = from_bounds(*bounds, transform=src.transform)
    full = Window(0, 0, src.width, src.height)
    window = window.intersection(full)

    # Snap to whole multiples of the overview factor so every read lines up.
    f = OVERVIEW_FACTOR
    col0 = int(window.col_off // f) * f
    row0 = int(window.row_off // f) * f
    col1 = min(src.width, int(-(-(window.col_off + window.width) // f)) * f)
    row1 = min(src.height, int(-(-(window.row_off + window.height) // f)) * f)
    window = Window(col0, row0, col1 - col0, row1 - row0)
    out_shape = (int(window.height // f), int(window.width // f))
    transform = src.window_transform(window) * rasterio.Affine.scale(f, f)

    shapes = [
        (transform_geom("EPSG:4326", src.crs, d["geometry"]), index + 1)
        for index, d in enumerate(districts)
    ]
    labels = rasterize(shapes, out_shape=out_shape, transform=transform, fill=0, dtype="int32")

    grid = {"window": window, "out_shape": out_shape, "labels": labels,
            "land": land_counts(labels, len(districts))}
    with _tiles_lock:
        _tiles[tile] = grid
    return grid


# ------------------------------------------------------------------
# STAC search
# ------------------------------------------------------------------

def search_month(client, year, month):
    start = date(year, month, 1)
    end = date(year + (month == 12), month % 12 + 1, 1)
    body = {
        "collections": [COLLECTION],
        "bbox": list(BANGLADESH_BBOX),
        "datetime": f"{start}T00:00:00Z/{end}T00:00:00Z",
        "limit": 200,
    }
    items = []
    response = _post_json(client, STAC_SEARCH, body)
    while True:
        items += response["features"]
        nxt = next((l for l in response.get("links", []) if l.get("rel") == "next"), None)
        if not nxt:
            break
        if nxt.get("method", "GET").upper() == "POST":
            response = _post_json(client, nxt["href"], nxt.get("body", body))
        else:
            response = _get_json(client, nxt["href"])
    # The end bound is inclusive in STAC; keep this month only.
    return [i for i in items if i["properties"]["datetime"][:7] == f"{year:04d}-{month:02d}"]


def _post_json(client, url, body):
    return _retry(lambda: client.post(url, json=body))


def _get_json(client, url):
    return _retry(lambda: client.get(url))


def _retry(call):
    for attempt in range(4):
        try:
            response = call()
            if response.status_code < 500 and response.status_code != 429:
                response.raise_for_status()
                return response.json()
        except httpx.TransportError:
            pass
        time.sleep(5 * 2 ** attempt)
    raise RuntimeError("STAC search failed repeatedly")


# ------------------------------------------------------------------
# One pass (UTC day) on one tile
# ------------------------------------------------------------------

def read_layer(item, asset, grid):
    href = item["assets"][asset]["href"]
    with rasterio.open(href) as src:
        return src.read(1, window=grid["window"], out_shape=grid["out_shape"],
                        boundless=True, fill_value=NO_DATA)


def process_group(day, tile, scenes, districts):
    n = len(districts)
    with rasterio.open(scenes[0]["assets"]["ensemble_flood_extent"]["href"]) as src:
        grid = tile_grid(src, tile, districts)
    labels = grid["labels"]

    observed = np.zeros(labels.shape, bool)
    flooded = np.zeros(labels.shape, bool)
    flagged = np.zeros(labels.shape, bool)
    advisory_known = np.zeros(labels.shape, bool)
    used, skipped, advisory_missing = 0, [], []

    for item in scenes:
        if not all(a in item["assets"] for a in ("ensemble_flood_extent", "exclusion_mask")):
            skipped.append({"id": item["id"], "reason": "flood or exclusion layer not listed"})
            continue
        flood = read_layer(item, "ensemble_flood_extent", grid)
        covered = (labels > 0) & (flood != NO_DATA)
        if not covered.any():
            continue  # this scene lies outside Bangladesh's districts
        exclusion = read_layer(item, "exclusion_mask", grid)
        obs = covered & (exclusion == 0)
        # Scenes of one pass overlap slightly: combine pixel masks, never add counts.
        observed |= obs
        flooded |= obs & (flood == FLOOD)
        used += 1

        # Advisory flags only qualify the result. Some archive files are
        # missing (HTTP 404); then the advisory share uses the other pixels.
        try:
            advisory = read_layer(item, "advisory_flags", grid) if "advisory_flags" in item["assets"] else None
        except RasterioIOError as error:
            if "404" not in str(error):
                raise
            advisory = None
        if advisory is None:
            advisory_missing.append(item["id"])
            continue
        known = obs & (advisory != NO_DATA)
        advisory_known |= known
        flagged |= known & (advisory != 0)

    if not used:
        return None

    def count(mask):
        return np.bincount(labels[mask], minlength=n + 1)[1:]

    return {
        "day": day, "tile": tile, "scenes": used, "skipped": skipped,
        "advisory_missing": advisory_missing,
        "observed": count(observed).tolist(),
        "flooded": count(flooded).tolist(),
        "flagged": count(flagged).tolist(),
        "advisory_known": count(advisory_known).tolist(),
        "land": grid["land"].tolist(),
    }


# ------------------------------------------------------------------
# fetch: one cache file per month
# ------------------------------------------------------------------

def months_between(start, end):
    y, m = start
    while (y, m) <= end:
        yield y, m
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


def fetch_month(client, year, month, districts):
    path = CACHE_DIR / f"{year:04d}-{month:02d}.json"
    if path.exists():
        log(f"{year}-{month:02d}: cached, skipped")
        return

    t0 = time.time()
    items = search_month(client, year, month)
    groups = defaultdict(list)
    for item in items:
        groups[(item["properties"]["datetime"][:10], item["properties"]["Equi7Tile"])].append(item)

    results, errors = [], []
    with ThreadPoolExecutor(WORKERS) as pool:
        futures = {pool.submit(process_group, day, tile, scenes, districts): (day, tile)
                   for (day, tile), scenes in groups.items()}
        for future in as_completed(futures):
            try:
                result = future.result()
            except Exception as error:  # network failure on one group
                errors.append(f"{futures[future]}: {error}")
                continue
            if result:
                results.append(result)

    if errors:
        # Do not cache an incomplete month; running fetch again retries it.
        log(f"{year}-{month:02d}: {len(errors)} groups failed, NOT cached. First: {errors[0]}")
        return

    versions = sorted({i["properties"].get("processing:version", "unknown") for i in items})
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "month": f"{year:04d}-{month:02d}",
        "pcodes": [d["pcode"] for d in districts],
        "scene_tiles_found": len(items),
        "processing_versions": versions,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "groups": sorted(results, key=lambda r: (r["day"], r["tile"])),
    }
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload))
    tmp.replace(path)
    log(f"{year}-{month:02d}: {len(items)} scene-tiles, {len(results)} pass-tiles over districts, "
        f"{time.time() - t0:.0f}s")


# ------------------------------------------------------------------
# assemble: cache -> data/labels/district_flood_observations.json
# ------------------------------------------------------------------

def assemble(districts):
    caches = sorted(CACHE_DIR.glob("*.json"))
    if not caches:
        sys.exit("No cached months. Run 'fetch' first.")

    pcodes = [d["pcode"] for d in districts]
    n = len(districts)
    land_by_tile = {}
    per_day = defaultdict(lambda: {"observed": np.zeros(n, np.int64), "flooded": np.zeros(n, np.int64),
                                   "flagged": np.zeros(n, np.int64), "advisory_known": np.zeros(n, np.int64),
                                   "scenes": 0})
    months, versions, skipped, advisory_missing = [], set(), [], []

    for path in caches:
        cache = json.loads(path.read_text())
        if cache["pcodes"] != pcodes:
            sys.exit(f"{path.name} was built with other districts; delete it and fetch again.")
        months.append(cache["month"])
        versions.update(cache["processing_versions"])
        for g in cache["groups"]:
            land_by_tile[g["tile"]] = np.array(g["land"], np.int64)
            day = per_day[g["day"]]
            day["observed"] += g["observed"]
            day["flooded"] += g["flooded"]
            day["flagged"] += g["flagged"]
            day["advisory_known"] += g.get("advisory_known", g["observed"])
            day["scenes"] += g["scenes"]
            skipped += g["skipped"]
            advisory_missing += g.get("advisory_missing", [])

    # Tiles do not overlap, so a district's land is the sum over every tile.
    land = sum(land_by_tile.values())

    rows = {p: [] for p in pcodes}
    for day in sorted(per_day):
        d = per_day[day]
        for i, pcode in enumerate(pcodes):
            if not d["observed"][i]:
                continue
            observed_share, flooded_share, advisory_share = shares(
                land[i], d["observed"][i], d["flooded"][i], d["flagged"][i], d["advisory_known"][i])
            if observed_share < MIN_STORED_OBSERVED_SHARE:
                continue
            rows[pcode].append([day, observed_share, flooded_share, advisory_share])

    output = {
        "generated_on": date.today().isoformat(),
        "source": "Copernicus Emergency Management Service - Global Flood Monitoring (GFM), "
                  "Sentinel-1 ensemble flood extent, EODC open archive (stac.eodc.eu, collection GFM)",
        "license": "CEMS-FLOODS licence: free reproduction, distribution and adaptation with attribution; "
                   "information only, not a flood warning; no warranty.",
        "attribution": ATTRIBUTION,
        "kind": "observed",
        "months": months,
        "gfm_processing_versions": sorted(versions),
        "method": {
            "unit": "one row per district per Sentinel-1 pass (UTC day of acquisition)",
            "resolution_m": 20 * OVERVIEW_FACTOR,
            "observed_share": "district land covered by the pass and not in the GFM exclusion mask / district land",
            "flooded_share": "GFM flood pixels / observed pixels (GFM removes normal permanent and monthly seasonal water)",
            "advisory_share": "observed pixels with a GFM advisory flag / observed pixels whose advisory flag is "
                              "known (null when no advisory file exists for the pass)",
            "min_stored_observed_share": MIN_STORED_OBSERVED_SHARE,
            "scenes_of_one_pass": "pixel masks combined (OR), never added",
            "district_boundaries": "data/boundaries/bangladesh_districts.geojson (HDX COD-AB v03, simplified)",
        },
        "label_rule": {
            "min_observed_share": LABEL_MIN_OBSERVED_SHARE,
            "flooded_share_threshold": LABEL_FLOODED_SHARE,
            "meaning": "flood observed = observed_share >= 0.5 and flooded_share >= 0.10; "
                       "passes that saw less than half the district are not labelled",
        },
        "columns": ["date", "observed_share", "flooded_share", "advisory_share"],
        "skipped_scenes": skipped,
        # Scenes whose advisory-flag file is missing from the archive (HTTP 404).
        "advisory_flags_missing": sorted(advisory_missing),
        "districts": [
            {"pcode": d["pcode"], "name": d["name"], "division": d["division"],
             "land_pixels": int(land[i]), "rows": rows[d["pcode"]]}
            for i, d in enumerate(districts)
        ],
    }
    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(output, separators=(",", ":")))
    total = sum(len(r) for r in rows.values())
    log(f"Wrote {OUTPUT_FILE.relative_to(BACKEND)}: {len(months)} months, {len(per_day)} pass days, "
        f"{total} district rows, {OUTPUT_FILE.stat().st_size / 1e6:.1f} MB")


# ------------------------------------------------------------------

def parse_month(text):
    y, m = text.split("-")
    return int(y), int(m)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    fetch = sub.add_parser("fetch")
    fetch.add_argument("--start", required=True, help="YYYY-MM")
    fetch.add_argument("--end", required=True, help="YYYY-MM")
    fetch.add_argument("--months", default="4-11",
                       help="season months to include, e.g. 4-11 (April-November)")
    sub.add_parser("assemble")
    args = parser.parse_args()

    districts = load_districts()

    if args.command == "assemble":
        assemble(districts)
        return

    first, last = (int(x) for x in args.months.split("-"))
    with httpx.Client(timeout=60, headers={"User-Agent": USER_AGENT}) as client:
        for year, month in months_between(parse_month(args.start), parse_month(args.end)):
            if first <= month <= last:
                fetch_month(client, year, month, districts)


if __name__ == "__main__":
    main()
