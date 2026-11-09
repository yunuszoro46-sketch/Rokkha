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


# ==========================================
# EXPOSURE ANALYSIS
# ==========================================
# Exposure = what the data says about each asset's location: where flooding
# DID happen (observed), where it COULD happen (modelled hazard), and how
# close the water is. These are facts with yes/no flags, NOT a risk score
# and NOT a forecast: flood probabilities come later from the ML model.

class ObservedFloodExposure(BaseModel):

    # UNOSAT satellite observations at the asset's ~90 m grid cell.
    times_observed: int

    times_flooded: int

    flooded_event_ids: list[str]

    # The most recent event in which flood water was seen here, if any.
    last_flooded_event_id: str | None


class HazardExposure(BaseModel):

    # Modelled river flood (JRC GloFAS).
    return_period_years: Literal[10, 100]

    depth_class: int | None

    depth_label: str | None


class DistrictFloodContext(BaseModel):

    pcode: str

    name: str

    # 1 = most frequently flooded of Bangladesh's 64 districts.
    flood_rank: int

    events_observed: int

    events_flooded: int


class NearestWaterwayExposure(BaseModel):

    waterway_type: str

    name: str | None

    distance_meters: float


class ExposureFlags(BaseModel):

    observed_flooding: bool

    modelled_hazard_10yr: bool

    modelled_hazard_100yr: bool


class AssetExposure(BaseModel):

    asset_id: str

    name: str

    asset_type: AssetType

    criticality: Criticality

    occupancy: int | None

    replacement_value_bdt: float | None

    district: DistrictFloodContext

    grid_cell_size_m: int

    # True when the asset sits on mapped permanent water (river/lake).
    on_permanent_water: bool

    observed: ObservedFloodExposure

    hazard: list[HazardExposure]

    # Waterway data only covers Dhaka District; elsewhere this is false
    # and nearest_waterways is empty.
    waterway_coverage: bool

    nearest_waterways: list[NearestWaterwayExposure]

    flags: ExposureFlags


class ExposureGroupTotals(BaseModel):

    assets: int

    occupancy: int

    replacement_value_bdt: float


class ExposureSummary(BaseModel):

    total: ExposureGroupTotals

    with_observed_flooding: ExposureGroupTotals

    with_modelled_hazard_10yr: ExposureGroupTotals

    with_modelled_hazard_100yr: ExposureGroupTotals


class AssetExposureReport(BaseModel):

    summary: ExposureSummary

    assets: list[AssetExposure]

    attribution: list[str]

    limitations: list[str]


class SingleAssetExposureResponse(AssetExposure):

    attribution: list[str]

    limitations: list[str]
