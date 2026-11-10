
from datetime import datetime, timezone
from uuid import uuid4

from pymongo import ASCENDING

from app.core.database import get_db


# Weather observations live in the MongoDB collection
# "weather_observations" (Milestone 17). The API's "id" is stored as
# MongoDB's "_id". Functions are async: they wait for the database
# without blocking the server.

COLLECTION = "weather_observations"


def _collection():
    return get_db()[COLLECTION]


def _now() -> datetime:

    # MongoDB stores dates with millisecond precision; cut the microseconds
    # so the time returned on create equals the time read back later.
    now = datetime.now(timezone.utc)
    return now.replace(microsecond=now.microsecond // 1000 * 1000)


def _to_api(document: dict | None) -> dict | None:

    if document is None:
        return None

    record = dict(document)
    record["id"] = record.pop("_id")
    return record


async def create_weather_record(data: dict) -> dict:

    document = {
        "_id": str(uuid4()),
        **data,
        "observed_at": _now()
    }

    await _collection().insert_one(document)

    return _to_api(document)


async def get_all_weather_records() -> list[dict]:

    # Oldest first, in the order the observations were made.
    cursor = _collection().find().sort("observed_at", ASCENDING)

    return [_to_api(document) async for document in cursor]


async def get_weather_record(record_id: str) -> dict | None:

    return _to_api(await _collection().find_one({"_id": record_id}))
