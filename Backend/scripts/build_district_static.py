"""
Build the fixed (static) model inputs per district.

For each of the 64 districts:
    hazard_share_10yr / hazard_share_100yr
        share of the district's ~90 m cells inside the JRC modelled 10- / 100-year
        river-flood zone (data/flood/flood_grid.npz). MODELLED hazard: where a
        river flood could happen, not where it did.
    permanent_water_share
        share of cells that are permanent water (JRC).
    river_site_id / river_distance_km
        the nearest verified river site of the ingestion module
        (data/ingestion/sites.json) and its WGS84 distance from the district's
        rain site. The model reads that site's river flow.
    labelled
        whether satellite passes ever saw at least half the district
        (data/labels/district_flood_observations.json). Unlabelled districts
        cannot be trained on or checked.

Offline script: needs requirements-dev.txt (rasterio).

Usage (from the Backend folder):
    python scripts/build_district_static.py

Output: data/ml/district_static.json
"""

import json
from datetime import date
from pathlib import Path

import numpy as np
from geographiclib.geodesic import Geodesic
from rasterio.features import rasterize
from rasterio.transform import Affine

BACKEND = Path(__file__).resolve().parent.parent
DATA = BACKEND / "data"
OUTPUT = DATA / "ml" / "district_static.json"


def main():
    districts = json.loads((DATA / "boundaries" / "bangladesh_districts.geojson").read_text())["features"]
    districts = sorted(districts, key=lambda f: f["properties"]["pcode"])
    sites = json.loads((DATA / "ingestion" / "sites.json").read_text())["sites"]
    labels = json.loads((DATA / "labels" / "district_flood_observations.json").read_text())

    rain_sites = {s["district_pcode"]: s for s in sites if s["kind"] == "district"}
    river_sites = [s for s in sites if s["kind"] == "river"]
    min_observed = labels["label_rule"]["min_observed_share"]
    labelled = {
        d["pcode"]: any(row[1] >= min_observed for row in d["rows"])
        for d in labels["districts"]
    }

    with np.load(DATA / "flood" / "flood_grid.npz") as grid:
        hazard = grid["hazard"]
        transform = Affine(*grid["transform"])

    # District number (1..64) for every grid cell, 0 = outside Bangladesh.
    zones = rasterize(
        [(f["geometry"], i + 1) for i, f in enumerate(districts)],
        out_shape=hazard.shape, transform=transform, fill=0, dtype="int32",
    )

    def share(mask):
        counts = np.bincount(zones[mask], minlength=len(districts) + 1)[1:]
        return counts / np.bincount(zones.ravel(), minlength=len(districts) + 1)[1:]

    # hazard byte: bits 0-2 = 10-year depth class, bits 3-5 = 100-year, bit 6 = permanent water.
    share_10 = share((hazard & 0b111) > 0)
    share_100 = share(((hazard >> 3) & 0b111) > 0)
    share_water = share(((hazard >> 6) & 1) > 0)

    rows = []
    for i, feature in enumerate(districts):
        pcode = feature["properties"]["pcode"]
        lon, lat = rain_sites[pcode]["location"]["coordinates"]

        def distance_km(site):
            rlon, rlat = site["location"]["coordinates"]
            return Geodesic.WGS84.Inverse(lat, lon, rlat, rlon)["s12"] / 1000

        nearest = min(river_sites, key=distance_km)

        rows.append({
            "pcode": pcode,
            "name": feature["properties"]["name"],
            "division": feature["properties"]["parent_name"],
            "rain_site_id": rain_sites[pcode]["site_id"],
            "river_site_id": nearest["site_id"],
            "river_distance_km": round(distance_km(nearest), 1),
            "hazard_share_10yr": round(float(share_10[i]), 4),
            "hazard_share_100yr": round(float(share_100[i]), 4),
            "permanent_water_share": round(float(share_water[i]), 4),
            "labelled": labelled[pcode],
        })

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "generated_on": date.today().isoformat(),
        "sources": {
            "hazard": "JRC GloFAS flood hazard maps v2.1.2 (modelled), via data/flood/flood_grid.npz",
            "river_sites": "data/ingestion/sites.json (verified GloFAS cells)",
            "labelled": "data/labels/district_flood_observations.json (Copernicus GFM)",
        },
        "districts": rows,
    }, indent=1))

    print(f"Wrote {OUTPUT.relative_to(BACKEND)}: {len(rows)} districts, "
          f"{sum(r['labelled'] for r in rows)} labelled")


if __name__ == "__main__":
    main()
