"""
Automated tests for environmental-data ingestion (Milestone 18).

The tests NEVER call the internet. Open-Meteo is replaced by an
httpx.MockTransport:
- FakeOpenMeteo answers any request in Open-Meteo's real shape with
  synthetic values (clearly test data), and counts the requests;
- three REAL responses recorded from Open-Meteo (tests/fixtures/open_meteo/)
  check that the conversion works on the genuine format.

Data is stored in the local test MongoDB (see conftest.py).

Run from the Backend folder:  python -m pytest -v
"""

import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient
from shapely.geometry import Point, shape

from app.core.config import settings
from app.main import app
from app.modules.geospatial.repository import get_district_collection
from app.modules.ingestion import sources


BASE = "/api/v1/ingestion"
FIXTURES = Path(__file__).parent / "fixtures" / "open_meteo"

TEST_MONGODB_URI = os.environ["MONGODB_URI"]
TEST_DATABASE = os.environ["MONGODB_DATABASE"]

SUNAMGANJ = "district-BD6090"
DHAKA = "district-BD3026"
SURMA = "surma-sunamganj"


# ==========================================
# FAKE OPEN-METEO
# ==========================================

class FakeOpenMeteo:
    """Answers like Open-Meteo, with synthetic values: day k -> k + 0.5."""

    def __init__(self, fail_with: int | None = None):
        self.requests = []
        self.fail_with = fail_with

    def __call__(self, request: httpx.Request) -> httpx.Response:

        self.requests.append(request)

        if self.fail_with:
            return httpx.Response(self.fail_with, text="simulated failure")

        params = request.url.params
        lats = [float(x) for x in params["latitude"].split(",")]
        lons = [float(x) for x in params["longitude"].split(",")]

        if "past_days" in params:
            # Recent days: past_days full days, then today (not finished yet).
            today = datetime.now(timezone.utc).date()
            past = int(params["past_days"])
            days = [(today - timedelta(days=past - k)).isoformat() for k in range(past + 1)]
            series = {"daily": {"time": days, "precipitation_sum": [k + 0.5 for k in range(len(days))]}}
        elif "hourly" in params:
            start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
            hours = 24 * int(params["forecast_days"])
            times = [(start + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M") for h in range(hours)]
            series = {"hourly": {"time": times, "precipitation": [0.25] * hours}}
        else:
            first = date.fromisoformat(params["start_date"])
            last = date.fromisoformat(params["end_date"])
            days = [(first + timedelta(days=k)).isoformat() for k in range((last - first).days + 1)]
            field = params["daily"]
            series = {"daily": {"time": days, field: [k + 0.5 for k in range(len(days))]}}

        locations = [
            # Pretend the data grid is 0.25 degrees, like ERA5.
            {"latitude": round(lat * 4) / 4, "longitude": round(lon * 4) / 4, **series}
            for lat, lon in zip(lats, lons)
        ]

        return httpx.Response(200, json=locations if len(locations) > 1 else locations[0])


@pytest.fixture
def fake_api():

    fake = FakeOpenMeteo()
    sources.set_transport(httpx.MockTransport(fake))
    sources.RETRY_BASE_SECONDS = 0
    yield fake
    sources.set_transport(None)
    sources.RETRY_BASE_SECONDS = 5.0


def run(client, **body):

    response = client.post(f"{BASE}/runs", json=body)

    # In tests the background task finishes before post() returns.
    if response.status_code == 202:
        return response, client.get(f"{BASE}/runs/{response.json()['run_id']}").json()

    return response, None


def stored(collection: str, query: dict | None = None) -> list[dict]:

    with MongoClient(TEST_MONGODB_URI) as mongo:
        return list(mongo[TEST_DATABASE][collection].find(query or {}))


# ==========================================
# SITES
# ==========================================

def test_sites_are_64_districts_and_9_rivers(client):

    body = client.get(f"{BASE}/sites").json()

    assert body["count"] == 73
    assert sum(s["kind"] == "district" for s in body["sites"]) == 64
    assert sum(s["kind"] == "river" for s in body["sites"]) == 9


def test_every_district_site_lies_inside_its_district(client):

    districts = {f.id: shape(f.geometry.model_dump()) for f in get_district_collection().features}

    for site in client.get(f"{BASE}/sites", params={"kind": "district"}).json()["sites"]:
        assert districts[site["district_pcode"]].covers(Point(site["location"]["coordinates"]))


def test_river_sites_are_verified_rivers(client):

    for site in client.get(f"{BASE}/sites", params={"kind": "river"}).json()["sites"]:

        assert site["measures"] == ["river_discharge"]
        assert site["verification"]["mean_discharge_m3s"] >= 100
        assert site["approximate_location"] is not None


def test_buriganga_is_excluded_with_a_reason(client):

    excluded = client.get(f"{BASE}/sites").json()["excluded_river_candidates"]

    assert [e["site_id"] for e in excluded] == ["buriganga-dhaka"]
    assert "cannot separate" in excluded[0]["reason"]


# ==========================================
# HISTORY RUNS
# ==========================================

def test_rain_history_stores_values_with_provenance(client, fake_api):

    response, result = run(client, kind="rain_history", start_date="2022-06-13",
                           end_date="2022-06-20", site_ids=[SUNAMGANJ, DHAKA])

    assert response.status_code == 202
    assert result["status"] == "completed"
    assert result["values_written"] == 2 * 8
    assert result["api_calls"] == pytest.approx(2.0)            # 2 sites x 8 days (<= 14)

    value = client.get(f"{BASE}/rain", params={
        "site_id": SUNAMGANJ, "start_date": "2022-06-13", "end_date": "2022-06-20"
    }).json()["values"][0]

    assert value["precipitation_mm"] == 0.5
    assert value["unit"] == "mm"
    assert value["statistic"] == "24 h total, 00:00-24:00 UTC"
    assert value["date"] == "2022-06-13T00:00:00Z"
    assert "ERA5" in value["source"]
    assert value["grid_location"]["type"] == "Point"
    assert value["is_forecast"] is False
    assert value["run_id"] == result["run_id"]


def test_history_run_is_resumable(client, fake_api):

    body = dict(kind="rain_history", start_date="2022-06-13", end_date="2022-06-20", site_ids=[SUNAMGANJ])

    run(client, **body)
    _, second = run(client, **body)

    assert second["pieces_skipped"] == 1
    assert second["api_calls"] == 0
    assert len(fake_api.requests) == 1          # the second run never called the API
    assert len(stored("rain_daily")) == 8       # no duplicates


def test_history_is_split_into_years_and_site_groups(client, fake_api):

    district_ids = [s["site_id"] for s in client.get(f"{BASE}/sites", params={"kind": "district"}).json()["sites"]][:12]

    _, result = run(client, kind="rain_history", start_date="2021-12-30",
                    end_date="2022-01-02", site_ids=district_ids)

    # 12 sites -> 2 groups (10 + 2); 2021 and 2022 -> 2 years; 4 pieces.
    assert result["pieces_total"] == 4
    assert len(fake_api.requests) == 4
    assert result["values_written"] == 12 * 4


def test_river_history_stores_discharge(client, fake_api):

    _, result = run(client, kind="river_history", start_date="2022-06-10",
                    end_date="2022-06-25", site_ids=[SURMA])

    assert result["status"] == "completed"

    values = client.get(f"{BASE}/river", params={
        "site_id": SURMA, "start_date": "2022-06-10", "end_date": "2022-06-25"
    }).json()["values"]

    assert len(values) == 16
    assert values[0]["unit"] == "m3/s"
    assert values[0]["statistic"] == "daily mean discharge (GloFAS)"
    assert values[0]["discharge_m3s"] == 0.5


def test_missing_source_values_are_stored_as_missing(client):

    def answer(request):
        return httpx.Response(200, json={
            "latitude": 25.0, "longitude": 91.5,
            "daily": {"time": ["2022-06-13", "2022-06-14"], "precipitation_sum": [12.0, None]},
        })

    sources.set_transport(httpx.MockTransport(answer))
    try:
        run(client, kind="rain_history", start_date="2022-06-13", end_date="2022-06-14", site_ids=[SUNAMGANJ])
    finally:
        sources.set_transport(None)

    values = {v["date"].date().isoformat(): v for v in stored("rain_daily")}

    assert values["2022-06-14"]["missing"] is True
    assert values["2022-06-14"]["precipitation_mm"] is None
    assert values["2022-06-13"]["missing"] is False


# ==========================================
# REAL RECORDED RESPONSES (genuine Open-Meteo format)
# ==========================================

def replay(filename):

    body = json.loads((FIXTURES / filename).read_text())
    sources.set_transport(httpx.MockTransport(lambda request: httpx.Response(200, json=body)))
    return body


def test_real_era5_response_is_converted(client):

    body = replay("era5_two_sites.json")
    try:
        run(client, kind="rain_history", start_date="2022-06-16", end_date="2022-06-18",
            site_ids=[SUNAMGANJ, DHAKA])
    finally:
        sources.set_transport(None)

    # Each site must get one complete series from the response, with the
    # matching grid point. (Sites are processed in the sites-file order.)
    by_site = {}
    for value in sorted(stored("rain_daily"), key=lambda v: v["date"]):
        by_site.setdefault(value["site_id"], []).append(value)

    assert set(by_site) == {SUNAMGANJ, DHAKA}

    received = {
        (tuple(v["precipitation_mm"] for v in values), tuple(values[0]["grid_location"]["coordinates"]))
        for values in by_site.values()
    }
    expected = {
        (tuple(location["daily"]["precipitation_sum"]), (location["longitude"], location["latitude"]))
        for location in body
    }

    assert received == expected


def test_real_glofas_response_is_converted(client):

    body = replay("glofas_one_site.json")
    try:
        run(client, kind="river_history", start_date="2022-06-16", end_date="2022-06-18", site_ids=[SURMA])
    finally:
        sources.set_transport(None)

    values = sorted(stored("river_discharge_daily"), key=lambda v: v["date"])

    # The real 2022 Surma flood peak: about 1,700 m3/s.
    assert [v["discharge_m3s"] for v in values] == body["daily"]["river_discharge"]
    assert max(v["discharge_m3s"] for v in values) > 1700


def test_real_gfs_response_is_converted(client):

    body = replay("gfs_one_site.json")
    try:
        run(client, kind="rain_forecast", site_ids=[DHAKA], forecast_days=1)
    finally:
        sources.set_transport(None)

    forecast = client.get(f"{BASE}/rain-forecast", params={"site_id": DHAKA}).json()

    assert forecast["count"] == len(body["hourly"]["time"])
    assert forecast["values"][0]["accumulation"] == "1 h, the hour ending at valid_time"


# ==========================================
# FORECAST RUNS
# ==========================================

def test_rain_forecast_returns_only_the_latest_fetch(client, fake_api):

    run(client, kind="rain_forecast", site_ids=[DHAKA], forecast_days=1)

    # Make the first fetch look one hour older (new key + older fetched_at),
    # then fetch again. Fetches within the same minute share a key on purpose.
    with MongoClient(TEST_MONGODB_URI) as mongo:
        collection = mongo[TEST_DATABASE]["rain_forecast_hourly"]
        for document in list(collection.find()):
            collection.delete_one({"_id": document["_id"]})
            document["_id"] = "older|" + document["_id"]
            document["fetched_at"] = document["fetched_at"] - timedelta(hours=1)
            collection.insert_one(document)

    run(client, kind="rain_forecast", site_ids=[DHAKA], forecast_days=2)

    forecast = client.get(f"{BASE}/rain-forecast", params={"site_id": DHAKA}).json()

    assert forecast["count"] == 48                   # the newer, 2-day fetch only
    assert forecast["total_precipitation_mm"] == pytest.approx(48 * 0.25)
    assert len(stored("rain_forecast_hourly")) == 24 + 48   # both fetches are kept


def test_river_forecast_is_marked_as_forecast(client, fake_api):

    _, result = run(client, kind="river_forecast", site_ids=[SURMA], forecast_days=7)

    assert result["status"] == "completed"

    values = sorted(stored("river_discharge_daily"), key=lambda v: v["date"])

    assert len(values) == 7
    assert values[0]["is_forecast"] is False       # today
    assert values[-1]["is_forecast"] is True       # six days ahead


def test_river_forecast_is_refreshed_not_skipped(client, fake_api):

    run(client, kind="river_forecast", site_ids=[SURMA], forecast_days=3)
    _, second = run(client, kind="river_forecast", site_ids=[SURMA], forecast_days=3)

    assert second["pieces_skipped"] == 0
    assert len(fake_api.requests) == 2


# ==========================================
# SAFETY: BUDGET, ERRORS, ONE RUN AT A TIME
# ==========================================

def test_run_pauses_when_the_call_budget_would_be_exceeded(client, fake_api, monkeypatch):

    monkeypatch.setattr(settings, "INGESTION_MAX_CALLS_PER_HOUR", 1.0)

    _, result = run(client, kind="rain_history", start_date="2022-06-13",
                    end_date="2022-06-20", site_ids=[SUNAMGANJ, DHAKA])      # needs 2 calls

    assert result["status"] == "paused_budget"
    assert "Hourly call budget" in result["message"]
    assert fake_api.requests == []
    assert stored("rain_daily") == []


def test_usage_counts_calls(client, fake_api):

    run(client, kind="rain_history", start_date="2022-01-01", end_date="2022-01-28", site_ids=[SUNAMGANJ])

    usage = client.get(f"{BASE}/usage").json()

    assert usage["calls_this_hour"] == pytest.approx(2.0)     # 28 days = 2 calls
    assert usage["max_calls_per_day"] == settings.INGESTION_MAX_CALLS_PER_DAY


def test_source_failure_is_logged_not_crashed(client):

    fake = FakeOpenMeteo(fail_with=503)
    sources.set_transport(httpx.MockTransport(fake))
    sources.RETRY_BASE_SECONDS = 0
    try:
        _, result = run(client, kind="river_history", start_date="2022-06-10",
                        end_date="2022-06-12", site_ids=[SURMA])
    finally:
        sources.set_transport(None)
        sources.RETRY_BASE_SECONDS = 5.0

    assert result["status"] == "failed"
    assert "503" in result["message"]
    assert len(fake.requests) == 3                  # tried three times


def test_network_failures_are_retried(client):

    # Two connection timeouts, then a normal answer: the run must still complete.
    fake = FakeOpenMeteo()
    attempts = []

    def flaky(request):
        attempts.append(request)
        if len(attempts) <= 2:
            raise httpx.ConnectTimeout("connection timed out", request=request)
        return fake(request)

    sources.set_transport(httpx.MockTransport(flaky))
    sources.RETRY_BASE_SECONDS = 0
    try:
        _, result = run(client, kind="river_history", start_date="2022-06-10",
                        end_date="2022-06-12", site_ids=[SURMA])
    finally:
        sources.set_transport(None)
        sources.RETRY_BASE_SECONDS = 5.0

    assert result["status"] == "completed"
    assert result["values_written"] == 3
    assert len(attempts) == 3


def test_lasting_network_failure_is_reported_clearly(client):

    def down(request):
        raise httpx.ConnectTimeout("connection timed out", request=request)

    sources.set_transport(httpx.MockTransport(down))
    sources.RETRY_BASE_SECONDS = 0
    try:
        _, result = run(client, kind="river_history", start_date="2022-06-10",
                        end_date="2022-06-12", site_ids=[SURMA])
    finally:
        sources.set_transport(None)
        sources.RETRY_BASE_SECONDS = 5.0

    assert result["status"] == "failed"
    # Says what failed and that it is safe to start the run again.
    assert "ConnectTimeout" in result["message"]
    assert "flood-api.open-meteo.com" in result["message"]
    assert "start the same run again" in result["message"]


def test_runs_interrupted_by_a_restart_are_closed(fake_api):

    # A run was "running" when the server stopped (restart, crash, laptop
    # closed). Nothing is running any more, so on the next start it must be
    # closed; otherwise it would block every new run with 409 forever.
    with MongoClient(TEST_MONGODB_URI) as mongo:
        mongo[TEST_DATABASE]["ingestion_runs"].insert_one({
            "_id": "interrupted", "kind": "rain_history", "status": "running",
            "source": "x", "start_date": "2022-06-10", "end_date": "2022-06-12",
            "forecast_days": None, "site_ids": [DHAKA],
            "started_at": datetime.now(timezone.utc), "finished_at": None,
            "pieces_total": 1, "pieces_done": 0, "pieces_skipped": 0,
            "values_written": 0, "api_calls": 0, "message": None,
        })

    with TestClient(app) as client:                  # the server starts

        old = client.get("/api/v1/ingestion/runs/interrupted").json()

        assert old["status"] == "failed"
        assert old["finished_at"] is not None
        assert "interrupted" in old["message"]
        assert "start the same run again" in old["message"]

        response, result = run(client, kind="rain_history", start_date="2022-06-10",
                               end_date="2022-06-12", site_ids=[DHAKA])

        assert response.status_code == 202           # no longer blocked
        assert result["status"] == "completed"


def test_only_one_run_at_a_time(client):

    with MongoClient(TEST_MONGODB_URI) as mongo:
        mongo[TEST_DATABASE]["ingestion_runs"].insert_one({
            "_id": "busy", "status": "running", "started_at": datetime.now(timezone.utc)
        })

    response, _ = run(client, kind="rain_forecast")

    assert response.status_code == 409


# ==========================================
# RECENT RAIN (the days ERA5 has not delivered yet)
# ==========================================

def test_recent_rain_is_stored_apart_from_era5(client, fake_api):

    _, result = run(client, kind="rain_recent", past_days=7, site_ids=[DHAKA])

    assert result["status"] == "completed"
    assert result["past_days"] == 7
    assert result["values_written"] == 7
    assert "GFS" in result["source"]

    # Never mixed into the ERA5 collection.
    assert stored("rain_daily") == []

    documents = stored("rain_recent_daily")
    today = datetime.now(timezone.utc).date()

    assert len(documents) == 7
    # Only finished days: today's total is still growing, so it is not stored.
    assert sorted(d["date"].date() for d in documents) == [today - timedelta(days=k) for k in range(7, 0, -1)]

    first = min(documents, key=lambda d: d["date"])

    assert first["precipitation_mm"] == 0.5
    assert first["unit"] == "mm"
    assert first["statistic"] == "24 h total, 00:00-24:00 UTC"
    assert "GFS" in first["source"]
    assert first["run_id"] == result["run_id"]

    request = fake_api.requests[0].url.params
    assert request["past_days"] == "7"
    assert request["daily"] == "precipitation_sum"
    assert request["timezone"] == "UTC"


def test_recent_rain_is_refreshed_not_duplicated(client, fake_api):

    run(client, kind="rain_recent", past_days=3, site_ids=[DHAKA])
    _, again = run(client, kind="rain_recent", past_days=3, site_ids=[DHAKA])

    assert again["values_written"] == 3
    assert len(stored("rain_recent_daily")) == 3


def test_recent_rain_can_be_read(client, fake_api):

    run(client, kind="rain_recent", past_days=5, site_ids=[DHAKA])

    today = datetime.now(timezone.utc).date()
    response = client.get(f"{BASE}/rain-recent", params={
        "site_id": DHAKA,
        "start_date": (today - timedelta(days=3)).isoformat(),
        "end_date": today.isoformat(),
    })

    assert response.status_code == 200
    assert response.json()["count"] == 3
    assert client.get(f"{BASE}/rain-recent", params={
        "site_id": SURMA, "start_date": "2022-06-01", "end_date": "2022-06-02",
    }).status_code == 422


@pytest.mark.parametrize("past_days", [0, 31])
def test_recent_rain_days_out_of_range_rejected(client, past_days):

    response, _ = run(client, kind="rain_recent", past_days=past_days)

    assert response.status_code == 422


# ==========================================
# VALIDATION
# ==========================================

@pytest.mark.parametrize("body", [
    {"kind": "rain_history"},                                                   # no dates
    {"kind": "rain_history", "start_date": "2022-06-20", "end_date": "2022-06-13"},
    {"kind": "rain_history", "start_date": "1980-01-01", "end_date": "1980-01-02"},
    {"kind": "rain_history", "start_date": "2022-06-13", "end_date": "2022-06-14", "site_ids": ["nope"]},
    {"kind": "rain_history", "start_date": "2022-06-13", "end_date": "2022-06-14", "site_ids": [SURMA]},
    {"kind": "river_history", "start_date": "2022-06-13", "end_date": "2022-06-14", "site_ids": [DHAKA]},
    {"kind": "rain_forecast", "forecast_days": 0},
    {"kind": "rain_forecast", "forecast_days": 8},
    {"kind": "weather_magic"},
])
def test_invalid_run_requests_rejected(client, body):

    assert client.post(f"{BASE}/runs", json=body).status_code == 422


def test_rain_history_cannot_end_in_the_last_days(client):

    recent = date.today().isoformat()

    response = client.post(f"{BASE}/runs", json={
        "kind": "rain_history", "start_date": recent, "end_date": recent
    })

    assert response.status_code == 422
    assert "ERA5" in response.json()["detail"]


def test_read_endpoints_validate_sites(client):

    params = {"start_date": "2022-06-13", "end_date": "2022-06-20"}

    assert client.get(f"{BASE}/rain", params={"site_id": "nope", **params}).status_code == 404
    assert client.get(f"{BASE}/rain", params={"site_id": SURMA, **params}).status_code == 422
    assert client.get(f"{BASE}/river", params={"site_id": DHAKA, **params}).status_code == 422
    assert client.get(f"{BASE}/rain", params={
        "site_id": DHAKA, "start_date": "2022-06-20", "end_date": "2022-06-13"
    }).status_code == 422
    assert client.get(f"{BASE}/rain-forecast", params={"site_id": "nope"}).status_code == 404


def test_unknown_run_returns_404(client):

    assert client.get(f"{BASE}/runs/nope").status_code == 404


def test_no_forecast_yet(client):

    body = client.get(f"{BASE}/rain-forecast", params={"site_id": DHAKA}).json()

    assert body["fetched_at"] is None
    assert body["count"] == 0
