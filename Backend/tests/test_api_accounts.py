"""
Automated tests for user accounts: register, log in, save a home location and
read the flood report for it (local test database, see conftest.py).

Run from the Backend folder:  python -m pytest -v
"""

import os
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient

from app.modules.accounts import service
from test_api_prediction import store_rain


AUTH = "/api/v1/auth"

TEST_MONGODB_URI = os.environ["MONGODB_URI"]
TEST_DATABASE = os.environ["MONGODB_DATABASE"]

SUNAMGANJ_HAOR = {"type": "Point", "coordinates": [91.1428, 24.8474]}
KOLKATA = {"type": "Point", "coordinates": [88.3639, 22.5726]}


def person(**overrides):
    return {"name": "Rahima Begum", "email": "rahima@example.org", "password": "monsoon-2026", **overrides}


def register(client, **overrides):
    response = client.post(f"{AUTH}/register", json=person(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def bearer(session):
    return {"Authorization": f"Bearer {session['token']}"}


def database():
    return MongoClient(TEST_MONGODB_URI)[TEST_DATABASE]


# ==========================================
# REGISTER
# ==========================================

def test_register_returns_a_session_and_the_user(client):

    session = register(client)

    assert session["token_type"] == "bearer"
    assert len(session["token"]) >= 40
    assert session["user"]["name"] == "Rahima Begum"
    assert session["user"]["email"] == "rahima@example.org"
    assert session["user"]["location"] is None
    assert "password" not in str(session).lower()


def test_password_and_token_are_never_stored_readable(client):

    session = register(client)

    user = database()["users"].find_one({})
    stored_session = database()["sessions"].find_one({})

    assert "monsoon-2026" not in str(user)
    assert user["password_hash"].startswith("scrypt$")
    assert session["token"] not in str(stored_session)


def test_email_is_case_insensitive_and_unique(client):

    register(client, email="Rahima@Example.org")

    again = client.post(f"{AUTH}/register", json=person(email="rahima@example.ORG"))

    assert again.status_code == 409
    assert database()["users"].count_documents({}) == 1


def test_register_rejects_bad_input(client):

    assert client.post(f"{AUTH}/register", json=person(password="short")).status_code == 422
    assert client.post(f"{AUTH}/register", json=person(email="not-an-email")).status_code == 422
    assert client.post(f"{AUTH}/register", json=person(name="   ")).status_code == 422


# ==========================================
# LOG IN / LOG OUT
# ==========================================

def test_login_with_the_right_password(client):

    register(client)

    response = client.post(f"{AUTH}/login", json={"email": "RAHIMA@example.org", "password": "monsoon-2026"})

    assert response.status_code == 200
    me = client.get(f"{AUTH}/me", headers=bearer(response.json()))
    assert me.status_code == 200
    assert me.json()["email"] == "rahima@example.org"


def test_wrong_password_and_unknown_email_give_the_same_answer(client):

    register(client)

    wrong = client.post(f"{AUTH}/login", json={"email": "rahima@example.org", "password": "wrong-password"})
    unknown = client.post(f"{AUTH}/login", json={"email": "nobody@example.org", "password": "monsoon-2026"})

    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_too_many_wrong_passwords_block_the_login_for_a_while(client):

    register(client)
    wrong = {"email": "rahima@example.org", "password": "wrong-password"}

    for _ in range(service.MAX_FAILED_LOGINS):
        assert client.post(f"{AUTH}/login", json=wrong).status_code == 401

    # Even the right password is refused now.
    blocked = client.post(f"{AUTH}/login", json={"email": "rahima@example.org", "password": "monsoon-2026"})
    assert blocked.status_code == 429


def test_me_needs_a_valid_token(client):

    assert client.get(f"{AUTH}/me").status_code == 401
    assert client.get(f"{AUTH}/me", headers={"Authorization": "Bearer not-a-real-token"}).status_code == 401


def test_logout_ends_the_session(client):

    session = register(client)

    assert client.post(f"{AUTH}/logout", headers=bearer(session)).status_code == 204
    assert client.get(f"{AUTH}/me", headers=bearer(session)).status_code == 401


def test_an_expired_session_is_refused(client):

    session = register(client)
    database()["sessions"].update_many({}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}})

    assert client.get(f"{AUTH}/me", headers=bearer(session)).status_code == 401


# ==========================================
# HOME LOCATION
# ==========================================

def test_saving_a_location_finds_its_district(client):

    session = register(client)

    response = client.put(
        f"{AUTH}/me/location", headers=bearer(session),
        json={"location": SUNAMGANJ_HAOR, "label": "Home"},
    )

    assert response.status_code == 200
    user = response.json()
    assert user["location"] == SUNAMGANJ_HAOR
    assert user["location_label"] == "Home"
    assert user["district"] == {"pcode": "BD6090", "name": "Sunamganj", "division": "Sylhet"}
    assert client.get(f"{AUTH}/me", headers=bearer(session)).json()["district"]["pcode"] == "BD6090"


def test_a_location_outside_bangladesh_is_refused(client):

    session = register(client)

    response = client.put(f"{AUTH}/me/location", headers=bearer(session), json={"location": KOLKATA})

    assert response.status_code == 422
    assert client.get(f"{AUTH}/me", headers=bearer(session)).json()["location"] is None


def test_location_can_be_removed(client):

    session = register(client)
    client.put(f"{AUTH}/me/location", headers=bearer(session), json={"location": SUNAMGANJ_HAOR})

    assert client.delete(f"{AUTH}/me/location", headers=bearer(session)).status_code == 200
    me = client.get(f"{AUTH}/me", headers=bearer(session)).json()
    assert me["location"] is None and me["district"] is None


def test_one_user_cannot_see_another_users_location(client):

    first = register(client)
    second = register(client, email="karim@example.org", name="Karim")
    client.put(f"{AUTH}/me/location", headers=bearer(first), json={"location": SUNAMGANJ_HAOR})

    assert client.get(f"{AUTH}/me", headers=bearer(second)).json()["location"] is None


# ==========================================
# REPORT FOR THE USER'S LOCATION
# ==========================================

def test_report_needs_a_saved_location(client):

    session = register(client)

    response = client.get(f"{AUTH}/me/report", headers=bearer(session))

    assert response.status_code == 409


def test_report_without_a_forecast_says_so_and_still_gives_history(client):

    session = register(client)
    client.put(f"{AUTH}/me/location", headers=bearer(session), json={"location": SUNAMGANJ_HAOR})

    response = client.get(f"{AUTH}/me/report?target_date=2022-06-18", headers=bearer(session))

    assert response.status_code == 200
    report = response.json()
    assert report["target_date"] == "2022-06-18"
    assert report["district"]["pcode"] == "BD6090"
    assert report["forecast"] is None
    assert report["forecast_status"] == "no_forecast_for_this_day"
    # Observed history at the exact spot: this haor cell flooded in all 7 checks.
    assert report["flood_history"]["cell"]["times_flooded"] == 7
    assert report["flood_history"]["district"]["rank"] == 1
    assert report["nearest_assets"] == []
    assert report["attribution"] and report["limitations"]


def test_report_includes_the_stored_forecast_for_the_users_district(client, flood_model):

    session = register(client)
    client.put(f"{AUTH}/me/location", headers=bearer(session), json={"location": SUNAMGANJ_HAOR})
    store_rain("BD6090", 60.0)      # 180 mm in 3 days: the test model calls that a flood
    created = client.post("/api/v1/predictions", json={"target_date": "2022-06-18"})
    assert created.status_code == 201, created.text
    expected = next(p for p in created.json()["predictions"] if p["pcode"] == "BD6090")
    assert expected["status"] == "predicted"

    report = client.get(f"{AUTH}/me/report?target_date=2022-06-18", headers=bearer(session)).json()

    assert report["forecast_status"] == "available"
    assert report["forecast"]["pcode"] == "BD6090"
    assert report["forecast"]["status"] == expected["status"]
    assert report["forecast"]["probability"] == expected["probability"]
    assert report["forecast"]["alert_level"] == "alert"
    assert report["alert_thresholds"] is not None


def test_report_lists_registered_places_nearest_first(client):

    session = register(client)
    client.put(f"{AUTH}/me/location", headers=bearer(session), json={"location": SUNAMGANJ_HAOR})
    for name, lng in (("Far shelter", 91.30), ("Near shelter", 91.15)):
        created = client.post("/api/v1/assets", json={
            "name": name, "asset_type": "flood_shelter",
            "location": {"type": "Point", "coordinates": [lng, 24.85]}, "criticality": "high",
        })
        assert created.status_code == 201, created.text

    report = client.get(f"{AUTH}/me/report?target_date=2022-06-18", headers=bearer(session)).json()

    assert [r["asset"]["name"] for r in report["nearest_assets"]] == ["Near shelter", "Far shelter"]
    assert report["nearest_assets"][0]["distance_meters"] < report["nearest_assets"][1]["distance_meters"]


def test_deleting_the_account_removes_the_user_and_sessions(client):

    session = register(client)

    assert client.delete(f"{AUTH}/me", headers=bearer(session)).status_code == 204
    assert database()["users"].count_documents({}) == 0
    assert database()["sessions"].count_documents({}) == 0
    assert client.get(f"{AUTH}/me", headers=bearer(session)).status_code == 401
