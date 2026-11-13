"""
Hospitals, clinics and flood/cyclone shelters from OpenStreetMap, as assets.

Source: the Humanitarian OpenStreetMap Team (HOT) country exports on HDX
    https://data.humdata.org/dataset/hotosm_bgd_health_facilities
    https://data.humdata.org/dataset/hotosm_bgd_points_of_interest
© OpenStreetMap contributors, Open Database License (ODbL).

Two steps:

1. build   Reads the two downloaded GeoJSON files and writes the selection to
           data/assets/osm_facilities.json (kept in the repository, so step 2
           can be repeated without downloading anything).

       python scripts/import_osm_facilities.py build \
           --health ~/Downloads/health_facilities.geojson \
           --poi ~/Downloads/points_of_interest.geojson --snapshot 2026-11-04

2. import  Adds the facilities that are not stored yet to the database in
           Backend/.env. Safe to run again: nothing is added twice.

       python scripts/import_osm_facilities.py import
       python scripts/import_osm_facilities.py remove     # undo: deletes ONLY what this script added

What is selected (see select_facility):
- hospital       amenity=hospital or healthcare=hospital
- clinic         amenity=clinic, or healthcare=clinic / centre
- flood_shelter  any place whose name says cyclone/flood shelter or centre
Only places with a name are kept. Pharmacies, dentists and single doctors are left out.

What is NOT in OpenStreetMap and is therefore left empty: how many people a
place holds (unless mapped), and its value. `criticality` is set by a fixed
rule (hospital: critical; clinic and shelter: high); it is not a measured fact.
The points were mapped by volunteers and are not checked on the ground.
"""

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path
from uuid import uuid4

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

FACILITIES_FILE = BACKEND / "data" / "assets" / "osm_facilities.json"

SOURCE = "OpenStreetMap"
ATTRIBUTION = "© OpenStreetMap contributors, ODbL (HOT export via HDX)"

SHELTER_NAME = re.compile(
    r"cyclone\s*(shelter|cent(re|er))|flood\s*shelter|আশ্রয়\s*কেন্দ্র|আশ্রয়\s*কেন্দ্র|ঘূর্ণিঝড়\s*কেন্দ্র",
    re.IGNORECASE,
)

CRITICALITY_RULE = {"hospital": "critical", "clinic": "high", "flood_shelter": "high"}


def _name(properties: dict) -> str | None:

    for key in ("name", "name_en", "name_bn"):
        value = properties.get(key)
        if isinstance(value, str) and len(value.strip()) >= 2:
            return value.strip()[:150]

    return None


def _point(geometry: dict) -> list[float] | None:
    """[longitude, latitude] of a feature: the point itself, or a point inside a building outline."""

    if geometry["type"] == "Point":
        longitude, latitude = geometry["coordinates"][:2]
        return [round(longitude, 6), round(latitude, 6)]

    if geometry["type"] in ("Polygon", "MultiPolygon"):
        from shapely.geometry import shape

        inside = shape(geometry).representative_point()
        return [round(inside.x, 6), round(inside.y, 6)]

    return None


def select_facility(feature: dict) -> dict | None:
    """One OpenStreetMap feature -> one facility, or None when it is not wanted."""

    properties = feature.get("properties") or {}
    name = _name(properties)

    if name is None or not properties.get("id"):
        return None

    names = " ".join(str(properties.get(k) or "") for k in ("name", "name_en", "name_bn"))
    amenity = properties.get("amenity")
    healthcare = properties.get("healthcare")

    if amenity == "hospital" or healthcare == "hospital":
        asset_type = "hospital"
    elif amenity == "clinic" or healthcare in ("clinic", "centre"):
        asset_type = "clinic"
    elif SHELTER_NAME.search(names):
        asset_type = "flood_shelter"
    else:
        return None

    location = _point(feature["geometry"])

    if location is None:
        return None

    # OpenStreetMap stores the capacity as text; keep it only when it is a plain positive number.
    capacity = str(properties.get("capacity_persons") or "").strip()
    capacity = int(capacity) if capacity.isdigit() and int(capacity) > 0 else None
    address = properties.get("addr_full") or properties.get("addr_city")

    return {
        "source_id": f"osm:{properties['id']}",
        "name": name,
        "asset_type": asset_type,
        "location": {"type": "Point", "coordinates": location},
        # Only when a mapper recorded it; otherwise unknown.
        "occupancy": capacity,
        "address": str(address)[:300] if address else None,
    }


def build(health_path: Path, poi_path: Path, snapshot: str) -> dict:

    facilities = {}

    for path in (health_path, poi_path):
        for feature in json.loads(path.read_text(encoding="utf-8"))["features"]:
            facility = select_facility(feature)
            # The health file is read first, so a hospital keeps its type even
            # if it also appears among the points of interest.
            if facility and facility["source_id"] not in facilities:
                facilities[facility["source_id"]] = facility

    rows = sorted(facilities.values(), key=lambda f: f["source_id"])

    return {
        "source": "OpenStreetMap, Humanitarian OpenStreetMap Team (HOT) exports on HDX: "
                  "hotosm_bgd_health_facilities and hotosm_bgd_points_of_interest",
        "snapshot": snapshot,
        "license": "Open Database License (ODbL) 1.0",
        "attribution": ATTRIBUTION,
        "selection": "Named places only. hospital: amenity or healthcare = hospital. clinic: amenity = clinic or "
                     "healthcare = clinic/centre. flood_shelter: the name says cyclone/flood shelter or centre.",
        "limitations": [
            "Mapped by volunteers; coverage is better in towns than in remote areas. A missing place does not mean none exists.",
            "Not checked on the ground. A place may have closed, moved or be mis-tagged.",
            "Capacity is only present where a mapper recorded it. Value is never present.",
        ],
        "counts": {t: sum(f["asset_type"] == t for f in rows) for t in CRITICALITY_RULE},
        "facilities": rows,
    }


def to_asset(facility: dict, district: dict, snapshot: str, now) -> dict:
    """The MongoDB document for one facility (same shape as an asset made through the API)."""

    return {
        "_id": str(uuid4()),
        "name": facility["name"],
        "asset_type": facility["asset_type"],
        "location": facility["location"],
        "criticality": CRITICALITY_RULE[facility["asset_type"]],
        "occupancy": facility["occupancy"],
        "replacement_value_bdt": None,
        "owner": None,
        "address": facility["address"],
        "notes": f"From OpenStreetMap (snapshot {snapshot}), not checked on the ground. {ATTRIBUTION}.",
        "source": SOURCE,
        "source_id": facility["source_id"],
        "district": district,
        "created_at": now,
        "updated_at": now,
    }


async def import_facilities(remove: bool = False) -> dict:

    from app.core.database import Database, get_db
    from app.modules.assets.repository import _now
    from app.modules.geospatial.schemas import GeoJSONPoint
    from app.modules.geospatial.service import find_district

    await Database.connect()

    try:
        assets = get_db()["assets"]

        if remove:
            deleted = await assets.delete_many({"source": SOURCE})
            return {"removed": deleted.deleted_count}

        data = json.loads(FACILITIES_FILE.read_text(encoding="utf-8"))
        stored = {doc["source_id"] async for doc in assets.find({"source": SOURCE}, {"source_id": 1})}

        now = _now()
        documents, outside = [], 0

        for facility in data["facilities"]:
            if facility["source_id"] in stored:
                continue
            district = find_district(GeoJSONPoint(**facility["location"]))
            if district is None:        # the export's box reaches a little past the border
                outside += 1
                continue
            documents.append(to_asset(facility, district, data["snapshot"], now))

        for start in range(0, len(documents), 500):
            await assets.insert_many(documents[start:start + 500])

        return {"in_file": len(data["facilities"]), "already_stored": len(stored),
                "added": len(documents), "outside_bangladesh": outside}

    finally:
        await Database.disconnect()


def main():

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    build_parser = commands.add_parser("build")
    build_parser.add_argument("--health", type=Path, required=True)
    build_parser.add_argument("--poi", type=Path, required=True)
    build_parser.add_argument("--snapshot", required=True, help="Date of the OpenStreetMap snapshot, YYYY-MM-DD")
    commands.add_parser("import")
    commands.add_parser("remove")
    arguments = parser.parse_args()

    if arguments.command == "build":
        result = build(arguments.health, arguments.poi, arguments.snapshot)
        FACILITIES_FILE.parent.mkdir(parents=True, exist_ok=True)
        FACILITIES_FILE.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"Wrote {FACILITIES_FILE.relative_to(BACKEND)}: {result['counts']}")
    else:
        print(asyncio.run(import_facilities(remove=arguments.command == "remove")))


if __name__ == "__main__":
    main()
