import json
from datetime import date, datetime, time, timezone
from functools import lru_cache
from pathlib import Path

import xgboost
from pymongo import ASCENDING, ReplaceOne

from app.core.database import get_db
from app.modules.geospatial.repository import get_satellite_observations, satellite_observations_version


DATA_DIR = Path(__file__).resolve().parents[3] / "data"

STATIC_FILE = DATA_DIR / "ml" / "district_static.json"

# The trained model is delivered as two files (written by the training script):
#   flood_model.json        the XGBoost model
#   flood_model.meta.json   what it predicts, its inputs, test results, thresholds
MODEL_DIR = DATA_DIR / "models"

PREDICTIONS = "flood_predictions"

_loaded: dict = {"key": None, "model": None}


def load_model() -> dict | None:
    """The trained model and its description, or None if no model exists yet."""

    model_file = MODEL_DIR / "flood_model.json"
    meta_file = MODEL_DIR / "flood_model.meta.json"

    if not (model_file.exists() and meta_file.exists()):
        return None

    # Reload only when the files change (a newly trained model is picked up).
    key = (str(model_file), model_file.stat().st_mtime_ns, meta_file.stat().st_mtime_ns)

    if _loaded["key"] != key:
        booster = xgboost.Booster()
        booster.load_model(model_file)
        _loaded["model"] = {
            "booster": booster,
            "meta": json.loads(meta_file.read_text(encoding="utf-8")),
        }
        _loaded["key"] = key

    return _loaded["model"]


@lru_cache(maxsize=1)
def get_static() -> dict[str, dict]:

    rows = json.loads(STATIC_FILE.read_text(encoding="utf-8"))["districts"]

    return {row["pcode"]: row for row in rows}


def get_labelled_passes() -> dict[str, list[tuple[date, float]]]:
    """Per district: (day, flooded_share) of satellite passes that saw at least half of it."""

    return _labelled_passes(satellite_observations_version())


@lru_cache(maxsize=1)
def _labelled_passes(version: tuple) -> dict[str, list[tuple[date, float]]]:

    data = get_satellite_observations()
    minimum = data["label_rule"]["min_observed_share"]

    return {
        district["pcode"]: [
            (date.fromisoformat(row[0]), row[2])
            for row in district["rows"] if row[1] >= minimum
        ]
        for district in data["districts"]
    }


def _midnight(day: date) -> datetime:

    return datetime.combine(day, time.min, tzinfo=timezone.utc)


async def daily_values(collection: str, field: str, site_ids: list[str], start: date, end: date) -> dict:
    """{site_id: {day: value}} of stored daily values between two days (inclusive)."""

    cursor = get_db()[collection].find(
        {
            "site_id": {"$in": site_ids},
            "date": {"$gte": _midnight(start), "$lte": _midnight(end)},
        },
        {"_id": 0, "site_id": 1, "date": 1, field: 1},
    )

    series: dict[str, dict] = {site_id: {} for site_id in site_ids}

    async for document in cursor:
        series[document["site_id"]][document["date"].date()] = document.get(field)

    return series


async def save_predictions(documents: list[dict]) -> None:

    # One document per district and target day: predicting again replaces it.
    await get_db()[PREDICTIONS].bulk_write([
        ReplaceOne({"_id": document["_id"]}, document, upsert=True)
        for document in documents
    ])


async def find_predictions(target_date: str) -> list[dict]:

    cursor = get_db()[PREDICTIONS].find(
        {"target_date": target_date}, {"_id": 0}
    ).sort("pcode", ASCENDING)

    return [document async for document in cursor]
