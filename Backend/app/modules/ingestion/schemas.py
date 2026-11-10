from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.modules.geospatial.schemas import GeoJSONPoint


IngestionKind = Literal["rain_history", "river_history", "rain_forecast", "river_forecast", "rain_recent"]

RunStatus = Literal["queued", "running", "completed", "paused_budget", "failed"]


class Site(BaseModel):

    site_id: str

    # "district": one point inside each district (rain).
    # "river": a verified GloFAS river cell (discharge).
    kind: Literal["district", "river"]

    name: str

    location: GeoJSONPoint

    measures: list[str]

    district_pcode: str | None = None

    division: str | None = None

    river: str | None = None

    approximate_location: GeoJSONPoint | None = None

    verification: dict[str, Any] | None = None


class SiteListResponse(BaseModel):

    count: int

    sites: list[Site]

    # River candidates that could not be identified reliably, with reasons.
    excluded_river_candidates: list[dict[str, Any]]

    method: dict[str, Any]


class RunRequest(BaseModel):

    kind: IngestionKind

    # History runs only.
    start_date: date | None = None

    end_date: date | None = None

    # Optional: only these sites (default: every suitable site).
    site_ids: list[str] | None = Field(default=None, min_length=1)

    # Forecast runs only.
    forecast_days: int = Field(default=3, ge=1, le=7)

    # rain_recent runs only: how many finished days back from today.
    past_days: int = Field(default=7, ge=1, le=30)


class RunResponse(BaseModel):

    run_id: str

    kind: IngestionKind

    status: RunStatus

    source: str

    start_date: str | None

    end_date: str | None

    forecast_days: int | None

    past_days: int | None = None

    site_ids: list[str]

    started_at: datetime

    finished_at: datetime | None

    pieces_total: int

    pieces_done: int

    # Pieces already fully stored (resumed runs).
    pieces_skipped: int

    values_written: int

    api_calls: float

    message: str | None


class DailyValue(BaseModel):

    site_id: str

    date: datetime

    precipitation_mm: float | None = None

    discharge_m3s: float | None = None

    missing: bool

    unit: str

    statistic: str

    is_forecast: bool

    source: str

    # The data-grid point the value really belongs to (not the site point).
    grid_location: GeoJSONPoint

    fetched_at: datetime

    run_id: str


class DailySeriesResponse(BaseModel):

    site: Site

    count: int

    values: list[DailyValue]

    attribution: list[str]


class HourlyForecastValue(BaseModel):

    site_id: str

    valid_time: datetime

    precipitation_mm: float | None

    missing: bool

    unit: str

    accumulation: str

    source: str

    grid_location: GeoJSONPoint

    fetched_at: datetime

    run_id: str


class RainForecastResponse(BaseModel):

    site: Site

    # When the forecast was fetched; null = no forecast stored yet.
    fetched_at: datetime | None

    count: int

    total_precipitation_mm: float

    values: list[HourlyForecastValue]

    attribution: list[str]


class UsageResponse(BaseModel):

    calls_this_hour: float

    calls_today_utc: float

    max_calls_per_hour: float

    max_calls_per_day: float

    note: str
