
from fastapi import APIRouter, HTTPException, status

from app.modules.geospatial.schemas import (
    LocationCreate,
    LocationResponse,
    SpatialAnalysisRequest,
    SpatialAnalysisResponse,
    DistanceCalculationRequest,
    DistanceCalculationResponse,
    LineStringLengthRequest,
    LineStringLengthResponse,
    MultiPointZoneRequest,
    MultiPointZoneResponse
)

from app.modules.geospatial.service import (
    add_location,
    list_locations,
    find_location,
    analyze_point_in_polygon,
    calculate_geographic_distance,
    calculate_linestring_length,
    analyze_multipoint_in_zone
)


router = APIRouter(
    prefix="/geospatial",
    tags=["Geospatial"]
)


# ==========================================
# LOCATION ENDPOINTS
# ==========================================

@router.post(
    "/locations",
    response_model=LocationResponse,
    status_code=status.HTTP_201_CREATED
)
def create_location(data: LocationCreate):

    return add_location(
        data.model_dump()
    )


@router.get(
    "/locations",
    response_model=list[LocationResponse]
)
def get_locations():

    return list_locations()


@router.get(
    "/locations/{location_id}",
    response_model=LocationResponse
)
def get_location(location_id: str):

    location = find_location(location_id)

    if location is None:

        raise HTTPException(
            status_code=404,
            detail="Location not found"
        )

    return location


# ==========================================
# SPATIAL ANALYSIS ENDPOINT
# ==========================================

@router.post(
    "/spatial-analysis/point-in-polygon",
    response_model=SpatialAnalysisResponse
)
def point_in_polygon_analysis(
    data: SpatialAnalysisRequest
):

    try:

        result = analyze_point_in_polygon(
            data.point,
            data.polygon
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=422,
            detail=str(error)
        )

# ==========================================
# GEOGRAPHIC DISTANCE ENDPOINT
# ==========================================

@router.post(
    "/spatial-analysis/distance",
    response_model=DistanceCalculationResponse
)
def calculate_distance(
    data: DistanceCalculationRequest
):

    result = calculate_geographic_distance(
        data.point_a,
        data.point_b
    )

    return result


# ==========================================
# LINESTRING PATH LENGTH ENDPOINT
# ==========================================

@router.post(
    "/spatial-analysis/linestring-length",
    response_model=LineStringLengthResponse
)
def linestring_length_analysis(
    data: LineStringLengthRequest
):

    try:

        result = calculate_linestring_length(
            data.line
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=422,
            detail=str(error)
        )

# ==========================================
# MULTIPOINT IN ZONE ENDPOINT
# ==========================================

@router.post(
    "/spatial-analysis/multipoint-in-zone",
    response_model=MultiPointZoneResponse
)
def multipoint_in_zone_analysis(
    data: MultiPointZoneRequest
):

    try:

        result = analyze_multipoint_in_zone(
            data.points,
            data.zone
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=422,
            detail=str(error)
        )
