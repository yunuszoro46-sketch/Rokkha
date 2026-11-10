"""
Environmental-data ingestion (Milestone 18).

Run kinds:
    rain_history     ERA5 daily rain, district sites, a date range
    river_history    GloFAS daily discharge, river sites, a date range
    river_forecast   GloFAS daily discharge forecast, river sites, next N days
    rain_forecast    GFS hourly rain forecast, district sites, next N days

Every run is logged in "ingestion_runs" (what, when, how many calls, how many
values, status). Work is split into pieces of up to 10 sites x 1 year. Each
piece is:
    skipped  if all its values are already stored (so re-running resumes),
    paused   if its estimated cost would cross the hourly/daily call budget,
    fetched, converted with full provenance, and upserted otherwise.
"""

from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from app.core.config import settings
from app.modules.ingestion import sources
from app.modules.ingestion.repository import (
    add_api_calls,
    api_calls_used,
    count_documents,
    find_series,
    get_run,
    get_sites,
    get_sites_document,
    insert_run,
    latest_value,
    list_runs,
    update_run,
    upsert_documents,
)


SITES_PER_REQUEST = 10

# ERA5 reaches the archive about 5 days after real time.
ERA5_DELAY_DAYS = 6

HISTORY_KINDS = {"rain_history", "river_history"}
FORECAST_KINDS = {"rain_forecast", "river_forecast"}

# Recent rain: the last days from GFS, for the days ERA5 has not delivered yet.
RECENT_KINDS = {"rain_recent"}

SOURCE_LABELS = {
    "rain_history": "ERA5 reanalysis (ECMWF, Copernicus C3S) via Open-Meteo Historical Weather API",
    "river_history": "GloFAS (Copernicus EMS) via Open-Meteo Flood API",
    "river_forecast": "GloFAS (Copernicus EMS) via Open-Meteo Flood API",
    "rain_forecast": "GFS (NOAA NCEP) via Open-Meteo GFS API",
    "rain_recent": "GFS (NOAA NCEP), recent days, via Open-Meteo GFS API",
}


class IngestionRequestError(ValueError):
    """The run request is invalid (dates, sites, kind)."""


class IngestionBusyError(RuntimeError):
    """Another run is still in progress."""


class BudgetPaused(Exception):
    """The next piece of work would exceed the call budget."""


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _midnight(day: str) -> datetime:
    return datetime.fromisoformat(day).replace(tzinfo=timezone.utc)


# ==========================================
# SITES
# ==========================================

def list_sites(kind: str | None = None) -> dict:

    document = get_sites_document()

    sites = [s for s in document["sites"] if kind is None or s["kind"] == kind]

    return {
        "count": len(sites),
        "sites": sites,
        "excluded_river_candidates": document.get("excluded_river_candidates", []),
        "method": document["method"],
    }


def _sites_for(kind: str, site_ids: list[str] | None) -> list[dict]:

    measure = "rain" if kind.startswith("rain") else "river_discharge"

    eligible = [s for s in get_sites() if measure in s["measures"]]

    if site_ids is None:
        return eligible

    by_id = {s["site_id"]: s for s in eligible}

    unknown = [i for i in site_ids if i not in by_id]
    if unknown:
        raise IngestionRequestError(
            f"Unknown or unsuitable site ids for {kind}: {', '.join(unknown)}"
        )

    return [by_id[i] for i in dict.fromkeys(site_ids)]


# ==========================================
# STARTING A RUN
# ==========================================

def _validate_dates(kind: str, start_date: date | None, end_date: date | None, today: date):

    if kind in FORECAST_KINDS or kind in RECENT_KINDS:
        return None, None

    if start_date is None or end_date is None:
        raise IngestionRequestError(f"{kind} needs start_date and end_date.")

    if start_date > end_date:
        raise IngestionRequestError("start_date must not be after end_date.")

    latest = today - timedelta(days=ERA5_DELAY_DAYS) if kind == "rain_history" else today

    if end_date > latest:
        raise IngestionRequestError(
            f"end_date must be on or before {latest.isoformat()} for {kind}"
            + (" (ERA5 reaches the archive about 5 days late)." if kind == "rain_history" else ".")
        )

    if start_date < date(1984, 1, 1):
        raise IngestionRequestError("start_date must be 1984-01-01 or later.")

    return start_date.isoformat(), end_date.isoformat()


async def start_run(
    kind: str,
    start_date: date | None = None,
    end_date: date | None = None,
    site_ids: list[str] | None = None,
    forecast_days: int = 3,
    past_days: int = 7,
) -> dict:

    # One run at a time, so two runs cannot overspend the budget together.
    for run in await list_runs(5):
        if run["status"] in ("queued", "running"):
            raise IngestionBusyError(f"Run {run['_id']} is still {run['status']}.")

    now = _utc_now()
    start, end = _validate_dates(kind, start_date, end_date, now.date())
    sites = _sites_for(kind, site_ids)

    run = {
        "_id": str(uuid4()),
        "kind": kind,
        "status": "queued",
        "source": SOURCE_LABELS[kind],
        "start_date": start,
        "end_date": end,
        "forecast_days": forecast_days if kind in FORECAST_KINDS else None,
        "past_days": past_days if kind in RECENT_KINDS else None,
        "site_ids": [s["site_id"] for s in sites],
        "started_at": now,
        "finished_at": None,
        "pieces_total": 0,
        "pieces_done": 0,
        "pieces_skipped": 0,
        "values_written": 0,
        "api_calls": 0.0,
        "message": None,
    }

    await insert_run(run)

    return run


# ==========================================
# EXECUTING A RUN (runs in the background)
# ==========================================

async def _spend(calls: float) -> None:

    # Check the budget BEFORE a request; pause instead of risking an IP block.
    hour, day = await api_calls_used(_utc_now())

    if hour + calls > settings.INGESTION_MAX_CALLS_PER_HOUR:
        raise BudgetPaused(
            f"Hourly call budget reached ({hour:.0f} used + {calls:.0f} needed > "
            f"{settings.INGESTION_MAX_CALLS_PER_HOUR:.0f}). Start the same run again next hour: "
            f"stored values are skipped."
        )

    if day + calls > settings.INGESTION_MAX_CALLS_PER_DAY:
        raise BudgetPaused(
            f"Daily call budget reached ({day:.0f} used + {calls:.0f} needed > "
            f"{settings.INGESTION_MAX_CALLS_PER_DAY:.0f}). Start the same run again tomorrow (UTC): "
            f"stored values are skipped."
        )


def _year_pieces(start: str, end: str) -> list[tuple[str, str]]:

    pieces = []
    current = date.fromisoformat(start)
    last = date.fromisoformat(end)

    while current <= last:
        piece_end = min(date(current.year, 12, 31), last)
        pieces.append((current.isoformat(), piece_end.isoformat()))
        current = piece_end + timedelta(days=1)

    return pieces


def _daily_documents(kind, run_id, fetched_at, sites, results, field, value_name, unit, statistic):

    documents = []

    for site, result in zip(sites, results):

        grid = {"type": "Point", "coordinates": [result["longitude"], result["latitude"]]}

        for day, value in zip(result["daily"]["time"], result["daily"][field]):

            documents.append({
                "_id": f"{site['site_id']}|{day}",
                "site_id": site["site_id"],
                "date": _midnight(day),
                value_name: value,
                # None = the source has no value for that day; stored so a
                # re-run knows the day was already asked for.
                "missing": value is None,
                "unit": unit,
                "statistic": statistic,
                "is_forecast": kind == "river_forecast" and _midnight(day) > fetched_at,
                "source": SOURCE_LABELS[kind],
                "grid_location": grid,
                "fetched_at": fetched_at,
                "run_id": run_id,
            })

    return documents


async def _history_piece(run, sites, start, end, collection, fetch, field, value_name, unit, statistic):

    days = sources.days_between(start, end)

    # History: skip a piece that is already fully stored (resumable runs).
    # Forecasts: always fetch, so a newer forecast replaces the older one.
    if run["kind"] in HISTORY_KINDS:

        already = await count_documents(collection, {
            "site_id": {"$in": [s["site_id"] for s in sites]},
            "date": {"$gte": _midnight(start), "$lte": _midnight(end)},
        })

        if already >= len(sites) * days:
            return "skipped", 0, 0.0

    calls = sources.estimate_calls(len(sites), days)
    await _spend(calls)

    fetched_at = _utc_now()
    results = await fetch([s["location"]["coordinates"] for s in sites], start, end)
    await add_api_calls(fetched_at, calls)

    if len(results) != len(sites):
        raise sources.SourceError(f"expected {len(sites)} locations, got {len(results)}")

    documents = _daily_documents(
        run["kind"], run["_id"], fetched_at, sites, results, field, value_name, unit, statistic
    )

    return "done", await upsert_documents(collection, documents), calls


async def _forecast_rain_piece(run, sites, forecast_days):

    calls = sources.estimate_calls(len(sites), forecast_days)
    await _spend(calls)

    fetched_at = _utc_now()
    results = await sources.fetch_gfs_hourly_rain([s["location"]["coordinates"] for s in sites], forecast_days)
    await add_api_calls(fetched_at, calls)

    if len(results) != len(sites):
        raise sources.SourceError(f"expected {len(sites)} locations, got {len(results)}")

    fetch_key = fetched_at.strftime("%Y%m%dT%H%M")
    documents = []

    for site, result in zip(sites, results):

        grid = {"type": "Point", "coordinates": [result["longitude"], result["latitude"]]}

        for valid, value in zip(result["hourly"]["time"], result["hourly"]["precipitation"]):

            documents.append({
                "_id": f"{site['site_id']}|{fetch_key}|{valid}",
                "site_id": site["site_id"],
                "valid_time": datetime.fromisoformat(valid).replace(tzinfo=timezone.utc),
                "precipitation_mm": value,
                "missing": value is None,
                "unit": "mm",
                "accumulation": "1 h, the hour ending at valid_time",
                "source": SOURCE_LABELS["rain_forecast"],
                "grid_location": grid,
                "fetched_at": fetched_at,
                "run_id": run["_id"],
            })

    return await upsert_documents("rain_forecast_hourly", documents), calls


async def _recent_rain_piece(run, sites, past_days):

    calls = sources.estimate_calls(len(sites), past_days + 1)
    await _spend(calls)

    fetched_at = _utc_now()
    results = await sources.fetch_gfs_recent_daily_rain(
        [s["location"]["coordinates"] for s in sites], past_days
    )
    await add_api_calls(fetched_at, calls)

    if len(results) != len(sites):
        raise sources.SourceError(f"expected {len(sites)} locations, got {len(results)}")

    documents = _daily_documents(
        run["kind"], run["_id"], fetched_at, sites, results,
        "precipitation_sum", "precipitation_mm", "mm", "24 h total, 00:00-24:00 UTC",
    )

    # Keep finished days only: today's total is still growing.
    today = _midnight(fetched_at.date().isoformat())
    documents = [d for d in documents if d["date"] < today]

    return await upsert_documents("rain_recent_daily", documents), calls


async def execute_run(run_id: str) -> None:

    run = await get_run(run_id)
    sites = [s for s in get_sites() if s["site_id"] in set(run["site_ids"])]
    site_groups = sources.chunks(sites, SITES_PER_REQUEST)

    progress = {"pieces_done": 0, "pieces_skipped": 0, "values_written": 0, "api_calls": 0.0}

    await update_run(run_id, {"status": "running"})

    try:

        if run["kind"] == "rain_forecast":

            await update_run(run_id, {"pieces_total": len(site_groups)})

            for group in site_groups:
                written, calls = await _forecast_rain_piece(run, group, run["forecast_days"])
                progress["pieces_done"] += 1
                progress["values_written"] += written
                progress["api_calls"] += calls
                await update_run(run_id, dict(progress))

        elif run["kind"] == "rain_recent":

            await update_run(run_id, {"pieces_total": len(site_groups)})

            for group in site_groups:
                written, calls = await _recent_rain_piece(run, group, run["past_days"])
                progress["pieces_done"] += 1
                progress["values_written"] += written
                progress["api_calls"] += calls
                await update_run(run_id, dict(progress))

        else:

            if run["kind"] == "river_forecast":
                today = _utc_now().date()
                start = today.isoformat()
                end = (today + timedelta(days=run["forecast_days"] - 1)).isoformat()
            else:
                start, end = run["start_date"], run["end_date"]

            rain = run["kind"] == "rain_history"

            settings_for_kind = dict(
                collection="rain_daily" if rain else "river_discharge_daily",
                fetch=sources.fetch_era5_daily_rain if rain else sources.fetch_glofas_daily_discharge,
                field="precipitation_sum" if rain else "river_discharge",
                value_name="precipitation_mm" if rain else "discharge_m3s",
                unit="mm" if rain else "m3/s",
                statistic=(
                    "24 h total, 00:00-24:00 UTC" if rain else "daily mean discharge (GloFAS)"
                ),
            )

            pieces = [(g, a, b) for g in site_groups for a, b in _year_pieces(start, end)]

            await update_run(run_id, {"pieces_total": len(pieces)})

            for group, piece_start, piece_end in pieces:

                status, written, calls = await _history_piece(
                    run, group, piece_start, piece_end, **settings_for_kind
                )

                progress["pieces_skipped" if status == "skipped" else "pieces_done"] += 1
                progress["values_written"] += written
                progress["api_calls"] += calls
                await update_run(run_id, dict(progress))

        await update_run(run_id, {"status": "completed", "finished_at": _utc_now()})

    except BudgetPaused as pause:
        await update_run(run_id, {"status": "paused_budget", "message": str(pause), "finished_at": _utc_now()})

    except Exception as error:   # keep the reason in the run log
        await update_run(run_id, {
            "status": "failed",
            "message": f"{type(error).__name__}: {error}"[:500],
            "finished_at": _utc_now(),
        })


# ==========================================
# READING DATA
# ==========================================

def _check_site(site_id: str, measure: str) -> dict:

    for site in get_sites():
        if site["site_id"] == site_id:
            if measure not in site["measures"]:
                raise IngestionRequestError(f"Site {site_id} does not measure {measure}.")
            return site

    raise LookupError(site_id)


async def rain_series(site_id: str, start_date: date, end_date: date) -> dict:

    site = _check_site(site_id, "rain")

    values = await find_series("rain_daily", {
        "site_id": site_id,
        "date": {"$gte": _midnight(start_date.isoformat()), "$lte": _midnight(end_date.isoformat())},
    }, "date")

    return {"site": site, "count": len(values), "values": values, "attribution": sources.ATTRIBUTION}


async def recent_rain_series(site_id: str, start_date: date, end_date: date) -> dict:

    site = _check_site(site_id, "rain")

    values = await find_series("rain_recent_daily", {
        "site_id": site_id,
        "date": {"$gte": _midnight(start_date.isoformat()), "$lte": _midnight(end_date.isoformat())},
    }, "date")

    return {"site": site, "count": len(values), "values": values, "attribution": sources.ATTRIBUTION}


async def river_series(site_id: str, start_date: date, end_date: date) -> dict:

    site = _check_site(site_id, "river_discharge")

    values = await find_series("river_discharge_daily", {
        "site_id": site_id,
        "date": {"$gte": _midnight(start_date.isoformat()), "$lte": _midnight(end_date.isoformat())},
    }, "date")

    return {"site": site, "count": len(values), "values": values, "attribution": sources.ATTRIBUTION}


async def latest_rain_forecast(site_id: str) -> dict:

    site = _check_site(site_id, "rain")

    fetched_at = await latest_value("rain_forecast_hourly", {"site_id": site_id}, "fetched_at")

    values = [] if fetched_at is None else await find_series(
        "rain_forecast_hourly", {"site_id": site_id, "fetched_at": fetched_at}, "valid_time"
    )

    return {
        "site": site,
        "fetched_at": fetched_at,
        "count": len(values),
        "total_precipitation_mm": round(sum(v["precipitation_mm"] or 0 for v in values), 2),
        "values": values,
        "attribution": sources.ATTRIBUTION,
    }


async def runs(limit: int) -> list[dict]:
    return await list_runs(limit)


async def run_by_id(run_id: str) -> dict | None:
    return await get_run(run_id)


async def usage() -> dict:

    hour, day = await api_calls_used(_utc_now())

    return {
        "calls_this_hour": round(hour, 2),
        "calls_today_utc": round(day, 2),
        "max_calls_per_hour": settings.INGESTION_MAX_CALLS_PER_HOUR,
        "max_calls_per_day": settings.INGESTION_MAX_CALLS_PER_DAY,
        "note": "Open-Meteo free tier: < 5,000 calls/hour, < 10,000/day, non-commercial use. "
                "One call = up to 14 days for one location.",
    }
