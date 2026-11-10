from shapely.geometry import shape

from app.modules.assets.repository import (
    create_asset_record,
    delete_asset_record,
    find_asset_records,
    find_assets_near,
    find_assets_within,
    get_asset_record,
    update_asset_record,
)
from app.modules.geospatial.schemas import GeoJSONPoint
from app.modules.geospatial.service import (
    FLOOD_LIMITATIONS,
    calculate_geographic_distance,
    check_flood_at_point,
    find_district,
    find_nearest_waterways,
)


class AssetOutsideCoverageError(ValueError):
    """Raised when an asset location is outside Bangladesh."""


class InvalidAreaError(ValueError):
    """Raised when a search polygon is geometrically invalid."""


def _district_for(location: dict) -> dict:

    # Ask the geospatial module which district contains the point.
    district = find_district(GeoJSONPoint(**location))

    if district is None:
        raise AssetOutsideCoverageError(
            "Asset location is outside Bangladesh. Climate Shield's flood, "
            "boundary and waterway data only cover Bangladesh."
        )

    return district


def _filters(
    asset_type: str | None,
    criticality: str | None,
    district_pcode: str | None,
) -> dict:

    # The same three filters everywhere, as a MongoDB query.
    query = {}

    if asset_type is not None:
        query["asset_type"] = asset_type

    if criticality is not None:
        query["criticality"] = criticality

    if district_pcode is not None:
        query["district.pcode"] = district_pcode.upper()

    return query


def _with_totals(assets: list[dict]) -> dict:

    return {
        "count": len(assets),
        # "or 0" treats a missing value (None) as zero in the totals.
        "total_occupancy": sum(a["occupancy"] or 0 for a in assets),
        "total_replacement_value_bdt": sum(
            a["replacement_value_bdt"] or 0 for a in assets
        ),
        "assets": assets,
    }


async def add_asset(data: dict) -> dict:

    data["district"] = _district_for(data["location"])

    return await create_asset_record(data)


async def list_assets(
    asset_type: str | None = None,
    criticality: str | None = None,
    district_pcode: str | None = None,
) -> dict:

    assets = await find_asset_records(_filters(asset_type, criticality, district_pcode))

    return _with_totals(assets)


async def find_asset(asset_id: str) -> dict | None:

    return await get_asset_record(asset_id)


async def change_asset(asset_id: str, changes: dict) -> dict | None:

    if await get_asset_record(asset_id) is None:
        return None

    # A new location means a (possibly) new district. Checked BEFORE
    # writing, so an invalid location changes nothing.
    if "location" in changes:
        changes["district"] = _district_for(changes["location"])

    return await update_asset_record(asset_id, changes)


async def remove_asset(asset_id: str) -> bool:

    return await delete_asset_record(asset_id)


# ==========================================
# GEOSPATIAL QUERIES (MongoDB 2dsphere index)
# ==========================================

async def assets_near(
    point: GeoJSONPoint,
    max_distance_m: float,
    asset_type: str | None = None,
    criticality: str | None = None,
    district_pcode: str | None = None,
) -> dict:

    # MongoDB selects and orders the assets with the 2dsphere index (fast).
    found = await find_assets_near(
        point.model_dump(),
        max_distance_m,
        _filters(asset_type, criticality, district_pcode),
    )

    results = []

    for asset in found:

        # MongoDB measures on a simple sphere; report the WGS84 geodesic
        # distance (GeographicLib), like every other distance in this API.
        asset.pop("_mongo_distance_m", None)

        distance = calculate_geographic_distance(
            point, GeoJSONPoint(**asset["location"])
        )

        results.append({
            "asset": asset,
            "distance_meters": distance["distance_meters"],
            "distance_kilometers": distance["distance_kilometers"],
        })

    return {
        "count": len(results),
        "max_distance_meters": max_distance_m,
        "total_occupancy": sum(r["asset"]["occupancy"] or 0 for r in results),
        "total_replacement_value_bdt": sum(
            r["asset"]["replacement_value_bdt"] or 0 for r in results
        ),
        "results": results,
        "method": "MongoDB $geoNear (2dsphere) selection; distances WGS84 geodesic",
    }


async def assets_within(
    area: dict,
    asset_type: str | None = None,
    criticality: str | None = None,
    district_pcode: str | None = None,
) -> dict:

    # Reject broken shapes (e.g. a self-crossing "bow tie") with a clear
    # message, the same rule as the point-in-polygon endpoint.
    if not shape(area).is_valid:
        raise InvalidAreaError("The supplied area polygon is geometrically invalid.")

    assets = await find_assets_within(
        area, _filters(asset_type, criticality, district_pcode)
    )

    return _with_totals(assets)


# ==========================================
# EXPOSURE ANALYSIS
# ==========================================

EXPOSURE_LIMITATIONS = [
    "This is historical exposure and modelled hazard, not a forecast or a "
    "flood probability. Probabilities will come from the ML model.",
    "Waterway distances are only available inside Dhaka District.",
]


def _exposure_for(asset: dict) -> tuple[dict, list[str]]:

    point = GeoJSONPoint(**asset["location"])

    # Reuse the geospatial module's public functions: flood grid +
    # district history, and nearest waterways.
    flood = check_flood_at_point(point)
    waterways = find_nearest_waterways(point, ["river", "canal"])

    cell = flood["cell"]
    district = flood["district"]

    flooded_ids = cell["flooded_event_ids"]
    hazard = cell["hazard"]

    # Waterway data only covers Dhaka District: outside it, the "nearest"
    # line could be 200 km away and misleading, so leave the list empty.
    covered = waterways["inside_coverage_area"]

    exposure = {
        "asset_id": asset["id"],
        "name": asset["name"],
        "asset_type": asset["asset_type"],
        "criticality": asset["criticality"],
        "occupancy": asset["occupancy"],
        "replacement_value_bdt": asset["replacement_value_bdt"],
        "district": {
            "pcode": district["pcode"],
            "name": district["name"],
            "flood_rank": district["rank"],
            "events_observed": district["events_observed"],
            "events_flooded": district["events_flooded"],
        },
        "grid_cell_size_m": cell["grid_cell_size_m"],
        "on_permanent_water": cell["permanent_water"],
        "observed": {
            "times_observed": cell["times_observed"],
            "times_flooded": cell["times_flooded"],
            "flooded_event_ids": flooded_ids,
            # Events are stored oldest first, so the last one is the latest.
            "last_flooded_event_id": flooded_ids[-1] if flooded_ids else None,
        },
        "hazard": hazard,
        "waterway_coverage": covered,
        "nearest_waterways": [
            {
                "waterway_type": result["waterway_type"],
                "name": result["name"],
                "distance_meters": result["distance_meters"],
            }
            for result in waterways["results"]
        ] if covered else [],
        "flags": {
            "observed_flooding": cell["times_flooded"] > 0,
            "modelled_hazard_10yr": hazard[0]["depth_class"] is not None,
            "modelled_hazard_100yr": hazard[1]["depth_class"] is not None,
        },
    }

    attribution = [flood["attribution"], waterways["attribution"]]

    return exposure, attribution


async def analyze_asset_exposure(asset_id: str) -> dict | None:

    asset = await get_asset_record(asset_id)

    if asset is None:
        return None

    exposure, attribution = _exposure_for(asset)

    return {
        **exposure,
        "attribution": attribution,
        "limitations": FLOOD_LIMITATIONS + EXPOSURE_LIMITATIONS,
    }


def _totals(exposures: list[dict]) -> dict:

    return {
        "assets": len(exposures),
        "occupancy": sum(e["occupancy"] or 0 for e in exposures),
        "replacement_value_bdt": sum(
            e["replacement_value_bdt"] or 0 for e in exposures
        ),
    }


async def exposure_report(
    asset_type: str | None = None,
    criticality: str | None = None,
    district_pcode: str | None = None,
) -> dict:

    # Same filters as the asset list, so both views always agree.
    assets = (await list_assets(asset_type, criticality, district_pcode))["assets"]

    exposures, attribution = [], []

    for asset in assets:
        exposure, attribution = _exposure_for(asset)
        exposures.append(exposure)

    def flagged(flag):
        return [e for e in exposures if e["flags"][flag]]

    return {
        "summary": {
            "total": _totals(exposures),
            "with_observed_flooding": _totals(flagged("observed_flooding")),
            "with_modelled_hazard_10yr": _totals(flagged("modelled_hazard_10yr")),
            "with_modelled_hazard_100yr": _totals(flagged("modelled_hazard_100yr")),
        },
        "assets": exposures,
        # Empty when there are no assets: no data was used.
        "attribution": attribution,
        "limitations": FLOOD_LIMITATIONS + EXPOSURE_LIMITATIONS,
    }
