"""
Tests for the Copernicus GFM satellite flood observations (Milestone 19):
the data file data/labels/district_flood_observations.json (built by
scripts/build_gfm_labels.py) and the endpoint
GET /api/v1/geospatial/flood/districts/{pcode}/satellite-observations.

Real values below come from the built file and were cross-checked against the
Sunamganj 2022 trial, UNOSAT's 2022 event window and ERA5 rain (Milestone 18).

Run from the Backend folder:  python -m pytest -v
"""

from datetime import date

import pytest

from app.modules.geospatial.repository import get_satellite_observations


BASE = "/api/v1/geospatial/flood/districts"

SUNAMGANJ = "BD6090"

# Districts the radar cannot map well enough (hills, Sundarbans forest,
# Gazipur forest/urban): no pass ever saw half the district.
NEVER_LABELLED = {
    "BD2003",  # Bandarban
    "BD2015",  # Chattogram
    "BD2022",  # Cox's Bazar
    "BD2046",  # Khagrachhari
    "BD2084",  # Rangamati
    "BD3033",  # Gazipur
    "BD4001",  # Bagerhat
    "BD4047",  # Khulna
}


def observations(client, pcode, **params):
    return client.get(f"{BASE}/{pcode}/satellite-observations", params=params)


# ==========================================
# DATA FILE
# ==========================================

def test_file_covers_64_districts_and_every_training_month():

    data = get_satellite_observations()

    assert data["kind"] == "observed"
    assert len(data["districts"]) == 64
    assert len({d["pcode"] for d in data["districts"]}) == 64

    # The training years are complete. Later months are added by the daily update.
    training_months = [f"{y}-{m:02d}" for y in range(2016, 2025) for m in range(4, 12)]
    assert data["months"][:len(training_months)] == training_months
    assert data["months"] == sorted(data["months"])


def test_one_gfm_version_for_every_training_year():

    # One processing version means the years the model learned from are
    # comparable. Newer passes (live inputs) come from newer versions.
    by_year = get_satellite_observations()["gfm_processing_versions_by_year"]

    for year in range(2016, 2025):
        assert by_year[str(year)] == ["GFM v3.1.0"]


def test_rows_are_valid_shares_in_date_order():

    data = get_satellite_observations()

    assert data["columns"] == ["date", "observed_share", "flooded_share", "advisory_share"]

    for district in data["districts"]:

        days = [row[0] for row in district["rows"]]
        assert days == sorted(days)
        assert len(days) == len(set(days))

        for day, observed, flooded, advisory in district["rows"]:

            assert 4 <= date.fromisoformat(day).month <= 11
            assert data["method"]["min_stored_observed_share"] <= observed <= 1
            assert 0 <= flooded <= 1
            assert advisory is None or 0 <= advisory <= 1


def test_label_rule_is_recorded_in_the_file():

    rule = get_satellite_observations()["label_rule"]

    assert rule["min_observed_share"] == 0.5
    assert rule["flooded_share_threshold"] == 0.10


def test_attribution_names_copernicus():

    assert "Copernicus Emergency Management Service" in get_satellite_observations()["attribution"]


def test_sunamganj_2022_floods_and_ordinary_days():

    district = next(d for d in get_satellite_observations()["districts"] if d["pcode"] == SUNAMGANJ)
    rows = {row[0]: row for row in district["rows"]}

    # Ordinary day before the floods.
    assert rows["2022-04-05"][2] == pytest.approx(0.0094)

    # First wave peak (UNOSAT event window 25 May - 21 June).
    assert rows["2022-05-23"][2] == pytest.approx(0.5859)

    # Second wave, the day after ERA5's 104 mm rain (17 June).
    assert rows["2022-06-18"][2] == pytest.approx(0.3071)

    # Back to normal at the end of July.
    assert rows["2022-07-29"][2] == pytest.approx(0.0051)


def test_hill_and_forest_districts_are_never_labelled():

    for district in get_satellite_observations()["districts"]:

        best = max((row[1] for row in district["rows"]), default=0)

        if district["pcode"] in NEVER_LABELLED:
            assert best < 0.5
        else:
            assert best >= 0.5


def test_big_flood_years_have_more_flood_observations_than_quiet_years():

    data = get_satellite_observations()
    rule = data["label_rule"]

    def flood_rate(year):
        rows = [
            row for d in data["districts"] for row in d["rows"]
            if row[0].startswith(year) and row[1] >= rule["min_observed_share"]
        ]
        return sum(row[2] >= rule["flooded_share_threshold"] for row in rows) / len(rows)

    # 2022 (Sylhet) and 2024 were major flood years; 2021 and 2023 were quieter.
    assert min(flood_rate("2022"), flood_rate("2024")) > 2 * max(flood_rate("2021"), flood_rate("2023"))


# ==========================================
# ENDPOINT
# ==========================================

def test_endpoint_returns_labelled_observations(client):

    response = observations(client, SUNAMGANJ, start_date="2022-05-20", end_date="2022-06-20")

    assert response.status_code == 200

    body = response.json()

    assert body["name"] == "Sunamganj"
    assert body["kind"] == "observed"
    assert body["min_observed_share"] == 0.5
    assert body["count"] == len(body["observations"]) > 0
    assert body["label_rule"]["flooded_share_threshold"] == 0.10
    assert "Copernicus" in body["attribution"]
    assert body["limitations"]

    by_day = {o["date"]: o for o in body["observations"]}

    assert by_day["2022-05-23"]["flooded"] is True
    assert by_day["2022-05-23"]["flooded_share"] == pytest.approx(0.5859)

    for o in body["observations"]:
        assert "2022-05-20" <= o["date"] <= "2022-06-20"
        assert o["observed_share"] >= 0.5


def test_ordinary_day_is_not_flooded(client):

    body = observations(client, SUNAMGANJ, start_date="2022-07-29", end_date="2022-07-29").json()

    assert body["count"] == 1
    assert body["observations"][0]["flooded"] is False


def test_partial_passes_have_no_label(client):

    # Passes that saw less than half the district are only returned on request,
    # and then carry flooded = null: unseen land is unknown, not dry.
    body = observations(client, "BD4047", min_observed_share=0.05).json()

    assert body["count"] > 0
    assert all(o["flooded"] is None for o in body["observations"])

    assert observations(client, "BD4047").json()["count"] == 0


def test_lowercase_pcode(client):

    assert observations(client, "bd6090", start_date="2022-05-23", end_date="2022-05-23").json()["count"] == 1


def test_unknown_district_returns_404(client):

    assert observations(client, "BD9999").status_code == 404


@pytest.mark.parametrize("params", [
    {"start_date": "2022-07-01", "end_date": "2022-06-01"},
    {"min_observed_share": 0},
    {"min_observed_share": 1.5},
    {"start_date": "not-a-date"},
])
def test_invalid_parameters_rejected(client, params):

    assert observations(client, SUNAMGANJ, **params).status_code == 422


def test_a_rebuilt_observations_file_is_read_without_a_restart(tmp_path, monkeypatch):
    import json
    import os

    from app.modules.geospatial import repository as geo
    from app.modules.prediction.repository import get_labelled_passes

    def write(day, stamp):
        path.write_text(json.dumps({
            "label_rule": {"min_observed_share": 0.5},
            "districts": [{"pcode": "BD6090", "rows": [[day, 0.9, 0.2, None]]}],
        }))
        os.utime(path, ns=(stamp, stamp))

    path = tmp_path / "observations.json"
    monkeypatch.setattr(geo, "SATELLITE_OBSERVATIONS_FILE", path)

    write("2026-11-01", 1_000_000_000)
    assert geo.get_satellite_observations()["districts"][0]["rows"][0][0] == "2026-11-01"
    assert get_labelled_passes()["BD6090"][0][0].isoformat() == "2026-11-01"

    write("2026-11-09", 2_000_000_000)
    assert geo.get_satellite_observations()["districts"][0]["rows"][0][0] == "2026-11-09"
    assert get_labelled_passes()["BD6090"][0][0].isoformat() == "2026-11-09"


# ==========================================
# LATEST PASS FOR EVERY DISTRICT (one call for a map)
# ==========================================

LATEST = "/api/v1/geospatial/flood/satellite-observations/latest"


def test_latest_gives_one_row_per_district(client):

    response = client.get(LATEST, params={"date": "2022-06-18"})

    assert response.status_code == 200
    body = response.json()
    assert body["date"] == "2022-06-18"
    assert body["kind"] == "observed"
    assert len(body["districts"]) == 64
    assert body["count"] == sum(d["observation"] is not None for d in body["districts"])
    assert body["attribution"] and body["limitations"]


def test_latest_matches_the_district_timeline_and_never_looks_ahead(client):

    latest = client.get(LATEST, params={"date": "2022-06-18"}).json()
    row = next(d for d in latest["districts"] if d["pcode"] == SUNAMGANJ)

    timeline = observations(
        client, SUNAMGANJ, start_date="2022-05-19", end_date="2022-06-18"
    ).json()["observations"]

    assert row["observable"] is True
    assert row["observation"] == timeline[-1]
    assert row["observation"]["date"] <= "2022-06-18"
    assert row["days_ago"] == (date(2022, 6, 18) - date.fromisoformat(row["observation"]["date"])).days


def test_latest_marks_districts_the_radar_cannot_observe(client):

    body = client.get(LATEST, params={"date": "2022-06-18"}).json()

    blind = {d["pcode"] for d in body["districts"] if not d["observable"]}

    assert blind == NEVER_LABELLED
    assert all(d["observation"] is None for d in body["districts"] if not d["observable"])


def test_latest_has_no_observation_when_the_last_pass_is_too_old(client):

    # January: the archive holds April-November passes only, so nothing recent exists.
    body = client.get(LATEST, params={"date": "2022-01-20"}).json()

    assert body["count"] == 0
    assert all(d["observation"] is None and d["days_ago"] is None for d in body["districts"])
    # ... but an observable district is still marked observable: "no recent pass", not "blind".
    assert next(d for d in body["districts"] if d["pcode"] == SUNAMGANJ)["observable"] is True


def test_latest_max_age_can_be_widened(client):

    narrow = client.get(LATEST, params={"date": "2022-06-18", "max_age_days": 1}).json()
    wide = client.get(LATEST, params={"date": "2022-06-18", "max_age_days": 30}).json()

    assert narrow["count"] < wide["count"]
    assert all(d["days_ago"] <= 1 for d in narrow["districts"] if d["observation"])


def test_latest_rejects_bad_parameters(client):

    assert client.get(LATEST, params={"date": "yesterday"}).status_code == 422
    assert client.get(LATEST, params={"date": "2022-06-18", "max_age_days": 0}).status_code == 422
    assert client.get(LATEST, params={"date": "2022-06-18", "max_age_days": 400}).status_code == 422
