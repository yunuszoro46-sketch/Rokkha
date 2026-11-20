from datetime import datetime, timezone
from uuid import uuid4

from pymongo.errors import DuplicateKeyError

from app.core.database import get_db


# Three MongoDB collections (indexes in app/core/database.py):
#   users           one document per account; email is unique
#   sessions        one per login; _id is the SHA-256 of the token, never the token
#   login_failures  one per wrong password; MongoDB deletes them after 15 minutes

USERS = "users"
SESSIONS = "sessions"
LOGIN_FAILURES = "login_failures"


def now() -> datetime:

    # MongoDB stores milliseconds; cut the microseconds so values read back equal.
    moment = datetime.now(timezone.utc)
    return moment.replace(microsecond=moment.microsecond // 1000 * 1000)


def _to_api(document: dict | None) -> dict | None:

    if document is None:
        return None

    user = {key: value for key, value in document.items() if key != "password_hash"}
    user["id"] = user.pop("_id")
    # Accounts made before roles existed have no role stored: they are users.
    user.setdefault("role", "user")
    return user


# ==========================================
# USERS
# ==========================================

async def create_user(name: str, email: str, password_hash: str, role: str = "user") -> dict | None:

    document = {
        "_id": str(uuid4()),
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "role": role,
        "location": None,
        "location_label": None,
        "district": None,
        "location_updated_at": None,
        "created_at": now(),
    }

    try:
        await get_db()[USERS].insert_one(document)

    # The unique index on email refused it: the account already exists.
    except DuplicateKeyError:
        return None

    return _to_api(document)


async def find_password_hash(email: str) -> tuple[str, str] | None:

    document = await get_db()[USERS].find_one({"email": email}, {"password_hash": 1})

    return (document["_id"], document["password_hash"]) if document else None


async def find_user(user_id: str) -> dict | None:

    return _to_api(await get_db()[USERS].find_one({"_id": user_id}))


async def update_user(user_id: str, changes: dict) -> dict | None:

    await get_db()[USERS].update_one({"_id": user_id}, {"$set": changes})

    return await find_user(user_id)


async def list_users(limit: int) -> list[dict]:

    cursor = get_db()[USERS].find().sort("created_at", 1).limit(limit)

    return [_to_api(document) async for document in cursor]


async def delete_user(user_id: str) -> None:

    await get_db()[SESSIONS].delete_many({"user_id": user_id})
    await get_db()[USERS].delete_one({"_id": user_id})


# ==========================================
# SESSIONS
# ==========================================

async def create_session(token_hash: str, user_id: str, expires_at: datetime) -> None:

    await get_db()[SESSIONS].insert_one({
        "_id": token_hash,
        "user_id": user_id,
        "created_at": now(),
        "expires_at": expires_at,
    })


async def find_session(token_hash: str) -> dict | None:

    return await get_db()[SESSIONS].find_one({"_id": token_hash})


async def delete_session(token_hash: str) -> None:

    await get_db()[SESSIONS].delete_one({"_id": token_hash})


# ==========================================
# WRONG-PASSWORD COUNTER
# ==========================================

async def count_login_failures(email: str, since: datetime) -> int:

    return await get_db()[LOGIN_FAILURES].count_documents({"email": email, "at": {"$gte": since}})


async def add_login_failure(email: str) -> None:

    await get_db()[LOGIN_FAILURES].insert_one({"email": email, "at": now()})


async def clear_login_failures(email: str) -> None:

    await get_db()[LOGIN_FAILURES].delete_many({"email": email})
