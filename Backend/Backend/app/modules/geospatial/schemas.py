
from pydantic import BaseModel, Field


class LocationCreate(BaseModel):

    location_name: str = Field(
        min_length=2,
        max_length=100
    )

    latitude: float = Field(
        ge=-90,
        le=90
    )

    longitude: float = Field(
        ge=-180,
        le=180
    )


class GeoJSONPoint(BaseModel):

    type: str = Field(
        default="Point",
        pattern="^Point$"
    )

    coordinates: list[float] = Field(
        min_length=2,
        max_length=2
    )


class LocationResponse(BaseModel):

    id: str

    location_name: str

    latitude: float

    longitude: float

    geometry: GeoJSONPoint
