from geographiclib.geodesic import Geodesic
from shapely.geometry import Point, Polygon, MultiPolygon, LineString
from app.modules.geospatial.schemas import (
    GeoJSONPoint,
    GeoJSONPolygon,
    GeoJSONMultiPolygon,
    GeoJSONLineString,
    GeoJSONMultiPoint
)
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
