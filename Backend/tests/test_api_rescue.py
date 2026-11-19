"""
Automated tests for rescue requests (SOS), roles and the admin routes
(local test database, see conftest.py).

Run from the Backend folder:  python -m pytest -v
"""

import os
import uuid

from pymongo import MongoClient

from app.modules.rescue import service
from scripts.set_role import set_role


SOS = "/api/v1/sos"
AUTH = "/api/v1/auth"
ADMIN = "/api/v1/admin"

TEST_MONGODB_URI = os.environ["MONGODB_URI"]
TEST_DATABASE = os.environ["MONGODB_DATABASE"]

SUNAMGANJ_HAOR = {"type": "Point", "coordinates": [91.1428, 24.8474]}
DHAKA = {"type": "Point", "coordinates": [90.3976, 23.7258]}
KOLKATA = {"type": "Point", "coordinates": [88.3639, 22.5726]}


def database():
    return MongoClient(TEST_MONGODB_URI)[TEST_DATABASE]


def sos(**overrides):
    return {
        "client_id": str(uuid.uuid4()),
        "location": SUNAMGANJ_HAOR,
        "people": 4,
        "need": "rescue",
        "note": "Water is at the roof. Two children.",
        "contact_name": "Rahima",
        "contact_phone": "+880 1700 000000",
        **overrides,
    }


def account(client, email, role="user"):
    """Register an account, give it a role, return its Authorization header."""

    created = client.post(f"{AUTH}/register", json={"name": email.split("@")[0], "email": email, "password": "monsoon-2026"})
    assert created.status_code == 201, created.text

    if role != "user":
        assert set_role(database(), email, role)

    return {"Authorization": f"Bearer {created.json()['token']}"}


# ==========================================
# SENDING A REQUEST (no login needed)
# ==========================================

def test_anyone_can_send_a_request_and_gets_a_receipt(client):

    response = client.post(SOS, json=sos())

    assert response.status_code == 201
    receipt = response.json()
    assert receipt["status"] == "available"
    assert receipt["district"] == {"pcode": "BD6090", "name": "Sunamganj", "division": "Sylhet"}
    assert receipt["history"][0] == {"event": "received", "status": "available", "at": receipt["received_at"],
                                     "team": None, "reason": None}
    # The receipt holds no personal details: it may be shown on a shared screen.
    assert "contact_phone" not in receipt and "location" not in receipt


def test_a_retry_from_the_phone_is_not_stored_twice(client):

    request = sos()

    first = client.post(SOS, json=request)
    again = client.post(SOS, json=request)

    assert first.status_code == 201
    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"]
    assert database()["sos_requests"].count_documents({}) == 1


def test_the_senders_key_is_not_stored_readable(client):

    request = sos()
    client.post(SOS, json=request)

    stored = database()["sos_requests"].find_one({})

    assert request["client_id"] not in str(stored)


def test_bad_requests_are_refused(client):

    assert client.post(SOS, json=sos(location=KOLKATA)).status_code == 422
    assert client.post(SOS, json=sos(people=0)).status_code == 422
    assert client.post(SOS, json=sos(need="pizza")).status_code == 422
    assert client.post(SOS, json=sos(client_id="short")).status_code == 422
    assert client.post(SOS, json=sos(contact_phone="call me <script>")).status_code == 422
    assert database()["sos_requests"].count_documents({}) == 0


def test_too_many_new_requests_from_one_connection_are_refused(client):

    for _ in range(service.MAX_NEW_PER_HOUR):
        assert client.post(SOS, json=sos()).status_code == 201

    refused = client.post(SOS, json=sos())

    assert refused.status_code == 429
    assert "999" in refused.json()["detail"]


def test_a_faked_forwarded_address_does_not_skip_the_limit(client):

    # Render keeps any X-Forwarded-For the visitor sends, so it must not count.
    for i in range(service.MAX_NEW_PER_HOUR):
        client.post(SOS, json=sos(), headers={"X-Forwarded-For": f"10.0.0.{i}"})

    refused = client.post(SOS, json=sos(), headers={"X-Forwarded-For": "10.9.9.9"})

    assert refused.status_code == 429


def test_the_limit_counts_the_address_cloudflare_reports(client):

    for _ in range(service.MAX_NEW_PER_HOUR):
        client.post(SOS, json=sos(), headers={"CF-Connecting-IP": "203.0.113.1"})

    assert client.post(SOS, json=sos(), headers={"CF-Connecting-IP": "203.0.113.1"}).status_code == 429
    assert client.post(SOS, json=sos(), headers={"CF-Connecting-IP": "203.0.113.2"}).status_code == 201


def test_a_retry_still_works_when_the_limit_is_reached(client):

    first = sos()
    client.post(SOS, json=first)
    for _ in range(service.MAX_NEW_PER_HOUR - 1):
        client.post(SOS, json=sos())

    assert client.post(SOS, json=first).status_code == 200


# ==========================================
# THE SENDER FOLLOWS AND CANCELS THEIR REQUEST
# ==========================================

def test_sender_reads_the_status_with_their_key(client):

    request = sos()
    client.post(SOS, json=request)

    status = client.get(f"{SOS}/status/{request['client_id']}")

    assert status.status_code == 200
    assert status.json()["status"] == "available"
    assert client.get(f"{SOS}/status/{uuid.uuid4()}").status_code == 404


def test_sender_can_cancel_once(client):

    request = sos()
    client.post(SOS, json=request)

    cancelled = client.post(f"{SOS}/status/{request['client_id']}/cancel")

    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert client.post(f"{SOS}/status/{request['client_id']}/cancel").status_code == 409


def test_a_logged_in_user_sees_their_own_requests_only(client):

    rahima = account(client, "rahima@example.org")
    karim = account(client, "karim@example.org")
    client.post(SOS, json=sos(), headers=rahima)
    client.post(SOS, json=sos())                      # sent without a login

    assert len(client.get(f"{SOS}/mine", headers=rahima).json()) == 1
    assert client.get(f"{SOS}/mine", headers=karim).json() == []
    assert client.get(f"{SOS}/mine").status_code == 401


# ==========================================
# RESCUERS
# ==========================================

def test_only_rescuers_and_admins_can_read_the_list(client):

    client.post(SOS, json=sos())

    assert client.get(SOS).status_code == 401
    assert client.get(SOS, headers=account(client, "user@example.org")).status_code == 403

    for email, role in (("rescuer@example.org", "rescuer"), ("admin@example.org", "admin")):
        listed = client.get(SOS, headers=account(client, email, role))
        assert listed.status_code == 200
        assert listed.json()["count"] == 1


def test_rescuer_sees_what_is_needed_to_reach_the_person(client):

    client.post(SOS, json=sos())
    # An admin sees contact details; a team only after accepting (tests/test_api_rescue_board.py).
    rescuer = account(client, "admin@example.org", "admin")

    request = client.get(SOS, headers=rescuer).json()["requests"][0]

    assert request["location"] == SUNAMGANJ_HAOR
    assert request["people"] == 4
    assert request["contact_phone"] == "+880 1700 000000"
    assert request["from_account"] is False





def test_a_normal_user_cannot_change_a_request(client):

    request_id = client.post(SOS, json=sos()).json()["id"]
    user = account(client, "user@example.org")

    assert client.post(f"{SOS}/{request_id}/accept", headers=user).status_code == 403
    assert client.post(f"{SOS}/{request_id}/accept").status_code == 401
    assert client.post(f"{SOS}/{request_id}/progress", json={"status": "en_route"}, headers=user).status_code == 403
    # The old free status change no longer exists.
    assert client.patch(f"{SOS}/{request_id}", json={"status": "resolved"}, headers=user).status_code in (404, 405)


# ==========================================
# ROLES AND ADMIN
# ==========================================

def test_a_new_account_is_always_a_user_whatever_it_asks_for(client):

    created = client.post(f"{AUTH}/register", json={
        "name": "Sneaky", "email": "sneaky@example.org", "password": "monsoon-2026", "role": "admin",
    })

    assert created.status_code == 201
    assert created.json()["user"]["role"] == "user"


def test_admin_lists_users_and_changes_roles(client):

    admin = account(client, "admin@example.org", "admin")
    account(client, "karim@example.org")

    users = client.get(f"{ADMIN}/users", headers=admin).json()
    karim = next(u for u in users["users"] if u["email"] == "karim@example.org")

    assert users["count"] == 2
    assert "password_hash" not in str(users)

    changed = client.patch(f"{ADMIN}/users/{karim['id']}/role", json={"role": "rescuer"}, headers=admin)

    assert changed.status_code == 200
    assert changed.json()["role"] == "rescuer"


def test_role_changes_take_effect_on_the_next_request(client):

    admin = account(client, "admin@example.org", "admin")
    karim = account(client, "karim@example.org")
    karim_id = client.get(f"{AUTH}/me", headers=karim).json()["id"]

    assert client.get(SOS, headers=karim).status_code == 403
    client.patch(f"{ADMIN}/users/{karim_id}/role", json={"role": "rescuer"}, headers=admin)
    assert client.get(SOS, headers=karim).status_code == 200


def test_only_admins_reach_the_admin_routes(client):

    rescuer = account(client, "rescuer@example.org", "rescuer")

    assert client.get(f"{ADMIN}/users").status_code == 401
    assert client.get(f"{ADMIN}/users", headers=rescuer).status_code == 403
    assert client.patch(f"{ADMIN}/users/x/role", json={"role": "admin"}, headers=rescuer).status_code == 403


def test_admin_cannot_change_their_own_role_or_a_missing_user(client):

    admin = account(client, "admin@example.org", "admin")
    admin_id = client.get(f"{AUTH}/me", headers=admin).json()["id"]

    assert client.patch(f"{ADMIN}/users/{admin_id}/role", json={"role": "user"}, headers=admin).status_code == 409
    assert client.patch(f"{ADMIN}/users/nobody/role", json={"role": "rescuer"}, headers=admin).status_code == 404
    assert client.patch(f"{ADMIN}/users/{admin_id}/role", json={"role": "king"}, headers=admin).status_code == 422
