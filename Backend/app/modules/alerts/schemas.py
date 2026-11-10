import datetime as dt
from typing import Any, Literal

from pydantic import BaseModel


class AlertDistrict(BaseModel):

    pcode: str

    name: str

    division: str


class AlertAsset(BaseModel):

    asset_id: str

    name: str

    asset_type: str

    criticality: str

    occupancy: int | None

    # Facts about the asset's own location (same as the exposure report):
    # observed_flooding, modelled_hazard_10yr, modelled_hazard_100yr.
    flags: dict[str, bool]


class AssetsAtRisk(BaseModel):

    # Each: {"assets": n, "occupancy": n, "replacement_value_bdt": n}
    total: dict[str, float]

    with_observed_flooding: dict[str, float]

    with_modelled_hazard_10yr: dict[str, float]

    assets: list[AlertAsset]


class Alert(BaseModel):

    alert_id: str

    # "alert" is more serious than "watch".
    level: Literal["watch", "alert"]

    district: AlertDistrict

    target_date: dt.date

    probability: float

    # A ready-to-show sentence.
    message: str

    assets_at_risk: AssetsAtRisk

    issued_at: dt.datetime

    model_version: str


class AlertListResponse(BaseModel):

    target_date: dt.date

    model_version: str

    min_level: Literal["watch", "alert"]

    count: int

    # Highest probability first. Empty = no district reached the threshold.
    alerts: list[Alert]

    districts_predicted: int

    alert_thresholds: dict[str, Any] | None

    what_is_predicted: str

    attribution: list[str]

    limitations: list[str]
