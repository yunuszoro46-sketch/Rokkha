"""
Automated tests for weather observations and saved locations, both stored
in MongoDB since Milestone 17 (local test database, see conftest.py).

Run from the Backend folder:  python -m pytest -v
"""

import os

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.main import app


WEATHER = "/api/v1/weather/observations"
LOCATIONS = "/api/v1/geospatial/locations"

# Set by conftest.py before the app starts: the local test database.
TEST_MONGODB_URI = os.environ["MONGODB_URI"]
TEST_DATABASE = os.environ["MONGODB_DATABASE"]


def observation(**overrides):
    return {
        "location_name": "Dhanmondi",
        "latitude": 23.7465,
        "longitude": 90.3760,
        "rainfall_mm": 42.5,
        "temperature_c": 29.0,
        "humidity_percent": 88,
        **overrides,
    }


# ==========================================
# WEATHER OBSERVATIONS
# ==========================================

def test_create_weather_observation(client):

    response = client.post(WEATHER, json=observation())

    assert response.status_code == 201

    body = response.json()

    assert body["id"]
    assert body["rainfall_mm"] == 42.5
    assert body["source"] == "manual"            # default
    assert body["observed_at"].endswith("Z")     # UTC timestamp


def test_get_weather_observation_by_id(client):

    created = client.post(WEATHER, json=observation()).json()

    response = client.get(f"{WEATHER}/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_unknown_weather_observation_returns_404(client):

    assert client.get(f"{WEATHER}/nope").status_code == 404


def test_list_weather_observations_oldest_first(client):

    first = client.post(WEATHER, json=observation(location_name="Mirpur")).json()
    second = client.post(WEATHER, json=observation(location_name="Uttara")).json()

    ids = [o["id"] for o in client.get(WEATHER).json()]

    assert ids == [first["id"], second["id"]]


@pytest.mark.parametrize("overrides", [
    {"rainfall_mm": -1},             # negative rain
    {"humidity_percent": 101},       # over 100 %
    {"temperature_c": 70},           # above the allowed range
    {"latitude": 95},                # invalid latitude
    {"location_name": "X"},          # too short
])
def test_invalid_weather_observation_rejected(client, overrides):

    assert client.post(WEATHER, json=observation(**overrides)).status_code == 422


def test_weather_observation_stored_in_mongodb(client):

    created = client.post(WEATHER, json=observation()).json()

    with MongoClient(TEST_MONGODB_URI) as mongo:
        document = mongo[TEST_DATABASE]["weather_observations"].find_one({"_id": created["id"]})

    assert document["location_name"] == "Dhanmondi"


# ==========================================
# SAVED LOCATIONS
# ==========================================

def test_list_locations_oldest_first(client):

    for name in ("Dhanmondi", "Gulshan"):
        client.post(LOCATIONS, json={"location_name": name, "latitude": 23.75, "longitude": 90.39})

    names = [loc["location_name"] for loc in client.get(LOCATIONS).json()]

    assert names == ["Dhanmondi", "Gulshan"]


def test_location_response_hides_internal_fields(client):

    created = client.post(LOCATIONS, json={
        "location_name": "Dhanmondi", "latitude": 23.7465, "longitude": 90.3760
    }).json()

    assert set(created) == {"id", "location_name", "latitude", "longitude", "geometry"}


# ==========================================
# PERSISTENCE
# ==========================================

def test_weather_and_locations_survive_an_app_restart(client):

    client.post(WEATHER, json=observation())
    client.post(LOCATIONS, json={"location_name": "Gulshan", "latitude": 23.7925, "longitude": 90.4152})

    # A new TestClient context = the app stops and starts again.
    with TestClient(app) as restarted:
        assert len(restarted.get(WEATHER).json()) == 1
        assert len(restarted.get(LOCATIONS).json()) == 1


def test_new_indexes_exist(client):

    with MongoClient(TEST_MONGODB_URI) as mongo:
        database = mongo[TEST_DATABASE]
        locations = database["locations"].index_information()
        weather = database["weather_observations"].index_information()

    assert locations["geometry_2dsphere"]["key"] == [("geometry", "2dsphere")]
    assert {"observed_at", "location_name"} <= set(weather)
