"""
Build the measuring sites used by the ingestion module.

Writes data/ingestion/sites.json with two kinds of site:

1. District sites (64): one point inside each district of Bangladesh
   (Shapely representative_point of data/boundaries/bangladesh_districts.geojson),
   used for rain.

2. River sites: well-known river gauge locations on the big rivers. Their
   coordinates below are APPROXIMATE (desk positions near the named place).
   GloFAS works on a ~5 km grid, and a point slightly off the channel can land
   on a small stream (near Sunamganj two neighbouring cells carry 5.6 and
   1,051 m3/s). So each candidate is SNAPPED: the script searches the GloFAS
   cells within +/-0.05 degrees (~5.5 km) and keeps the cell with the highest
   mean flow in July-August 2020, then VERIFIES that flow is a river
   (>= MIN_RIVER_FLOW). Candidates that fail are listed as rejected.
   A wider search (+/-0.1 deg) was tried first and REJECTED: near Dhaka it
   jumped 18 km to the Dhaleshwari-Meghna system (8,048 m3/s) instead of the
   Buriganga (~369 m3/s, 4 km away). Where rivers meet, "most water nearby"
   can be a different river.

Data: GloFAS river discharge (Copernicus Emergency Management Service) via
the Open-Meteo Flood API (CC BY 4.0). Free non-commercial use; this script
costs about 9 x 4.4 = 40 API calls per candidate.

Usage (from the Backend folder):  python scripts/build_ingestion_sites.py
"""

import json
import time
from datetime import date
from pathlib import Path

import httpx
from geographiclib.geodesic import Geodesic
from shapely.geometry import shape

BACKEND = Path(__file__).resolve().parent.parent
DISTRICTS_FILE = BACKEND / "data" / "boundaries" / "bangladesh_districts.geojson"
OUTPUT = BACKEND / "data" / "ingestion" / "sites.json"

FLOOD_API = "https://flood-api.open-meteo.com/v1/flood"
USER_AGENT = "ClimateShield-Rokkha-backend/0.4 (build_ingestion_sites.py)"

SNAP_RADIUS_DEG = 0.05
MAX_MOVE_KM = 8.0              # flag a site that moved further than this
GLOFAS_STEP_DEG = 0.05
SNAP_START, SNAP_END = "2020-07-01", "2020-08-31"
MIN_RIVER_FLOW = 100.0          # m3/s, July-August mean

# name, river, near, approximate [longitude, latitude]
RIVER_CANDIDATES = [
    ("surma-sunamganj", "Surma", "Sunamganj", [91.40, 25.07]),
    ("kushiyara-sherpur", "Kushiyara", "Sherpur (Moulvibazar)", [91.68, 24.63]),
    ("jamuna-bahadurabad", "Jamuna (Brahmaputra)", "Bahadurabad (Jamalpur)", [89.70, 25.15]),
    ("jamuna-sirajganj", "Jamuna (Brahmaputra)", "Sirajganj", [89.71, 24.45]),
    ("ganges-hardinge-bridge", "Ganges (Padma)", "Hardinge Bridge (Pabna/Kushtia)", [89.03, 24.07]),
    ("padma-goalundo", "Padma", "Goalundo (Rajbari)", [89.76, 23.80]),
    ("meghna-bhairab", "Meghna", "Bhairab Bazar (Kishoreganj)", [90.98, 24.05]),
    ("teesta-kaunia", "Teesta", "Kaunia (Rangpur)", [89.43, 25.78]),
    ("feni-area-river", "Feni area river (name not verified)", "Feni", [91.45, 22.95]),
]

# Candidates that cannot be identified reliably at GloFAS resolution.
EXCLUDED_CANDIDATES = [
    {
        "site_id": "buriganga-dhaka",
        "name": "Buriganga near Dhaka (Sadarghat)",
        "approximate_location": {"type": "Point", "coordinates": [90.41, 23.70]},
        "reason": (
            "GloFAS ~5 km cells cannot separate the Buriganga from the Turag, Dhaleshwari and "
            "Shitalakshya where they meet around Dhaka: two nearby cells both lie close to OSM "
            "'Buriganga River' lines but carry 364 and 670 m3/s (Jul-Aug 2020), and a wider search "
            "reached the Dhaleshwari-Meghna system (8,048 m3/s). Dhaka keeps its district rain site."
        ),
    },
]


def district_sites():

    features = json.loads(DISTRICTS_FILE.read_text(encoding="utf-8"))["features"]
    sites = []

    for feature in features:
        # representative_point is guaranteed to lie inside the polygon
        # (a centroid can fall outside an oddly shaped district).
        point = shape(feature["geometry"]).representative_point()
        p = feature["properties"]
        sites.append({
            "site_id": f"district-{p['pcode']}",
            "kind": "district",
            "name": p["name"],
            "district_pcode": p["pcode"],
            "division": p["parent_name"],
            "location": {"type": "Point", "coordinates": [round(point.x, 5), round(point.y, 5)]},
            "measures": ["rain"],
        })

    return sites


def fetch_discharge(client, points, start, end):

    response = client.get(FLOOD_API, params={
        "latitude": ",".join(f"{lat:.3f}" for _, lat in points),
        "longitude": ",".join(f"{lon:.3f}" for lon, _ in points),
        "daily": "river_discharge",
        "start_date": start,
        "end_date": end,
    })
    response.raise_for_status()
    body = response.json()
    return body if isinstance(body, list) else [body]


def mean(values):
    values = [v for v in values if v is not None]
    return sum(values) / len(values) if values else 0.0


def snap_river(client, candidate):

    site_id, river, near, (lon0, lat0) = candidate
    steps = round(SNAP_RADIUS_DEG / GLOFAS_STEP_DEG)
    grid = [
        (lon0 + i * GLOFAS_STEP_DEG, lat0 + j * GLOFAS_STEP_DEG)
        for i in range(-steps, steps + 1)
        for j in range(-steps, steps + 1)
    ]

    results = fetch_discharge(client, grid, SNAP_START, SNAP_END)
    best = max(results, key=lambda r: mean(r["daily"]["river_discharge"]))
    flow = mean(best["daily"]["river_discharge"])

    moved_km = Geodesic.WGS84.Inverse(lat0, lon0, best["latitude"], best["longitude"])["s12"] / 1000

    record = {
        "site_id": site_id,
        "kind": "river",
        "name": f"{river} near {near}",
        "river": river,
        "near": near,
        "approximate_location": {"type": "Point", "coordinates": [lon0, lat0]},
        # The GloFAS cell actually used (snapped to the main channel).
        "location": {"type": "Point", "coordinates": [round(best["longitude"], 5), round(best["latitude"], 5)]},
        # Only discharge: for a river, the rain that matters falls upstream,
        # not at the gauge (district sites already cover rain).
        "measures": ["river_discharge"],
        "verification": {
            "period": f"{SNAP_START} to {SNAP_END}",
            "mean_discharge_m3s": round(flow, 1),
            "cells_searched": len(results),
            "moved_km": round(moved_km, 1),
            "moved_more_than_max": moved_km > MAX_MOVE_KM,
            "min_required_m3s": MIN_RIVER_FLOW,
        },
    }

    return record, flow >= MIN_RIVER_FLOW


def main():

    sites = district_sites()
    rejected = []

    with httpx.Client(timeout=60, headers={"User-Agent": USER_AGENT}) as client:
        for candidate in RIVER_CANDIDATES:
            record, ok = snap_river(client, candidate)
            v = record["verification"]
            print(f"{record['site_id']:24s} mean {v['mean_discharge_m3s']:>9} m3/s  moved {v['moved_km']:>4} km  "
                  f"cell {record['location']['coordinates']}  {'KEPT' if ok else 'REJECTED'}"
                  f"{'  (moved > ' + str(MAX_MOVE_KM) + ' km: check)' if v['moved_more_than_max'] else ''}")
            (sites if ok else rejected).append(record)
            time.sleep(1)   # stay well under 600 calls per minute

    # District sites are also used for district-level rain; add the district
    # each river site falls in for convenience.
    from shapely.geometry import Point
    districts = json.loads(DISTRICTS_FILE.read_text(encoding="utf-8"))["features"]
    shapes = [(f["properties"]["pcode"], shape(f["geometry"])) for f in districts]
    for site in sites:
        if site["kind"] == "river":
            p = Point(site["location"]["coordinates"])
            site["district_pcode"] = next((code for code, g in shapes if g.covers(p)), None)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "generated_on": date.today().isoformat(),
        "method": {
            "district_sites": "Shapely representative_point of each district polygon (HDX COD-AB v03, simplified)",
            "river_sites": (
                f"approximate gauge location snapped to the GloFAS cell with the highest mean discharge "
                f"within +/-{SNAP_RADIUS_DEG} degrees ({SNAP_START} to {SNAP_END}); kept if >= {MIN_RIVER_FLOW} m3/s"
            ),
            "source": "GloFAS (Copernicus Emergency Management Service) via the Open-Meteo Flood API, CC BY 4.0",
        },
        "sites": sites,
        "rejected_river_candidates": rejected,
        "excluded_river_candidates": EXCLUDED_CANDIDATES,
    }, indent=1), encoding="utf-8")

    print(f"wrote {len(sites)} sites ({sum(s['kind'] == 'river' for s in sites)} rivers), "
          f"{len(rejected)} rejected -> {OUTPUT}")


if __name__ == "__main__":
    main()
