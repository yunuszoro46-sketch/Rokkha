"""Readable place names from a GPS point (offline upazila lookup)."""

from tests.test_api_rescue import ADMIN, DHAKA, SOS, SUNAMGANJ_HAOR, account
from tests.test_api_rescue_board import send

PLACE = "/api/v1/geospatial/place-name"


def test_a_point_gets_its_upazila_and_district(client):

    answer = client.get(PLACE, params={"lng": 91.1428, "lat": 24.8474})

    assert answer.status_code == 200
    body = answer.json()
    assert body["district"]["name"] == "Sunamganj"
    assert body["upazila"]  # a real name from the boundary file, never invented
    assert body["label"] == f"{body['upazila']}, Sunamganj"
    assert body["upazila_pcode"].startswith("BD6090")  # stable code, child of Sunamganj (BD6090)
    assert "BBS" in body["attribution"] and "v03" in body["attribution"]


def test_every_upazila_belongs_to_its_district_in_the_same_release():

    import json
    from app.modules.geospatial.service import UPAZILAS_FILE, get_district_collection

    upazilas = json.loads(UPAZILAS_FILE.read_text(encoding="utf-8"))["features"]
    districts = {f.properties["pcode"] for f in get_district_collection().features}

    assert len(upazilas) == 507
    assert len(districts) == 64
    for feature in upazilas:
        props = feature["properties"]
        assert props["version"] == "v03" and props["valid_on"] == "2023-05-21"
        assert props["parent_pcode"] in districts
        assert props["pcode"].startswith(props["parent_pcode"])


def test_outside_bangladesh_has_no_name(client):

    answer = client.get(PLACE, params={"lng": 88.3639, "lat": 22.5726})

    assert answer.status_code == 200
    assert answer.json() == {"upazila": None, "upazila_pcode": None, "district": None, "label": None,
                             "attribution": answer.json()["attribution"]}


def test_bad_coordinates_are_refused(client):

    assert client.get(PLACE, params={"lng": 200, "lat": 24}).status_code == 422
    assert client.get(PLACE).status_code == 422


def test_rescuers_see_the_readable_area_of_a_gps_request(client):

    admin = account(client, "admin@example.org", "admin")
    send(client)
    send(client, location=None, location_source="manual", accuracy_m=None,
         place={"district_pcode": "BD6090", "village": "Example Village"})

    board = client.get(SOS, headers=admin).json()["requests"]
    by_source = {r["location_source"]: r for r in board}

    assert by_source["gps"]["area_name"].endswith(", Sunamganj")
    assert by_source["manual"]["area_name"] is None  # only from a real point
