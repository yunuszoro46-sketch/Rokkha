from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.modules.geospatial.schemas import GeoJSONPoint


# ==========================================
# REQUESTS
# ==========================================

# A simple shape check ("something@something.tld"). Whether the address
# really exists is not checked: no email is ever sent.
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


def _clean_email(value: str) -> str:

    # Emails are compared in lower case, so "A@x.org" and "a@x.org" are one account.
    return value.strip().lower()


class RegisterRequest(BaseModel):

    name: str = Field(min_length=1, max_length=80)

    email: str = Field(max_length=254, pattern=EMAIL_PATTERN)

    # Long passwords are fine; the upper limit only stops abuse (hashing is slow on purpose).
    password: str = Field(min_length=8, max_length=128)

    # Only "user" and "rescuer" may self-register. "admin" is set by an existing admin only.
    role: Literal["user", "rescuer"] = "user"

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:

        value = value.strip()

        if not value:
            raise ValueError("Name must not be empty.")

        return value

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, value):
        return _clean_email(value) if isinstance(value, str) else value


class LoginRequest(BaseModel):

    email: str = Field(max_length=254)

    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, value):
        return _clean_email(value) if isinstance(value, str) else value


class LocationRequest(BaseModel):

    # GeoJSON order: [longitude, latitude]. Must be inside Bangladesh.
    location: GeoJSONPoint

    # The user's own name for the place, e.g. "Home".
    label: str | None = Field(default=None, max_length=80)


# ==========================================
# RESPONSES
# ==========================================

# What an account may do. Every new account is a "user"; only an admin (or the
# developer's scripts/set_role.py) can change it. Never taken from the client.
Role = Literal["user", "rescuer", "admin"]


class RoleRequest(BaseModel):

    role: Role


class DistrictRef(BaseModel):

    pcode: str
    name: str
    division: str


class TeamRef(BaseModel):

    id: str
    name: str
    organization: str


class UserResponse(BaseModel):

    id: str
    name: str
    email: str
    role: Role
    # The rescue team the account works in (set by an admin), or None.
    team: TeamRef | None = None
    location: GeoJSONPoint | None
    location_label: str | None
    district: DistrictRef | None
    location_updated_at: datetime | None
    created_at: datetime
    # "suspended" accounts cannot log in; their sessions were ended when suspended.
    status: Literal["active", "suspended"] = "active"
    last_login_at: datetime | None = None


class SessionResponse(BaseModel):

    # Send it with every request:  Authorization: Bearer <token>
    token: str
    token_type: Literal["bearer"] = "bearer"
    expires_at: datetime
    user: UserResponse


class LocationReportResponse(BaseModel):

    target_date: date
    location: GeoJSONPoint
    location_label: str | None
    district: DistrictRef

    # "available": `forecast` is the model's prediction for the district that day.
    # "no_forecast_for_this_day": none is stored; `forecast` is null. Not "safe".
    forecast_status: Literal["available", "no_forecast_for_this_day"]
    forecast: dict[str, Any] | None
    alert_thresholds: dict[str, Any] | None

    # Same content as POST /geospatial/flood/check for the saved point.
    flood_history: dict[str, Any]

    # Places registered in this system near the saved point, nearest first.
    nearest_assets: list[dict[str, Any]]
    nearest_assets_radius_meters: float

    attribution: list[str]
    limitations: list[str]


class UserListResponse(BaseModel):

    count: int
    # Number of accounts matching the filters (for paging); count is the number on this page.
    total: int | None = None
    skip: int = 0
    users: list[UserResponse]


class StatusRequest(BaseModel):

    status: Literal["active", "suspended"]
    # Why: kept in the audit log. Required so every suspension can be explained later.
    reason: str = Field(min_length=3, max_length=300)
