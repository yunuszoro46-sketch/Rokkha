"""
Storage for the ingestion module.

Read-only file:
    data/ingestion/sites.json      measuring sites (scripts/build_ingestion_sites.py)

MongoDB collections:
    rain_daily                ERA5 daily rain per site
    river_discharge_daily     GloFAS daily river discharge per site
    rain_forecast_hourly      GFS hourly forecast rain per site and fetch
    ingestion_runs            one document per ingestion run (provenance log)
    ingestion_api_usage       Open-Meteo calls spent per hour (budget)

Every observation's _id is built from what makes it unique (site + date,
or site + fetch hour + valid time), so re-running an ingestion REPLACES a
value instead of duplicating it.
"""

import json
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

from pymongo import ASCENDING, DESCENDING, ReplaceOne

from app.core.database import get_db


SITES_FILE = Path(__file__).resolve().parents[3] / "data" / "ingestion" / "sites.json"


@lru_cache(maxsize=1)
def get_sites_document() -> dict:

    return json.loads(SITES_FILE.read_text(encoding="utf-8"))


def get_sites() -> list[dict]:

    return get_sites_document()["sites"]


def _collection(name: str):
    return get_db()[name]


# ==========================================
# OBSERVATIONS AND FORECASTS
# ==========================================

async def upsert_documents(collection: str, documents: list[dict]) -> int:

    if not documents:
        return 0

    # One round trip for many documents; upsert = insert or replace.
    result = await _collection(collection).bulk_write(
        [ReplaceOne({"_id": d["_id"]}, d, upsert=True) for d in documents],
        ordered=False,
    )

    return len(documents)


async def count_documents(collection: str, query: dict) -> int:

    return await _collection(collection).count_documents(query)


async def find_series(collection: str, query: dict, sort_field: str) -> list[dict]:

    cursor = _collection(collection).find(query, {"_id": 0}).sort(sort_field, ASCENDING)

    return [document async for document in cursor]


async def latest_value(collection: str, query: dict, field: str):

    document = await _collection(collection).find_one(query, sort=[(field, DESCENDING)])

    return None if document is None else document[field]


# ==========================================
# RUN LOG
# ==========================================

# A run notes the time ("heartbeat_at") whenever it changes, at least once per
# piece. One piece is a single Open-Meteo request, at most about 7 minutes with
# its retries. A run silent for longer than this belongs to a server that is gone.
RUN_STALE_AFTER = timedelta(minutes=30)


async def insert_run(run: dict) -> None:

    document = dict(run)
    document.setdefault("heartbeat_at", document.get("started_at"))

    await _collection("ingestion_runs").insert_one(document)


async def update_run(run_id: str, changes: dict) -> None:

    changes = {**changes, "heartbeat_at": datetime.now(timezone.utc)}

    await _collection("ingestion_runs").update_one({"_id": run_id}, {"$set": changes})


async def close_interrupted_runs(now: datetime, stale_after: timedelta = RUN_STALE_AFTER) -> int:

    # Called when a server starts and before a new run starts. Only runs that
    # have shown no sign of life for a while are closed: the hosted backend and
    # the daily job's own copy of the backend share this database, so a run
    # that is "running" may belong to the other one and still be alive.
    # (Runs stored before heartbeats existed are judged by their start time.)
    cutoff = now - stale_after

    result = await _collection("ingestion_runs").update_many(
        {
            "status": {"$in": ["queued", "running"]},
            "$or": [
                {"heartbeat_at": {"$lt": cutoff}},
                {"heartbeat_at": {"$exists": False}, "started_at": {"$lt": cutoff}},
                {"heartbeat_at": None, "started_at": {"$lt": cutoff}},
            ],
        },
        {"$set": {
            "status": "failed",
            "finished_at": now,
            "message": "The run was interrupted because the server stopped or restarted. "
                       "Data already stored is kept; start the same run again to continue.",
        }},
    )

    return result.modified_count


async def get_run(run_id: str) -> dict | None:

    return await _collection("ingestion_runs").find_one({"_id": run_id})


async def list_runs(limit: int) -> list[dict]:

    cursor = _collection("ingestion_runs").find().sort("started_at", DESCENDING).limit(limit)

    return [run async for run in cursor]


# ==========================================
# API CALL BUDGET
# ==========================================

def _hour_key(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H")


async def add_api_calls(moment: datetime, calls: float) -> None:

    await _collection("ingestion_api_usage").update_one(
        {"_id": _hour_key(moment)},
        {"$inc": {"calls": calls}, "$set": {"date": moment.strftime("%Y-%m-%d")}},
        upsert=True,
    )


async def api_calls_used(moment: datetime) -> tuple[float, float]:

    # (calls this hour, calls today), UTC.
    usage = _collection("ingestion_api_usage")

    hour = await usage.find_one({"_id": _hour_key(moment)})

    day_total = 0.0
    async for bucket in usage.find({"date": moment.strftime("%Y-%m-%d")}):
        day_total += bucket["calls"]

    return (hour["calls"] if hour else 0.0), day_total
