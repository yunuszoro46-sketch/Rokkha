from fastapi import APIRouter, HTTPException, Query, Response, status

from app.modules.assets.schemas import (
    AssetCreate,
    AssetListResponse,
    AssetResponse,
    AssetType,
    AssetUpdate,
    Criticality,
)
from app.modules.assets.service import (
    AssetOutsideCoverageError,
    add_asset,
    change_asset,
    find_asset,
    list_assets,
    remove_asset,
)


router = APIRouter(
    prefix="/assets",
    tags=["Assets"]
)


def _not_found():
    return HTTPException(status_code=404, detail="Asset not found")


@router.post(
    "",
    response_model=AssetResponse,
    status_code=status.HTTP_201_CREATED
)
def create_asset(data: AssetCreate):

    try:
        return add_asset(data.model_dump())

    except AssetOutsideCoverageError as error:
        raise HTTPException(status_code=422, detail=str(error))


@router.get(
    "",
    response_model=AssetListResponse
)
def get_assets(
    asset_type: AssetType | None = Query(default=None),
    criticality: Criticality | None = Query(default=None),
    district_pcode: str | None = Query(
        default=None,
        description="District code, e.g. BD3026 for Dhaka"
    ),
):

    return list_assets(asset_type, criticality, district_pcode)


@router.get(
    "/{asset_id}",
    response_model=AssetResponse
)
def get_asset(asset_id: str):

    asset = find_asset(asset_id)

    if asset is None:
        raise _not_found()

    return asset


@router.patch(
    "/{asset_id}",
    response_model=AssetResponse
)
def update_asset(asset_id: str, data: AssetUpdate):

    # exclude_unset: only the fields the client actually sent, so a
    # missing field means "leave unchanged", not "set to null".
    changes = data.model_dump(exclude_unset=True)

    try:
        asset = change_asset(asset_id, changes)

    except AssetOutsideCoverageError as error:
        raise HTTPException(status_code=422, detail=str(error))

    if asset is None:
        raise _not_found()

    return asset


@router.delete(
    "/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_asset(asset_id: str):

    if not remove_asset(asset_id):
        raise _not_found()

    # 204 = success with no body.
    return Response(status_code=status.HTTP_204_NO_CONTENT)
