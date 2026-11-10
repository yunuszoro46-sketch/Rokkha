
from datetime import date

from fastapi import APIRouter, HTTPException, Query, status

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
    MultiPointZoneResponse,
    MultiPointDistanceRequest,
    MultiPointDistanceResponse,
    PointInZonesRequest,
    PointInZonesResponse,
    BoundaryListResponse,
    BoundaryLocateRequest,
    BoundaryLocateResponse,
    WaterwayType,
    WaterwaySummaryResponse,
    WaterwayNearestRequest,
    WaterwayNearestResponse,
    FloodEventListResponse,
    DistrictFloodRankingResponse,
    DistrictFloodHistoryResponse,
    DistrictSatelliteObservationsResponse,
    FloodCheckRequest,
    FloodCheckResponse
)

from app.modules.geospatial.service import (
    add_location,
    list_locations,
    find_location,
    analyze_point_in_polygon,
    calculate_geographic_distance,
    calculate_linestring_length,
    analyze_multipoint_in_zone,
    calculate_multipoint_distances,
    analyze_point_in_zones,
    list_boundaries,
    locate_point_in_boundaries,
    summarize_waterways,
    find_nearest_waterways,
    list_flood_events,
    rank_flood_districts,
    get_district_flood_history,
    get_district_satellite_observations,
    check_flood_at_point
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
async def create_location(data: LocationCreate):

    return await add_location(
        data.model_dump()
    )


@router.get(
    "/locations",
    response_model=list[LocationResponse]
)
async def get_locations():

    return await list_locations()


@router.get(
    "/locations/{location_id}",
    response_model=LocationResponse
)
async def get_location(location_id: str):

    location = await find_location(location_id)

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


# ==========================================
# MULTIPOINT DISTANCES ENDPOINT
# ==========================================

@router.post(
    "/spatial-analysis/multipoint-distances",
    response_model=MultiPointDistanceResponse
)
def multipoint_distance_analysis(
    data: MultiPointDistanceRequest
):

    result = calculate_multipoint_distances(
        data.reference,
        data.points
    )

    return result


# ==========================================
# POINT IN NAMED ZONES ENDPOINT
# ==========================================

@router.post(
    "/spatial-analysis/point-in-zones",
    response_model=PointInZonesResponse
)
def point_in_zones_analysis(
    data: PointInZonesRequest
):

    try:

        result = analyze_point_in_zones(
            data.point,
            data.zones
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=422,
            detail=str(error)
        )


# ==========================================
# ADMINISTRATIVE BOUNDARY ENDPOINTS
# ==========================================

@router.get(
    "/boundaries",
    response_model=BoundaryListResponse
)
def get_boundaries(
    admin_level: int | None = Query(
        default=None,
        ge=2,
        le=3,
        description="2 = district, 3 = upazila / city corporation"
    )
):

    return list_boundaries(admin_level)


@router.post(
    "/boundaries/locate",
    response_model=BoundaryLocateResponse
)
def locate_boundary(
    data: BoundaryLocateRequest
):

    return locate_point_in_boundaries(data.point)


# ==========================================
# WATERWAY ENDPOINTS
# ==========================================

@router.get(
    "/waterways",
    response_model=WaterwaySummaryResponse
)
def get_waterways(
    waterway_type: WaterwayType | None = Query(
        default=None,
        description="river, canal, stream, drain or ditch"
    )
):

    return summarize_waterways(waterway_type)


@router.post(
    "/waterways/nearest",
    response_model=WaterwayNearestResponse
)
def nearest_waterways(
    data: WaterwayNearestRequest
):

    return find_nearest_waterways(
        data.point,
        data.waterway_types
    )


# ==========================================
# FLOOD HISTORY AND FLOOD ZONE ENDPOINTS
# ==========================================

@router.get(
    "/flood/events",
    response_model=FloodEventListResponse
)
def get_flood_events():

    return list_flood_events()


@router.get(
    "/flood/districts",
    response_model=DistrictFloodRankingResponse
)
def get_flood_district_ranking(
    limit: int | None = Query(
        default=None,
        ge=1,
        le=64,
        description="Return only the top N districts"
    ),
    division: str | None = Query(
        default=None,
        description="Filter by division name, e.g. Sylhet"
    )
):

    return rank_flood_districts(limit, division)


@router.get(
    "/flood/districts/{pcode}",
    response_model=DistrictFloodHistoryResponse
)
def get_flood_district_history(pcode: str):

    history = get_district_flood_history(pcode)

    if history is None:

        raise HTTPException(
            status_code=404,
            detail="District not found"
        )

    return history


@router.get(
    "/flood/districts/{pcode}/satellite-observations",
    response_model=DistrictSatelliteObservationsResponse
)
def get_flood_district_satellite_observations(
    pcode: str,
    start_date: date | None = Query(default=None, description="First UTC day, e.g. 2022-05-01"),
    end_date: date | None = Query(default=None, description="Last UTC day, e.g. 2022-07-31"),
    min_observed_share: float = Query(
        default=0.5,
        ge=0.05,
        le=1,
        description="Only passes that saw at least this share of the district"
    )
):

    if start_date and end_date and start_date > end_date:

        raise HTTPException(
            status_code=422,
            detail="start_date must not be after end_date."
        )

    observations = get_district_satellite_observations(
        pcode, start_date, end_date, min_observed_share
    )

    if observations is None:

        raise HTTPException(
            status_code=404,
            detail="District not found"
        )

    return observations


@router.post(
    "/flood/check",
    response_model=FloodCheckResponse
)
def flood_check(
    data: FloodCheckRequest
):

    return check_flood_at_point(data.point)
