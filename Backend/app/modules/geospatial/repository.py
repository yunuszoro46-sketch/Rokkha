
import json
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

import numpy

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
