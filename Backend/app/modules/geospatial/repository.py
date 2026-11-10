
import json
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

import numpy
from pymongo import ASCENDING

from app.core.database import get_db

from app.modules.geospatial.schemas import GeoJSONFeatureCollection

# ==========================================
# SAVED LOCATIONS (MongoDB collection "locations", Milestone 17)
# ==========================================
# The API's "id" is stored as MongoDB's "_id". A hidden created_at keeps
# the list in a stable, oldest-first order (it is not part of the API
# response model, so clients never see it).

LOCATIONS_COLLECTION = "locations"


def _locations():
    return get_db()[LOCATIONS_COLLECTION]


def _location_to_api(document: dict | None) -> dict | None:

    if document is None:
        return None

    record = dict(document)
    record["id"] = record.pop("_id")
    return record


async def create_location_record(data: dict) -> dict:

    document = {
        "_id": str(uuid4()),
        **data,
        "created_at": datetime.now(timezone.utc),
    }

    await _locations().insert_one(document)

    return _location_to_api(document)


async def get_all_location_records() -> list[dict]:

    cursor = _locations().find().sort("created_at", ASCENDING)

    return [_location_to_api(document) async for document in cursor]


async def get_location_record(location_id: str) -> dict | None:

    return _location_to_api(await _locations().find_one({"_id": location_id}))

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


# ==========================================
# WATERWAYS (read-only file)
# ==========================================

WATERWAYS_FILE = (
    Path(__file__).resolve().parents[3]
    / "data" / "waterways" / "dhaka_waterways.geojson"
)

WATERWAYS_ATTRIBUTION = (
    "Waterway data © OpenStreetMap contributors, "
    "available under the Open Database License (ODbL)."
)


@lru_cache(maxsize=1)
def get_waterway_collection() -> GeoJSONFeatureCollection:

    raw = json.loads(
        WATERWAYS_FILE.read_text(encoding="utf-8")
    )

    return GeoJSONFeatureCollection.model_validate(raw)


# ==========================================
# FLOOD DATA (read-only files)
# ==========================================

DATA_DIR = Path(__file__).resolve().parents[3] / "data"

DISTRICTS_FILE = DATA_DIR / "boundaries" / "bangladesh_districts.geojson"

FLOOD_HISTORY_FILE = DATA_DIR / "flood" / "district_flood_history.json"

FLOOD_GRID_FILE = DATA_DIR / "flood" / "flood_grid.npz"

FLOOD_ATTRIBUTION = (
    "Observed floods: UNOSAT (United Nations Satellite Centre), CC BY-SA. "
    "Modelled river-flood hazard: JRC GloFAS flood hazard maps v2.1.2 "
    "© European Union, CC BY 4.0 / ODbL. "
    "District boundaries: Bangladesh Bureau of Statistics (BBS) and UN OCHA "
    "via HDX, CC BY-IGO."
)


@lru_cache(maxsize=1)
def get_district_collection() -> GeoJSONFeatureCollection:

    raw = json.loads(DISTRICTS_FILE.read_text(encoding="utf-8"))

    return GeoJSONFeatureCollection.model_validate(raw)


@lru_cache(maxsize=1)
def get_flood_history() -> dict:

    # A plain JSON document: events, method, and per-district history.
    return json.loads(FLOOD_HISTORY_FILE.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def get_flood_grid() -> dict:

    # Compressed numpy arrays on the ~90 m JRC grid covering Bangladesh.
    # np.load reads them into memory once (lru_cache); lookups are then
    # a simple array index.
    with numpy.load(FLOOD_GRID_FILE) as grid:
        return {name: grid[name] for name in grid.files}
