"""
Daily update: refresh the data, predict today, list the alerts.

Talks to the running backend over its own API, in this order:
    1. river_history   river flow for the last 35 days                (GloFAS)
    2. rain_history    rain up to 6 days ago, the last 32 days of it  (ERA5, arrives about 5 days late)
    3. rain_recent     rain for the last 7 days                       (GFS, fills the days ERA5 lacks)
    4. new satellite passes of this month and the last            (Copernicus GFM)
    5. POST /predictions for today (UTC)
    6. GET  /alerts      for today
    7. river_forecast  river flow for today and the next 6 days       (GloFAS forecast, 9 river sites)
    8. rain_forecast   hourly rain from 00:00 UTC for 4 days, so the next 72 h are covered (GFS, 64 district sites)

Steps 7-8 feed the map (river charts, rain-forecast layer), not today's prediction, so they run after it and a
failure there is reported but does not fail the update.

About 310 Open-Meteo calls per day (235 + 9 + 64), far inside the free budget (10,000 a day).

Step 4 runs scripts/build_gfm_labels.py (needs requirements-dev.txt) and
rewrites data/labels/district_flood_observations.json; the backend notices the
new file by itself. If it fails, the update goes on and says so: predictions
are then made with the satellite passes already stored. Skip it with
--no-satellite.

Usage (the backend must be running):
    python scripts/daily_update.py
    python scripts/daily_update.py --api http://127.0.0.1:8000

Run it automatically every morning with cron (crontab -e), for example at 09:30:
    30 9 * * * cd ~/Rokkha/Backend && .venv/bin/python scripts/daily_update.py >> daily_update.log 2>&1

Exit code 0 = predictions made; 1 = a step failed (the message says which).
"""

import argparse
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

V1 = "/api/v1"

RIVER_DAYS = 35
RAIN_DAYS = 32
ERA5_DELAY_DAYS = 6
RECENT_DAYS = 7
RIVER_FORECAST_DAYS = 7
RAIN_FORECAST_DAYS = 4  # starts at 00:00 UTC; 4 days so the full 72 hours after a morning run are covered

# Forecasts for the map. Best effort: they never block or undo today's predictions.
FORECAST_STEPS = [
    dict(kind="river_forecast", forecast_days=RIVER_FORECAST_DAYS),
    dict(kind="rain_forecast", forecast_days=RAIN_FORECAST_DAYS),
]


class StepFailed(Exception):
    pass


def ingest(client, wait_seconds, **body):
    """Start an ingestion run and wait until it ends."""

    response = client.post(f"{V1}/ingestion/runs", json=body)

    if response.status_code != 202:
        raise StepFailed(f"{body['kind']}: could not start ({response.status_code}): {response.json().get('detail')}")

    run = response.json()

    while run["status"] in ("queued", "running"):
        time.sleep(wait_seconds)
        run = client.get(f"{V1}/ingestion/runs/{run['run_id']}").json()

    if run["status"] != "completed":
        raise StepFailed(f"{body['kind']}: {run['status']}: {run['message']}")

    return run


def satellite_months(today):
    """The two months ("YYYY-MM") that hold the last 30 days: last month and this one."""

    last_month = today.replace(day=1) - timedelta(days=1)

    return last_month.strftime("%Y-%m"), today.strftime("%Y-%m")


def refresh_satellite_passes(today=None):
    """Fetch the newest Copernicus GFM passes and rebuild the observations file."""

    today = today or datetime.now(timezone.utc).date()
    start, end = satellite_months(today)
    script = str(Path(__file__).resolve().parent / "build_gfm_labels.py")

    for arguments in (["fetch", "--start", start, "--end", end, "--months", "1-12"], ["assemble"]):
        try:
            done = subprocess.run([sys.executable, script, *arguments], capture_output=True, text=True, timeout=1800)
        except subprocess.TimeoutExpired:
            raise StepFailed(f"{arguments[0]} took longer than 30 minutes")

        last_line = (done.stdout + done.stderr).strip().splitlines()[-1:] or [""]

        if done.returncode != 0 or "NOT cached" in done.stdout:
            raise StepFailed(f"{arguments[0]}: {last_line[0]}")

    return f"{start} and {end} fetched; {last_line[0]}"


def daily_update(client, today=None, wait_seconds=5, log=print, refresh_satellite=None):
    """Run every step. Returns {"target_date", "predicted", "alerts", "satellite_refreshed"}.

    refresh_satellite: a function that fetches new satellite passes and returns
    a short text, or None to skip that step.
    """

    today = today or datetime.now(timezone.utc).date()

    def day(back):
        return (today - timedelta(days=back)).isoformat()

    steps = [
        dict(kind="river_history", start_date=day(RIVER_DAYS), end_date=day(1)),
        dict(kind="rain_history", start_date=day(ERA5_DELAY_DAYS + RAIN_DAYS - 1), end_date=day(ERA5_DELAY_DAYS)),
        dict(kind="rain_recent", past_days=RECENT_DAYS),
    ]

    for body in steps:
        run = ingest(client, wait_seconds, **body)
        log(f"{body['kind']}: {run['values_written']} values, {run['api_calls']:.0f} calls")

    # New satellite passes help, but predictions do not depend on them.
    satellite_refreshed = False

    if refresh_satellite:
        try:
            log(f"satellite passes: {refresh_satellite()}")
            satellite_refreshed = True
        except StepFailed as error:
            log(f"satellite passes NOT refreshed ({error}); predicting with the passes already stored")

    response = client.post(f"{V1}/predictions", json={"target_date": today.isoformat()})

    if response.status_code != 201:
        raise StepFailed(f"predictions ({response.status_code}): {response.json().get('detail')}")

    predictions = response.json()
    log(f"predictions for {today}: {predictions['count_predicted']} districts, model {predictions['model_version']}")

    alerts = client.get(f"{V1}/alerts", params={"target_date": today.isoformat()}).json()

    if not alerts["alerts"]:
        log("alerts: none")

    for alert in alerts["alerts"]:
        log(f"{alert['level'].upper()}: {alert['message']}")

    forecasts_refreshed = []

    for body in FORECAST_STEPS:
        try:
            run = ingest(client, wait_seconds, **body)
            log(f"{body['kind']}: {run['values_written']} values, {run['api_calls']:.0f} calls")
            forecasts_refreshed.append(body["kind"])
        except StepFailed as error:
            log(f"{body['kind']} NOT refreshed ({error}); the map shows the last stored forecast or none")

    return {
        "target_date": today.isoformat(),
        "predicted": predictions["count_predicted"],
        "alerts": alerts["alerts"],
        "satellite_refreshed": satellite_refreshed,
        "forecasts_refreshed": forecasts_refreshed,
    }


def main():
    parser = argparse.ArgumentParser(description="Refresh data, predict today, list alerts.")
    parser.add_argument("--api", default="http://127.0.0.1:8000", help="address of the running backend")
    parser.add_argument("--no-satellite", action="store_true", help="do not fetch new satellite passes")
    args = parser.parse_args()

    def log(text):
        print(datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), text, flush=True)

    try:
        with httpx.Client(base_url=args.api, timeout=120) as client:
            daily_update(client, log=log, refresh_satellite=None if args.no_satellite else refresh_satellite_passes)

    except StepFailed as error:
        log(f"FAILED: {error}")
        sys.exit(1)

    except httpx.TransportError as error:
        log(f"FAILED: the backend at {args.api} does not answer ({type(error).__name__}). Is it running?")
        sys.exit(1)


if __name__ == "__main__":
    main()
