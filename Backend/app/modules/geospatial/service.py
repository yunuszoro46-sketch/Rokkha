import math
from datetime import date, timedelta
from functools import lru_cache

import numpy
import shapely
from geographiclib.geodesic import Geodesic
from shapely.affinity import scale
from shapely.geometry import Point, Polygon, MultiPolygon, LineString
from shapely.ops import nearest_points
from app.modules.geospatial.schemas import (
    GeoJSONPoint,
    GeoJSONPolygon,
    GeoJSONMultiPolygon,
    GeoJSONLineString,
    GeoJSONMultiPoint,
    GeoJSONFeatureCollection
)
from app.modules.geospatial.repository import (
    create_location_record,
    get_all_location_records,
    get_location_record,
    get_boundary_collection,
    BOUNDARIES_ATTRIBUTION,
    get_waterway_collection,
    WATERWAYS_ATTRIBUTION,
    get_district_collection,
    get_flood_history,
    get_flood_grid,
    get_district_hazard_shares,
    get_satellite_observations,
    FLOOD_ATTRIBUTION
)


async def add_location(data: dict):

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

    return await create_location_record(location_data)


async def list_locations():

    return await get_all_location_records()


async def find_location(location_id: str):

    return await get_location_record(location_id)



def analyze_point_in_polygon(
    point_data: GeoJSONPoint,
    polygon_data: GeoJSONPolygon | GeoJSONMultiPolygon
):

    # Convert GeoJSON Point into a Shapely Point.
    point = Point(
        point_data.coordinates
    )

    # Determine which geometry was supplied.
    if isinstance(polygon_data, GeoJSONPolygon):

        polygon = Polygon(
            shell=polygon_data.coordinates[0],
            holes=polygon_data.coordinates[1:]
        )

    elif isinstance(polygon_data, GeoJSONMultiPolygon):

        polygons = []

        for polygon_coordinates in polygon_data.coordinates:

            individual_polygon = Polygon(
                shell=polygon_coordinates[0],
                holes=polygon_coordinates[1:]
            )

            polygons.append(individual_polygon)

        polygon = MultiPolygon(polygons)

    else:

        raise ValueError(
            "Unsupported geographic geometry."
        )

    # Reject invalid or empty geometry.
    if polygon.is_empty or not polygon.is_valid:
        raise ValueError(
            "The supplied polygon is geometrically invalid."
        )

    # Perform spatial analysis.
    covered = polygon.covers(point)

    strictly_inside = polygon.contains(point)

    on_boundary = polygon.boundary.covers(point)

    # Determine the relationship.
    if on_boundary:
        relationship = "boundary"

    elif strictly_inside:
        relationship = "inside"

    else:
        relationship = "outside"

    return {
        "covered": covered,
        "strictly_inside": strictly_inside,
        "on_boundary": on_boundary,
        "relationship": relationship
    }


# ==========================================
# GEOGRAPHIC DISTANCE CALCULATION
# ==========================================

def calculate_geographic_distance(
    point_a: GeoJSONPoint,
    point_b: GeoJSONPoint
):

    # GeoJSON coordinates are [longitude, latitude].
    longitude_a, latitude_a = point_a.coordinates

    longitude_b, latitude_b = point_b.coordinates

    # GeographicLib expects latitude first.
    result = Geodesic.WGS84.Inverse(
        latitude_a,
        longitude_a,
        latitude_b,
        longitude_b
    )

    distance_meters = result["s12"]

    distance_kilometers = distance_meters / 1000

    return {
        "distance_meters": distance_meters,
        "distance_kilometers": distance_kilometers,
        "method": "WGS84 geodesic"
    }

# ==========================================
# LINESTRING PATH LENGTH
# ==========================================

def calculate_linestring_length(
    line_data: GeoJSONLineString
):

    # Convert GeoJSON LineString into a Shapely LineString.
    line = LineString(line_data.coordinates)

    # Reject invalid or empty geometry.
    # Example: every position identical, so the path has no length.
    if line.is_empty or not line.is_valid:
        raise ValueError(
            "The supplied LineString is geometrically invalid."
        )

    segment_lengths_meters = []

    # Walk through consecutive pairs of positions:
    # (P1, P2), (P2, P3), ... (Pn-1, Pn)
    positions = line_data.coordinates

    for start, end in zip(positions[:-1], positions[1:]):

        # GeoJSON coordinates are [longitude, latitude].
        start_longitude, start_latitude = start

        end_longitude, end_latitude = end

        # GeographicLib expects latitude first.
        result = Geodesic.WGS84.Inverse(
            start_latitude,
            start_longitude,
            end_latitude,
            end_longitude
        )

        segment_lengths_meters.append(result["s12"])

    total_length_meters = sum(segment_lengths_meters)

    return {
        "total_length_meters": total_length_meters,
        "total_length_kilometers": total_length_meters / 1000,
        "segment_count": len(segment_lengths_meters),
        "segment_lengths_meters": segment_lengths_meters,
        "planar_length_degrees": line.length,
        "method": "WGS84 geodesic"
    }


# ==========================================
# MULTIPOINT IN ZONE
# ==========================================

def analyze_multipoint_in_zone(
    points_data: GeoJSONMultiPoint,
    zone_data: GeoJSONPolygon | GeoJSONMultiPolygon
):

    results = []

    # enumerate() gives each point's position (0, 1, 2, ...)
    # together with its coordinates.
    for index, coordinates in enumerate(points_data.coordinates):

        # Wrap the position as a GeoJSON Point so we can reuse
        # the already-tested point-in-polygon analysis.
        point = GeoJSONPoint(
            coordinates=list(coordinates)
        )

        # Raises ValueError if the zone geometry is invalid.
        analysis = analyze_point_in_polygon(point, zone_data)

        results.append({
            "point_index": index,
            "coordinates": coordinates,
            **analysis
        })

    # Count how many points have each relationship.
    inside_count = sum(
        1 for result in results if result["relationship"] == "inside"
    )

    boundary_count = sum(
        1 for result in results if result["relationship"] == "boundary"
    )

    outside_count = sum(
        1 for result in results if result["relationship"] == "outside"
    )

    return {
        "total_points": len(results),
        "inside_count": inside_count,
        "boundary_count": boundary_count,
        "outside_count": outside_count,
        "covered_count": inside_count + boundary_count,
        "results": results
    }


# ==========================================
# MULTIPOINT DISTANCES FROM A REFERENCE POINT
# ==========================================

def calculate_multipoint_distances(
    reference_data: GeoJSONPoint,
    points_data: GeoJSONMultiPoint
):

    results = []

    for index, coordinates in enumerate(points_data.coordinates):

        # Wrap the position as a GeoJSON Point so we can reuse
        # the already-tested geodesic distance calculation.
        point = GeoJSONPoint(
            coordinates=list(coordinates)
        )

        distance = calculate_geographic_distance(
            reference_data,
            point
        )

        results.append({
            "point_index": index,
            "coordinates": coordinates,
            "distance_meters": distance["distance_meters"],
            "distance_kilometers": distance["distance_kilometers"]
        })

    # min() with key= finds the result with the smallest distance.
    # On a tie, min() keeps the first one it saw.
    nearest = min(
        results,
        key=lambda result: result["distance_meters"]
    )

    return {
        "total_points": len(results),
        "nearest_point_index": nearest["point_index"],
        "nearest_distance_meters": nearest["distance_meters"],
        "nearest_distance_kilometers": nearest["distance_kilometers"],
        "results": results,
        "method": "WGS84 geodesic"
    }


# ==========================================
# POINT IN NAMED ZONES (FEATURECOLLECTION)
# ==========================================

def analyze_point_in_zones(
    point_data: GeoJSONPoint,
    zones_data: GeoJSONFeatureCollection
):

    matches = []

    for index, feature in enumerate(zones_data.features):

        # A zone must be an area. Points and lines cannot contain anything.
        if not isinstance(
            feature.geometry,
            (GeoJSONPolygon, GeoJSONMultiPolygon)
        ):
            raise ValueError(
                f"Zone feature {index} must have a Polygon or "
                f"MultiPolygon geometry, not {feature.geometry.type}."
            )

        # Reuse the already-tested point-in-polygon analysis.
        # Raises ValueError if this zone's geometry is invalid.
        analysis = analyze_point_in_polygon(
            point_data,
            feature.geometry
        )

        # Keep only zones that cover the point (inside or boundary).
        if analysis["covered"]:

            matches.append({
                "feature_index": index,
                "feature_id": feature.id,
                "properties": feature.properties,
                **analysis
            })

    return {
        "total_zones": len(zones_data.features),
        "matched_count": len(matches),
        "matches": matches
    }


# ==========================================
# ADMINISTRATIVE BOUNDARIES
# ==========================================

def list_boundaries(admin_level: int | None = None):

    collection = get_boundary_collection()

    boundaries = [
        feature.properties
        for feature in collection.features
        if admin_level is None
        or feature.properties["admin_level"] == admin_level
    ]

    return {
        "count": len(boundaries),
        "attribution": BOUNDARIES_ATTRIBUTION,
        "boundaries": boundaries
    }


def locate_point_in_boundaries(point_data: GeoJSONPoint):

    collection = get_boundary_collection()

    # Reuse the tested FeatureCollection logic from Milestone 11.
    result = analyze_point_in_zones(point_data, collection)

    # District (level 2) first, then the unit inside it (level 3).
    result["matches"].sort(
        key=lambda match: match["properties"]["admin_level"]
    )

    return {
        **result,
        "total_boundaries": result.pop("total_zones"),
        "attribution": BOUNDARIES_ATTRIBUTION
    }


# ==========================================
# WATERWAYS (RIVERS, CANALS, DRAINS)
# ==========================================

WATERWAY_LIMITATIONS = [
    "Coverage is Dhaka District only.",
    "Drains are very incomplete (about 75 km mapped); Dhaka WASA's "
    "storm-drain network is not available as open data.",
    "OpenStreetMap is crowd-sourced and cannot be considered exhaustive.",
]

# Shapely measures in flat x/y units. One degree of longitude is shorter
# than one degree of latitude (by cos(latitude)), so we shrink longitudes
# by cos(Dhaka's latitude) before asking Shapely "which line is closest?".
# Over a city-sized area this makes flat distances proportional to real
# ground distances. The final distance is still measured geodesically.
DHAKA_REFERENCE_LATITUDE = 23.8

LONGITUDE_SCALE = math.cos(math.radians(DHAKA_REFERENCE_LATITUDE))


@lru_cache(maxsize=1)
def _waterway_summary_by_type():

    totals = {}

    for feature in get_waterway_collection().features:

        waterway_type = feature.properties["waterway_type"]

        # Reuse the Milestone 9 geodesic path-length calculation.
        length = calculate_linestring_length(feature.geometry)

        count, meters = totals.get(waterway_type, (0, 0.0))

        totals[waterway_type] = (
            count + 1,
            meters + length["total_length_meters"]
        )

    return totals


@lru_cache(maxsize=1)
def _waterway_search_index():

    # Build the scaled Shapely lines once, grouped by type.
    index = {}

    for feature in get_waterway_collection().features:

        waterway_type = feature.properties["waterway_type"]

        scaled_line = scale(
            LineString(feature.geometry.coordinates),
            xfact=LONGITUDE_SCALE,
            yfact=1,
            origin=(0, 0)
        )

        lines, features = index.setdefault(waterway_type, ([], []))

        lines.append(scaled_line)
        features.append(feature)

    return {
        waterway_type: (numpy.array(lines), features)
        for waterway_type, (lines, features) in index.items()
    }


def summarize_waterways(waterway_type: str | None = None):

    totals = _waterway_summary_by_type()

    by_type = [
        {
            "waterway_type": name,
            "feature_count": count,
            "total_length_km": round(meters / 1000, 2)
        }
        for name, (count, meters) in sorted(totals.items())
        if waterway_type is None or name == waterway_type
    ]

    return {
        "total_features": sum(item["feature_count"] for item in by_type),
        "by_type": by_type,
        "attribution": WATERWAYS_ATTRIBUTION,
        "limitations": WATERWAY_LIMITATIONS
    }


def find_nearest_waterways(
    point_data: GeoJSONPoint,
    waterway_types: list[str]
):

    longitude, latitude = point_data.coordinates

    scaled_point = Point(longitude * LONGITUDE_SCALE, latitude)

    index = _waterway_search_index()

    results = []

    # dict.fromkeys removes duplicates but keeps the request order.
    for waterway_type in dict.fromkeys(waterway_types):

        if waterway_type not in index:
            continue

        lines, features = index[waterway_type]

        # Shapely 2 measures the distance to every line at once.
        distances = shapely.distance(lines, scaled_point)

        best = int(distances.argmin())

        # Closest position on that line, converted back to real longitude.
        closest = nearest_points(lines[best], scaled_point)[0]

        nearest_point = GeoJSONPoint(
            coordinates=[closest.x / LONGITUDE_SCALE, closest.y]
        )

        # Reuse the tested geodesic distance for the real-world answer.
        distance = calculate_geographic_distance(point_data, nearest_point)

        feature = features[best]

        results.append({
            "waterway_type": waterway_type,
            "osm_id": feature.properties["osm_id"],
            "name": feature.properties["name"],
            "distance_meters": distance["distance_meters"],
            "distance_kilometers": distance["distance_kilometers"],
            "nearest_point": nearest_point
        })

    return {
        "inside_coverage_area": _inside_dhaka_district(point_data),
        "results": results,
        "method": "WGS84 geodesic",
        "attribution": WATERWAYS_ATTRIBUTION
    }


def _inside_dhaka_district(point_data: GeoJSONPoint):

    for feature in get_boundary_collection().features:

        if feature.properties["admin_level"] == 2:

            return analyze_point_in_polygon(
                point_data,
                feature.geometry
            )["covered"]

    return False


# ==========================================
# FLOOD HISTORY AND FLOOD GRID
# ==========================================

FLOOD_LIMITATIONS = [
    "Observed floods come from UNOSAT satellite radar analyses of specific "
    "dates. Radar underestimates standing water in built-up areas and under "
    "dense vegetation, so city waterlogging is largely missed.",
    "'not_observed' means no satellite analysis covered the place for that "
    "event; it does not mean it stayed dry.",
    "Hazard classes are modelled river floods (JRC GloFAS) that ignore flood "
    "embankments, so protected areas such as central Dhaka are overstated.",
    "Neither source models rainfall-driven urban waterlogging.",
    "Seasonal wetlands (haors, beels) fill with water every monsoon; that "
    "normal seasonal inundation is counted as flood water alongside "
    "damaging floods.",
    "Grid cells are about 90 m; results describe the cell, not an exact spot.",
]

JRC_DEPTH_LABELS = {1: "< 1 m", 2: "1 to 3 m", 3: "3 to 10 m", 4: "> 10 m"}


def _district_summary(row: dict) -> dict:

    return {
        **{
            key: row[key]
            for key in (
                "rank", "pcode", "name", "division",
                "events_observed", "events_flooded", "max_flooded_share"
            )
        },
        # Modelled hazard, kept apart from the observed history above.
        **get_district_hazard_shares().get(
            row["pcode"], {"hazard_share_10yr": None, "hazard_share_100yr": None}
        ),
    }


def list_flood_events():

    history = get_flood_history()

    return {
        "count": len(history["events"]),
        "events": history["events"],
        "skipped_events": history["skipped_events"],
        "method": history["method"],
        "attribution": FLOOD_ATTRIBUTION
    }


def rank_flood_districts(
    limit: int | None = None,
    division: str | None = None
):

    history = get_flood_history()

    rows = [
        _district_summary(row)
        for row in history["districts"]
        if division is None or row["division"].lower() == division.lower()
    ]

    if limit is not None:
        rows = rows[:limit]

    return {
        "total_districts": len(history["districts"]),
        "total_events": len(history["events"]),
        "districts": rows,
        "attribution": FLOOD_ATTRIBUTION,
        "limitations": FLOOD_LIMITATIONS
    }


def get_district_flood_history(pcode: str):

    for row in get_flood_history()["districts"]:

        if row["pcode"] == pcode.upper():

            return {
                **_district_summary(row),
                "flooded_event_ids": row["flooded_event_ids"],
                "events": row["events"],
                "attribution": FLOOD_ATTRIBUTION
            }

    return None


SATELLITE_LIMITATIONS = [
    "Observations, not a forecast: what Sentinel-1 radar saw on the day of "
    "each pass. Passes come every few days, so short floods between passes "
    "can be missed.",
    "A pass usually sees only part of a district (strip edges, and areas where "
    "radar cannot map floods such as cities, dense vegetation and steep hills). "
    "observed_share says how much; unseen land is unknown, not dry.",
    "Radar underestimates standing water in built-up areas, so city "
    "waterlogging is largely missed.",
    "GFM removes normal permanent and monthly seasonal water (a 2018-2022 "
    "Sentinel-1 reference), so flooded_share is unusual water for that month.",
    "Results are based on an automated satellite product; they are information "
    "only and not an official flood warning.",
]

SATELLITE_ATTRIBUTION = (
    "Contains modified Copernicus Emergency Management Service information "
    "[2016-2024] (Global Flood Monitoring, GFM). "
    "District boundaries: Bangladesh Bureau of Statistics (BBS) and UN OCHA "
    "via HDX, CC BY-IGO."
)


def get_district_satellite_observations(pcode: str, start_date, end_date, min_observed_share: float):

    data = get_satellite_observations()
    rule = data["label_rule"]

    for district in data["districts"]:

        if district["pcode"] != pcode.upper():
            continue

        observations = [
            {
                "date": day,
                "observed_share": observed,
                "flooded_share": flooded,
                "advisory_share": advisory,
                # The label rule only applies to passes that saw enough of the
                # district; otherwise the answer is unknown (null).
                "flooded": (flooded >= rule["flooded_share_threshold"])
                if observed >= rule["min_observed_share"] else None,
            }
            for day, observed, flooded, advisory in district["rows"]
            if observed >= min_observed_share
            and (start_date is None or day >= start_date.isoformat())
            and (end_date is None or day <= end_date.isoformat())
        ]

        return {
            "pcode": district["pcode"],
            "name": district["name"],
            "division": district["division"],
            "kind": data["kind"],
            "min_observed_share": min_observed_share,
            "count": len(observations),
            "observations": observations,
            "label_rule": rule,
            "method": data["method"],
            "attribution": SATELLITE_ATTRIBUTION,
            "limitations": SATELLITE_LIMITATIONS,
        }

    return None


def get_latest_satellite_observations(day, max_age_days: int):

    # For a map: the newest labelled pass per district, never newer than `day`.
    data = get_satellite_observations()
    rule = data["label_rule"]
    oldest = (day - timedelta(days=max_age_days)).isoformat()
    newest = day.isoformat()

    districts = []

    for district in data["districts"]:

        # Rows are in date order; only passes that saw enough of the district count.
        labelled = [row for row in district["rows"] if row[1] >= rule["min_observed_share"]]
        recent = [row for row in labelled if oldest <= row[0] <= newest]

        observation = None
        days_ago = None

        if recent:
            pass_day, observed, flooded, advisory = recent[-1]
            observation = {
                "date": pass_day,
                "observed_share": observed,
                "flooded_share": flooded,
                "advisory_share": advisory,
                "flooded": flooded >= rule["flooded_share_threshold"],
            }
            days_ago = (day - date.fromisoformat(pass_day)).days

        districts.append({
            "pcode": district["pcode"],
            "name": district["name"],
            "division": district["division"],
            "observable": bool(labelled),
            "observation": observation,
            "days_ago": days_ago,
        })

    return {
        "date": day,
        "max_age_days": max_age_days,
        "kind": data["kind"],
        "count": sum(d["observation"] is not None for d in districts),
        "districts": districts,
        "label_rule": rule,
        "attribution": SATELLITE_ATTRIBUTION,
        "limitations": SATELLITE_LIMITATIONS,
    }


def _events_from_bits(bits: int, event_ids) -> list[str]:

    # Bit k set means event k applies to this cell.
    return [
        str(event_id)
        for k, event_id in enumerate(event_ids)
        if bits & (1 << k)
    ]


def _flood_cell(longitude: float, latitude: float):

    grid = get_flood_grid()

    # Affine transform: lon = c + col * a, lat = f + row * e (e is negative).
    a, _, c, _, e, f = grid["transform"]

    col = int((longitude - c) // a)
    row = int((latitude - f) // e)

    rows, cols = grid["hazard"].shape

    if not (0 <= row < rows and 0 <= col < cols):
        return None

    observed_bits = int(grid["observed_mask"][row, col])
    flooded_bits = int(grid["flooded_mask"][row, col])
    hazard_byte = int(grid["hazard"][row, col])

    event_ids = grid["event_ids"]

    hazard = []

    for years, shift in ((10, 0), (100, 3)):

        depth_class = (hazard_byte >> shift) & 0b111

        hazard.append({
            "return_period_years": years,
            "depth_class": depth_class or None,
            "depth_label": JRC_DEPTH_LABELS.get(depth_class)
        })

    observed_ids = _events_from_bits(observed_bits, event_ids)
    flooded_ids = _events_from_bits(flooded_bits, event_ids)

    return {
        # 3 arc-seconds of latitude is about 92.6 m.
        "grid_cell_size_m": round(abs(e) * 111_320),
        "permanent_water": bool(hazard_byte & (1 << 6)),
        "times_observed": len(observed_ids),
        "times_flooded": len(flooded_ids),
        "observed_event_ids": observed_ids,
        "flooded_event_ids": flooded_ids,
        "hazard": hazard
    }


def check_flood_at_point(point_data: GeoJSONPoint):

    rows = {row["pcode"]: row for row in get_flood_history()["districts"]}

    # Which district? Reuse the tested point-in-zones logic.
    located = analyze_point_in_zones(point_data, get_district_collection())

    if not located["matches"]:

        return {
            "district": None,
            "cell": None,
            "attribution": FLOOD_ATTRIBUTION,
            "limitations": FLOOD_LIMITATIONS
        }

    pcode = located["matches"][0]["feature_id"]

    longitude, latitude = point_data.coordinates

    return {
        "district": _district_summary(rows[pcode]),
        "cell": _flood_cell(longitude, latitude),
        "attribution": FLOOD_ATTRIBUTION,
        "limitations": FLOOD_LIMITATIONS
    }


# ==========================================
# DISTRICT LOOKUP (used by other modules, e.g. assets)
# ==========================================

def find_district(point_data: GeoJSONPoint):

    # Which of Bangladesh's 64 districts contains this point?
    # Returns {"pcode", "name", "division"} or None outside Bangladesh.
    located = analyze_point_in_zones(point_data, get_district_collection())

    if not located["matches"]:
        return None

    properties = located["matches"][0]["properties"]

    return {
        "pcode": properties["pcode"],
        "name": properties["name"],
        "division": properties["parent_name"]
    }
