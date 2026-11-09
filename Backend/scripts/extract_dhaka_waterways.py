"""
Extract Dhaka District rivers, canals and drains from the HOT OpenStreetMap
export of Bangladesh waterways.

Source dataset (download "Waterways (OSM), GeoJSON"):
    https://data.humdata.org/dataset/hotosm_bgd_waterways
    file: hotosm_bgd_waterways_osm_geojson.zip

Usage (from the Backend folder):
    python scripts/extract_dhaka_waterways.py path/to/hotosm_bgd_waterways_osm_geojson.zip

Output:
    data/waterways/dhaka_waterways.geojson

The national file is about 500 MB, so it is read one line (one feature)
at a time instead of loading everything into memory.
"""

import json
import sys
import zipfile
from collections import Counter
from pathlib import Path

from shapely.geometry import shape


DHAKA_DISTRICT_PCODE = "BD3026"

# Linear waterway types we keep (OpenStreetMap "waterway" tag values).
WATERWAY_TYPES = {"river", "canal", "stream", "drain", "ditch"}

COORDINATE_DECIMALS = 6

OUTPUT_PATH = (
    Path(__file__).resolve().parent.parent
    / "data" / "waterways" / "dhaka_waterways.geojson"
)


def clean_line(coordinates):

    # Round to ~0.1 m and drop consecutive duplicate positions
    # that rounding can create.
    cleaned = []

    for longitude, latitude in coordinates:

        position = [
            round(longitude, COORDINATE_DECIMALS),
            round(latitude, COORDINATE_DECIMALS)
        ]

        if not cleaned or cleaned[-1] != position:
            cleaned.append(position)

    return cleaned


def main(zip_path):

    archive = zipfile.ZipFile(zip_path)

    features = []
    skipped = Counter()

    with archive.open("waterways.geojson") as source:

        for raw_line in source:

            line = raw_line.decode("utf-8").strip().rstrip(",")

            # Each feature sits on its own line in this export.
            if not line.startswith('{ "type": "Feature"'):
                continue

            # Cheap text check before the (slower) JSON parse.
            if f'"adm2_pcode": "{DHAKA_DISTRICT_PCODE}"' not in line:
                continue

            feature = json.loads(line)
            properties = feature["properties"]
            geometry = feature["geometry"]

            if properties["waterway"] not in WATERWAY_TYPES:
                continue

            if geometry["type"] != "LineString":
                skipped["not a LineString"] += 1
                continue

            coordinates = clean_line(geometry["coordinates"])

            clean_geometry = {
                "type": "LineString",
                "coordinates": coordinates
            }

            if len(coordinates) < 2 or not shape(clean_geometry).is_valid:
                skipped["invalid after cleaning"] += 1
                continue

            features.append({
                "type": "Feature",
                "id": properties["id"],
                "geometry": clean_geometry,
                "properties": {
                    "osm_id": properties["id"],
                    "waterway_type": properties["waterway"],
                    "name": properties["name_en"] or properties["name"],
                    "name_bn": properties["name_bn"]
                }
            })

    if not features:
        raise ValueError("No Dhaka District waterways found in the source file.")

    features.sort(key=lambda f: f["id"])

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    OUTPUT_PATH.write_text(
        json.dumps(
            {"type": "FeatureCollection", "features": features},
            ensure_ascii=False,
            separators=(",", ":")
        ),
        encoding="utf-8"
    )

    counts = Counter(f["properties"]["waterway_type"] for f in features)

    print(f"Wrote {len(features)} features to {OUTPUT_PATH}")
    print("By type:", dict(sorted(counts.items())))
    print("Skipped:", dict(skipped) or "none")


if __name__ == "__main__":

    if len(sys.argv) != 2:
        sys.exit(__doc__)

    main(sys.argv[1])
