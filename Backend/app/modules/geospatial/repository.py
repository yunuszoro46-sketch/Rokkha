
import json
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from app.modules.geospatial.schemas import GeoJSONFeatureCollection

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


# ==========================================
# ADMINISTRATIVE BOUNDARIES (read-only file)
# ==========================================

# Path: Backend/data/boundaries/dhaka_boundaries.geojson
# parents[3] walks up: geospatial -> modules -> app -> Backend
BOUNDARIES_FILE = (
    Path(__file__).resolve().parents[3]
    / "data" / "boundaries" / "dhaka_boundaries.geojson"
)

BOUNDARIES_ATTRIBUTION = (
    "Administrative boundaries © Bangladesh Bureau of Statistics (BBS) "
    "and UN OCHA, via the Humanitarian Data Exchange (HDX), "
    "licensed under CC BY-IGO."
)


@lru_cache(maxsize=1)
def get_boundary_collection() -> GeoJSONFeatureCollection:

    # lru_cache remembers the result, so the file is read and
    # validated only the first time this function is called.
    raw = json.loads(
        BOUNDARIES_FILE.read_text(encoding="utf-8")
    )

    # Validate with the same schema the API uses, so a broken
    # data file fails loudly instead of giving wrong answers.
    return GeoJSONFeatureCollection.model_validate(raw)
