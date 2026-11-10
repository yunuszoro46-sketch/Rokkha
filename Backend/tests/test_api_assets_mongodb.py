"""
Automated tests for MongoDB storage and geospatial queries (Milestone 17):
    GET  /api/v1/assets/near
    POST /api/v1/assets/within
    GET  /api/v1/health/database

Runs against the local test MongoDB (see conftest.py), never Atlas.

Run from the Backend folder:  python -m pytest -v
"""

import os

import pytest
from pymongo import MongoClient
from pytest import approx


# Set by conftest.py before the app starts: the local test database.
TEST_MONGODB_URI = os.environ["MONGODB_URI"]
TEST_DATABASE = os.environ["MONGODB_DATABASE"]


BASE = "/api/v1/assets"

# Real places, [longitude, latitude].
SADARGHAT = [90.4106, 23.7058]
DHAKA_MEDICAL = [90.3976, 23.7258]
KERANIGANJ = [90.3500, 23.6800]
DHANMONDI = [90.3760, 23.7465]
SUNAMGANJ_HOSPITAL = [91.3990, 25.0658]

# Verified WGS84 geodesic distances from Sadarghat, in metres.
SADARGHAT_TO_DHAKA_MEDICAL = 2581.5
SADARGHAT_TO_DHANMONDI = 5724.2
SADARGHAT_TO_KERANIGANJ = 6809.3


def point(coordinates):
    return {"type": "Point", "coordinates": coordinates}


def rectangle(west, south, east, north):
    return {
        "type": "Polygon",
        "coordinates": [[
            [west, south], [east, south], [east, north], [west, north], [west, south]
        ]]
    }


@pytest.fixture
def assets(client):

    created = {}

    for name, coordinates, asset_type, occupancy in [
        ("Sadarghat river terminal", SADARGHAT, "other", 2000),
        ("Dhaka Medical College Hospital", DHAKA_MEDICAL, "hospital", 4000),
        ("Keraniganj warehouse", KERANIGANJ, "warehouse", 40),
        ("Dhanmondi school", DHANMONDI, "school", 1200),
        ("Sunamganj Sadar Hospital", SUNAMGANJ_HOSPITAL, "hospital", 250),
    ]:
        response = client.post(BASE, json={
            "name": name,
            "asset_type": asset_type,
            "location": point(coordinates),
            "occupancy": occupancy,
        })
        created[name] = response.json()["id"]

    return created


def near(client, coordinates, max_distance_m, **filters):
    return client.get(f"{BASE}/near", params={
        "lng": coordinates[0], "lat": coordinates[1],
        "max_distance_m": max_distance_m, **filters,
    })


# ==========================================
# STORAGE
# ==========================================

def test_database_health(client):

    response = client.get("/api/v1/health/database")

    assert response.status_code == 200
    assert response.json() == {"database": "MongoDB", "status": "connected"}


def test_asset_is_stored_in_mongodb_with_id_as_primary_key(client, assets):

    asset_id = assets["Dhaka Medical College Hospital"]

    with MongoClient(TEST_MONGODB_URI) as mongo:
        document = mongo[TEST_DATABASE]["assets"].find_one({"_id": asset_id})

    assert document is not None
    assert document["name"] == "Dhaka Medical College Hospital"
    # Stored as real GeoJSON, which the 2dsphere index needs.
    assert document["location"] == point(DHAKA_MEDICAL)


def test_assets_survive_an_app_restart(client, assets):

    # A new TestClient context = the app shuts down and starts again
    # (disconnect + connect). In-memory storage would have lost everything.
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as restarted:
        body = restarted.get(BASE).json()

    assert body["count"] == 5


def test_indexes_exist(client):

    with MongoClient(TEST_MONGODB_URI) as mongo:
        indexes = mongo[TEST_DATABASE]["assets"].index_information()

    assert indexes["location_2dsphere"]["key"] == [("location", "2dsphere")]
    assert {"created_at", "asset_type", "district_pcode"} <= set(indexes)


# ==========================================
# NEAR
# ==========================================

def test_near_returns_nearest_first_within_radius(client, assets):

    response = near(client, SADARGHAT, 6000)

    assert response.status_code == 200

    body = response.json()

    names = [r["asset"]["name"] for r in body["results"]]

    # Keraniganj (6.8 km) and Sunamganj (181 km) are outside 6 km.
    assert names == [
        "Sadarghat river terminal",
        "Dhaka Medical College Hospital",
        "Dhanmondi school",
    ]
    assert body["count"] == 3
    assert body["total_occupancy"] == 2000 + 4000 + 1200
    assert body["max_distance_meters"] == 6000


def test_near_distances_are_wgs84_geodesic(client, assets):

    results = near(client, SADARGHAT, 7000).json()["results"]

    distances = {r["asset"]["name"]: r["distance_meters"] for r in results}

    assert distances["Sadarghat river terminal"] == approx(0, abs=0.01)
    assert distances["Dhaka Medical College Hospital"] == approx(SADARGHAT_TO_DHAKA_MEDICAL, abs=0.1)
    assert distances["Dhanmondi school"] == approx(SADARGHAT_TO_DHANMONDI, abs=0.1)
    assert distances["Keraniganj warehouse"] == approx(SADARGHAT_TO_KERANIGANJ, abs=0.1)

    # Nearest first.
    assert list(distances.values()) == sorted(distances.values())


def test_near_results_are_full_assets(client, assets):

    result = near(client, DHAKA_MEDICAL, 10).json()["results"][0]

    assert result["asset"]["id"] == assets["Dhaka Medical College Hospital"]
    assert result["asset"]["district"]["pcode"] == "BD3026"
    assert "_mongo_distance_m" not in result["asset"]


def test_near_with_filter(client, assets):

    results = near(client, SADARGHAT, 200_000, asset_type="hospital").json()["results"]

    assert [r["asset"]["name"] for r in results] == [
        "Dhaka Medical College Hospital",
        "Sunamganj Sadar Hospital",
    ]


def test_near_nothing_in_range(client, assets):

    body = near(client, [92.2185, 22.1953], 1000).json()      # Bandarban hills

    assert body["count"] == 0
    assert body["results"] == []


@pytest.mark.parametrize("params", [
    {"lng": 90.4, "lat": 23.7, "max_distance_m": 0},          # radius must be > 0
    {"lng": 90.4, "lat": 23.7, "max_distance_m": 300_000},    # over 200 km
    {"lng": 190, "lat": 23.7, "max_distance_m": 1000},        # invalid longitude
    {"lng": 90.4, "lat": 95, "max_distance_m": 1000},         # invalid latitude
    {"lng": 90.4, "lat": 23.7},                               # radius missing
])
def test_near_invalid_parameters_rejected(client, params):

    assert client.get(f"{BASE}/near", params=params).status_code == 422


def test_near_route_is_not_mistaken_for_an_asset_id(client, assets):

    assert near(client, SADARGHAT, 100).status_code == 200


# ==========================================
# WITHIN
# ==========================================

def within(client, area, **filters):
    return client.post(f"{BASE}/within", json={"area": area}, params=filters)


def test_within_rectangle_around_old_dhaka(client, assets):

    # Covers Sadarghat and Dhaka Medical, not Dhanmondi or Keraniganj.
    body = within(client, rectangle(90.39, 23.70, 90.42, 23.73)).json()

    assert sorted(a["name"] for a in body["assets"]) == [
        "Dhaka Medical College Hospital",
        "Sadarghat river terminal",
    ]
    assert body["count"] == 2
    assert body["total_occupancy"] == 6000


def test_within_multipolygon(client, assets):

    area = {
        "type": "MultiPolygon",
        "coordinates": [
            rectangle(90.39, 23.70, 90.42, 23.73)["coordinates"],        # Old Dhaka
            rectangle(91.38, 25.05, 91.42, 25.08)["coordinates"],        # Sunamganj town
        ]
    }

    names = sorted(a["name"] for a in within(client, area).json()["assets"])

    assert names == [
        "Dhaka Medical College Hospital",
        "Sadarghat river terminal",
        "Sunamganj Sadar Hospital",
    ]


def test_within_with_filter(client, assets):

    body = within(client, rectangle(90.30, 23.60, 90.50, 23.80), asset_type="school").json()

    assert [a["name"] for a in body["assets"]] == ["Dhanmondi school"]


def test_within_empty_area(client, assets):

    assert within(client, rectangle(88.0, 21.0, 88.1, 21.1)).json()["count"] == 0


def test_within_invalid_polygon_rejected(client, bow_tie_zone):

    response = within(client, bow_tie_zone)

    assert response.status_code == 422
    assert "invalid" in response.json()["detail"]


def test_within_point_instead_of_area_rejected(client):

    assert within(client, point(SADARGHAT)).status_code == 422
