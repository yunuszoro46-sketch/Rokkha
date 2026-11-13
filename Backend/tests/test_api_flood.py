"""
Automated tests for the flood history and flood grid endpoints.

Data: UNOSAT observed flood water (CC BY-SA), JRC GloFAS river flood
hazard v2.1.2 (CC BY 4.0 / ODbL), HDX district boundaries (CC BY-IGO),
built by scripts/build_flood_data.py into data/flood/.

Run from the Backend folder:  python -m pytest -v
"""

import numpy
from shapely.geometry import shape

from app.modules.geospatial.repository import (
    get_district_collection,
    get_flood_grid,
    get_flood_history,
)


BASE = "/api/v1/geospatial/flood"

DHAKA_DISTRICT = "BD3026"

# Real locations, [longitude, latitude].
DHANMONDI = [90.3760, 23.7465]
BAY_OF_BENGAL = [90.0, 20.0]          # sea, outside every district
KOLKATA = [88.3639, 22.5726]          # India, outside Bangladesh


def check(client, coordinates):
    return client.post(
        f"{BASE}/check",
        json={"point": {"type": "Point", "coordinates": coordinates}}
    )


# ==========================================
# DATA FILES
# ==========================================

def test_district_file_has_64_valid_districts():

    features = get_district_collection().features

    assert len(features) == 64

    pcodes = [feature.id for feature in features]

    assert len(set(pcodes)) == 64
    assert DHAKA_DISTRICT in pcodes

    for feature in features:
        assert shape(feature.geometry.model_dump()).is_valid


def test_history_covers_every_district_and_event():

    history = get_flood_history()

    event_ids = [event["event_id"] for event in history["events"]]

    assert len(history["districts"]) == 64

    for district in history["districts"]:

        # One result per event, in the same order as the event list.
        assert [e["event_id"] for e in district["events"]] == event_ids

        for result in district["events"]:

            assert result["status"] in ("flooded", "not_flooded", "not_observed")

            # "not observed" must never carry a flooded share: no data != dry.
            if result["status"] == "not_observed":
                assert result["flooded_share"] is None


def test_ranks_are_ordered_by_flood_frequency():

    districts = get_flood_history()["districts"]

    assert [d["rank"] for d in districts] == list(range(1, 65))

    counts = [d["events_flooded"] for d in districts]

    assert counts == sorted(counts, reverse=True)


def test_grid_matches_event_list():

    grid = get_flood_grid()
    history = get_flood_history()

    assert list(grid["event_ids"]) == [e["event_id"] for e in history["events"]]

    shape_ = grid["hazard"].shape

    assert grid["observed_mask"].shape == shape_
    assert grid["flooded_mask"].shape == shape_


def test_grid_never_floods_an_unobserved_cell():

    # A cell can only be "flooded" in an event that observed it.
    grid = get_flood_grid()

    flooded = grid["flooded_mask"]
    observed = grid["observed_mask"]

    assert not numpy.any(flooded & ~observed)


def test_grid_hazard_values_are_valid():

    hazard = get_flood_grid()["hazard"]

    rp10 = hazard & 0b111
    rp100 = (hazard >> 3) & 0b111

    assert rp10.max() <= 4
    assert rp100.max() <= 4
    assert (hazard >> 7).max() == 0          # bit 7 is unused


def test_permanent_water_cells_are_never_flooded():

    # Floods are counted on land only (detected water minus permanent water).
    grid = get_flood_grid()

    permanent = (grid["hazard"] >> 6) & 1 == 1

    assert not numpy.any(grid["flooded_mask"][permanent])


# ==========================================
# EVENTS
# ==========================================

def test_list_events(client):

    response = client.get(f"{BASE}/events")

    assert response.status_code == 200

    body = response.json()

    assert body["count"] == len(body["events"]) == 10
    assert "UNOSAT" in body["attribution"]
    assert "JRC" in body["attribution"]
    assert "permanent water" in body["method"]["flooded_cell"]


def test_cyclone_mora_is_skipped_with_reason(client):

    skipped = client.get(f"{BASE}/events").json()["skipped_events"]

    assert [e["event_id"] for e in skipped] == ["2017-05-cyclone-mora"]
    assert "saturated soil" in skipped[0]["reason"]


# ==========================================
# DISTRICT RANKING AND HISTORY
# ==========================================

def test_ranking_all_districts(client):

    body = client.get(f"{BASE}/districts").json()

    assert body["total_districts"] == 64
    assert body["total_events"] == 10
    assert len(body["districts"]) == 64
    assert any("built-up" in text for text in body["limitations"])


def test_ranking_limit(client):

    body = client.get(f"{BASE}/districts", params={"limit": 5}).json()

    assert [d["rank"] for d in body["districts"]] == [1, 2, 3, 4, 5]


def test_ranking_division_filter_is_case_insensitive(client):

    body = client.get(f"{BASE}/districts", params={"division": "sylhet"}).json()

    assert len(body["districts"]) == 4
    assert all(d["division"] == "Sylhet" for d in body["districts"])


def test_ranking_invalid_limit_rejected(client):

    assert client.get(f"{BASE}/districts", params={"limit": 0}).status_code == 422


def test_district_history(client):

    response = client.get(f"{BASE}/districts/{DHAKA_DISTRICT}")

    assert response.status_code == 200

    body = response.json()

    assert body["name"] == "Dhaka"
    assert len(body["events"]) == 10


def test_district_history_lowercase_pcode(client):

    assert client.get(f"{BASE}/districts/bd3026").status_code == 200


def test_unknown_district_returns_404(client):

    assert client.get(f"{BASE}/districts/BD9999").status_code == 404


# ==========================================
# CHECK A POINT
# ==========================================

def test_check_dhanmondi(client):

    response = check(client, DHANMONDI)

    assert response.status_code == 200

    body = response.json()

    assert body["district"]["pcode"] == DHAKA_DISTRICT

    cell = body["cell"]

    assert 85 <= cell["grid_cell_size_m"] <= 95
    assert cell["times_observed"] == len(cell["observed_event_ids"])
    assert cell["times_flooded"] == len(cell["flooded_event_ids"])
    assert set(cell["flooded_event_ids"]) <= set(cell["observed_event_ids"])
    assert [h["return_period_years"] for h in cell["hazard"]] == [10, 100]


def test_check_point_outside_bangladesh(client):

    for coordinates in (BAY_OF_BENGAL, KOLKATA):

        body = check(client, coordinates).json()

        assert body["district"] is None
        assert body["cell"] is None


def test_check_invalid_point_rejected(client):

    assert check(client, [90.37, 95]).status_code == 422


# ==========================================
# REAL PLACES (values verified against the built data)
# ==========================================

SUNAMGANJ_HAOR = [91.1428, 24.8474]     # flooded in every observed event
BANDARBAN = [92.2185, 22.1953]          # hill district
KERANIGANJ = [90.3500, 23.6800]         # Dhaka's unprotected fringe


def test_most_flooded_district_is_sunamganj(client):

    top = client.get(f"{BASE}/districts", params={"limit": 1}).json()

    assert top["districts"][0]["name"] == "Sunamganj"
    assert top["districts"][0]["events_flooded"] == 6


def test_hill_districts_rank_last(client):

    last = client.get(f"{BASE}/districts").json()["districts"][-2:]

    assert {d["name"] for d in last} == {"Khagrachhari", "Bandarban"}
    assert all(d["events_flooded"] == 0 for d in last)


def test_sunamganj_haor_flooded_every_observed_event(client):

    body = check(client, SUNAMGANJ_HAOR).json()

    assert body["district"]["name"] == "Sunamganj"

    cell = body["cell"]

    assert cell["times_observed"] == 7
    assert cell["times_flooded"] == 7
    assert "2022-05-northeast" in cell["flooded_event_ids"]
    assert cell["permanent_water"] is False


def test_bandarban_never_flooded(client):

    cell = check(client, BANDARBAN).json()["cell"]

    assert cell["times_flooded"] == 0
    assert all(h["depth_class"] is None for h in cell["hazard"])


def test_keraniganj_modelled_hazard_without_observed_flood(client):

    # Shows why hazard ("could") and observed ("did") are kept apart.
    cell = check(client, KERANIGANJ).json()["cell"]

    assert cell["hazard"][0] == {
        "return_period_years": 10,
        "depth_class": 3,
        "depth_label": "3 to 10 m"
    }
    assert cell["times_flooded"] == 0


# ==========================================
# MODELLED HAZARD SHARE PER DISTRICT
# ==========================================

def test_district_rows_carry_the_modelled_hazard_shares(client):

    rows = client.get("/api/v1/geospatial/flood/districts").json()["districts"]

    assert len(rows) == 64
    for row in rows:
        assert 0 <= row["hazard_share_10yr"] <= row["hazard_share_100yr"] <= 1

    # A haor district lies far more inside the modelled flood zone than a hill district.
    by_name = {row["name"]: row for row in rows}
    assert by_name["Sunamganj"]["hazard_share_100yr"] > 0.5
    assert by_name["Bandarban"]["hazard_share_100yr"] < 0.2


def test_hazard_shares_are_the_ones_the_model_uses(client):

    from app.modules.prediction.repository import get_static

    detail = client.get("/api/v1/geospatial/flood/districts/BD6090").json()

    assert detail["hazard_share_10yr"] == get_static()["BD6090"]["hazard_share_10yr"]
    assert detail["hazard_share_100yr"] == get_static()["BD6090"]["hazard_share_100yr"]
