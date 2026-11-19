"""
Tests for the shared rescue board (docs/RESCUE_COORDINATION_SPEC.md):
requests without GPS, several needs, teams, one primary team per request,
explicit progress, release, support, privacy of contact details and the
sender's honest status.

Run from the Backend folder:  python -m pytest tests/test_api_rescue_board.py -v
"""

import re
import uuid
from concurrent.futures import ThreadPoolExecutor

from tests.test_api_rescue import ADMIN, DHAKA, SOS, SUNAMGANJ_HAOR, account, database, sos


TEAMS = f"{ADMIN}/teams"


def request(**overrides):
    body = {
        "client_id": str(uuid.uuid4()),
        "needs": ["food_water", "medical"],
        "people": 5,
        "serious_injury": True,
        "vulnerable": ["children", "elderly"],
        "location": SUNAMGANJ_HAOR,
        "location_source": "gps",
        "accuracy_m": 12.0,
        "note": "Grandmother has a fever.",
        "contact_name": "Rahima",
        "contact_phone": "+880 1700 000000",
    }
    body.update(overrides)
    return body


MANUAL_PLACE = {
    "district_pcode": "BD6090",
    "upazila": "Tahirpur",
    "village": "Example Village",
    "landmark": "Behind the primary school",
}


def team_member(client, admin, email, team_name, organization="Example NGO"):
    """A rescuer account inside a (new or existing) team. Returns (headers, team)."""

    teams = client.get(TEAMS, headers=admin).json()["teams"]
    team = next((t for t in teams if t["name"] == team_name and t["organization"] == organization), None)

    if team is None:
        created = client.post(TEAMS, json={"name": team_name, "organization": organization}, headers=admin)
        assert created.status_code == 201, created.text
        team = created.json()

    headers = account(client, email, "rescuer")
    me = client.get("/api/v1/auth/me", headers=headers).json()
    joined = client.patch(f"{ADMIN}/users/{me['id']}/team", json={"team_id": team["id"]}, headers=admin)
    assert joined.status_code == 200, joined.text

    return headers, team


def setup_two_teams(client):
    admin = account(client, "admin@example.org", "admin")
    alpha, alpha_team = team_member(client, admin, "alpha@example.org", "Rescue Team Alpha")
    bravo, bravo_team = team_member(client, admin, "bravo@example.org", "Rescue Team Bravo", "Other Relief")
    return admin, alpha, bravo, alpha_team, bravo_team


def send(client, **overrides):
    body = request(**overrides)
    answer = client.post(SOS, json=body)
    assert answer.status_code == 201, answer.text
    return body, answer.json()


def status_of(client, body):
    return client.get(f"{SOS}/status/{body['client_id']}").json()


# ==========================================
# A1 / C: SENDING A REQUEST
# ==========================================

def test_a_food_request_without_an_account_is_stored_with_a_reference(client):

    body, receipt = send(client, needs=["food_water"], serious_injury=None, vulnerable=[])

    assert receipt["status"] == "available"
    assert re.fullmatch(r"RK-[2-9A-HJ-NP-Z]{6}", receipt["reference"])
    assert receipt["needs"] == ["food_water"]
    assert receipt["team"] is None
    assert [step["event"] for step in receipt["history"]] == ["received"]

    stored = database().sos_requests.find_one({"_id": receipt["id"]})
    assert stored["needs"] == ["food_water"]
    assert stored["reference"] == receipt["reference"]


def test_a_medical_request_keeps_injury_and_vulnerability(client):

    admin = account(client, "admin@example.org", "admin")
    _, receipt = send(client, needs=["medical"])

    seen = client.get(SOS, headers=admin).json()["requests"][0]

    assert seen["needs"] == ["medical"]
    assert seen["serious_injury"] is True
    assert seen["vulnerable"] == ["children", "elderly"]
    assert seen["location_source"] == "gps"
    assert seen["accuracy_m"] == 12.0


def test_needs_are_checked_and_duplicates_removed(client):

    assert client.post(SOS, json=request(needs=[])).status_code == 422
    assert client.post(SOS, json=request(needs=["helicopter"])).status_code == 422
    assert client.post(SOS, json=request(vulnerable=["robots"])).status_code == 422

    _, receipt = send(client, needs=["medical", "medical", "evacuation"])
    assert receipt["needs"] == ["medical", "evacuation"]


def test_older_phones_queued_requests_are_still_accepted(client):

    # The shape the portal sent before this change (one "need", no source).
    old = sos(need="rescue")
    answer = client.post(SOS, json=old)

    assert answer.status_code == 201, answer.text
    assert answer.json()["needs"] == ["evacuation"]

    stored = database().sos_requests.find_one({"_id": answer.json()["id"]})
    assert stored["location_source"] is None  # never guessed


def test_a_request_without_gps_uses_the_place_the_person_typed(client):

    admin = account(client, "admin@example.org", "admin")
    body, receipt = send(client, location=None, location_source="manual", accuracy_m=None, place=MANUAL_PLACE)

    assert receipt["district"]["pcode"] == "BD6090"

    seen = client.get(SOS, headers=admin).json()["requests"][0]
    assert seen["location"] is None  # no made-up coordinates
    assert seen["accuracy_m"] is None
    assert seen["location_source"] == "manual"
    assert seen["place"]["village"] == "Example Village"
    assert seen["place"]["landmark"] == "Behind the primary school"


def test_a_request_needs_a_point_or_a_described_place(client):

    nothing = request(location=None, location_source=None, accuracy_m=None)
    only_district = request(location=None, location_source="manual", accuracy_m=None,
                            place={"district_pcode": "BD6090"})
    unknown_district = request(location=None, location_source="manual", accuracy_m=None,
                               place={"district_pcode": "BD9999", "village": "X"})

    for body in (nothing, only_district, unknown_district):
        assert client.post(SOS, json=body).status_code == 422, body


def test_coordinates_are_checked(client):

    assert client.post(SOS, json=request(location={"type": "Point", "coordinates": [200, 24]})).status_code == 422
    assert client.post(SOS, json=request(location={"type": "Point", "coordinates": [0, 0]})).status_code == 422
    # A point gives the district, even if the typed place names another one.
    _, receipt = send(client, location=DHAKA, place=MANUAL_PLACE)
    assert receipt["district"]["pcode"] == "BD3026"


# ==========================================
# TEAMS
# ==========================================

def test_only_admins_manage_teams_and_the_account_shows_its_team(client):

    admin = account(client, "admin@example.org", "admin")
    rescuer = account(client, "rescuer@example.org", "rescuer")

    assert client.post(TEAMS, json={"name": "A", "organization": "B"}, headers=rescuer).status_code == 403
    assert client.get(TEAMS, headers=rescuer).status_code == 403

    created = client.post(TEAMS, json={"name": "Rescue Team Alpha", "organization": "Example NGO"}, headers=admin)
    assert created.status_code == 201
    again = client.post(TEAMS, json={"name": "Rescue Team Alpha", "organization": "Example NGO"}, headers=admin)
    assert again.status_code == 409

    me = client.get("/api/v1/auth/me", headers=rescuer).json()
    assert me["team"] is None

    client.patch(f"{ADMIN}/users/{me['id']}/team", json={"team_id": created.json()["id"]}, headers=admin)
    me = client.get("/api/v1/auth/me", headers=rescuer).json()
    assert me["team"]["name"] == "Rescue Team Alpha"
    assert me["team"]["organization"] == "Example NGO"

    assert client.patch(f"{ADMIN}/users/{me['id']}/team", json={"team_id": "missing"}, headers=admin).status_code == 404
    assert client.patch(f"{ADMIN}/users/{me['id']}/team", json={"team_id": None}, headers=admin).status_code == 200
    assert client.get("/api/v1/auth/me", headers=rescuer).json()["team"] is None


def test_a_rescuer_without_a_team_sees_the_board_but_cannot_accept(client):

    rescuer = account(client, "loner@example.org", "rescuer")
    _, receipt = send(client)

    assert client.get(SOS, headers=rescuer).json()["count"] == 1
    refused = client.post(f"{SOS}/{receipt['id']}/accept", headers=rescuer)
    assert refused.status_code == 403
    assert "team" in refused.json()["detail"]


# ==========================================
# A2 / A3: SHARED BOARD AND EXCLUSIVE ACCEPTANCE
# ==========================================

def test_unauthorised_people_cannot_see_or_touch_the_board(client):

    _, receipt = send(client)
    user = account(client, "user@example.org")

    assert client.get(SOS).status_code == 401
    assert client.get(SOS, headers=user).status_code == 403
    assert client.post(f"{SOS}/{receipt['id']}/accept", headers=user).status_code == 403
    assert client.post(f"{SOS}/{receipt['id']}/accept").status_code == 401


def test_one_team_accepts_and_the_other_gets_a_conflict(client):

    _, alpha, bravo, alpha_team, _ = setup_two_teams(client)
    _, receipt = send(client)

    accepted = client.post(f"{SOS}/{receipt['id']}/accept", headers=alpha)
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    assert accepted.json()["team"]["name"] == "Rescue Team Alpha"

    late = client.post(f"{SOS}/{receipt['id']}/accept", headers=bravo)
    assert late.status_code == 409
    assert "Rescue Team Alpha" in late.json()["detail"]

    stored = database().sos_requests.find_one({"_id": receipt["id"]})
    assert stored["team"]["id"] == alpha_team["id"]


def test_simultaneous_accepts_leave_exactly_one_primary_team(client):

    admin = account(client, "admin@example.org", "admin")
    members = [team_member(client, admin, f"t{i}@example.org", f"Team {i}")[0] for i in range(8)]
    _, receipt = send(client)

    def accept(headers):
        return client.post(f"{SOS}/{receipt['id']}/accept", headers=headers).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        codes = list(pool.map(accept, members))

    assert sorted(codes) == [200] + [409] * 7

    stored = database().sos_requests.find_one({"_id": receipt["id"]})
    assert [step["event"] for step in stored["history"]].count("accepted") == 1


def test_contact_details_only_for_the_team_that_took_responsibility(client):

    admin, alpha, bravo, _, _ = setup_two_teams(client)
    _, receipt = send(client)

    before = client.get(SOS, headers=bravo).json()["requests"][0]
    assert before["contact_phone"] is None and before["contact_name"] is None
    assert before["contact_hidden"] is True
    assert before["location"] == SUNAMGANJ_HAOR  # needed to judge the distance

    client.post(f"{SOS}/{receipt['id']}/accept", headers=alpha)

    mine = client.get(SOS, headers=alpha).json()["requests"][0]
    theirs = client.get(SOS, headers=bravo).json()["requests"][0]
    as_admin = client.get(SOS, headers=admin).json()["requests"][0]

    assert mine["contact_phone"] == "+880 1700 000000" and mine["contact_hidden"] is False
    assert theirs["contact_phone"] is None and theirs["contact_hidden"] is True
    assert as_admin["contact_phone"] == "+880 1700 000000"


def test_the_board_can_be_filtered(client):

    _, alpha, bravo, _, _ = setup_two_teams(client)
    _, first = send(client)
    send(client, location=DHAKA)

    client.post(f"{SOS}/{first['id']}/accept", headers=alpha)

    assert client.get(SOS, params={"status": "available"}, headers=bravo).json()["count"] == 1
    assert client.get(SOS, params={"mine": "true"}, headers=alpha).json()["count"] == 1
    assert client.get(SOS, params={"mine": "true"}, headers=bravo).json()["count"] == 0
    assert client.get(SOS, params={"district_pcode": "BD3026"}, headers=bravo).json()["count"] == 1
    board = client.get(SOS, headers=bravo).json()
    assert board["by_status"] == {"available": 1, "accepted": 1}


# ==========================================
# A4 / A5: LIFECYCLE AND EXPLICIT "EN ROUTE"
# ==========================================

def test_full_lifecycle_and_the_sender_sees_each_real_step(client):

    _, alpha, bravo, _, _ = setup_two_teams(client)
    body, receipt = send(client)
    rid = receipt["id"]

    client.post(f"{SOS}/{rid}/accept", headers=alpha)
    assert status_of(client, body)["status"] == "accepted"  # not "on its way" yet

    en_route = client.post(f"{SOS}/{rid}/progress", json={"status": "en_route", "message_to_sender": "Boat from the ghat"}, headers=alpha)
    assert en_route.status_code == 200

    board_for_others = client.get(SOS, headers=bravo).json()["requests"][0]
    assert board_for_others["status"] == "en_route"
    assert board_for_others["team"]["name"] == "Rescue Team Alpha"
    assert client.post(f"{SOS}/{rid}/accept", headers=bravo).status_code == 409

    for step in ("arrived", "in_progress"):
        assert client.post(f"{SOS}/{rid}/progress", json={"status": step}, headers=alpha).status_code == 200

    done = client.post(f"{SOS}/{rid}/progress", json={"status": "completed", "outcome": {"people_helped": 5, "note": "Taken to the school shelter"}}, headers=alpha)
    assert done.status_code == 200
    assert done.json()["outcome"]["people_helped"] == 5

    seen = status_of(client, body)
    assert seen["status"] == "completed"
    assert seen["team"] == {"name": "Rescue Team Alpha", "organization": "Example NGO"}
    assert seen["message_to_sender"] == "Boat from the ghat"
    assert [s["event"] for s in seen["history"]] == ["received", "accepted", "en_route", "arrived", "in_progress", "completed"]
    assert all("by" not in s and "actor_id" not in s for s in seen["history"])
    assert "contact_phone" not in seen and "location" not in seen


def test_steps_cannot_be_skipped_or_reversed(client):

    _, alpha, _, _, _ = setup_two_teams(client)
    _, receipt = send(client)
    rid = receipt["id"]

    # Not accepted yet: nothing to progress.
    assert client.post(f"{SOS}/{rid}/progress", json={"status": "en_route"}, headers=alpha).status_code == 409

    client.post(f"{SOS}/{rid}/accept", headers=alpha)

    # "Arrived" or "completed" without confirming "en route" first.
    assert client.post(f"{SOS}/{rid}/progress", json={"status": "arrived"}, headers=alpha).status_code == 409
    assert client.post(f"{SOS}/{rid}/progress", json={"status": "completed", "outcome": {"people_helped": 1}}, headers=alpha).status_code == 409
    assert client.post(f"{SOS}/{rid}/progress", json={"status": "accepted"}, headers=alpha).status_code == 422

    client.post(f"{SOS}/{rid}/progress", json={"status": "en_route"}, headers=alpha)
    assert client.post(f"{SOS}/{rid}/progress", json={"status": "en_route"}, headers=alpha).status_code == 409


def test_completed_needs_an_outcome(client):

    _, alpha, _, _, _ = setup_two_teams(client)
    _, receipt = send(client)
    rid = receipt["id"]
    client.post(f"{SOS}/{rid}/accept", headers=alpha)
    client.post(f"{SOS}/{rid}/progress", json={"status": "en_route"}, headers=alpha)
    client.post(f"{SOS}/{rid}/progress", json={"status": "arrived"}, headers=alpha)

    assert client.post(f"{SOS}/{rid}/progress", json={"status": "completed"}, headers=alpha).status_code == 422
    assert client.post(f"{SOS}/{rid}/progress", json={"status": "completed", "outcome": {"people_helped": 2}}, headers=alpha).status_code == 200


def test_only_the_primary_team_reports_progress(client):

    admin, alpha, bravo, _, _ = setup_two_teams(client)
    _, receipt = send(client)
    rid = receipt["id"]
    client.post(f"{SOS}/{rid}/accept", headers=alpha)

    assert client.post(f"{SOS}/{rid}/progress", json={"status": "en_route"}, headers=bravo).status_code == 403
    assert client.post(f"{SOS}/{rid}/progress", json={"status": "en_route"}, headers=admin).status_code == 403


# ==========================================
# A6: RELEASE, UNABLE TO REACH, SUPPORT, CLOSE
# ==========================================

def test_unable_to_reach_puts_the_request_back_on_the_board(client):

    _, alpha, bravo, _, _ = setup_two_teams(client)
    body, receipt = send(client)
    rid = receipt["id"]
    client.post(f"{SOS}/{rid}/accept", headers=alpha)
    client.post(f"{SOS}/{rid}/progress", json={"status": "en_route"}, headers=alpha)

    # Another team cannot release it for them.
    assert client.post(f"{SOS}/{rid}/release", json={"reason": "other"}, headers=bravo).status_code == 403

    released = client.post(f"{SOS}/{rid}/release", json={"reason": "unable_to_reach", "note": "Road under water"}, headers=alpha)
    assert released.status_code == 200
    assert released.json()["status"] == "available"
    assert released.json()["team"] is None
    assert released.json()["releases"][0]["reason"] == "unable_to_reach"
    assert released.json()["releases"][0]["team"]["name"] == "Rescue Team Alpha"

    seen = status_of(client, body)
    assert seen["status"] == "available"
    assert seen["history"][-1]["event"] == "released"
    assert seen["history"][-1]["reason"] == "unable_to_reach"

    # Only now can another team take it.
    assert client.post(f"{SOS}/{rid}/accept", headers=bravo).status_code == 200


def test_release_needs_a_known_reason_and_an_open_request(client):

    _, alpha, _, _, _ = setup_two_teams(client)
    _, receipt = send(client)
    rid = receipt["id"]

    assert client.post(f"{SOS}/{rid}/release", json={"reason": "unable_to_reach"}, headers=alpha).status_code == 409
    client.post(f"{SOS}/{rid}/accept", headers=alpha)
    assert client.post(f"{SOS}/{rid}/release", json={"reason": "bored"}, headers=alpha).status_code == 422


def test_an_admin_can_release_a_stuck_request(client):

    admin, alpha, _, _, _ = setup_two_teams(client)
    _, receipt = send(client)
    client.post(f"{SOS}/{receipt['id']}/accept", headers=alpha)

    released = client.post(f"{SOS}/{receipt['id']}/release", json={"reason": "other", "note": "Team not answering"}, headers=admin)
    assert released.status_code == 200
    assert released.json()["status"] == "available"


def test_support_is_asked_and_joined_without_changing_the_primary_team(client):

    admin, alpha, bravo, _, _ = setup_two_teams(client)
    _, receipt = send(client)
    rid = receipt["id"]
    client.post(f"{SOS}/{rid}/accept", headers=alpha)

    # Nobody asked for help yet.
    assert client.post(f"{SOS}/{rid}/support", headers=bravo).status_code == 409

    asked = client.post(f"{SOS}/{rid}/support-request", json={"note": "Need a second boat"}, headers=alpha)
    assert asked.status_code == 200
    assert asked.json()["support_request"]["note"] == "Need a second boat"
    assert client.post(f"{SOS}/{rid}/support-request", json={"note": "x"}, headers=bravo).status_code == 403

    joined = client.post(f"{SOS}/{rid}/support", headers=bravo)
    assert joined.status_code == 200
    assert joined.json()["team"]["name"] == "Rescue Team Alpha"
    assert [t["name"] for t in joined.json()["support_teams"]] == ["Rescue Team Bravo"]
    assert joined.json()["contact_hidden"] is False  # the support team may call the person

    assert client.post(f"{SOS}/{rid}/support", headers=bravo).status_code == 409  # not twice
    assert client.post(f"{SOS}/{rid}/support", headers=alpha).status_code == 409  # not the primary
    assert client.post(f"{SOS}/{rid}/progress", json={"status": "en_route"}, headers=bravo).status_code == 403


def test_the_sender_can_cancel_and_an_admin_can_close(client):

    admin, alpha, _, _, _ = setup_two_teams(client)
    body, first = send(client)
    _, second = send(client)

    client.post(f"{SOS}/{first['id']}/accept", headers=alpha)
    cancelled = client.post(f"{SOS}/status/{body['client_id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert client.post(f"{SOS}/{first['id']}/progress", json={"status": "en_route"}, headers=alpha).status_code == 409

    assert client.post(f"{SOS}/{second['id']}/close", json={"reason": "duplicate"}, headers=alpha).status_code == 403
    closed = client.post(f"{SOS}/{second['id']}/close", json={"reason": "duplicate"}, headers=admin)
    assert closed.status_code == 200
    assert closed.json()["status"] == "cancelled"


def test_unknown_requests_give_404(client):

    _, alpha, _, _, _ = setup_two_teams(client)
    for path in ("accept", "support"):
        assert client.post(f"{SOS}/missing/{path}", headers=alpha).status_code == 404
    assert client.post(f"{SOS}/missing/progress", json={"status": "en_route"}, headers=alpha).status_code == 404
