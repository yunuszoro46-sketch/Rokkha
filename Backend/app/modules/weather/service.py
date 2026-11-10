
from app.modules.weather.repository import (
    create_weather_record,
    get_all_weather_records,
    get_weather_record
)


async def add_weather_observation(data: dict):

    return await create_weather_record(data)


async def list_weather_observations():

    return await get_all_weather_records()


async def find_weather_observation(record_id: str):

    return await get_weather_record(record_id)
