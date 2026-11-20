from datetime import datetime, timezone
from uuid import uuid4

from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from app.core.database import get_db


# Two MongoDB collections (indexes in app/core/database.py):
#   sos_requests   one document per request; client_key_hash and reference are unique
#   rescue_teams   one per rescue team (name + organisation, unique together)
#   sos_senders    one per accepted request and sender address; MongoDB deletes
#                  them after an hour (they only exist to limit floods of requests)

REQUESTS = "sos_requests"
SENDERS = "sos_senders"
TEAMS = "rescue_teams"


class ReferenceTaken(Exception):
    pass


def now() -> datetime:

    moment = datetime.now(timezone.utc)
    return moment.replace(microsecond=moment.microsecond // 1000 * 1000)


def _to_api(document: dict | None) -> dict | None:

    if document is None:
        return None

    request = {k: v for k, v in document.items() if k not in ("client_key_hash", "sender_hash")}
    request.setdefault("support_teams", [])
    request.setdefault("releases", [])
    request["id"] = request.pop("_id")
    request["from_account"] = request.pop("user_id", None) is not None
    return request


async def insert_request(document: dict) -> dict | None:

    document = {"_id": str(uuid4()), **document}

    try:
        await get_db()[REQUESTS].insert_one(document)

    except DuplicateKeyError as error:

        # The short reference number happened to be in use: the caller makes a new one.
        if "reference" in (error.details or {}).get("keyPattern", {}):
            raise ReferenceTaken()

        # The unique index on client_key_hash refused it: this request is already stored.
        return None

    return _to_api(document)


async def find_by_client_key(client_key_hash: str) -> dict | None:

    return _to_api(await get_db()[REQUESTS].find_one({"client_key_hash": client_key_hash}))


async def find_request(request_id: str) -> dict | None:

    return _to_api(await get_db()[REQUESTS].find_one({"_id": request_id}))


async def find_for_user(user_id: str) -> list[dict]:

    cursor = get_db()[REQUESTS].find({"user_id": user_id}).sort("received_at", -1).limit(50)

    return [_to_api(document) async for document in cursor]


async def list_requests(filters: dict, limit: int) -> list[dict]:

    # Oldest first: the person who has waited longest is at the top.
    cursor = get_db()[REQUESTS].find(filters).sort("received_at", ASCENDING).limit(limit)

    return [_to_api(document) async for document in cursor]


async def count_by_status() -> dict[str, int]:

    counts = {}

    async for row in await get_db()[REQUESTS].aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]):
        counts[row["_id"]] = row["n"]

    return counts


async def change_request(request_id: str, conditions: dict, update: dict) -> dict | None:

    # One atomic change of one document. "conditions" holds what must still be
    # true (the expected status, the primary team...): when two teams click at
    # the same moment only the first one matches, the second gets None.
    result = await get_db()[REQUESTS].find_one_and_update(
        {"_id": request_id, **conditions},
        update,
        return_document=True,
    )

    return _to_api(result)


# ==========================================
# TEAMS
# ==========================================

def _team_to_api(document: dict, members: int = 0) -> dict:

    return {
        "id": document["_id"],
        "name": document["name"],
        "organization": document["organization"],
        "created_at": document["created_at"],
        "members": members,
    }


async def insert_team(name: str, organization: str) -> dict | None:

    document = {"_id": str(uuid4()), "name": name, "organization": organization, "created_at": now()}

    try:
        await get_db()[TEAMS].insert_one(document)

    # The same name already exists in this organisation.
    except DuplicateKeyError:
        return None

    return _team_to_api(document)


async def find_team(team_id: str) -> dict | None:

    document = await get_db()[TEAMS].find_one({"_id": team_id})

    return _team_to_api(document) if document else None


async def list_teams() -> list[dict]:

    members = {}

    async for row in await get_db()["users"].aggregate([
        {"$match": {"team_id": {"$ne": None}}},
        {"$group": {"_id": "$team_id", "n": {"$sum": 1}}},
    ]):
        members[row["_id"]] = row["n"]

    cursor = get_db()[TEAMS].find({}).sort([("organization", ASCENDING), ("name", ASCENDING)])

    return [_team_to_api(document, members.get(document["_id"], 0)) async for document in cursor]


async def count_recent_from(sender_hash: str, since: datetime) -> int:

    return await get_db()[SENDERS].count_documents({"sender_hash": sender_hash, "at": {"$gte": since}})


async def note_sender(sender_hash: str) -> None:

    await get_db()[SENDERS].insert_one({"sender_hash": sender_hash, "at": now()})
