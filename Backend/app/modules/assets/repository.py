from datetime import datetime, timezone
from uuid import uuid4


# Temporary in-memory storage until MongoDB integration.
# Records disappear when the application restarts.
#
# A dict keyed by id (instead of a list) makes get / update / delete a
# direct lookup. When MongoDB arrives, only this file changes: the service
# and router keep calling the same functions.

asset_records: dict[str, dict] = {}


def create_asset_record(data: dict) -> dict:

    now = datetime.now(timezone.utc)

    record = {
        "id": str(uuid4()),
        **data,
        "created_at": now,
        "updated_at": now,
    }

    asset_records[record["id"]] = record

    return record


def get_all_asset_records() -> list[dict]:

    return list(asset_records.values())


def get_asset_record(asset_id: str) -> dict | None:

    return asset_records.get(asset_id)


def update_asset_record(asset_id: str, changes: dict) -> dict | None:

    record = asset_records.get(asset_id)

    if record is None:
        return None

    record.update(changes)
    record["updated_at"] = datetime.now(timezone.utc)

    return record


def delete_asset_record(asset_id: str) -> bool:

    # pop returns None when the id does not exist.
    return asset_records.pop(asset_id, None) is not None


def clear_asset_records() -> None:

    # Used by tests so each test starts with an empty store.
    asset_records.clear()
