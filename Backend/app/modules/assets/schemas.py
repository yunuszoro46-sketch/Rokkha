from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

# Reuse the validated GeoJSON Point from the geospatial module, so an asset
# location follows exactly the same [longitude, latitude] rules.
from app.modules.geospatial.schemas import GeoJSONPoint


# ==========================================
# VOCABULARIES
# ==========================================

# What kind of thing the asset is. Kept short and explicit; "other" covers
# anything not listed.
AssetType = Literal[
    "hospital",
    "clinic",
    "school",
    "flood_shelter",
    "power_substation",
    "water_treatment",
    "telecom_tower",
    "warehouse",
    "factory",
    "office",
    "residential",
    "road_bridge",
    "other",
]

# How serious it would be to lose the asset during a flood.
Criticality = Literal["low", "medium", "high", "critical"]


# ==========================================
# REQUEST MODELS
# ==========================================

class AssetCreate(BaseModel):

    name: str = Field(min_length=2, max_length=150)

    asset_type: AssetType

    location: GeoJSONPoint

    criticality: Criticality = "medium"

    # People normally inside or served on site ("lives protected").
    occupancy: int | None = Field(default=None, ge=0)

    # Replacement value in Bangladeshi taka ("assets protected").
    replacement_value_bdt: float | None = Field(default=None, ge=0)

    owner: str | None = Field(default=None, max_length=150)

    address: str | None = Field(default=None, max_length=300)

    notes: str | None = Field(default=None, max_length=1000)


class AssetUpdate(BaseModel):

    # Every field is optional: send only what changes (HTTP PATCH).
    name: str | None = Field(default=None, min_length=2, max_length=150)

    asset_type: AssetType | None = None

    location: GeoJSONPoint | None = None

    criticality: Criticality | None = None

    occupancy: int | None = Field(default=None, ge=0)

    replacement_value_bdt: float | None = Field(default=None, ge=0)

    owner: str | None = Field(default=None, max_length=150)

    address: str | None = Field(default=None, max_length=300)

    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def required_fields_cannot_be_cleared(self):

        # model_fields_set = the fields the client actually sent.
        # Sending null for these would erase something every asset needs.
        for field in ("name", "asset_type", "location", "criticality"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"'{field}' cannot be set to null.")

        return self


# ==========================================
# RESPONSE MODELS
# ==========================================

class AssetDistrict(BaseModel):

    pcode: str

    name: str

    division: str


class AssetResponse(BaseModel):

    id: str

    name: str

    asset_type: AssetType

    location: GeoJSONPoint

    criticality: Criticality

    occupancy: int | None

    replacement_value_bdt: float | None

    owner: str | None

    address: str | None

    notes: str | None

    # Filled in automatically from the location (64 districts, HDX).
    district: AssetDistrict

    created_at: datetime

    updated_at: datetime


class AssetListResponse(BaseModel):

    count: int

    # Totals over the returned assets: a first view of what is at stake.
    total_occupancy: int

    total_replacement_value_bdt: float

    assets: list[AssetResponse]
