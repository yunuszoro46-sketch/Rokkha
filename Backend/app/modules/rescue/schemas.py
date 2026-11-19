from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.geospatial.schemas import GeoJSONPoint


# ==========================================
# VOCABULARIES (docs/RESCUE_COORDINATION_SPEC.md)
# ==========================================

# What the person needs. One request may need several.
Need = Literal["food_water", "medical", "house_danger", "evacuation", "other"]

# The single "need" older portals sent (and phones may still have queued).
OldNeed = Literal["rescue", "medical", "food_water", "shelter", "other"]
OLD_NEED = {"rescue": "evacuation", "shelter": "other", "medical": "medical", "food_water": "food_water", "other": "other"}

Vulnerable = Literal["children", "elderly", "disability", "pregnant"]

# Where the point came from. Missing (None) for old portals: never guessed.
LocationSource = Literal["gps", "saved_place", "manual"]

# The life of a request:
#   available -> accepted -> en_route -> arrived -> (in_progress ->) completed
# A release puts it back to "available". The sender (or an admin) can cancel it while it is open.
SosStatus = Literal["available", "accepted", "en_route", "arrived", "in_progress", "completed", "cancelled"]

# What happened, step by step (the history the sender and the teams read).
SosEvent = Literal[
    "received", "accepted", "en_route", "arrived", "in_progress", "completed",
    "released", "support_requested", "support_joined", "cancelled", "closed",
]

ProgressStatus = Literal["en_route", "arrived", "in_progress", "completed"]
ReleaseReason = Literal["unable_to_reach", "lacks_resources", "other"]
CloseReason = Literal["duplicate", "not_genuine", "other"]


def _blank_to_none(value):

    if value is None:
        return None

    value = value.strip()
    return value or None


# ==========================================
# REQUESTS
# ==========================================

class Place(BaseModel):

    # What the person typed or chose. Never turned into coordinates.
    district_pcode: str | None = Field(default=None, max_length=10)
    upazila: str | None = Field(default=None, max_length=80)
    union: str | None = Field(default=None, max_length=80)
    village: str | None = Field(default=None, max_length=120)
    area: str | None = Field(default=None, max_length=120)
    landmark: str | None = Field(default=None, max_length=160)
    details: str | None = Field(default=None, max_length=300)

    @field_validator("*", mode="before")
    @classmethod
    def blank_is_none(cls, value):

        return _blank_to_none(value) if isinstance(value, str) else value

    def is_described(self) -> bool:

        return any((self.village, self.area, self.landmark, self.details, self.union, self.upazila))


class SosCreate(BaseModel):

    # Made up by the phone (a random UUID) when the request is first saved,
    # and sent again unchanged on every retry. It does two jobs: the server
    # never stores the same request twice, and it is the sender's private
    # key for reading the status later. Treat it like a password.
    client_id: str = Field(min_length=32, max_length=64, pattern=r"^[A-Za-z0-9-]+$")

    # GeoJSON order: [longitude, latitude]. Inside Bangladesh, or missing when
    # the person described the place instead (see "place").
    location: GeoJSONPoint | None = None

    location_source: LocationSource | None = None

    # GPS accuracy in metres, only if the phone reported it.
    accuracy_m: float | None = Field(default=None, ge=0, le=100000)

    place: Place | None = None

    people: int = Field(default=1, ge=1, le=1000)

    needs: list[Need] | None = Field(default=None, max_length=5)

    # Older portals: one need. Turned into "needs" below.
    need: OldNeed | None = None

    # "Is anyone seriously ill or injured?" None = not answered.
    serious_injury: bool | None = None

    vulnerable: list[Vulnerable] = Field(default_factory=list, max_length=4)

    note: str | None = Field(default=None, max_length=500)

    contact_name: str | None = Field(default=None, max_length=80)

    contact_phone: str | None = Field(default=None, max_length=20, pattern=r"^[0-9+ ()-]*$")

    # When the phone saved the request (it may reach the server much later).
    saved_at: datetime | None = None

    @field_validator("note", "contact_name", "contact_phone")
    @classmethod
    def empty_is_none(cls, value):

        return _blank_to_none(value)

    @model_validator(mode="after")
    def complete(self):

        if self.needs is None:
            self.needs = [OLD_NEED[self.need]] if self.need else ["evacuation"]

        # Same order as given, each need once.
        self.needs = list(dict.fromkeys(self.needs))
        self.vulnerable = list(dict.fromkeys(self.vulnerable))

        if not self.needs:
            raise ValueError("Choose at least one kind of help.")

        if self.location is None:

            self.accuracy_m = None

            if self.place is None or not self.place.district_pcode or not self.place.is_described():
                raise ValueError(
                    "Give the location: share GPS, or choose the district and describe the place "
                    "(village, area, landmark or details)."
                )

        return self


class SosProgress(BaseModel):

    status: ProgressStatus

    # A short message the sender can read, e.g. "Boat leaving from Sunamganj ghat".
    message_to_sender: str | None = Field(default=None, max_length=300)

    outcome: "SosOutcome | None" = None

    @model_validator(mode="after")
    def outcome_when_completed(self):

        if self.status == "completed" and self.outcome is None:
            raise ValueError("Say how many people were helped when completing a request.")

        return self


class SosOutcome(BaseModel):

    people_helped: int = Field(ge=0, le=1000)
    note: str | None = Field(default=None, max_length=300)


SosProgress.model_rebuild()


class SosRelease(BaseModel):

    reason: ReleaseReason
    note: str | None = Field(default=None, max_length=300)


class SosSupportRequest(BaseModel):

    note: str | None = Field(default=None, max_length=300)


class SosClose(BaseModel):

    reason: CloseReason
    note: str | None = Field(default=None, max_length=300)


# ==========================================
# RESPONSES
# ==========================================

class SosDistrict(BaseModel):

    pcode: str
    name: str
    division: str


class TeamName(BaseModel):

    # What anyone involved may see about a team.
    name: str
    organization: str


class TeamRef(TeamName):

    id: str


class SosStep(BaseModel):

    event: SosEvent
    status: SosStatus
    at: datetime
    team: TeamName | None = None
    reason: str | None = None


class SosStatusResponse(BaseModel):

    # What the SENDER may see: no personal details of anyone else.
    id: str
    reference: str
    status: SosStatus
    needs: list[Need]
    district: SosDistrict
    team: TeamName | None
    received_at: datetime
    updated_at: datetime
    history: list[SosStep]
    message_to_sender: str | None


class SosReleaseRecord(BaseModel):

    reason: ReleaseReason
    note: str | None
    at: datetime
    team: TeamRef


class SosSupportAsk(BaseModel):

    note: str | None
    at: datetime


class SosBoardStep(SosStep):

    team: TeamRef | None = None
    note: str | None = None


class SosResponse(SosStatusResponse):

    # What a RESCUER sees. Contact details only for the teams responsible (and admins).
    team: TeamRef | None
    support_teams: list[TeamRef]
    support_request: SosSupportAsk | None
    releases: list[SosReleaseRecord]
    outcome: SosOutcome | None
    history: list[SosBoardStep]
    location: GeoJSONPoint | None
    location_source: LocationSource | None
    # "Upazila, District" looked up from the point; None without a point.
    area_name: str | None = None
    accuracy_m: float | None
    place: Place | None
    people: int
    serious_injury: bool | None
    vulnerable: list[Vulnerable]
    note: str | None
    contact_hidden: bool
    contact_name: str | None
    contact_phone: str | None
    saved_at: datetime | None
    from_account: bool


class SosListResponse(BaseModel):

    count: int
    # How many requests of each status exist in total (not only on this page).
    by_status: dict[str, int]
    requests: list[SosResponse]


# ==========================================
# TEAMS
# ==========================================

class TeamCreate(BaseModel):

    name: str = Field(min_length=2, max_length=60)
    organization: str = Field(min_length=2, max_length=80)

    @field_validator("name", "organization")
    @classmethod
    def trimmed(cls, value):

        value = value.strip()

        if len(value) < 2:
            raise ValueError("At least 2 characters.")

        return value


class TeamResponse(TeamRef):

    created_at: datetime
    members: int


class TeamListResponse(BaseModel):

    teams: list[TeamResponse]


class TeamAssign(BaseModel):

    team_id: str | None
