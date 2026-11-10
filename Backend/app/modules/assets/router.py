from fastapi import APIRouter, HTTPException, Query, Response, status

from app.modules.assets.schemas import (
    AssetCreate,
    AssetExposureReport,
    AssetListResponse,
    AssetNearResponse,
    AssetResponse,
    AssetType,
    AssetUpdate,
    AssetWithinRequest,
    Criticality,
    SingleAssetExposureResponse,
)
from app.modules.assets.service import (
    AssetOutsideCoverageError,
    InvalidAreaError,
    add_asset,
    analyze_asset_exposure,
    assets_near,
    assets_within,
    change_asset,
    exposure_report,
    find_asset,
    list_assets,
    remove_asset,
)
from app.modules.geospatial.schemas import GeoJSONPoint


router = APIRouter(
    prefix="/assets",
    tags=["Assets"]
)

# Every endpoint is "async def": it awaits MongoDB without blocking the
# server, so other requests are served while one waits for the database.


def _not_found():
    return HTTPException(status_code=404, detail="Asset not found")


# The same three optional filters on every list-style endpoint.
TypeFilter = Query(default=None)
CriticalityFilter = Query(default=None)
DistrictFilter = Query(default=None, description="District code, e.g. BD3026 for Dhaka")


@router.post(
    "",
    response_model=AssetResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_asset(data: AssetCreate):

    try:
        return await add_asset(data.model_dump())

    except AssetOutsideCoverageError as error:
        raise HTTPException(status_code=422, detail=str(error))


@router.get(
    "",
    response_model=AssetListResponse
)
async def get_assets(
    asset_type: AssetType | None = TypeFilter,
    criticality: Criticality | None = CriticalityFilter,
    district_pcode: str | None = DistrictFilter,
):

    return await list_assets(asset_type, criticality, district_pcode)


# The fixed paths below ("/exposure", "/near", "/within") must be declared
# BEFORE "/{asset_id}": FastAPI matches routes top to bottom, and
# "/{asset_id}" would otherwise catch them as an id.

@router.get(
    "/exposure",
    response_model=AssetExposureReport
)
async def get_exposure_report(
    asset_type: AssetType | None = TypeFilter,
    criticality: Criticality | None = CriticalityFilter,
    district_pcode: str | None = DistrictFilter,
):

    return await exposure_report(asset_type, criticality, district_pcode)


@router.get(
    "/near",
    response_model=AssetNearResponse
)
async def get_assets_near(
    lng: float = Query(ge=-180, le=180, description="Longitude of the search point"),
    lat: float = Query(ge=-90, le=90, description="Latitude of the search point"),
    max_distance_m: float = Query(
        gt=0,
        le=200_000,
        description="Search radius in metres (up to 200 km)"
    ),
    asset_type: AssetType | None = TypeFilter,
    criticality: Criticality | None = CriticalityFilter,
    district_pcode: str | None = DistrictFilter,
):

    point = GeoJSONPoint(coordinates=[lng, lat])

    return await assets_near(
        point, max_distance_m, asset_type, criticality, district_pcode
    )


@router.post(
    "/within",
    response_model=AssetListResponse
)
async def get_assets_within(
    data: AssetWithinRequest,
    asset_type: AssetType | None = TypeFilter,
    criticality: Criticality | None = CriticalityFilter,
    district_pcode: str | None = DistrictFilter,
):

    try:
        return await assets_within(
            data.area.model_dump(), asset_type, criticality, district_pcode
        )

    except InvalidAreaError as error:
        raise HTTPException(status_code=422, detail=str(error))


@router.get(
    "/{asset_id}/exposure",
    response_model=SingleAssetExposureResponse
)
async def get_asset_exposure(asset_id: str):

    exposure = await analyze_asset_exposure(asset_id)

    if exposure is None:
        raise _not_found()

    return exposure


@router.get(
    "/{asset_id}",
    response_model=AssetResponse
)
async def get_asset(asset_id: str):

    asset = await find_asset(asset_id)

    if asset is None:
        raise _not_found()

    return asset


@router.patch(
    "/{asset_id}",
    response_model=AssetResponse
)
async def update_asset(asset_id: str, data: AssetUpdate):

    # exclude_unset: only the fields the client actually sent, so a
    # missing field means "leave unchanged", not "set to null".
    changes = data.model_dump(exclude_unset=True)

    try:
        asset = await change_asset(asset_id, changes)

    except AssetOutsideCoverageError as error:
        raise HTTPException(status_code=422, detail=str(error))

    if asset is None:
        raise _not_found()

    return asset


@router.delete(
    "/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def delete_asset(asset_id: str):

    if not await remove_asset(asset_id):
        raise _not_found()

    # 204 = success with no body.
    return Response(status_code=status.HTTP_204_NO_CONTENT)
