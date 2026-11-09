"""
Automated tests for the asset management module (/api/v1/assets).

Storage is in memory until MongoDB integration, so an autouse fixture
empties it before every test: each test starts from a clean store.

Run from the Backend folder:  python -m pytest -v
"""

import pytest

from app.modules.assets.repository import clear_asset_records


BASE = "/api/v1/assets"

# Real facilities, [longitude, latitude].
DHAKA_MEDICAL = [90.3976, 23.7258]          # Dhaka Medical College Hospital
SUNAMGANJ_HOSPITAL = [91.3990, 25.0658]     # Sunamganj Sadar Hospital
SYLHET_OSMANI = [91.8545, 24.9007]          # Sylhet MAG Osmani Medical College
KOLKATA = [88.3639, 22.5726]                # India: outside coverage


@pytest.fixture(autouse=True)
def empty_store():
    clear_asset_records()
    yield
    clear_asset_records()


def point(coordinates):
    return {"type": "Point", "coordinates": coordinates}


def new_asset(client, **overrides):

    body = {
        "name": "Dhaka Medical College Hospital",
        "asset_type": "hospital",
        "location": point(DHAKA_MEDICAL),
        "criticality": "critical",
        "occupancy": 4000,
        "replacement_value_bdt": 25_000_000_000,
        **overrides,
    }

    return client.post(BASE, json=body)


# ==========================================
# CREATE
# ==========================================

def test_create_asset_fills_district(client):

    response = new_asset(client)

    assert response.status_code == 201

    asset = response.json()

    assert asset["id"]
    assert asset["district"] == {
        "pcode": "BD3026",
        "name": "Dhaka",
        "division": "Dhaka"
    }
    assert asset["location"] == point(DHAKA_MEDICAL)
    assert asset["created_at"] == asset["updated_at"]


def test_create_defaults(client):

    asset = client.post(BASE, json={
        "name": "Community flood shelter",
        "asset_type": "flood_shelter",
        "location": point(SUNAMGANJ_HOSPITAL),
    }).json()

    assert asset["criticality"] == "medium"
    assert asset["occupancy"] is None
    assert asset["district"]["name"] == "Sunamganj"


def test_create_outside_bangladesh_rejected(client):

    response = new_asset(client, location=point(KOLKATA))

    assert response.status_code == 422
    assert "outside Bangladesh" in response.json()["detail"]


@pytest.mark.parametrize("overrides", [
    {"name": "X"},                                   # too short
    {"asset_type": "castle"},                        # unknown type
    {"criticality": "extreme"},                      # unknown level
    {"occupancy": -5},                               # negative people
    {"replacement_value_bdt": -1},                   # negative value
    {"location": point([200, 23.7])},                # invalid longitude
    {"location": {"type": "Polygon", "coordinates": []}},  # not a Point
])
def test_create_invalid_input_rejected(client, overrides):

    assert new_asset(client, **overrides).status_code == 422


# ==========================================
# READ
# ==========================================

def test_get_asset_by_id(client):

    created = new_asset(client).json()

    response = client.get(f"{BASE}/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_get_unknown_asset_returns_404(client):

    assert client.get(f"{BASE}/does-not-exist").status_code == 404


def test_list_empty(client):

    assert client.get(BASE).json() == {
        "count": 0,
        "total_occupancy": 0,
        "total_replacement_value_bdt": 0,
        "assets": []
    }


def test_list_totals_treat_missing_values_as_zero(client):

    new_asset(client)                                         # 4000 people
    new_asset(client, name="Sunamganj Sadar Hospital",
              location=point(SUNAMGANJ_HOSPITAL),
              occupancy=250, replacement_value_bdt=None)
    new_asset(client, name="Unknown size school", asset_type="school",
              occupancy=None, replacement_value_bdt=None)

    body = client.get(BASE).json()

    assert body["count"] == 3
    assert body["total_occupancy"] == 4250
    assert body["total_replacement_value_bdt"] == 25_000_000_000


def test_list_in_creation_order(client):

    first = new_asset(client, name="First").json()["id"]
    second = new_asset(client, name="Second").json()["id"]

    ids = [a["id"] for a in client.get(BASE).json()["assets"]]

    assert ids == [first, second]


def test_list_filters(client):

    new_asset(client)                                                   # hospital, critical, Dhaka
    new_asset(client, name="Sylhet Osmani", location=point(SYLHET_OSMANI),
              criticality="high")                                       # hospital, high, Sylhet
    new_asset(client, name="Dhaka school", asset_type="school",
              criticality="medium")                                     # school, medium, Dhaka

    def names(**params):
        return sorted(a["name"] for a in client.get(BASE, params=params).json()["assets"])

    assert names(asset_type="hospital") == ["Dhaka Medical College Hospital", "Sylhet Osmani"]
    assert names(criticality="critical") == ["Dhaka Medical College Hospital"]
    assert names(district_pcode="bd3026") == ["Dhaka Medical College Hospital", "Dhaka school"]
    assert names(asset_type="hospital", district_pcode="BD3026") == ["Dhaka Medical College Hospital"]


def test_list_unknown_filter_value_rejected(client):

    assert client.get(BASE, params={"asset_type": "castle"}).status_code == 422


# ==========================================
# UPDATE
# ==========================================

def test_patch_changes_only_sent_fields(client):

    created = new_asset(client).json()

    response = client.patch(f"{BASE}/{created['id']}", json={"occupancy": 4500})

    assert response.status_code == 200

    updated = response.json()

    assert updated["occupancy"] == 4500
    assert updated["name"] == created["name"]                 # unchanged
    assert updated["district"] == created["district"]         # unchanged
    # ">=" not ">": Windows' clock can tick in ~15 ms steps, so a fast
    # PATCH may get the same timestamp.
    assert updated["updated_at"] >= created["updated_at"]
    assert updated["created_at"] == created["created_at"]


def test_patch_location_recomputes_district(client):

    created = new_asset(client).json()

    updated = client.patch(
        f"{BASE}/{created['id']}",
        json={"location": point(SUNAMGANJ_HOSPITAL)}
    ).json()

    assert updated["district"]["name"] == "Sunamganj"


def test_patch_optional_field_can_be_cleared(client):

    created = new_asset(client).json()

    updated = client.patch(f"{BASE}/{created['id']}", json={"occupancy": None}).json()

    assert updated["occupancy"] is None


def test_patch_required_field_cannot_be_cleared(client):

    created = new_asset(client).json()

    response = client.patch(f"{BASE}/{created['id']}", json={"name": None})

    assert response.status_code == 422


def test_patch_location_outside_bangladesh_rejected(client):

    created = new_asset(client).json()

    response = client.patch(f"{BASE}/{created['id']}", json={"location": point(KOLKATA)})

    assert response.status_code == 422

    # The failed update must not have changed anything.
    assert client.get(f"{BASE}/{created['id']}").json() == created


def test_patch_unknown_asset_returns_404(client):

    assert client.patch(f"{BASE}/nope", json={"occupancy": 1}).status_code == 404


# ==========================================
# DELETE
# ==========================================

def test_delete_asset(client):

    created = new_asset(client).json()

    response = client.delete(f"{BASE}/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"{BASE}/{created['id']}").status_code == 404


def test_delete_unknown_asset_returns_404(client):

    assert client.delete(f"{BASE}/nope").status_code == 404
