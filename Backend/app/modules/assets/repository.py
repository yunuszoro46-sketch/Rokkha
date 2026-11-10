from datetime import datetime, timezone
from uuid import uuid4

from pymongo import ASCENDING, ReturnDocument

from app.core.database import get_db


# Assets live in the MongoDB collection "assets" (Milestone 17).
#
# The rest of the app keeps using a plain "id" string. In MongoDB that same
# value is stored as "_id" (the primary key MongoDB indexes automatically);
# _to_api / _to_db translate between the two.
#
# Every function is async: it waits for the database without blocking the
# server, so other requests are served meanwhile.

COLLECTION = "assets"


def _collection():
    return get_db()[COLLECTION]


def _now() -> datetime:

    # MongoDB stores dates with millisecond precision. Cut the microseconds
    # now, so the timestamp returned on create equals the one read back.
    now = datetime.now(timezone.utc)
    return now.replace(microsecond=now.microsecond // 1000 * 1000)


def _to_api(document: dict | None) -> dict | None:

    if document is None:
        return None

    record = dict(document)
    record["id"] = record.pop("_id")
    return record


async def create_asset_record(data: dict) -> dict:

    now = _now()

    document = {
        "_id": str(uuid4()),
        **data,
        "created_at": now,
        "updated_at": now,
    }

    await _collection().insert_one(document)

    return _to_api(document)


async def find_asset_records(query: dict) -> list[dict]:

    # Oldest first, so the order is stable between requests.
    cursor = _collection().find(query).sort("created_at", ASCENDING)

    return [_to_api(document) async for document in cursor]


async def get_asset_record(asset_id: str) -> dict | None:

    return _to_api(await _collection().find_one({"_id": asset_id}))


async def update_asset_record(asset_id: str, changes: dict) -> dict | None:

    document = await _collection().find_one_and_update(
        {"_id": asset_id},
        {"$set": {**changes, "updated_at": _now()}},
        # Return the asset AFTER the change, not before.
        return_document=ReturnDocument.AFTER,
    )

    return _to_api(document)


async def delete_asset_record(asset_id: str) -> bool:

    result = await _collection().delete_one({"_id": asset_id})

    return result.deleted_count == 1


async def find_assets_near(point: dict, max_distance_m: float, query: dict) -> list[dict]:

    # $geoNear (uses the 2dsphere index) returns assets nearest first, only
    # those within max_distance_m. It must be the first pipeline stage.
    pipeline = [
        {
            "$geoNear": {
                "near": point,
                "distanceField": "_mongo_distance_m",
                "maxDistance": max_distance_m,
                "spherical": True,
                "query": query,
            }
        }
    ]

    return [_to_api(document) async for document in await _collection().aggregate(pipeline)]


async def find_assets_within(geometry: dict, query: dict) -> list[dict]:

    # $geoWithin: assets whose location lies inside the polygon.
    cursor = _collection().find(
        {"location": {"$geoWithin": {"$geometry": geometry}}, **query}
    ).sort("created_at", ASCENDING)

    return [_to_api(document) async for document in cursor]
