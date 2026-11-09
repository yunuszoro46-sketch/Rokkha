"""
Automated tests for the Dhaka administrative boundary endpoints.

Data: HDX Bangladesh COD-AB v03 (BBS / UN OCHA, CC BY-IGO),
stored in data/boundaries/dhaka_boundaries.geojson.

Run from the Backend folder:  python -m pytest -v
"""

from shapely.geometry import shape

from app.modules.geospatial.repository import get_boundary_collection


BASE = "/api/v1/geospatial/boundaries"

DISTRICT = "BD3026"
DHAKA_SOUTH = "BD30262000"
DHAKA_NORTH = "BD30262500"
SAVAR = "BD30260072"

# Real locations, [longitude, latitude].
DHANMONDI = [90.3760, 23.7465]
OLD_DHAKA = [90.4086, 23.7104]
GULSHAN = [90.4152, 23.7925]
UTTARA = [90.3984, 23.8759]
SAVAR_TOWN = [90.2600, 23.8583]
CHATTOGRAM = [91.8317, 22.3569]


def locate(client, coordinates):
    return client.post(
        f"{BASE}/locate",
        json={"point": {"type": "Point", "coordinates": coordinates}}
    )


def matched_pcodes(response):
    return [m["feature_id"] for m in response.json()["matches"]]


# ==========================================
# DATA FILE
# ==========================================

def test_boundary_file_loads_and_is_valid():

    collection = get_boundary_collection()

    assert len(collection.features) == 8

    pcodes = [feature.id for feature in collection.features]

    # Every official code appears exactly once.
    assert len(pcodes) == len(set(pcodes))

    for feature in collection.features:

        geometry = shape(feature.geometry.model_dump())

        assert geometry.is_valid, feature.properties["name"]


# ==========================================
# LIST
# ==========================================

def test_list_all_boundaries(client):

    response = client.get(BASE)

    assert response.status_code == 200

    body = response.json()

    assert body["count"] == 8
    assert "CC BY-IGO" in body["attribution"]

    names = {b["name"] for b in body["boundaries"]}

    assert "Dhaka North City Corporation" in names
    assert "Dhaka South City Corporation" in names


def test_list_level_3_only(client):

    body = client.get(BASE, params={"admin_level": 3}).json()

    assert body["count"] == 7
    assert all(b["admin_level"] == 3 for b in body["boundaries"])
    assert all(b["parent_pcode"] == DISTRICT for b in body["boundaries"])


def test_list_level_2_only(client):

    body = client.get(BASE, params={"admin_level": 2}).json()

    assert body["count"] == 1
    assert body["boundaries"][0]["pcode"] == DISTRICT


def test_list_unsupported_level_rejected(client):

    assert client.get(BASE, params={"admin_level": 4}).status_code == 422


# ==========================================
# LOCATE
# ==========================================

def test_dhanmondi_is_in_dhaka_south(client):

    response = locate(client, DHANMONDI)

    assert response.status_code == 200

    # District first, then the unit inside it.
    assert matched_pcodes(response) == [DISTRICT, DHAKA_SOUTH]

    unit = response.json()["matches"][1]

    assert unit["properties"]["name"] == "Dhaka South City Corporation"
    assert unit["relationship"] == "inside"


def test_old_dhaka_is_in_dhaka_south(client):

    assert matched_pcodes(locate(client, OLD_DHAKA)) == [DISTRICT, DHAKA_SOUTH]


def test_gulshan_is_in_dhaka_north(client):

    assert matched_pcodes(locate(client, GULSHAN)) == [DISTRICT, DHAKA_NORTH]


def test_uttara_is_in_dhaka_north(client):

    assert matched_pcodes(locate(client, UTTARA)) == [DISTRICT, DHAKA_NORTH]


def test_savar_town_is_in_savar(client):

    assert matched_pcodes(locate(client, SAVAR_TOWN)) == [DISTRICT, SAVAR]


def test_point_outside_dhaka_district(client):

    response = locate(client, CHATTOGRAM)

    assert response.status_code == 200
    assert response.json()["matched_count"] == 0
    assert response.json()["total_boundaries"] == 8


def test_locate_invalid_point_rejected(client):

    assert locate(client, [90.37, 95]).status_code == 422
