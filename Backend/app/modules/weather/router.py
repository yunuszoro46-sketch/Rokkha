
from fastapi import APIRouter, HTTPException, status

from app.modules.weather.schemas import (
    WeatherObservationCreate,
    WeatherObservationResponse
)

from app.modules.weather.service import (
    add_weather_observation,
    list_weather_observations,
    find_weather_observation
)


router = APIRouter(
    prefix="/weather",
    tags=["Weather"]
)


@router.post(
    "/observations",
    response_model=WeatherObservationResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_observation(data: WeatherObservationCreate):

    return await add_weather_observation(
        data.model_dump()
    )


@router.get(
    "/observations",
    response_model=list[WeatherObservationResponse]
)
async def get_observations():

    return await list_weather_observations()


@router.get(
    "/observations/{record_id}",
    response_model=WeatherObservationResponse
)
async def get_observation(record_id: str):

    record = await find_weather_observation(record_id)

    if record is None:

        raise HTTPException(
            status_code=404,
            detail="Weather observation not found"
        )

    return record
