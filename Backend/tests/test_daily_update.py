"""
Tests for scripts/daily_update.py: the daily chain
"refresh data -> predict today -> list alerts", run against the app with a
fake Open-Meteo and the test-only model (see conftest.py).
"""

import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest

from app.modules.ingestion import sources

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "daily_update.py"
spec = importlib.util.spec_from_file_location("daily_update", SCRIPT)
daily = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daily)


def open_meteo(recent_rain_mm):
    """A fake Open-Meteo: 2 mm a day of ERA5 rain, steady rivers, chosen recent rain."""

    def answer(request):
        params = request.url.params
        count = len(params["latitude"].split(","))
        today = datetime.now(timezone.utc).date()

        if "past_days" in params:
            past = int(params["past_days"])
            days = [(today - timedelta(days=past - k)).isoformat() for k in range(past + 1)]
            values = [recent_rain_mm] * len(days)
        else:
            first = datetime.fromisoformat(params["start_date"]).date()
            last = datetime.fromisoformat(params["end_date"]).date()
            days = [(first + timedelta(days=k)).isoformat() for k in range((last - first).days + 1)]
            values = [2.0 if params["daily"] == "precipitation_sum" else 1000.0] * len(days)

        location = {"latitude": 24.0, "longitude": 90.0, "daily": {"time": days, params["daily"]: values}}

        return httpx.Response(200, json=[location] * count if count > 1 else location)

    return answer


@pytest.fixture
def weather():

    def use(recent_rain_mm):
        sources.set_transport(httpx.MockTransport(open_meteo(recent_rain_mm)))

    sources.RETRY_BASE_SECONDS = 0
    yield use
    sources.set_transport(None)
    sources.RETRY_BASE_SECONDS = 5.0


def test_daily_update_on_a_dry_day(client, flood_model, weather):

    weather(recent_rain_mm=0.0)
    lines = []

    result = daily.daily_update(client, wait_seconds=0, log=lines.append)

    today = datetime.now(timezone.utc).date().isoformat()

    assert result["target_date"] == today
    assert result["predicted"] == 56                 # every district satellites can observe
    assert result["alerts"] == []
    assert lines[-1] == "alerts: none"
    assert [line.split(":")[0] for line in lines[:3]] == ["river_history", "rain_history", "rain_recent"]

    stored = client.get("/api/v1/predictions", params={"target_date": today}).json()
    dhaka = next(p for p in stored["predictions"] if p["pcode"] == "BD3026")

    # ERA5 reaches up to 6 days ago: 25 of the 30 days at 2 mm, and the last
    # 5 days (dry here) from the recent source.
    assert dhaka["recent_rain_days"] == 5
    assert dhaka["features"]["rain_30d"] == 50.0
    assert dhaka["data_through"] == (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()


def test_daily_update_raises_alerts_after_heavy_recent_rain(client, flood_model, weather):

    weather(recent_rain_mm=80.0)                     # 240 mm in 3 days, everywhere
    lines = []

    result = daily.daily_update(client, wait_seconds=0, log=lines.append)

    assert len(result["alerts"]) == 56
    assert all(alert["level"] == "alert" for alert in result["alerts"])
    assert any(line.startswith("ALERT: Flood alert for Sunamganj district") for line in lines)


def test_daily_update_says_when_there_is_no_model(client, no_flood_model, weather):

    weather(recent_rain_mm=0.0)

    with pytest.raises(daily.StepFailed) as failure:
        daily.daily_update(client, wait_seconds=0, log=lambda text: None)

    assert "503" in str(failure.value)
    assert "No flood model has been trained yet" in str(failure.value)


def test_daily_update_stops_when_a_data_source_fails(client, flood_model):

    sources.set_transport(httpx.MockTransport(lambda request: httpx.Response(503, text="down")))
    sources.RETRY_BASE_SECONDS = 0
    try:
        with pytest.raises(daily.StepFailed) as failure:
            daily.daily_update(client, wait_seconds=0, log=lambda text: None)
    finally:
        sources.set_transport(None)
        sources.RETRY_BASE_SECONDS = 5.0

    assert str(failure.value).startswith("river_history: failed")


# ------------------------------------------------------------------
# New satellite passes
# ------------------------------------------------------------------

def test_satellite_months_cover_the_last_30_days():
    from datetime import date

    assert daily.satellite_months(date(2026, 11, 11)) == ("2026-10", "2026-11")
    assert daily.satellite_months(date(2027, 1, 3)) == ("2026-12", "2027-01")


def test_daily_update_refreshes_satellite_passes_before_predicting(client, flood_model, weather):
    weather(0.0)
    lines = []

    def refresh():
        lines.append("REFRESH CALLED")
        return "2 new passes"

    result = daily.daily_update(client, wait_seconds=0, log=lines.append, refresh_satellite=refresh)

    assert result["satellite_refreshed"] is True
    assert "satellite passes: 2 new passes" in lines
    predicted = next(i for i, line in enumerate(lines) if line.startswith("predictions for"))
    assert lines.index("REFRESH CALLED") < predicted


def test_daily_update_still_predicts_when_the_satellite_archive_fails(client, flood_model, weather):
    weather(0.0)
    lines = []

    def refresh():
        raise daily.StepFailed("archive not reachable")

    result = daily.daily_update(client, wait_seconds=0, log=lines.append, refresh_satellite=refresh)

    assert result["satellite_refreshed"] is False
    assert result["predicted"] > 0
    assert any("NOT refreshed" in line and "archive not reachable" in line for line in lines)


def test_daily_update_without_a_satellite_step(client, flood_model, weather):
    weather(0.0)

    result = daily.daily_update(client, wait_seconds=0, log=lambda text: None)

    assert result["satellite_refreshed"] is False
