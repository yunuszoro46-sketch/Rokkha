"""
Daily update: refresh the data, predict today, list the alerts.

Talks to the running backend over its own API, in this order:
    1. river_history   river flow for the last 35 days                (GloFAS)
    2. rain_history    rain up to 6 days ago, the last 32 days of it  (ERA5, arrives about 5 days late)
    3. rain_recent     rain for the last 7 days                       (GFS, fills the days ERA5 lacks)
    4. POST /predictions for today (UTC)
    5. GET  /alerts      for today

About 235 Open-Meteo calls per day, far inside the free budget.

Usage (the backend must be running):
    python scripts/daily_update.py
    python scripts/daily_update.py --api http://127.0.0.1:8000

Run it automatically every morning with cron (crontab -e), for example at 09:30:
    30 9 * * * cd ~/Rokkha/Backend && .venv/bin/python scripts/daily_update.py >> daily_update.log 2>&1

Exit code 0 = predictions made; 1 = a step failed (the message says which).
"""

import argparse
import sys
import time
from datetime import datetime, timedelta, timezone

import httpx

V1 = "/api/v1"

RIVER_DAYS = 35
RAIN_DAYS = 32
ERA5_DELAY_DAYS = 6
RECENT_DAYS = 7


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


def daily_update(client, today=None, wait_seconds=5, log=print):
    """Run every step. Returns {"target_date", "predicted", "alerts"}."""

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

    return {
        "target_date": today.isoformat(),
        "predicted": predictions["count_predicted"],
        "alerts": alerts["alerts"],
    }


def main():
    parser = argparse.ArgumentParser(description="Refresh data, predict today, list alerts.")
    parser.add_argument("--api", default="http://127.0.0.1:8000", help="address of the running backend")
    args = parser.parse_args()

    def log(text):
        print(datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), text, flush=True)

    try:
        with httpx.Client(base_url=args.api, timeout=120) as client:
            daily_update(client, log=log)

    except StepFailed as error:
        log(f"FAILED: {error}")
        sys.exit(1)

    except httpx.TransportError as error:
        log(f"FAILED: the backend at {args.api} does not answer ({type(error).__name__}). Is it running?")
        sys.exit(1)


if __name__ == "__main__":
    main()
