
from app.modules.geospatial.repository import (
    create_location_record,
    get_all_location_records,
    get_location_record
)


def add_location(data: dict):

    geometry = {
        "type": "Point",
        "coordinates": [
            data["longitude"],
            data["latitude"]
        ]
    }

    location_data = {
        **data,
        "geometry": geometry
    }

    return create_location_record(location_data)


def list_locations():

    return get_all_location_records()


def find_location(location_id: str):

    return get_location_record(location_id)
