import hashlib
from datetime import timedelta

from app.modules.geospatial.service import find_district
from app.modules.rescue import repository


# ==========================================
# SETTINGS
# ==========================================

# One internet address may create this many NEW requests per hour. People in
# one shelter can share an address, so the limit is generous; it only stops
# a script from filling the rescuers' list. Retries of a request already
# stored are not counted.
MAX_NEW_PER_HOUR = 10
RATE_WINDOW = timedelta(hours=1)

# Status order. A request only moves to a later status.
ORDER = ["new", "acknowledged", "team_sent", "resolved"]
FINAL = ("resolved", "cancelled")

OPEN = ["new", "acknowledged", "team_sent"]


class OutsideBangladesh(Exception):
    pass


class TooManyRequests(Exception):
    pass


class NotFound(Exception):
    pass


class NotAllowed(Exception):

    def __init__(self, current: str):
        self.current = current


def _hash(text: str) -> str:

    # Only hashes are stored: the sender's private key and their internet
    # address cannot be read back out of the database.
    return hashlib.sha256(text.encode()).hexdigest()


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

    district = find_district(data["location"])

    if district is None:
        raise OutsideBangladesh()

    sender_hash = _hash(sender_address)
    since = repository.now() - RATE_WINDOW

    if await repository.count_recent_from(sender_hash, since) >= MAX_NEW_PER_HOUR:
        raise TooManyRequests()

    received_at = repository.now()

    stored = await repository.insert_request({
        "client_key_hash": key_hash,
        "sender_hash": sender_hash,
        "user_id": user["id"] if user else None,
        "status": "new",
        "location": data["location"].model_dump(),
        "accuracy_m": data["accuracy_m"],
        "district": district,
        "people": data["people"],
        "need": data["need"],
        "note": data["note"],
        "contact_name": data["contact_name"],
        "contact_phone": data["contact_phone"],
        "saved_at": data["saved_at"],
        "received_at": received_at,
        "updated_at": received_at,
        "history": [{"status": "new", "at": received_at}],
        "message_to_sender": None,
    })

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

    return await _move(request, "cancelled", None)


async def requests_of(user: dict) -> list[dict]:

    return await repository.find_for_user(user["id"])


# ==========================================
# RESCUER SIDE
# ==========================================

async def list_for_rescuers(status: str | None, district_pcode: str | None, limit: int) -> dict:

    filters: dict = {"status": status} if status else {"status": {"$in": OPEN}}

    if district_pcode:
        filters["district.pcode"] = district_pcode.upper()

    requests = await repository.list_requests(filters, limit)

    # The newest status first within the page: untouched requests on top.
    requests.sort(key=lambda r: (OPEN.index(r["status"]) if r["status"] in OPEN else len(OPEN)))

    return {
        "count": len(requests),
        "by_status": await repository.count_by_status(),
        "requests": requests,
    }


async def update_by_rescuer(request_id: str, status: str, message: str | None) -> dict:

    request = await repository.find_request(request_id)

    if request is None:
        raise NotFound()

    return await _move(request, status, message)


async def _move(request: dict, status: str, message: str | None) -> dict:

    current = request["status"]

    allowed = current not in FINAL and (
        status == "cancelled"
        or (status in ORDER and ORDER.index(status) > ORDER.index(current))
    )

    # The same status again with a new message is fine: it only updates the message.
    same = status == current and message is not None and current not in FINAL

    if not allowed and not same:
        raise NotAllowed(current)

    moment = repository.now()
    changes = {"status": status, "updated_at": moment}

    if message is not None:
        changes["message_to_sender"] = message.strip() or None

    moved = await repository.move_request(
        request["id"], current, changes, {"status": status, "at": moment}
    )

    # Someone else changed it in between.
    if moved is None:
        latest = await repository.find_request(request["id"])
        raise NotAllowed(latest["status"] if latest else current)

    return moved
