"""
Automated tests for asset exposure analysis:
    GET /api/v1/assets/exposure
    GET /api/v1/assets/{id}/exposure

Exposure combines each asset's location with the flood grid (observed
UNOSAT floods + JRC modelled hazard), the district flood ranking and, inside
Dhaka District, the nearest river and canal. Values below were verified
against the built data in data/flood/ and data/waterways/.

Run from the Backend folder:  python -m pytest -v
"""

import pytest
from pytest import approx

from app.modules.assets.repository import clear_asset_records


BASE = "/api/v1/assets"

# name: ([longitude, latitude], asset_type, occupancy, replacement_value_bdt)
PORTFOLIO = {
    "Dhaka Medical College Hospital": ([90.3976, 23.7258], "hospital", 4000, 25_000_000_000),
    "Sunamganj Sadar Hospital": ([91.3990, 25.0658], "hospital", 250, 2_000_000_000),
    "Haor flood shelter": ([91.1428, 24.8474], "flood_shelter", 800, 50_000_000),
    "Keraniganj warehouse": ([90.3500, 23.6800], "warehouse", 40, 300_000_000),
    "Sadarghat river terminal": ([90.4106, 23.7058], "other", 2000, 1_000_000_000),
}


@pytest.fixture(autouse=True)
def empty_store():
    clear_asset_records()
    yield
    clear_asset_records()


@pytest.fixture
def portfolio(client):

    ids = {}

    for name, (coordinates, asset_type, occupancy, value) in PORTFOLIO.items():

        response = client.post(BASE, json={
            "name": name,
            "asset_type": asset_type,
            "location": {"type": "Point", "coordinates": coordinates},
            "occupancy": occupancy,
            "replacement_value_bdt": value,
        })

        ids[name] = response.json()["id"]

    return ids


def exposure(client, asset_id):
    return client.get(f"{BASE}/{asset_id}/exposure")


# ==========================================
# SINGLE ASSET
# ==========================================

def test_haor_shelter_observed_and_modelled(client, portfolio):

    response = exposure(client, portfolio["Haor flood shelter"])

    assert response.status_code == 200

    body = response.json()

    assert body["district"]["name"] == "Sunamganj"
    assert body["district"]["flood_rank"] == 1
    assert body["observed"]["times_observed"] == 7
    assert body["observed"]["times_flooded"] == 7
    assert body["observed"]["last_flooded_event_id"] == "2024-08-eastern"
    assert body["hazard"][0]["depth_label"] == "1 to 3 m"
    assert body["flags"] == {
        "observed_flooding": True,
        "modelled_hazard_10yr": True,
        "modelled_hazard_100yr": True,
    }


def test_keraniganj_hazard_without_observed_flooding(client, portfolio):

    body = exposure(client, portfolio["Keraniganj warehouse"]).json()

    assert body["flags"] == {
        "observed_flooding": False,
        "modelled_hazard_10yr": True,
        "modelled_hazard_100yr": True,
    }
    assert body["observed"]["last_flooded_event_id"] is None

    canal = [w for w in body["nearest_waterways"] if w["waterway_type"] == "canal"][0]

    assert canal["distance_meters"] == approx(169, abs=1)


def test_sadarghat_nearest_river_is_buriganga(client, portfolio):

    body = exposure(client, portfolio["Sadarghat river terminal"]).json()

    assert body["waterway_coverage"] is True

    river = body["nearest_waterways"][0]

    assert river["waterway_type"] == "river"
    assert river["name"] == "Buriganga River"
    assert river["distance_meters"] == approx(224, abs=1)


def test_waterways_empty_outside_dhaka_district(client, portfolio):

    body = exposure(client, portfolio["Sunamganj Sadar Hospital"]).json()

    assert body["waterway_coverage"] is False
    assert body["nearest_waterways"] == []


def test_single_exposure_carries_limitations_and_attribution(client, portfolio):

    body = exposure(client, portfolio["Dhaka Medical College Hospital"]).json()

    assert any("not a forecast" in text for text in body["limitations"])
    assert any("built-up" in text for text in body["limitations"])
    assert any("UNOSAT" in text for text in body["attribution"])
    assert any("OpenStreetMap" in text for text in body["attribution"])


def test_exposure_unknown_asset_returns_404(client):

    assert exposure(client, "does-not-exist").status_code == 404


def test_exposure_follows_location_change(client, portfolio):

    asset_id = portfolio["Dhaka Medical College Hospital"]

    assert exposure(client, asset_id).json()["flags"]["observed_flooding"] is False

    client.patch(f"{BASE}/{asset_id}", json={
        "location": {"type": "Point", "coordinates": PORTFOLIO["Haor flood shelter"][0]}
    })

    assert exposure(client, asset_id).json()["flags"]["observed_flooding"] is True


# ==========================================
# REPORT FOR MANY ASSETS
# ==========================================

def test_report_summary(client, portfolio):

    response = client.get(f"{BASE}/exposure")

    assert response.status_code == 200

    summary = response.json()["summary"]

    assert summary["total"] == {
        "assets": 5,
        "occupancy": 7090,
        "replacement_value_bdt": 28_350_000_000,
    }
    assert summary["with_observed_flooding"] == {
        "assets": 1,
        "occupancy": 800,
        "replacement_value_bdt": 50_000_000,
    }
    assert summary["with_modelled_hazard_10yr"] == {
        "assets": 2,
        "occupancy": 840,
        "replacement_value_bdt": 350_000_000,
    }


def test_report_lists_assets_in_creation_order(client, portfolio):

    names = [e["name"] for e in client.get(f"{BASE}/exposure").json()["assets"]]

    assert names == list(PORTFOLIO)


def test_report_filters_match_asset_list(client, portfolio):

    params = {"district_pcode": "BD3026"}

    report = client.get(f"{BASE}/exposure", params=params).json()
    listing = client.get(BASE, params=params).json()

    assert [e["asset_id"] for e in report["assets"]] == [a["id"] for a in listing["assets"]]
    assert report["summary"]["total"]["assets"] == 3


def test_report_route_is_not_mistaken_for_an_asset_id(client, portfolio):

    # "/exposure" is declared before "/{asset_id}" in the router.
    response = client.get(f"{BASE}/exposure")

    assert response.status_code == 200
    assert "summary" in response.json()


def test_report_with_no_assets(client):

    body = client.get(f"{BASE}/exposure").json()

    assert body["summary"]["total"] == {"assets": 0, "occupancy": 0, "replacement_value_bdt": 0}
    assert body["assets"] == []
    assert body["attribution"] == []
    assert any("not a forecast" in text for text in body["limitations"])
