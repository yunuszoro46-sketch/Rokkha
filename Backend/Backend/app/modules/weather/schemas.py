
from datetime import datetime, timezone

from pydantic import BaseModel, Field


class WeatherObservationCreate(BaseModel):

    location_name: str = Field(min_length=2, max_length=100)

    latitude: float = Field(ge=-90, le=90)

    longitude: float = Field(ge=-180, le=180)

    rainfall_mm: float = Field(ge=0)

    temperature_c: float = Field(
        ge=-90,
        le=65
    )

    humidity_percent: float = Field(
        ge=0,
        le=100
    )

    source: str = Field(
        default="manual",
        max_length=100
    )


class WeatherObservationResponse(BaseModel):

    id: str

    location_name: str

    latitude: float

    longitude: float

    rainfall_mm: float

    temperature_c: float

    humidity_percent: float

    source: str

    observed_at: datetime
