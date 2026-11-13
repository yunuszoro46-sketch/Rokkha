"""
Tests for the OpenStreetMap facility import (scripts/import_osm_facilities.py)
and the file it builds, data/assets/osm_facilities.json.

Run from the Backend folder:  python -m pytest -v
"""

import json
from datetime import datetime, timezone

from app.modules.assets.schemas import AssetResponse
from app.modules.geospatial.schemas import GeoJSONPoint
from app.modules.geospatial.service import find_district
from scripts.import_osm_facilities import FACILITIES_FILE, build, select_facility, to_asset


def feature(geometry=None, **properties):
    return {
        "type": "Feature",
        "geometry": geometry or {"type": "Point", "coordinates": [91.1428, 24.8474]},
        "properties": {"id": "node/1", "name": "Sunamganj Sadar Hospital", **properties},
    }


# ==========================================
# WHAT IS SELECTED
# ==========================================

def test_hospitals_and_clinics_are_selected_by_their_tags():

    assert select_facility(feature(amenity="hospital"))["asset_type"] == "hospital"
    assert select_facility(feature(healthcare="hospital"))["asset_type"] == "hospital"
    assert select_facility(feature(amenity="clinic"))["asset_type"] == "clinic"
    assert select_facility(feature(healthcare="centre"))["asset_type"] == "clinic"


def test_shelters_are_selected_by_what_their_name_says():

    for name in ("Dakshin Paruapara Cyclone Shelter", "USAID School cum Flood shelter",
                 "Khuriakhali Cyclone Center", "আশ্রয় কেন্দ্র"):
        assert select_facility(feature(name=name, amenity="school"))["asset_type"] == "flood_shelter", name


def test_other_places_are_left_out():

    assert select_facility(feature(amenity="pharmacy")) is None
    assert select_facility(feature(amenity="school", name="Purbo Baria High School")) is None
    assert select_facility(feature(amenity="shelter", name="Bus stand")) is None


def test_places_without_a_usable_name_are_left_out():

    assert select_facility(feature(amenity="hospital", name=None)) is None
    assert select_facility(feature(amenity="hospital", name=" ")) is None


def test_a_building_outline_becomes_a_point_inside_it():

    outline = {"type": "Polygon", "coordinates": [[[91.0, 24.0], [91.002, 24.0], [91.002, 24.002], [91.0, 24.002], [91.0, 24.0]]]}

    longitude, latitude = select_facility(feature(geometry=outline, amenity="hospital"))["location"]["coordinates"]

    assert 91.0 < longitude < 91.002 and 24.0 < latitude < 24.002


def test_capacity_is_kept_only_when_it_is_a_number():

    assert select_facility(feature(amenity="hospital", capacity_persons="250"))["occupancy"] == 250
    assert select_facility(feature(amenity="hospital", capacity_persons="about 50"))["occupancy"] is None
    assert select_facility(feature(amenity="hospital"))["occupancy"] is None


def test_build_keeps_each_place_once(tmp_path):

    health = tmp_path / "health.geojson"
    poi = tmp_path / "poi.geojson"
    health.write_text(json.dumps({"features": [feature(amenity="hospital")]}))
    poi.write_text(json.dumps({"features": [
        feature(amenity="hospital"),                                    # the same place again
        feature(id="node/2", name="Char Cyclone Shelter", amenity="school"),
    ]}))

    result = build(health, poi, "2026-11-04")

    assert result["counts"] == {"hospital": 1, "clinic": 0, "flood_shelter": 1}
    assert [f["source_id"] for f in result["facilities"]] == ["osm:node/1", "osm:node/2"]


def test_the_database_document_is_a_valid_asset_with_its_source():

    facility = select_facility(feature(amenity="hospital"))
    district = find_district(GeoJSONPoint(**facility["location"]))

    document = to_asset(facility, district, "2026-11-04", datetime.now(timezone.utc))
    asset = AssetResponse(**{**document, "id": document["_id"]})

    assert asset.source == "OpenStreetMap"
    assert asset.criticality == "critical"
    assert asset.occupancy is None and asset.replacement_value_bdt is None
    assert "OpenStreetMap contributors" in asset.notes and "not checked" in asset.notes
    assert asset.district.pcode == "BD6090"


# ==========================================
# THE BUILT FILE
# ==========================================

def test_file_names_its_source_licence_and_limits():

    data = json.loads(FACILITIES_FILE.read_text(encoding="utf-8"))

    assert "OpenStreetMap" in data["source"]
    assert "ODbL" in data["license"]
    assert data["snapshot"] == "2026-11-04"
    assert len(data["limitations"]) >= 3


def test_file_rows_are_complete_and_unique():

    data = json.loads(FACILITIES_FILE.read_text(encoding="utf-8"))
    rows = data["facilities"]

    assert len(rows) == sum(data["counts"].values()) > 3000
    assert len({row["source_id"] for row in rows}) == len(rows)

    for row in rows:
        assert row["asset_type"] in ("hospital", "clinic", "flood_shelter")
        assert 2 <= len(row["name"]) <= 150
        longitude, latitude = row["location"]["coordinates"]
        assert 87.9 < longitude < 92.8 and 20.5 < latitude < 26.8
