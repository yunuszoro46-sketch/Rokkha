"""
Append-only audit log of administrative and security events (collection `admin_audit`).

There is deliberately no update or delete function and no route that changes an event: the log is
written here and only read through GET /admin/audit. Events never hold passwords, tokens, secrets or
the contact details of people asking for help; actors and targets are stored by id and display name.
"""

import re
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from pymongo import DESCENDING

from app.core.database import get_db

AUDIT = "admin_audit"
# A repeated refusal from the same account within this window is counted on the existing event.
DENIED_WINDOW_SECONDS = 60


def _now() -> datetime:
    moment = datetime.now(timezone.utc)
    return moment.replace(microsecond=moment.microsecond // 1000 * 1000)


def actor_of(user: dict | None) -> dict | None:
    if not user:
        return None
    return {"id": user.get("id"), "name": user.get("name"), "role": user.get("role")}


async def record(
    actor: dict | None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    target_label: str | None = None,
    result: str = "success",
    reason: str | None = None,
    details: dict | None = None,
) -> dict:
    # Refused requests are counted, not stored one by one: the same account hitting the same refusal
    # within a minute adds to the last event's "repeats", so one account cannot flood the log.
    if action == "permission_denied" and actor and actor.get("id"):
        since = _now() - timedelta(seconds=DENIED_WINDOW_SECONDS)
        recent = await get_db()[AUDIT].find_one_and_update(
            {"action": action, "actor.id": actor["id"], "at": {"$gte": since}, "details": details or {}},
            {"$inc": {"repeats": 1}, "$set": {"last_at": _now()}},
        )
        if recent is not None:
            return _out(recent)
    event = {
        "_id": str(uuid4()),
        "at": _now(),
        "actor": actor_of(actor),
        "action": action,
        "target": {"type": target_type, "id": target_id, "label": target_label} if target_type else None,
        "result": result,
        "reason": reason,
        "details": details or {},
    }
    await get_db()[AUDIT].insert_one(event)
    return _out(event)


def _out(event: dict) -> dict:
    event = dict(event)
    event["id"] = event.pop("_id")
    return event


async def list_events(
    action: str | None = None,
    actor_id: str | None = None,
    result: str | None = None,
    q: str | None = None,
    before: datetime | None = None,
    limit: int = 50,
) -> list[dict]:
    query: dict = {}
    if action:
        query["action"] = action
    if actor_id:
        query["actor.id"] = actor_id
    if result:
        query["result"] = result
    if before:
        query["at"] = {"$lt": before}
    if q:
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"actor.name": pattern}, {"target.label": pattern}, {"reason": pattern}, {"action": pattern}]
    cursor = get_db()[AUDIT].find(query).sort("at", DESCENDING).limit(limit)
    return [_out(e) async for e in cursor]


async def distinct_actions() -> list[str]:
    return sorted(await get_db()[AUDIT].distinct("action"))
