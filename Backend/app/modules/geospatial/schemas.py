
from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    model_validator
)


# ==========================================
# GEOJSON POINT
# ==========================================

class GeoJSONPoint(BaseModel):

    type: Literal["Point"] = "Point"

    coordinates: list[float] = Field(
        min_length=2,
        max_length=2
    )

    @model_validator(mode="after")
    def validate_coordinates(self):

        longitude, latitude = self.coordinates

        if not -180 <= longitude <= 180:
            raise ValueError("Invalid longitude.")

        if not -90 <= latitude <= 90:
            raise ValueError("Invalid latitude.")

        return self


# ==========================================
# LOCATION SCHEMAS
# ==========================================

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


class LocationResponse(BaseModel):

    id: str

    location_name: str

    latitude: float

    longitude: float

    geometry: GeoJSONPoint


# ==========================================
# GEOJSON POLYGON
# ==========================================

LinearRing = list[tuple[float, float]]


# ==========================================
# GEOJSON LINESTRING
# ==========================================

class GeoJSONLineString(BaseModel):

    type: Literal["LineString"] = "LineString"

    coordinates: list[tuple[float, float]] = Field(
        min_length=2
    )

    @model_validator(mode="after")
    def validate_coordinates(self):

        for longitude, latitude in self.coordinates:

            if not -180 <= longitude <= 180:
                raise ValueError("Invalid longitude.")

            if not -90 <= latitude <= 90:
                raise ValueError("Invalid latitude.")

        return self



class GeoJSONPolygon(BaseModel):

    type: Literal["Polygon"] = "Polygon"

    coordinates: list[LinearRing] = Field(
        min_length=1
    )

    @model_validator(mode="after")
    def validate_rings(self):

        for ring in self.coordinates:

            if len(ring) < 4:
                raise ValueError(
                    "A polygon ring needs at least 4 positions."
                )

            for longitude, latitude in ring:

                if not -180 <= longitude <= 180:
                    raise ValueError("Invalid longitude.")

                if not -90 <= latitude <= 90:
                    raise ValueError("Invalid latitude.")

            if ring[0] != ring[-1]:
                raise ValueError(
                    "A polygon ring must be closed."
                )

        return self


# ==========================================
# GEOJSON MULTIPOLYGON
# ==========================================

class GeoJSONMultiPolygon(BaseModel):

    type: Literal["MultiPolygon"] = "MultiPolygon"

    coordinates: list[list[LinearRing]] = Field(
        min_length=1
    )

    @model_validator(mode="after")
    def validate_polygons(self):

        for polygon in self.coordinates:

            # Every polygon must contain at least one ring.
            if not polygon:
                raise ValueError(
                    "Each polygon must contain at least one ring."
                )

            for ring in polygon:

                # Every ring must contain at least four positions.
                if len(ring) < 4:
                    raise ValueError(
                        "A polygon ring needs at least 4 positions."
                    )

                # Validate longitude and latitude.
                for longitude, latitude in ring:

                    if not -180 <= longitude <= 180:
                        raise ValueError("Invalid longitude.")

                    if not -90 <= latitude <= 90:
                        raise ValueError("Invalid latitude.")

                # Every ring must be closed.
                if ring[0] != ring[-1]:
                    raise ValueError(
                        "A polygon ring must be closed."
                    )

        return self

# ==========================================
# SPATIAL ANALYSIS
# ==========================================

class SpatialAnalysisRequest(BaseModel):

    point: GeoJSONPoint

    polygon: GeoJSONPolygon | GeoJSONMultiPolygon

class SpatialAnalysisResponse(BaseModel):

    covered: bool

    strictly_inside: bool

    on_boundary: bool

    relationship: Literal[
        "inside",
        "outside",
        "boundary"
    ]

# ==========================================
# GEOGRAPHIC DISTANCE
# ==========================================

class DistanceCalculationRequest(BaseModel):

    point_a: GeoJSONPoint

    point_b: GeoJSONPoint


class DistanceCalculationResponse(BaseModel):

    distance_meters: float

    distance_kilometers: float

    method: Literal["WGS84 geodesic"]