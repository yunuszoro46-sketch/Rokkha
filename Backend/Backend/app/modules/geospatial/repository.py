
from uuid import uuid4

# Temporary storage.
# Records disappear when the application restarts.

location_records = []


def create_location_record(data: dict):

    record = {
        "id": str(uuid4()),
        **data
    }

    location_records.append(record)

    return record


def get_all_location_records():

    return location_records


def get_location_record(location_id: str):

    for location in location_records:

        if location["id"] == location_id:
            return location

    return None
