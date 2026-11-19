"""
Read-only figures for the Admin Control Centre, computed from stored records at request time, plus
administrative announcements. Nothing here changes predictions, observations or the model: the admin
area can watch the science, not edit it.
"""

import json
import re
import time
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

from pymongo import DESCENDING, ReturnDocument

from app.core.config import settings
from app.core.database import get_db

DHAKA = ZoneInfo("Asia/Dhaka")
BACKEND_DIR = Path(__file__).resolve().parents[3]
LABELS_FILE = BACKEND_DIR / "data" / "labels" / "district_flood_observations.json"
ANNOUNCEMENTS = "announcements"

OPEN_STATUSES = ["available", "accepted", "en_route", "arrived", "in_progress"]
HANDLING_STATUSES = ["accepted", "en_route", "arrived", "in_progress"]


def _now() -> datetime:
    moment = datetime.now(timezone.utc)
    return moment.replace(microsecond=moment.microsecond // 1000 * 1000)


def _today() -> date:
    return datetime.now(DHAKA).date()


def _as_date(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


# ==========================================
# DATA SOURCES
# ==========================================

@lru_cache(maxsize=4)
def _labels_summary(mtime: float) -> dict:
    data = json.loads(LABELS_FILE.read_text())
    latest = None
    passes = 0
    for district in data.get("districts", []):
        rows = district.get("rows") or []
        passes += len(rows)
        if rows:
            d = rows[-1][0]
            latest = d if latest is None or d > latest else latest
    return {"latest": latest, "rows": passes, "generated_on": data.get("generated_on"), "attribution": data.get("attribution")}


def labels_summary() -> dict | None:
    try:
        return _labels_summary(LABELS_FILE.stat().st_mtime)
    except (OSError, ValueError):
        return None


async def _latest(collection: str, field: str, query: dict | None = None):
    doc = await get_db()[collection].find_one(query or {}, {field: 1}, sort=[(field, DESCENDING)])
    return doc.get(field) if doc else None


async def _runs_for(kind: str) -> dict:
    runs = get_db()["ingestion_runs"]
    ok = await runs.find_one({"kind": kind, "status": "completed"}, sort=[("started_at", DESCENDING)])
    bad = await runs.find_one({"kind": kind, "status": "failed"}, sort=[("started_at", DESCENDING)])

    def brief(run):
        if not run:
            return None
        started, finished = _utc(run.get("started_at")), _utc(run.get("finished_at"))
        return {
            "id": run["_id"],
            "status": run.get("status"),
            "started_at": started,
            "finished_at": finished,
            "duration_s": round((finished - started).total_seconds(), 1) if started and finished else None,
            "values_written": run.get("values_written"),
            # Error text from the data provider; it never holds secrets (Open-Meteo needs no key).
            "message": (run.get("message") or "")[:300] or None,
        }

    return {"last_success": brief(ok), "last_failure": brief(bad)}


def _freshness(latest: date | None, expected_days: int, last_success, last_failure) -> str:
    if latest is None:
        return "unknown"
    if last_failure and (not last_success or (last_failure["started_at"] or datetime.min.replace(tzinfo=timezone.utc)) > (last_success["started_at"] or datetime.min.replace(tzinfo=timezone.utc))):
        return "failing"
    age = (_today() - latest).days
    return "healthy" if age <= expected_days else "delayed"


async def data_sources() -> list[dict]:
    """Every data source Rokkha really uses, with its newest stored data and its latest runs."""

    today = _today()
    out: list[dict] = []

    async def dynamic(**source):
        latest_raw = source.pop("latest_raw")
        latest = _as_date(latest_raw)
        runs = await _runs_for(source["run_kind"]) if source.get("run_kind") else {"last_success": None, "last_failure": None}
        out.append({
            **source,
            "kind": "updated",
            "latest_data": latest.isoformat() if latest else None,
            "latest_data_at": latest_raw if isinstance(latest_raw, datetime) else None,
            "age_days": (today - latest).days if latest else None,
            "status": _freshness(latest, source["expected_days"], runs["last_success"], runs["last_failure"]),
            **runs,
        })

    labels = labels_summary()
    await dynamic(
        id="gfm", name="Satellite flood observations", category="Observation (satellite radar)",
        provider="Copernicus EMS Global Flood Monitoring (GFM), Sentinel-1",
        coverage="Bangladesh, 64 districts (8 mostly hidden from radar)",
        frequency="Each Sentinel-1 pass (every few days); added by the daily update",
        format="Flood-extent rasters summarised per district and pass (file in the backend)",
        attribution=(labels or {}).get("attribution") or "Copernicus EMS GFM",
        limitations="Short floods between passes and city waterlogging can be missed; dense vegetation and buildings hide water.",
        latest_raw=(labels or {}).get("latest"), run_kind=None, expected_days=12,
    )
    await dynamic(
        id="era5", name="Daily rain (reanalysis)", category="Model input: rain",
        provider="ECMWF ERA5 via Open-Meteo", coverage="One point per district (64)",
        frequency="Daily; ERA5 arrives about 5 days late", format="Daily totals (mm) in MongoDB",
        attribution="Contains modified Copernicus Climate Change Service information",
        limitations="About 25 km grid; a best estimate of past weather, not a rain gauge.",
        latest_raw=await _latest("rain_daily", "date"), run_kind="rain_history", expected_days=8,
    )
    await dynamic(
        id="gfs_recent", name="Recent rain (last days)", category="Model input: rain",
        provider="NOAA GFS via Open-Meteo", coverage="One point per district (64)",
        frequency="Daily", format="Daily totals (mm) in MongoDB",
        attribution="NOAA NCEP GFS via Open-Meteo",
        limitations="Weather-model values for the days ERA5 does not cover yet.",
        latest_raw=await _latest("rain_recent_daily", "date"), run_kind="rain_recent", expected_days=2,
    )
    await dynamic(
        id="gfs_forecast", name="Rain forecast (4 days)", category="Forecast: rain",
        provider="NOAA GFS via Open-Meteo", coverage="One point per district (64)",
        frequency="Daily fetch of hourly values", format="Hourly totals (mm) in MongoDB",
        attribution="NOAA NCEP GFS via Open-Meteo",
        limitations="Weather forecast, not a flood forecast; shown on the map only.",
        latest_raw=await _latest("rain_forecast_hourly", "fetched_at"), run_kind="rain_forecast", expected_days=1,
    )
    await dynamic(
        id="glofas", name="River flow", category="Model input: river (modelled)",
        provider="Copernicus EMS GloFAS via Open-Meteo", coverage="9 river sites",
        frequency="Daily", format="Daily mean discharge (m³/s) in MongoDB",
        attribution="Copernicus EMS GloFAS",
        limitations="Modelled flow, not a gauge water level; no danger levels.",
        latest_raw=await _latest("river_discharge_daily", "date", {"is_forecast": {"$ne": True}}), run_kind="river_history", expected_days=3,
    )
    await dynamic(
        id="glofas_forecast", name="River flow forecast (7 days)", category="Forecast: river (modelled)",
        provider="Copernicus EMS GloFAS via Open-Meteo", coverage="9 river sites",
        frequency="Daily", format="Daily discharge forecast (m³/s) in MongoDB",
        attribution="Copernicus EMS GloFAS",
        limitations="Modelled forecast; shown on station charts only.",
        latest_raw=await _latest("river_discharge_daily", "fetched_at", {"is_forecast": True}), run_kind="river_forecast", expected_days=1,
    )
    await dynamic(
        id="model", name="Rokkha flood forecast", category="Model output",
        provider="Rokkha XGBoost model (this backend)", coverage="56 of 64 districts",
        frequency="Daily, after the data steps", format="Probability and level per district and day",
        attribution="Rokkha", limitations="District level, one day ahead; not an official warning.",
        latest_raw=await _latest("flood_predictions", "issued_at"), run_kind=None, expected_days=1,
    )

    assets = get_db()["assets"]
    osm_note = await assets.find_one({"source": "OpenStreetMap"}, {"notes": 1})
    snapshot = re.search(r"snapshot (\d{4}-\d{2}-\d{2})", (osm_note or {}).get("notes") or "")
    out.append({
        "id": "osm_facilities", "name": "Shelters and health facilities", "category": "Reference: facilities",
        "provider": "OpenStreetMap (HOT export via HDX)", "coverage": f"{await assets.count_documents({})} places",
        "frequency": "Imported by hand (snapshot)", "format": "Points in MongoDB",
        "attribution": "© OpenStreetMap contributors, ODbL", "kind": "fixed",
        "latest_data": snapshot.group(1) if snapshot else None, "status": "fixed",
        "limitations": "Not checked on the ground; duplicates and missing capacity (see SHELTER_DATA_AUDIT).",
        "last_success": None, "last_failure": None, "age_days": None,
    })
    for fixed in (
        ("boundaries", "Administrative boundaries", "Reference: geography", "BBS and UN OCHA, COD-AB v03 (2023)", "8 divisions, 64 districts, 507 upazilas", "CC BY-IGO", "No union boundaries."),
        ("hazard", "Modelled river-flood hazard", "Modelled hazard", "JRC GloFAS flood hazard maps v2.1.2", "Bangladesh, ~90 m", "JRC (folder states CC BY 4.0 and ODbL)", "Ignores embankments; describes possibility, not current conditions."),
        ("unosat", "Past flood extents", "Historical observation", "UNOSAT flood analyses 2016–2024", "10 events", "UNITAR-UNOSAT, CC BY-SA", "Only the mapped events; not every flood."),
    ):
        out.append({
            "id": fixed[0], "name": fixed[1], "category": fixed[2], "provider": fixed[3], "coverage": fixed[4],
            "frequency": "Fixed dataset (changes only with a new release)", "format": "Files in the backend",
            "attribution": fixed[5], "limitations": fixed[6], "kind": "fixed", "latest_data": None,
            "status": "fixed", "last_success": None, "last_failure": None, "age_days": None,
        })
    return out


async def ingestion_runs(limit: int = 50, kind: str | None = None, status: str | None = None) -> list[dict]:
    query: dict = {}
    if kind:
        query["kind"] = kind
    if status:
        query["status"] = status
    cursor = get_db()["ingestion_runs"].find(query, {"site_ids": 0}).sort("started_at", DESCENDING).limit(limit)
    out = []
    async for run in cursor:
        started, finished = _utc(run.get("started_at")), _utc(run.get("finished_at"))
        out.append({
            "id": run["_id"], "kind": run.get("kind"), "status": run.get("status"), "source": run.get("source"),
            "started_at": started, "finished_at": finished,
            "duration_s": round((finished - started).total_seconds(), 1) if started and finished else None,
            "values_written": run.get("values_written"), "pieces_done": run.get("pieces_done"),
            "pieces_total": run.get("pieces_total"), "api_calls": run.get("api_calls"),
            "message": (run.get("message") or "")[:500] or None,
        })
    return out


# ==========================================
# OVERVIEW
# ==========================================

async def overview() -> dict:
    db = get_db()

    users = {row["_id"] or "user": row["n"] async for row in await db["users"].aggregate([{"$group": {"_id": "$role", "n": {"$sum": 1}}}])}
    suspended = await db["users"].count_documents({"status": "suspended"})
    teams_total = await db["rescue_teams"].count_documents({})
    teams_with_members = len(await db["users"].distinct("team_id", {"team_id": {"$ne": None}, "status": {"$ne": "suspended"}}))

    by_status = {row["_id"]: row["n"] async for row in await db["sos_requests"].aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}])}
    released_waiting = await db["sos_requests"].count_documents({"status": "available", "releases.0": {"$exists": True}})

    latest_target = await _latest("flood_predictions", "target_date")
    model = None
    if latest_target:
        levels = {row["_id"]: row["n"] async for row in await db["flood_predictions"].aggregate([
            {"$match": {"target_date": latest_target}},
            {"$group": {"_id": {"$ifNull": ["$alert_level", "$status"]}, "n": {"$sum": 1}}},
        ])}
        issued = await _latest("flood_predictions", "issued_at", {"target_date": latest_target})
        model = {"target_date": latest_target, "issued_at": _utc(issued), "watch": levels.get("watch", 0), "alert": levels.get("alert", 0),
                 "none": levels.get("none", 0), "not_covered": levels.get("unsupported", 0)}

    activity = []
    async for row in await db["sos_requests"].aggregate([
        {"$project": {"reference": 1, "district": "$district.name", "history": 1}},
        {"$unwind": "$history"},
        {"$sort": {"history.at": -1}},
        {"$limit": 12},
    ]):
        h = row["history"]
        activity.append({"reference": row.get("reference"), "district": row.get("district"), "event": h.get("event"),
                         "status": h.get("status"), "team": (h.get("team") or {}).get("name"), "at": _utc(h.get("at"))})

    from app.modules.admin import audit

    sources = await data_sources()
    return {
        "generated_at": _now(),
        "users": {"total": sum(users.values()), "by_role": users, "suspended": suspended},
        "teams": {"total": teams_total, "with_active_members": teams_with_members},
        "requests": {
            "total": sum(by_status.values()),
            "by_status": by_status,
            "waiting_for_team": by_status.get("available", 0),
            "released_waiting": released_waiting,
            "being_handled": sum(by_status.get(s, 0) for s in HANDLING_STATUSES),
            "completed": by_status.get("completed", 0),
            "cancelled": by_status.get("cancelled", 0),
        },
        "model": model,
        "announcements_published": await db[ANNOUNCEMENTS].count_documents({"status": "published"}),
        "data": [{"id": s["id"], "name": s["name"], "status": s["status"], "latest_data": s.get("latest_data"), "age_days": s.get("age_days")} for s in sources],
        "recent_rescue_activity": activity,
        "recent_admin_activity": await audit.list_events(limit=8),
    }


# ==========================================
# ANALYTICS
# ==========================================

def _day_range(days: int) -> list[str]:
    end = _today()
    return [(end - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]


async def _per_day(collection: str, field: str, since: datetime, match: dict | None = None, split: str | None = None) -> dict:
    group_id: dict = {"day": {"$dateToString": {"format": "%Y-%m-%d", "date": f"${field}", "timezone": "Asia/Dhaka"}}}
    if split:
        group_id["split"] = f"${split}"
    rows = await get_db()[collection].aggregate([
        {"$match": {field: {"$gte": since}, **(match or {})}},
        {"$group": {"_id": group_id, "n": {"$sum": 1}}},
    ])
    out: dict = {}
    async for row in rows:
        key = row["_id"]["day"]
        if split:
            out.setdefault(key, {})[row["_id"].get("split") or "unknown"] = row["n"]
        else:
            out[key] = row["n"]
    return out


async def analytics(days: int = 30) -> dict:
    db = get_db()
    day_list = _day_range(days)
    since = datetime.combine(date.fromisoformat(day_list[0]), datetime.min.time(), DHAKA).astimezone(timezone.utc)

    received = await _per_day("sos_requests", "received_at", since)
    completed = {}
    async for row in await db["sos_requests"].aggregate([
        {"$unwind": "$history"},
        {"$match": {"history.event": "completed", "history.at": {"$gte": since}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$history.at", "timezone": "Asia/Dhaka"}}, "n": {"$sum": 1}}},
    ]):
        completed[row["_id"]] = row["n"]

    needs = {row["_id"]: row["n"] async for row in await db["sos_requests"].aggregate([
        {"$match": {"received_at": {"$gte": since}}}, {"$unwind": "$needs"}, {"$group": {"_id": "$needs", "n": {"$sum": 1}}},
    ])}
    districts = [{"pcode": row["_id"]["pcode"], "name": row["_id"]["name"], "n": row["n"]} async for row in await db["sos_requests"].aggregate([
        {"$match": {"received_at": {"$gte": since}}},
        {"$group": {"_id": {"pcode": "$district.pcode", "name": "$district.name"}, "n": {"$sum": 1}}},
        {"$sort": {"n": -1}}, {"$limit": 12},
    ])]
    teams = [{"team": row["_id"], "accepted": row["n"]} async for row in await db["sos_requests"].aggregate([
        {"$unwind": "$history"},
        {"$match": {"history.event": "accepted", "history.at": {"$gte": since}}},
        {"$group": {"_id": "$history.team.name", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}}, {"$limit": 12},
    ])]
    registrations = await _per_day("users", "created_at", since)
    runs = await _per_day("ingestion_runs", "started_at", since, split="status")

    alerts = {}
    async for row in await db["flood_predictions"].aggregate([
        {"$match": {"target_date": {"$gte": day_list[0]}}},
        {"$group": {"_id": {"day": "$target_date", "level": "$alert_level"}, "n": {"$sum": 1}}},
    ]):
        alerts.setdefault(row["_id"]["day"], {})[row["_id"]["level"] or "none"] = row["n"]

    total_runs = sum(sum(v.values()) for v in runs.values())
    ok_runs = sum(v.get("completed", 0) for v in runs.values())
    return {
        "days": day_list,
        "requests": [{"day": d, "received": received.get(d, 0), "completed": completed.get(d, 0)} for d in day_list],
        "requests_by_need": needs,
        "requests_by_district": districts,
        "team_acceptances": teams,
        "registrations": [{"day": d, "n": registrations.get(d, 0)} for d in day_list],
        "ingestion": [{"day": d, **runs.get(d, {})} for d in day_list],
        "ingestion_totals": {"runs": total_runs, "completed": ok_runs},
        "model_levels": [{"day": d, "forecast": d in alerts, "watch": alerts.get(d, {}).get("watch", 0), "alert": alerts.get(d, {}).get("alert", 0)} for d in day_list],
        "method": "Counts from stored records, grouped by Bangladesh calendar day. Days with no record count 0; "
                  "model levels exist only for days a forecast was stored (forecast=false otherwise).",
    }


# ==========================================
# SYSTEM HEALTH
# ==========================================

async def system_health() -> dict:
    db = get_db()
    started = time.perf_counter()
    try:
        await db.command("ping")
        db_ok, db_ms = True, round((time.perf_counter() - started) * 1000, 1)
    except Exception:  # noqa: BLE001  (reported, never raised to the visitor)
        db_ok, db_ms = False, None

    week = _now() - timedelta(days=7)
    runs = db["ingestion_runs"]
    return {
        "checked_at": _now(),
        "api": {"status": "up", "note": "This page was answered by the API, so it is running."},
        "database": {"status": "up" if db_ok else "down", "ping_ms": db_ms},
        "ingestion": {
            "running_now": await runs.count_documents({"status": {"$in": ["queued", "running"]}}),
            "failed_last_7_days": await runs.count_documents({"status": "failed", "started_at": {"$gte": week}}),
            "paused_for_budget_last_7_days": await runs.count_documents({"status": "paused_budget", "started_at": {"$gte": week}}),
            "completed_last_7_days": await runs.count_documents({"status": "completed", "started_at": {"$gte": week}}),
        },
        "public_read_only": bool(getattr(settings, "PUBLIC_READ_ONLY", False)),
        "application_errors": {"available": False, "note": "Application errors are not stored by Rokkha yet (no error tracker is connected)."},
    }


# ==========================================
# ANNOUNCEMENTS
# ==========================================

def _ann_out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = doc.pop("_id")
    doc["label"] = "Announcement from Rokkha administrators — not an official warning"
    return doc


async def list_announcements(only_published: bool, limit: int = 50) -> list[dict]:
    query = {"status": "published"} if only_published else {}
    cursor = get_db()[ANNOUNCEMENTS].find(query).sort("published_at", DESCENDING).limit(limit)
    out = []
    async for doc in cursor:
        item = _ann_out(doc)
        if only_published:
            # The public sees the text and its times, not who wrote it or the edit history.
            item = {k: item[k] for k in ("id", "label", "title", "body", "level", "district_pcodes", "published_at", "updated_at")}
        out.append(item)
    return out


async def publish_announcement(admin: dict, title: str, body: str, level: str, district_pcodes: list[str]) -> dict:
    now = _now()
    doc = {
        "_id": str(uuid4()), "title": title, "body": body, "level": level, "district_pcodes": district_pcodes,
        "status": "published", "published_at": now, "updated_at": now,
        "published_by": {"id": admin["id"], "name": admin.get("name")},
        "history": [{"event": "published", "at": now, "by": {"id": admin["id"], "name": admin.get("name")}}],
    }
    await get_db()[ANNOUNCEMENTS].insert_one(doc)
    return _ann_out(doc)


class AnnouncementNotFound(Exception):
    pass


async def correct_announcement(admin: dict, ann_id: str, title: str, body: str, reason: str) -> tuple[dict, dict]:
    col = get_db()[ANNOUNCEMENTS]
    before = await col.find_one({"_id": ann_id, "status": "published"})
    if before is None:
        raise AnnouncementNotFound()
    now = _now()
    step = {"event": "corrected", "at": now, "by": {"id": admin["id"], "name": admin.get("name")}, "reason": reason,
            "previous": {"title": before["title"], "body": before["body"]}}
    after = await col.find_one_and_update(
        {"_id": ann_id, "status": "published"},
        {"$set": {"title": title, "body": body, "updated_at": now}, "$push": {"history": step}},
        return_document=ReturnDocument.AFTER,
    )
    if after is None:
        raise AnnouncementNotFound()
    return _ann_out(before), _ann_out(after)


async def withdraw_announcement(admin: dict, ann_id: str, reason: str) -> dict:
    now = _now()
    after = await get_db()[ANNOUNCEMENTS].find_one_and_update(
        {"_id": ann_id, "status": "published"},
        {"$set": {"status": "withdrawn", "updated_at": now, "withdrawn_at": now, "withdraw_reason": reason},
         "$push": {"history": {"event": "withdrawn", "at": now, "by": {"id": admin["id"], "name": admin.get("name")}, "reason": reason}}},
        return_document=ReturnDocument.AFTER,
    )
    if after is None:
        raise AnnouncementNotFound()
    return _ann_out(after)
