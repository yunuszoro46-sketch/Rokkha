
from uuid import uuid4

from datetime import datetime, timezone


# Temporary storage for development.
# This data disappears when the application restarts.

weather_records = []


def create_weather_record(data: dict):

    record = {
        "id": str(uuid4()),
        **data,
        "observed_at": datetime.now(timezone.utc)
    }

    weather_records.append(record)

    return record


def get_all_weather_records():

    return weather_records


def get_weather_record(record_id: str):

    for record in weather_records:

        if record["id"] == record_id:
            return record

    return None
