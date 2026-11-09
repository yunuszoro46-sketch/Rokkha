
from typing import Annotated, Any, Literal

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


# ==========================================
# GEOJSON MULTIPOINT
# ==========================================

class GeoJSONMultiPoint(BaseModel):

    type: Literal["MultiPoint"] = "MultiPoint"

    # One or more [longitude, latitude] positions.
    coordinates: list[tuple[float, float]] = Field(
        min_length=1
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
# GEOJSON FEATURE AND FEATURECOLLECTION
# ==========================================

# Any supported geometry. Pydantic reads the "type" field
# ("Point", "Polygon", ...) to decide which schema to validate with.
GeoJSONGeometry = Annotated[
    GeoJSONPoint
    | GeoJSONMultiPoint
    | GeoJSONLineString
    | GeoJSONPolygon
    | GeoJSONMultiPolygon,
    Field(discriminator="type")
]


class GeoJSONFeature(BaseModel):

    type: Literal["Feature"] = "Feature"

    # Optional identifier, for example a ward number.
    id: str | int | None = None

    geometry: GeoJSONGeometry

    # Free-form information about the feature,
    # for example {"name": "Ward 15", "risk_level": "high"}.
    properties: dict[str, Any] | None = None


class GeoJSONFeatureCollection(BaseModel):

    type: Literal["FeatureCollection"] = "FeatureCollection"

    features: list[GeoJSONFeature]

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


# ==========================================
# LINESTRING PATH LENGTH
# ==========================================

class LineStringLengthRequest(BaseModel):

    line: GeoJSONLineString


class LineStringLengthResponse(BaseModel):

    # Real-world path length along the Earth's surface.
    total_length_meters: float

    total_length_kilometers: float

    # Number of straight pieces between consecutive positions.
    segment_count: int

    # Geodesic length of each segment, in order.
    segment_lengths_meters: list[float]

    # Shapely's flat length in DEGREES, shown for learning only.
    # This is NOT a distance and must not be used as one.
    planar_length_degrees: float

    method: Literal["WGS84 geodesic"]


# ==========================================
# MULTIPOINT IN ZONE
# ==========================================

class MultiPointZoneRequest(BaseModel):

    points: GeoJSONMultiPoint

    zone: GeoJSONPolygon | GeoJSONMultiPolygon


class PointZoneResult(BaseModel):

    # Position of this point in the request list (starts at 0).
    point_index: int

    # [longitude, latitude]
    coordinates: tuple[float, float]

    covered: bool

    strictly_inside: bool

    on_boundary: bool

    relationship: Literal[
        "inside",
        "outside",
        "boundary"
    ]


class MultiPointZoneResponse(BaseModel):

    total_points: int

    inside_count: int

    boundary_count: int

    outside_count: int

    # inside + boundary: every point the zone touches.
    covered_count: int

    results: list[PointZoneResult]


# ==========================================
# MULTIPOINT DISTANCES FROM A REFERENCE POINT
# ==========================================

class MultiPointDistanceRequest(BaseModel):

    # The point we measure FROM (for example, a flooded location).
    reference: GeoJSONPoint

    # The points we measure TO (for example, shelters or gauges).
    points: GeoJSONMultiPoint


class PointDistanceResult(BaseModel):

    # Position of this point in the request list (starts at 0).
    point_index: int

    # [longitude, latitude]
    coordinates: tuple[float, float]

    distance_meters: float

    distance_kilometers: float


class MultiPointDistanceResponse(BaseModel):

    total_points: int

    # Index of the closest point. If several points are equally
    # close, the first one in the request list is chosen.
    nearest_point_index: int

    nearest_distance_meters: float

    nearest_distance_kilometers: float

    # In the same order as the request, so indexes match.
    results: list[PointDistanceResult]

    method: Literal["WGS84 geodesic"]


# ==========================================
# POINT IN NAMED ZONES (FEATURECOLLECTION)
# ==========================================

class PointInZonesRequest(BaseModel):

    point: GeoJSONPoint

    # Every feature must have a Polygon or MultiPolygon geometry.
    zones: GeoJSONFeatureCollection


class ZoneMatch(BaseModel):

    # Position of the zone in the request's features list.
    feature_index: int

    feature_id: str | int | None

    properties: dict[str, Any] | None

    covered: bool

    strictly_inside: bool

    on_boundary: bool

    relationship: Literal[
        "inside",
        "boundary"
    ]


class PointInZonesResponse(BaseModel):

    total_zones: int

    # Number of zones that cover the point (inside or boundary).
    matched_count: int

    # Only the zones that cover the point, in request order.
    matches: list[ZoneMatch]

# ==========================================
# ADMINISTRATIVE BOUNDARIES
# ==========================================

class BoundarySummary(BaseModel):

    # Official place code, for example "BD30262000".
    pcode: str

    name: str

    # 2 = district, 3 = upazila or city corporation.
    admin_level: int

    parent_name: str

    parent_pcode: str

    area_sqkm: float


class BoundaryListResponse(BaseModel):

    count: int

    attribution: str

    boundaries: list[BoundarySummary]


class BoundaryLocateRequest(BaseModel):

    point: GeoJSONPoint


class BoundaryLocateResponse(BaseModel):

    total_boundaries: int

    # 0 means the point is outside Dhaka District.
    matched_count: int

    # Ordered from largest area (district) to smallest (unit).
    matches: list[ZoneMatch]

    attribution: str


# ==========================================
# WATERWAYS (RIVERS, CANALS, DRAINS)
# ==========================================

WaterwayType = Literal[
    "river",
    "canal",
    "stream",
    "drain",
    "ditch"
]


class WaterwayTypeSummary(BaseModel):

    waterway_type: WaterwayType

    feature_count: int

    # Geodesic length, summed over every feature of this type.
    total_length_km: float


class WaterwaySummaryResponse(BaseModel):

    total_features: int

    by_type: list[WaterwayTypeSummary]

    attribution: str

    limitations: list[str]


class WaterwayNearestRequest(BaseModel):

    point: GeoJSONPoint

    # Which waterway types to search. One result is returned per type.
    waterway_types: list[WaterwayType] = Field(
        default=["river", "canal"],
        min_length=1
    )


class NearestWaterway(BaseModel):

    waterway_type: WaterwayType

    osm_id: str

    # Many canals and drains have no mapped name.
    name: str | None

    distance_meters: float

    distance_kilometers: float

    # The closest position on the waterway line.
    nearest_point: GeoJSONPoint


class WaterwayNearestResponse(BaseModel):

    # False when the point is outside Dhaka District. The data only covers
    # Dhaka District, so the real nearest waterway may then be missing.
    inside_coverage_area: bool

    results: list[NearestWaterway]

    method: Literal["WGS84 geodesic"]

    attribution: str
