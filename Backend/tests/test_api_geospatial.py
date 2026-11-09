"""
Automated API tests for the geospatial module.

Every number checked here was first verified by hand in Swagger
(Milestones 6–10). If a future change breaks any of them, pytest
will tell us immediately.

Run from the Backend folder:  python -m pytest -v
"""

from pytest import approx


BASE = "/api/v1/geospatial"

# Dhaka test locations, [longitude, latitude].
DHANMONDI = [90.3760, 23.7465]
OUTSIDE = [90.4500, 23.8000]
BOUNDARY = [90.3500, 23.7500]
SHAHBAGH = [90.3958, 23.7380]
MOGHBAZAR = [90.4070, 23.7490]

# Verified geodesic distances from Dhanmondi, in meters.
DHANMONDI_TO_OUTSIDE_M = 9591.848250510406
DHANMONDI_TO_SHAHBAGH_M = 2227.401550168093
DHANMONDI_TO_MOGHBAZAR_M = 3172.528767341919


def point(coordinates):
    return {"type": "Point", "coordinates": coordinates}


def multipoint(coordinates):
    return {"type": "MultiPoint", "coordinates": coordinates}


# ==========================================
# HEALTH
# ==========================================

def test_health(client):

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


# ==========================================
# LOCATIONS
# ==========================================

def test_create_and_get_location(client):

    created = client.post(f"{BASE}/locations", json={
        "location_name": "Dhanmondi",
        "latitude": 23.7465,
        "longitude": 90.3760
    })

    assert created.status_code == 201

    body = created.json()

    # GeoJSON stores [longitude, latitude].
    assert body["geometry"] == point(DHANMONDI)

    fetched = client.get(f"{BASE}/locations/{body['id']}")

    assert fetched.status_code == 200
    assert fetched.json()["location_name"] == "Dhanmondi"


def test_unknown_location_returns_404(client):

    response = client.get(f"{BASE}/locations/does-not-exist")

    assert response.status_code == 404


# ==========================================
# POINT IN POLYGON
# ==========================================

def analyze(client, coordinates, zone):
    return client.post(
        f"{BASE}/spatial-analysis/point-in-polygon",
        json={"point": point(coordinates), "polygon": zone}
    )


def test_point_inside(client, flood_zone):

    response = analyze(client, DHANMONDI, flood_zone)

    assert response.status_code == 200
    assert response.json() == {
        "covered": True,
        "strictly_inside": True,
        "on_boundary": False,
        "relationship": "inside"
    }


def test_point_outside(client, flood_zone):

    response = analyze(client, OUTSIDE, flood_zone)

    assert response.status_code == 200
    assert response.json() == {
        "covered": False,
        "strictly_inside": False,
        "on_boundary": False,
        "relationship": "outside"
    }


def test_point_on_boundary(client, flood_zone):

    response = analyze(client, BOUNDARY, flood_zone)

    assert response.status_code == 200
    assert response.json() == {
        "covered": True,
        "strictly_inside": False,
        "on_boundary": True,
        "relationship": "boundary"
    }


def test_bow_tie_polygon_rejected(client, bow_tie_zone):

    response = analyze(client, DHANMONDI, bow_tie_zone)

    assert response.status_code == 422


def test_point_in_second_polygon_of_multipolygon(
    client, flood_zone, second_zone
):

    zone = {
        "type": "MultiPolygon",
        "coordinates": [flood_zone["coordinates"], second_zone]
    }

    response = analyze(client, OUTSIDE, zone)

    assert response.status_code == 200
    assert response.json()["relationship"] == "inside"


# ==========================================
# DISTANCE
# ==========================================

def test_distance(client):

    response = client.post(f"{BASE}/spatial-analysis/distance", json={
        "point_a": point(DHANMONDI),
        "point_b": point(OUTSIDE)
    })

    assert response.status_code == 200

    body = response.json()

    assert body["distance_meters"] == approx(DHANMONDI_TO_OUTSIDE_M)
    assert body["distance_kilometers"] == approx(DHANMONDI_TO_OUTSIDE_M / 1000)
    assert body["method"] == "WGS84 geodesic"


# ==========================================
# LINESTRING LENGTH
# ==========================================

def line_length(client, coordinates):
    return client.post(
        f"{BASE}/spatial-analysis/linestring-length",
        json={"line": {"type": "LineString", "coordinates": coordinates}}
    )


def test_two_point_line_equals_distance(client):

    response = line_length(client, [DHANMONDI, OUTSIDE])

    assert response.status_code == 200
    assert response.json()["total_length_meters"] == approx(
        DHANMONDI_TO_OUTSIDE_M
    )


def test_dhaka_path_length(client):

    response = line_length(
        client, [DHANMONDI, SHAHBAGH, MOGHBAZAR, OUTSIDE]
    )

    assert response.status_code == 200

    body = response.json()

    assert body["segment_count"] == 3
    assert body["total_length_meters"] == approx(11046.680456228705)
    assert sum(body["segment_lengths_meters"]) == approx(
        body["total_length_meters"]
    )

    # A winding path is longer than the straight line.
    assert body["total_length_meters"] > DHANMONDI_TO_OUTSIDE_M


def test_zero_length_line_rejected(client):

    response = line_length(client, [DHANMONDI, DHANMONDI])

    assert response.status_code == 422


def test_single_position_line_rejected(client):

    response = line_length(client, [DHANMONDI])

    assert response.status_code == 422


def test_line_invalid_longitude_rejected(client):

    response = line_length(client, [[190, 23.7], [90.4, 23.8]])

    assert response.status_code == 422


# ==========================================
# MULTIPOINT IN ZONE
# ==========================================

def points_in_zone(client, coordinates, zone):
    return client.post(
        f"{BASE}/spatial-analysis/multipoint-in-zone",
        json={"points": multipoint(coordinates), "zone": zone}
    )


def test_multipoint_in_polygon(client, flood_zone):

    response = points_in_zone(
        client, [DHANMONDI, OUTSIDE, BOUNDARY], flood_zone
    )

    assert response.status_code == 200

    body = response.json()

    assert body["total_points"] == 3
    assert body["inside_count"] == 1
    assert body["boundary_count"] == 1
    assert body["outside_count"] == 1
    assert body["covered_count"] == 2

    relationships = [r["relationship"] for r in body["results"]]

    assert relationships == ["inside", "outside", "boundary"]


def test_multipoint_in_multipolygon(client, flood_zone, second_zone):

    zone = {
        "type": "MultiPolygon",
        "coordinates": [flood_zone["coordinates"], second_zone]
    }

    response = points_in_zone(
        client, [DHANMONDI, OUTSIDE, BOUNDARY], zone
    )

    assert response.status_code == 200

    body = response.json()

    assert body["inside_count"] == 2
    assert body["boundary_count"] == 1
    assert body["outside_count"] == 0


def test_multipoint_invalid_zone_rejected(client, bow_tie_zone):

    response = points_in_zone(client, [DHANMONDI], bow_tie_zone)

    assert response.status_code == 422


def test_empty_multipoint_rejected(client, flood_zone):

    response = points_in_zone(client, [], flood_zone)

    assert response.status_code == 422


# ==========================================
# MULTIPOINT DISTANCES
# ==========================================

def distances(client, reference, coordinates):
    return client.post(
        f"{BASE}/spatial-analysis/multipoint-distances",
        json={"reference": point(reference), "points": multipoint(coordinates)}
    )


def test_multipoint_distances_and_nearest(client):

    response = distances(
        client, DHANMONDI, [OUTSIDE, SHAHBAGH, MOGHBAZAR]
    )

    assert response.status_code == 200

    body = response.json()

    meters = [r["distance_meters"] for r in body["results"]]

    assert meters == approx([
        DHANMONDI_TO_OUTSIDE_M,
        DHANMONDI_TO_SHAHBAGH_M,
        DHANMONDI_TO_MOGHBAZAR_M
    ])
    assert body["nearest_point_index"] == 1
    assert body["nearest_distance_meters"] == approx(DHANMONDI_TO_SHAHBAGH_M)


def test_nearest_tie_picks_first(client):

    response = distances(
        client, DHANMONDI, [OUTSIDE, SHAHBAGH, SHAHBAGH]
    )

    assert response.json()["nearest_point_index"] == 1


def test_reference_equal_to_point_is_zero(client):

    response = distances(client, DHANMONDI, [OUTSIDE, DHANMONDI])

    body = response.json()

    assert body["nearest_point_index"] == 1
    assert body["nearest_distance_meters"] == 0.0


def test_invalid_reference_rejected(client):

    response = distances(client, [90.37, 95], [OUTSIDE])

    assert response.status_code == 422
