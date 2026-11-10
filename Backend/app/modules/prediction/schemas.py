import datetime as dt
from typing import Any, Literal

from pydantic import BaseModel


PredictionStatus = Literal["predicted", "unsupported", "inputs_missing"]

AlertLevel = Literal["none", "watch", "alert"]


class ModelInfoResponse(BaseModel):

    # "not_trained": no model file exists yet, so there are no predictions.
    status: Literal["ready", "not_trained"]

    message: str

    # The model's own description: what it predicts, inputs, training and
    # test periods, measured results, alert thresholds. null if not trained.
    model: dict[str, Any] | None


class PredictionRequest(BaseModel):

    # The day to predict (UTC). Uses stored data through the day before.
    target_date: dt.date


class DistrictPrediction(BaseModel):

    pcode: str

    name: str

    division: str

    target_date: dt.date

    status: PredictionStatus

    # Model estimate (0-1); null unless status is "predicted".
    probability: float | None

    alert_level: AlertLevel | None

    # Why there is no prediction (unsupported / inputs_missing).
    reason: str | None

    # The inputs the model used, for transparency. null = input not available.
    features: dict[str, float | None] | None

    # How many of the 30 rain days came from the GFS recent-days source
    # because ERA5 (which the model learned from) had not delivered them yet.
    # 0 for past dates; about 5 for today.
    recent_rain_days: int | None = None

    # Last day of data used.
    data_through: dt.date

    model_version: str

    issued_at: dt.datetime


class PredictionListResponse(BaseModel):

    target_date: dt.date

    model_version: str

    issued_at: dt.datetime

    count: int

    count_predicted: int

    predictions: list[DistrictPrediction]

    what_is_predicted: str

    # Probabilities from which a district gets a "watch" or an "alert".
    alert_thresholds: dict[str, Any] | None

    attribution: list[str]

    limitations: list[str]
