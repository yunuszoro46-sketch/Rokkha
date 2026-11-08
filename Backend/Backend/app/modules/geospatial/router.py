
from fastapi import APIRouter, HTTPException, status

from app.modules.geospatial.schemas import (
    LocationCreate,
    LocationResponse
)

from app.modules.geospatial.service import (
    add_location,
    list_locations,
    find_location
)


router = APIRouter(
    prefix="/geospatial",
    tags=["Geospatial"]
)


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
