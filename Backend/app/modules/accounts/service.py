import asyncio
import base64
import hashlib
import hmac
import secrets
from datetime import date, timedelta

from app.modules.accounts import repository
from app.modules.assets.service import assets_near
from app.modules.geospatial.schemas import GeoJSONPoint
from app.modules.geospatial.service import check_flood_at_point, find_district
from app.modules.prediction.service import (
    PREDICTION_ATTRIBUTION,
    PREDICTION_LIMITATIONS,
    stored_predictions,
)


# ==========================================
# SETTINGS
# ==========================================

# How long a login stays valid.
SESSION_DAYS = 30

# After this many wrong passwords for one email inside the window, logins
# for that email are refused until the window has passed. It slows down
# password guessing. (The database deletes the counters after 15 minutes.)
MAX_FAILED_LOGINS = 5
FAILED_LOGIN_WINDOW = timedelta(minutes=15)

# scrypt: a password hash that is slow and memory-hungry on purpose, so a
# stolen database cannot be searched quickly. It is in Python's standard
# library. These settings follow the OWASP password storage guidance
# (N=2^15, r=8, p=3) and use about 32 MB for a fraction of a second.
SCRYPT_N_LOG2 = 15
SCRYPT_R = 8
SCRYPT_P = 3
SCRYPT_MAXMEM = 64 * 1024 * 1024

NEAREST_ASSETS_RADIUS_M = 25_000
NEAREST_ASSETS_LIMIT = 5

REPORT_LIMITATIONS = [
    "The forecast is for the whole district, not for the saved point. It does not say "
    "that this exact place will flood.",
    "The flood history describes the ~90 m map cell under the saved point; satellites "
    "cannot see water between buildings.",
    "Only places registered in this system are listed as nearby. A missing shelter in "
    "the list does not mean there is none.",
]


class EmailTaken(Exception):
    pass


class WrongCredentials(Exception):
    pass


class TooManyAttempts(Exception):
    pass


class OutsideBangladesh(Exception):
    pass


class NoLocation(Exception):
    pass


# ==========================================
# PASSWORDS
# ==========================================

def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def _scrypt(password: str, salt: bytes, n_log2: int, r: int, p: int) -> bytes:

    return hashlib.scrypt(
        password.encode(), salt=salt, n=2 ** n_log2, r=r, p=p, maxmem=SCRYPT_MAXMEM, dklen=32
    )


def hash_password(password: str) -> str:

    # A fresh random salt per password: two users with the same password get
    # different hashes. The settings are stored with the hash, so they can be
    # raised later without breaking old accounts.
    salt = secrets.token_bytes(16)
    digest = _scrypt(password, salt, SCRYPT_N_LOG2, SCRYPT_R, SCRYPT_P)

    return f"scrypt${SCRYPT_N_LOG2}${SCRYPT_R}${SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:

    try:
        scheme, n_log2, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        candidate = _scrypt(password, base64.b64decode(salt), int(n_log2), int(r), int(p))
        # compare_digest takes the same time whether the first or the last
        # byte differs, so the timing tells an attacker nothing.
        return hmac.compare_digest(candidate, base64.b64decode(digest))

    except (ValueError, TypeError):
        return False


# Checked when the email is unknown, so "no such user" takes as long as
# "wrong password" and the two cannot be told apart by timing.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


# ==========================================
# SESSIONS
# ==========================================

def _token_hash(token: str) -> str:

    # The token is 256 random bits, so a plain SHA-256 is enough here (the
    # slow hash is for human-chosen passwords). Only the hash is stored: a
    # leaked database does not give working tokens.
    return hashlib.sha256(token.encode()).hexdigest()


async def _open_session(user: dict) -> dict:

    token = secrets.token_urlsafe(32)
    expires_at = repository.now() + timedelta(days=SESSION_DAYS)

    await repository.create_session(_token_hash(token), user["id"], expires_at)

    return {"token": token, "token_type": "bearer", "expires_at": expires_at, "user": user}


async def register(name: str, email: str, password: str) -> dict:

    # Hashing is slow on purpose: run it in a thread so other requests are not held up.
    password_hash = await asyncio.to_thread(hash_password, password)

    user = await repository.create_user(name, email, password_hash)

    if user is None:
        raise EmailTaken()

    return await _open_session(user)


async def login(email: str, password: str) -> dict:

    since = repository.now() - FAILED_LOGIN_WINDOW

    if await repository.count_login_failures(email, since) >= MAX_FAILED_LOGINS:
        raise TooManyAttempts()

    found = await repository.find_password_hash(email)
    stored_hash = found[1] if found else _DUMMY_HASH

    correct = await asyncio.to_thread(verify_password, password, stored_hash)

    if not found or not correct:
        await repository.add_login_failure(email)
        raise WrongCredentials()

    await repository.clear_login_failures(email)

    return await _open_session(await repository.find_user(found[0]))


async def user_for_token(token: str) -> dict | None:

    session = await repository.find_session(_token_hash(token))

    # The database removes expired sessions about once a minute; check the
    # time here too so an expired one never works in between.
    if session is None or session["expires_at"] <= repository.now():
        return None

    return await repository.find_user(session["user_id"])


async def logout(token: str) -> None:

    await repository.delete_session(_token_hash(token))


async def delete_account(user: dict) -> None:

    await repository.delete_user(user["id"])


# ==========================================
# HOME LOCATION
# ==========================================

async def set_location(user: dict, location: GeoJSONPoint, label: str | None) -> dict:

    district = find_district(location)

    if district is None:
        raise OutsideBangladesh()

    return await repository.update_user(user["id"], {
        "location": location.model_dump(),
        "location_label": label.strip() if label and label.strip() else None,
        "district": district,
        "location_updated_at": repository.now(),
    })


async def clear_location(user: dict) -> dict:

    return await repository.update_user(user["id"], {
        "location": None,
        "location_label": None,
        "district": None,
        "location_updated_at": None,
    })


# ==========================================
# REPORT FOR THE USER'S LOCATION
# ==========================================

async def location_report(user: dict, target: date) -> dict:

    if user["location"] is None:
        raise NoLocation()

    point = GeoJSONPoint(**user["location"])
    district = user["district"]

    # The stored forecast for that day, if any. Nothing is computed here and
    # no other day is used in its place: no forecast is reported as exactly that.
    stored = await stored_predictions(target)
    forecast = None

    if stored is not None:
        forecast = next(
            (p for p in stored["predictions"] if p["pcode"] == district["pcode"]), None
        )

    history = check_flood_at_point(point)
    nearby = await assets_near(point, NEAREST_ASSETS_RADIUS_M)

    return {
        "target_date": target,
        "location": user["location"],
        "location_label": user["location_label"],
        "district": district,
        "forecast_status": "available" if forecast else "no_forecast_for_this_day",
        "forecast": forecast,
        "alert_thresholds": stored["alert_thresholds"] if stored and forecast else None,
        "flood_history": {"district": history["district"], "cell": history["cell"]},
        "nearest_assets": nearby["results"][:NEAREST_ASSETS_LIMIT],
        "nearest_assets_radius_meters": NEAREST_ASSETS_RADIUS_M,
        "attribution": [history["attribution"], *PREDICTION_ATTRIBUTION],
        "limitations": REPORT_LIMITATIONS + PREDICTION_LIMITATIONS,
    }
