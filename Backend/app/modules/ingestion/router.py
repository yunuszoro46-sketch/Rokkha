from datetime import date
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status

from app.modules.ingestion.schemas import (
    DailySeriesResponse,
    RainForecastResponse,
    RunRequest,
    RunResponse,
    SiteListResponse,
    UsageResponse,
)
from app.modules.ingestion.service import (
    IngestionBusyError,
    IngestionRequestError,
    execute_run,
    latest_rain_forecast,
    list_sites,
    rain_series,
    recent_rain_series,
    river_series,
    run_by_id,
    runs,
    start_run,
    usage,
)


router = APIRouter(
    prefix="/ingestion",
    tags=["Ingestion"]
)


def _run_out(run: dict) -> dict:

    # MongoDB's "_id" is the API's "run_id".
    return {"run_id": run["_id"], **{k: v for k, v in run.items() if k != "_id"}}


@router.get(
    "/sites",
    response_model=SiteListResponse
)
async def get_sites(
    kind: Literal["district", "river"] | None = Query(default=None)
):

    return list_sites(kind)


@router.post(
    "/runs",
    response_model=RunResponse,
    status_code=status.HTTP_202_ACCEPTED
)
async def create_run(data: RunRequest, background_tasks: BackgroundTasks):

    try:
        run = await start_run(
            data.kind, data.start_date, data.end_date, data.site_ids, data.forecast_days,
            data.past_days,
        )

    except IngestionRequestError as error:
        raise HTTPException(status_code=422, detail=str(error))

    except IngestionBusyError as error:
        raise HTTPException(status_code=409, detail=str(error))

    # 202 Accepted: the run continues in the background after this response.
    # Follow it with GET /ingestion/runs/{run_id}.
    background_tasks.add_task(execute_run, run["_id"])

    return _run_out(run)


@router.get(
    "/runs",
    response_model=list[RunResponse]
)
async def get_runs(limit: int = Query(default=20, ge=1, le=200)):

    return [_run_out(run) for run in await runs(limit)]


@router.get(
    "/runs/{run_id}",
    response_model=RunResponse
)
async def get_run(run_id: str):

    run = await run_by_id(run_id)

    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    return _run_out(run)


@router.get(
    "/usage",
    response_model=UsageResponse
)
async def get_usage():

    return await usage()


async def _series(loader, site_id: str, start_date: date, end_date: date):

    if start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must not be after end_date.")

    try:
        return await loader(site_id, start_date, end_date)

    except LookupError:
        raise HTTPException(status_code=404, detail="Site not found")

    except IngestionRequestError as error:
        raise HTTPException(status_code=422, detail=str(error))


@router.get(
    "/rain",
    response_model=DailySeriesResponse
)
async def get_rain(site_id: str, start_date: date, end_date: date):

    return await _series(rain_series, site_id, start_date, end_date)


@router.get(
    "/rain-recent",
    response_model=DailySeriesResponse
)
async def get_recent_rain(site_id: str, start_date: date, end_date: date):

    # GFS rain for the last days, kept apart from ERA5 (GET /ingestion/rain).
    return await _series(recent_rain_series, site_id, start_date, end_date)


@router.get(
    "/river",
    response_model=DailySeriesResponse
)
async def get_river(site_id: str, start_date: date, end_date: date):

    return await _series(river_series, site_id, start_date, end_date)


@router.get(
    "/rain-forecast",
    response_model=RainForecastResponse
)
async def get_rain_forecast(site_id: str):

    try:
        return await latest_rain_forecast(site_id)

    except LookupError:
        raise HTTPException(status_code=404, detail="Site not found")

    except IngestionRequestError as error:
        raise HTTPException(status_code=422, detail=str(error))
