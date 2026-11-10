"""
The only code in the ingestion module that talks to the internet.

All data comes from Open-Meteo (no API key; free for non-commercial use;
data licensed CC BY 4.0):
- ERA5 reanalysis rain (ECMWF / Copernicus) via the Historical Weather API
- GFS forecast rain (NOAA) via the GFS API
- GloFAS river discharge (Copernicus Emergency Management Service) via the
  Flood API

Open-Meteo's free-tier rule for counting calls: one request = one call, but
"more than 2 weeks of data for a single location" or "more than 10
variables" count as several (fractional) calls. estimate_calls() applies
that rule so the module can stay inside the limits (see service.py).
"""

import asyncio
import math
from datetime import date

import httpx


ARCHIVE_API = "https://archive-api.open-meteo.com/v1/archive"
GFS_API = "https://api.open-meteo.com/v1/gfs"
FLOOD_API = "https://flood-api.open-meteo.com/v1/flood"

USER_AGENT = "ClimateShield-Rokkha-backend/0.5 (ingestion)"

ATTRIBUTION = [
    "Weather data by Open-Meteo.com (CC BY 4.0).",
    "ERA5: Generated using Copernicus Climate Change Service information; "
    "Hersbach et al. (2023), ERA5 hourly data, ECMWF.",
    "GloFAS river discharge: Copernicus Emergency Management Service "
    "(Global Flood Awareness System).",
    "GFS: NOAA National Centers for Environmental Prediction.",
]

# Tests replace this with httpx.MockTransport so they never go online.
_transport: httpx.AsyncBaseTransport | None = None

# Wait 5 s, then 10 s, before retrying a rate-limited or failing request.
# Tests set this to 0.
RETRY_BASE_SECONDS = 5.0


def set_transport(transport: httpx.AsyncBaseTransport | None) -> None:
    global _transport
    _transport = transport


class SourceError(RuntimeError):
    """The data source failed or returned something unexpected."""


def estimate_calls(locations: int, days: int, variables: int = 1) -> float:

    # Open-Meteo: > 14 days or > 10 variables per location count as more
    # than one call, fractionally (4 weeks = 2.0, 15 variables = 1.5).
    return locations * max(1.0, days / 14) * max(1.0, variables / 10)


async def _get(url: str, params: dict) -> list[dict]:

    async with httpx.AsyncClient(
        transport=_transport,
        timeout=120,
        headers={"User-Agent": USER_AGENT},
    ) as client:

        problem = ""

        for attempt in range(3):

            try:
                response = await client.get(url, params=params)

            # The connection itself failed (timeout, network down): wait and retry.
            except httpx.TransportError as error:
                problem = f"{type(error).__name__} ({error})"
                await asyncio.sleep(2 ** attempt * RETRY_BASE_SECONDS)
                continue

            # 429 = rate limited, 5xx = server trouble: wait and retry.
            if response.status_code == 429 or response.status_code >= 500:
                problem = f"HTTP {response.status_code}"
                await asyncio.sleep(2 ** attempt * RETRY_BASE_SECONDS)
                continue

            if response.status_code != 200:
                raise SourceError(f"{url} returned HTTP {response.status_code}: {response.text[:200]}")

            body = response.json()

            # One location -> one object; several -> a list.
            return body if isinstance(body, list) else [body]

    raise SourceError(
        f"{url} kept failing after 3 attempts: {problem}. "
        "Data already stored is kept; start the same run again later to continue."
    )


def _coords(points: list[list[float]]) -> dict:

    return {
        "latitude": ",".join(f"{lat:.5f}" for _, lat in points),
        "longitude": ",".join(f"{lon:.5f}" for lon, _ in points),
    }


async def fetch_era5_daily_rain(points: list[list[float]], start: str, end: str) -> list[dict]:

    return await _get(ARCHIVE_API, {
        **_coords(points),
        "daily": "precipitation_sum",
        "models": "era5",
        "timezone": "UTC",
        "start_date": start,
        "end_date": end,
    })


async def fetch_glofas_daily_discharge(points: list[list[float]], start: str, end: str) -> list[dict]:

    return await _get(FLOOD_API, {
        **_coords(points),
        "daily": "river_discharge",
        "start_date": start,
        "end_date": end,
    })


async def fetch_gfs_hourly_rain(points: list[list[float]], forecast_days: int) -> list[dict]:

    return await _get(GFS_API, {
        **_coords(points),
        "hourly": "precipitation",
        "forecast_days": forecast_days,
        "timezone": "UTC",
    })


def chunks(items: list, size: int) -> list[list]:

    return [items[i:i + size] for i in range(0, len(items), size)] if items else []


def days_between(start: str, end: str) -> int:

    return (date.fromisoformat(end) - date.fromisoformat(start)).days + 1


def ceil_calls(value: float) -> float:

    return math.ceil(value * 100) / 100
