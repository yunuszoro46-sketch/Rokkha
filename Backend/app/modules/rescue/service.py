import hashlib
import secrets
from datetime import timedelta

from app.modules.geospatial.service import district_by_pcode, find_district, place_name
from app.modules.rescue import repository


# ==========================================
# SETTINGS (docs/RESCUE_COORDINATION_SPEC.md)
# ==========================================

# One internet address may create this many NEW requests per hour. People in
# one shelter can share an address, so the limit is generous; it only stops
# a script from filling the rescuers' board. Retries of a request already
# stored are not counted.
MAX_NEW_PER_HOUR = 10
RATE_WINDOW = timedelta(hours=1)

# Statuses while somebody may still need help.
OPEN = ["available", "accepted", "en_route", "arrived", "in_progress"]
# Statuses in which a team is responsible.
ACTIVE = ["accepted", "en_route", "arrived", "in_progress"]

# Progress the primary team may report: the status it must come from.
PROGRESS_FROM = {
    "en_route": ["accepted"],
    "arrived": ["en_route"],
    "in_progress": ["arrived"],
    "completed": ["arrived", "in_progress"],
}

# Short reference numbers: no 0/O, 1/I/L, so they can be read out on a phone call.
REFERENCE_LETTERS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


class OutsideBangladesh(Exception):
    pass


class UnknownDistrict(Exception):
    pass


class TooManyRequests(Exception):
    pass


class NotFound(Exception):
    pass


class NoTeam(Exception):
    pass


class NotYourRequest(Exception):
    pass


class NotAllowed(Exception):

    # The request is not in a state that allows this (409). "request" is its current state.
    def __init__(self, request: dict, message: str):
        self.request = request
        self.message = message


def _hash(text: str) -> str:

    # Only hashes are stored: the sender's private key and their internet
    # address cannot be read back out of the database.
    return hashlib.sha256(text.encode()).hexdigest()


def _reference() -> str:

    return "RK-" + "".join(secrets.choice(REFERENCE_LETTERS) for _ in range(6))


def _team_of(user: dict) -> dict:

    # The team an account works in, as stored on requests: {id, name, organization}.
    team = user.get("team")

    if not team:
        raise NoTeam()

    return {"id": team["id"], "name": team["name"], "organization": team["organization"]}


def _step(event: str, status: str, at, team: dict | None = None, user: dict | None = None,
          reason: str | None = None, note: str | None = None) -> dict:

    # One line of history. "actor_id" (which account did it) is kept for the
    # record but never sent to the sender (the response models leave it out).
    return {
        "event": event,
        "status": status,
        "at": at,
        "team": team,
        "reason": reason,
        "note": note,
        "actor_id": user["id"] if user else None,
    }


# ==========================================
# SENDER SIDE
# ==========================================

async def create(data: dict, user: dict | None, sender_address: str) -> tuple[dict, bool]:
    """Store a request. Returns (request, created): created is False when the
    same client_id was already stored (a retry from the phone)."""

    key_hash = _hash(data["client_id"])

    existing = await repository.find_by_client_key(key_hash)

    if existing:
        return existing, False

    place = data["place"]
    location = data["location"]

    # With a point, the district comes from the point; without, from the chosen district.
    if location is not None:
        district = find_district(location)

        if district is None:
            raise OutsideBangladesh()
    else:
        district = district_by_pcode(place.district_pcode)

        if district is None:
            raise UnknownDistrict()

    sender_hash = _hash(sender_address)
    since = repository.now() - RATE_WINDOW

    if await repository.count_recent_from(sender_hash, since) >= MAX_NEW_PER_HOUR:
        raise TooManyRequests()

    received_at = repository.now()

    document = {
        "client_key_hash": key_hash,
        "sender_hash": sender_hash,
        "user_id": user["id"] if user else None,
        "status": "available",
        "needs": data["needs"],
        "people": data["people"],
        "serious_injury": data["serious_injury"],
        "vulnerable": data["vulnerable"],
        "location": location.model_dump() if location else None,
        "location_source": data["location_source"],
        "accuracy_m": data["accuracy_m"],
        "place": place.model_dump() if place else None,
        # Readable "Upazila, District" for a real point only (never for a typed place).
        "area_name": place_name(location)["label"] if location else None,
        "district": district,
        "note": data["note"],
        "contact_name": data["contact_name"],
        "contact_phone": data["contact_phone"],
        "saved_at": data["saved_at"],
        "received_at": received_at,
        "updated_at": received_at,
        "team": None,
        "support_teams": [],
        "support_request": None,
        "releases": [],
        "outcome": None,
        "history": [_step("received", "available", received_at)],
        "message_to_sender": None,
    }

    for _ in range(5):
        try:
            stored = await repository.insert_request({**document, "reference": _reference()})
            break
        except repository.ReferenceTaken:
            continue
    else:
        raise RuntimeError("Could not find a free reference number.")

    # Two copies of the same request arrived at the same moment: the other one won.
    if stored is None:
        return await repository.find_by_client_key(key_hash), False

    await repository.note_sender(sender_hash)

    return stored, True


async def status_for_sender(client_id: str) -> dict:

    request = await repository.find_by_client_key(_hash(client_id))

    if request is None:
        raise NotFound()

    return request


async def cancel_by_sender(client_id: str) -> dict:

    request = await status_for_sender(client_id)

    return await _cancel(request, "cancelled", None, None, None)


async def requests_of(user: dict) -> list[dict]:

    return await repository.find_for_user(user["id"])


# ==========================================
# RESCUE TEAMS: THE SHARED BOARD
# ==========================================

def for_viewer(request: dict, viewer: dict) -> dict:

    # Contact details only for the teams responsible for the request, and admins.
    team = viewer.get("team")
    team_id = team["id"] if team else None

    involved = team_id is not None and (
        (request.get("team") or {}).get("id") == team_id
        or any(t["id"] == team_id for t in request.get("support_teams", []))
    )
    allowed = viewer["role"] == "admin" or involved

    shown = dict(request)
    shown["contact_hidden"] = not allowed and bool(request.get("contact_name") or request.get("contact_phone"))

    if not allowed:
        shown["contact_name"] = None
        shown["contact_phone"] = None

    return shown


async def board(viewer: dict, status: str | None, district_pcode: str | None, mine: bool, limit: int) -> dict:

    filters: dict = {"status": status} if status else {"status": {"$in": OPEN}}

    if district_pcode:
        filters["district.pcode"] = district_pcode.upper()

    if mine:
        team = viewer.get("team")
        team_id = team["id"] if team else "-"
        filters["$or"] = [{"team.id": team_id}, {"support_teams.id": team_id}]

    requests = await repository.list_requests(filters, limit)

    # Requests nobody has taken first; within those, someone seriously hurt
    # first; then whoever has waited longest (the list comes oldest first).
    requests.sort(key=lambda r: (
        OPEN.index(r["status"]) if r["status"] in OPEN else len(OPEN),
        r.get("serious_injury") is not True,
    ))

    return {
        "count": len(requests),
        "by_status": await repository.count_by_status(),
        "requests": [for_viewer(r, viewer) for r in requests],
    }


async def _get(request_id: str) -> dict:

    request = await repository.find_request(request_id)

    if request is None:
        raise NotFound()

    return request


async def _changed_or_conflict(request_id: str, result: dict | None, message: str) -> dict:

    # result is None when the atomic change matched nothing: someone else
    # changed the request first. Answer with its state now.
    if result is None:
        raise NotAllowed(await _get(request_id), message)

    return result


def _primary_check(request: dict, viewer: dict) -> dict:

    team = _team_of(viewer)

    if (request.get("team") or {}).get("id") != team["id"]:
        raise NotYourRequest()

    return team


async def accept(request_id: str, viewer: dict) -> dict:

    team = _team_of(viewer)
    request = await _get(request_id)
    moment = repository.now()

    result = await repository.change_request(
        request_id,
        {"status": "available"},
        {
            "$set": {"status": "accepted", "team": team, "updated_at": moment, "support_request": None},
            "$push": {"history": _step("accepted", "accepted", moment, team, viewer)},
        },
    )

    if result is None:
        latest = await _get(request_id)
        holder = (latest.get("team") or {}).get("name")
        message = (
            f"{holder} is already responding to this request." if holder
            else f"This request is {latest['status'].replace('_', ' ')} and cannot be accepted."
        )
        raise NotAllowed(latest, message)

    return for_viewer(result, viewer)


async def progress(request_id: str, viewer: dict, status: str, message: str | None, outcome: dict | None) -> dict:

    request = await _get(request_id)
    allowed_from = PROGRESS_FROM[status]

    # First the state (409: e.g. not accepted yet, or a step skipped), then the owner (403).
    if request["status"] not in allowed_from:
        raise NotAllowed(
            request,
            f"The request is {request['status'].replace('_', ' ')}; it cannot become {status.replace('_', ' ')}.",
        )

    team = _primary_check(request, viewer)

    moment = repository.now()
    changes = {"status": status, "updated_at": moment}

    if message is not None:
        changes["message_to_sender"] = message.strip() or None

    if status == "completed":
        changes["outcome"] = outcome
        changes["support_request"] = None

    result = await repository.change_request(
        request_id,
        {"status": {"$in": allowed_from}, "team.id": team["id"]},
        {"$set": changes, "$push": {"history": _step(status, status, moment, team, viewer, note=message)}},
    )

    return for_viewer(await _changed_or_conflict(request_id, result, "The request changed in the meantime."), viewer)


async def release(request_id: str, viewer: dict, reason: str, note: str | None) -> dict:

    request = await _get(request_id)

    if request["status"] not in ACTIVE or not request.get("team"):
        raise NotAllowed(request, f"The request is {request['status'].replace('_', ' ')}; there is nothing to release.")

    # The primary team releases its own request; an admin may release a stuck one.
    if viewer["role"] != "admin":
        _primary_check(request, viewer)

    team = request["team"]
    moment = repository.now()
    record = {"reason": reason, "note": note, "at": moment, "team": team}

    result = await repository.change_request(
        request_id,
        {"status": {"$in": ACTIVE}, "team.id": team["id"]},
        {
            "$set": {"status": "available", "team": None, "support_teams": [], "support_request": None,
                     "updated_at": moment},
            "$push": {"releases": record,
                      "history": _step("released", "available", moment, team, viewer, reason, note)},
        },
    )

    return for_viewer(await _changed_or_conflict(request_id, result, "The request changed in the meantime."), viewer)


async def ask_support(request_id: str, viewer: dict, note: str | None) -> dict:

    request = await _get(request_id)

    if request["status"] not in ACTIVE:
        raise NotAllowed(request, "Support can only be asked while a team is responding.")

    team = _primary_check(request, viewer)
    moment = repository.now()

    result = await repository.change_request(
        request_id,
        {"status": {"$in": ACTIVE}, "team.id": team["id"]},
        {
            "$set": {"support_request": {"note": note, "at": moment}, "updated_at": moment},
            "$push": {"history": _step("support_requested", request["status"], moment, team, viewer, note=note)},
        },
    )

    return for_viewer(await _changed_or_conflict(request_id, result, "The request changed in the meantime."), viewer)


async def join_support(request_id: str, viewer: dict) -> dict:

    team = _team_of(viewer)
    request = await _get(request_id)
    moment = repository.now()

    # Only while support is asked, never the primary team, never twice.
    result = await repository.change_request(
        request_id,
        {
            "status": {"$in": ACTIVE},
            "support_request": {"$ne": None},
            "team.id": {"$ne": team["id"]},
            "support_teams.id": {"$ne": team["id"]},
        },
        {
            "$push": {"support_teams": team,
                      "history": _step("support_joined", request["status"], moment, team, viewer)},
            "$set": {"updated_at": moment},
        },
    )

    return for_viewer(
        await _changed_or_conflict(request_id, result, "Support is not asked for this request, or your team is already on it."),
        viewer,
    )


async def close_by_admin(request_id: str, viewer: dict, reason: str, note: str | None) -> dict:

    return for_viewer(await _cancel(await _get(request_id), "closed", viewer, reason, note), viewer)


async def _cancel(request: dict, event: str, viewer: dict | None, reason: str | None, note: str | None) -> dict:

    if request["status"] not in OPEN:
        raise NotAllowed(request, f"The request is already {request['status'].replace('_', ' ')}.")

    moment = repository.now()

    result = await repository.change_request(
        request["id"],
        {"status": {"$in": OPEN}},
        {
            "$set": {"status": "cancelled", "updated_at": moment, "support_request": None},
            "$push": {"history": _step(event, "cancelled", moment, request.get("team"), viewer, reason, note)},
        },
    )

    return await _changed_or_conflict(request["id"], result, "The request changed in the meantime.")


# ==========================================
# TEAMS (admin)
# ==========================================

class TeamExists(Exception):
    pass


async def create_team(name: str, organization: str) -> dict:

    team = await repository.insert_team(name, organization)

    if team is None:
        raise TeamExists()

    return team


async def list_teams() -> list[dict]:

    return await repository.list_teams()


async def find_team(team_id: str) -> dict | None:

    return await repository.find_team(team_id)
