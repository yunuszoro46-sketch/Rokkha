"""
Automated tests for the Dhaka waterway endpoints.

Data: HOT OpenStreetMap export of Bangladesh waterways, snapshot
2026-11-04 (© OpenStreetMap contributors, ODbL), stored in
data/waterways/dhaka_waterways.geojson.

Run from the Backend folder:  python -m pytest -v
"""

from pytest import approx
from shapely.geometry import shape

from app.modules.geospatial.repository import get_waterway_collection


BASE = "/api/v1/geospatial/waterways"

# Real locations, [longitude, latitude].
SADARGHAT = [90.4106, 23.7058]     # river port on the Buriganga
DHANMONDI = [90.3760, 23.7465]
GULSHAN = [90.4152, 23.7925]
CHATTOGRAM = [91.8317, 22.3569]    # outside Dhaka District

BURIGANGA_OSM_ID = "way/722862311"


def nearest(client, coordinates, waterway_types=None):

    body = {"point": {"type": "Point", "coordinates": coordinates}}

    if waterway_types is not None:
        body["waterway_types"] = waterway_types

    return client.post(f"{BASE}/nearest", json=body)


def by_type(response):
    return {r["waterway_type"]: r for r in response.json()["results"]}


# ==========================================
# DATA FILE
# ==========================================

def test_waterway_file_loads_and_is_valid():

    features = get_waterway_collection().features

    assert len(features) == 2141

    osm_ids = [feature.id for feature in features]

    assert len(osm_ids) == len(set(osm_ids))

    for feature in features:

        assert feature.geometry.type == "LineString"
        assert shape(feature.geometry.model_dump()).is_valid


# ==========================================
# SUMMARY
# ==========================================

def test_summary_all_types(client):

    response = client.get(BASE)

    assert response.status_code == 200

    body = response.json()

    assert body["total_features"] == 2141
    assert "OpenStreetMap" in body["attribution"]
    assert "ODbL" in body["attribution"]
    assert any("Drains" in text for text in body["limitations"])

    summary = {item["waterway_type"]: item for item in body["by_type"]}

    assert summary["river"]["feature_count"] == 91
    assert summary["river"]["total_length_km"] == approx(486.2, abs=0.1)
    assert summary["canal"]["feature_count"] == 446
    assert summary["canal"]["total_length_km"] == approx(371.84, abs=0.1)


def test_summary_filtered_by_type(client):

    body = client.get(BASE, params={"waterway_type": "river"}).json()

    assert body["total_features"] == 91
    assert [item["waterway_type"] for item in body["by_type"]] == ["river"]


def test_summary_unknown_type_rejected(client):

    response = client.get(BASE, params={"waterway_type": "ocean"})

    assert response.status_code == 422


# ==========================================
# NEAREST
# ==========================================

def test_sadarghat_is_next_to_buriganga(client):

    response = nearest(client, SADARGHAT)

    assert response.status_code == 200

    body = response.json()

    assert body["inside_coverage_area"] is True
    assert body["method"] == "WGS84 geodesic"

    river = by_type(response)["river"]

    assert river["name"] == "Buriganga River"
    assert river["osm_id"] == BURIGANGA_OSM_ID
    assert river["distance_meters"] == approx(224, abs=1)
    assert river["distance_kilometers"] == approx(
        river["distance_meters"] / 1000
    )


def test_default_types_are_river_then_canal(client):

    response = nearest(client, DHANMONDI)

    types = [r["waterway_type"] for r in response.json()["results"]]

    assert types == ["river", "canal"]


def test_dhanmondi_distances(client):

    results = by_type(nearest(client, DHANMONDI))

    assert results["river"]["name"] == "Buriganga River"
    assert results["river"]["distance_meters"] == approx(2603, abs=1)
    assert results["canal"]["distance_meters"] == approx(1552, abs=1)


def test_gulshan_distances(client):

    results = by_type(nearest(client, GULSHAN))

    assert results["river"]["distance_meters"] == approx(3621, abs=1)
    assert results["canal"]["distance_meters"] == approx(2068, abs=1)


def test_nearest_point_is_on_reported_distance(client):

    # The returned nearest_point must really be that far away.
    river = by_type(nearest(client, SADARGHAT))["river"]

    check = client.post("/api/v1/geospatial/spatial-analysis/distance", json={
        "point_a": {"type": "Point", "coordinates": SADARGHAT},
        "point_b": river["nearest_point"]
    }).json()

    assert check["distance_meters"] == approx(river["distance_meters"])


def test_requested_types_only(client):

    response = nearest(client, DHANMONDI, ["drain"])

    assert [r["waterway_type"] for r in response.json()["results"]] == ["drain"]


def test_duplicate_types_returned_once(client):

    response = nearest(client, DHANMONDI, ["river", "river", "canal"])

    types = [r["waterway_type"] for r in response.json()["results"]]

    assert types == ["river", "canal"]


def test_point_outside_coverage_is_flagged(client):

    body = nearest(client, CHATTOGRAM).json()

    assert body["inside_coverage_area"] is False


def test_unknown_waterway_type_rejected(client):

    assert nearest(client, DHANMONDI, ["ocean"]).status_code == 422


def test_empty_waterway_types_rejected(client):

    assert nearest(client, DHANMONDI, []).status_code == 422


def test_invalid_point_rejected(client):

    assert nearest(client, [90.37, 95]).status_code == 422
