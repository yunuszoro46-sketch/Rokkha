from app.modules.assets.repository import (
    create_asset_record,
    delete_asset_record,
    get_all_asset_records,
    get_asset_record,
    update_asset_record,
)
from app.modules.geospatial.schemas import GeoJSONPoint
from app.modules.geospatial.service import find_district


class AssetOutsideCoverageError(ValueError):
    """Raised when an asset location is outside Bangladesh."""


def _district_for(location: dict) -> dict:

    # Ask the geospatial module which district contains the point.
    district = find_district(GeoJSONPoint(**location))

    if district is None:
        raise AssetOutsideCoverageError(
            "Asset location is outside Bangladesh. Climate Shield's flood, "
            "boundary and waterway data only cover Bangladesh."
        )

    return district


def add_asset(data: dict) -> dict:

    data["district"] = _district_for(data["location"])

    return create_asset_record(data)


def list_assets(
    asset_type: str | None = None,
    criticality: str | None = None,
    district_pcode: str | None = None,
) -> dict:

    assets = [
        asset
        for asset in get_all_asset_records()
        if (asset_type is None or asset["asset_type"] == asset_type)
        and (criticality is None or asset["criticality"] == criticality)
        and (
            district_pcode is None
            or asset["district"]["pcode"] == district_pcode.upper()
        )
    ]

    # Oldest first, so the order is stable between requests.
    assets.sort(key=lambda asset: asset["created_at"])

    return {
        "count": len(assets),
        # "or 0" treats a missing value (None) as zero in the totals.
        "total_occupancy": sum(a["occupancy"] or 0 for a in assets),
        "total_replacement_value_bdt": sum(
            a["replacement_value_bdt"] or 0 for a in assets
        ),
        "assets": assets,
    }


def find_asset(asset_id: str) -> dict | None:

    return get_asset_record(asset_id)


def change_asset(asset_id: str, changes: dict) -> dict | None:

    if get_asset_record(asset_id) is None:
        return None

    # A new location means a (possibly) new district.
    if "location" in changes:
        changes["district"] = _district_for(changes["location"])

    return update_asset_record(asset_id, changes)


def remove_asset(asset_id: str) -> bool:

    return delete_asset_record(asset_id)
