from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.modules.geospatial.schemas import GeoJSONPoint


# ==========================================
# VOCABULARIES
# ==========================================

# What the person needs most.
Need = Literal["rescue", "medical", "food_water", "shelter", "other"]

# The life of a request. It only moves forward:
#   new -> acknowledged -> team_sent -> resolved
# and can be cancelled (by the sender or a rescuer) until it is resolved.
SosStatus = Literal["new", "acknowledged", "team_sent", "resolved", "cancelled"]


# ==========================================
# REQUESTS
# ==========================================

class SosCreate(BaseModel):

    # Made up by the phone (a random UUID) when the request is first saved,
    # and sent again unchanged on every retry. It does two jobs: the server
    # never stores the same request twice, and it is the sender's private
    # key for reading the status later. Treat it like a password.
    client_id: str = Field(min_length=32, max_length=64, pattern=r"^[A-Za-z0-9-]+$")

    # GeoJSON order: [longitude, latitude]. Must be inside Bangladesh.
    location: GeoJSONPoint

    # GPS accuracy in metres, if the phone reported it.
    accuracy_m: float | None = Field(default=None, ge=0, le=100000)

    people: int = Field(default=1, ge=1, le=1000)

    need: Need = "rescue"

    note: str | None = Field(default=None, max_length=500)

    contact_name: str | None = Field(default=None, max_length=80)

    contact_phone: str | None = Field(default=None, max_length=20, pattern=r"^[0-9+ ()-]*$")

    # When the phone saved the request (it may reach the server much later).
    saved_at: datetime | None = None

    @field_validator("note", "contact_name", "contact_phone")
    @classmethod
    def empty_is_none(cls, value):

        if value is None:
            return None

        value = value.strip()
        return value or None


class SosUpdate(BaseModel):

    status: SosStatus

    # A short message the sender can read, e.g. "Boat leaving from Sunamganj ghat".
    message_to_sender: str | None = Field(default=None, max_length=300)


# ==========================================
# RESPONSES
# ==========================================

class SosDistrict(BaseModel):

    pcode: str
    name: str
    division: str


class SosStep(BaseModel):

    status: SosStatus
    at: datetime


class SosStatusResponse(BaseModel):

    # What the SENDER may see: no personal details of anyone else.
    id: str
    status: SosStatus
    district: SosDistrict
    received_at: datetime
    updated_at: datetime
    history: list[SosStep]
    message_to_sender: str | None


class SosResponse(SosStatusResponse):

    # What a RESCUER sees: everything needed to reach the person.
    location: GeoJSONPoint
    accuracy_m: float | None
    people: int
    need: Need
    note: str | None
    contact_name: str | None
    contact_phone: str | None
    saved_at: datetime | None
    from_account: bool


class SosListResponse(BaseModel):

    count: int
    # How many requests of each status exist in total (not only on this page).
    by_status: dict[str, int]
    requests: list[SosResponse]
