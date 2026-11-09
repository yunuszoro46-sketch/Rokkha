"""
Extract Dhaka District boundaries from the official HDX dataset.

Source dataset (download "bgd_admin_boundaries.geojson.zip"):
    https://data.humdata.org/dataset/cod-ab-bgd

Usage (from the Backend folder):
    python scripts/extract_dhaka_boundaries.py path/to/bgd_admin_boundaries.geojson.zip

Output:
    data/boundaries/dhaka_boundaries.geojson

The output keeps:
    - Admin level 2: Dhaka District itself (1 feature)
    - Admin level 3: every upazila / city corporation inside it (7 features)
"""

import json
import sys
import zipfile
from pathlib import Path

from shapely.geometry import shape


DHAKA_DISTRICT_PCODE = "BD3026"

# Six decimal places is about 0.1 m on the ground — far more precise
# than the source boundaries, and it makes the file much smaller.
COORDINATE_DECIMALS = 6

OUTPUT_PATH = (
    Path(__file__).resolve().parent.parent
    / "data" / "boundaries" / "dhaka_boundaries.geojson"
)


def round_coordinates(value):

    # Coordinates are nested lists of numbers; walk them recursively.
    if isinstance(value, list):
        return [round_coordinates(item) for item in value]

    return round(value, COORDINATE_DECIMALS)


def build_feature(source_feature, level):

    properties = source_feature["properties"]

    prefix = f"adm{level}"
    parent_prefix = f"adm{level - 1}"

    geometry = {
        "type": source_feature["geometry"]["type"],
        "coordinates": round_coordinates(
            source_feature["geometry"]["coordinates"]
        )
    }

    # Refuse to write geometry that Shapely considers invalid.
    if not shape(geometry).is_valid:
        raise ValueError(
            f"Invalid geometry after rounding: {properties[prefix + '_name']}"
        )

    return {
        "type": "Feature",
        "id": properties[f"{prefix}_pcode"],
        "geometry": geometry,
        "properties": {
            "name": properties[f"{prefix}_name"],
            "pcode": properties[f"{prefix}_pcode"],
            "admin_level": level,
            "parent_name": properties[f"{parent_prefix}_name"],
            "parent_pcode": properties[f"{parent_prefix}_pcode"],
            "area_sqkm": round(properties["area_sqkm"], 2),
            "valid_on": properties["valid_on"],
            "version": properties["version"]
        }
    }


def main(zip_path):

    archive = zipfile.ZipFile(zip_path)

    admin2 = json.loads(archive.read("bgd_admin2.geojson"))["features"]
    admin3 = json.loads(archive.read("bgd_admin3.geojson"))["features"]

    district = [
        build_feature(feature, 2)
        for feature in admin2
        if feature["properties"]["adm2_pcode"] == DHAKA_DISTRICT_PCODE
    ]

    units = [
        build_feature(feature, 3)
        for feature in admin3
        if feature["properties"]["adm2_pcode"] == DHAKA_DISTRICT_PCODE
    ]

    if len(district) != 1 or not units:
        raise ValueError("Dhaka District not found in the source file.")

    collection = {
        "type": "FeatureCollection",
        "features": district + sorted(units, key=lambda f: f["id"])
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    OUTPUT_PATH.write_text(
        json.dumps(collection, separators=(",", ":")),
        encoding="utf-8"
    )

    print(f"Wrote {len(collection['features'])} features to {OUTPUT_PATH}")

    for feature in collection["features"]:
        p = feature["properties"]
        print(f"  level {p['admin_level']}  {p['pcode']}  {p['name']}")


if __name__ == "__main__":

    if len(sys.argv) != 2:
        sys.exit(__doc__)

    main(sys.argv[1])
