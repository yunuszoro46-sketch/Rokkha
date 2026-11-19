"""
Security and behaviour tests for the Admin Control Centre (app/modules/admin): who may enter, role
escalation, suspension, the last-admin guard, the append-only audit log, announcements that never
pose as official warnings, and that admin responses carry no secrets.

Run from the Backend folder:  python -m pytest tests/test_api_admin_center.py -v
"""

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest

from tests.test_api_rescue import ADMIN, AUTH, SOS, account, database, sos
from tests.test_api_rescue_board import TEAMS, team_member

ADMIN_READS = ["/overview", "/analytics", "/data-sources", "/ingestion-runs", "/system-health", "/audit", "/me", "/announcements"]


def user_id(client, headers):
    return client.get(f"{AUTH}/me", headers=headers).json()["id"]


def events(action=None):
    query = {"action": action} if action else {}
    return list(database().admin_audit.find(query))


# ---------------- access ----------------

@pytest.mark.parametrize("path", ADMIN_READS)
def test_anonymous_cannot_enter_any_admin_route(client, path):
    assert client.get(f"{ADMIN}{path}").status_code == 401


@pytest.mark.parametrize("role", ["user", "rescuer"])
@pytest.mark.parametrize("path", ADMIN_READS)
def test_citizens_and_responders_are_refused_and_it_is_logged(client, role, path):
    headers = account(client, f"{role}@example.org", role)
    assert client.get(f"{ADMIN}{path}", headers=headers).status_code == 403
    denied = events("permission_denied")
    assert denied and denied[-1]["actor"]["role"] == role and denied[-1]["result"] == "denied"


@pytest.mark.parametrize("path", ADMIN_READS)
def test_an_admin_reaches_every_admin_route(client, path):
    admin = account(client, "admin@example.org", "admin")
    answer = client.get(f"{ADMIN}{path}", headers=admin)
    assert answer.status_code == 200, answer.text


def test_admin_mutations_refuse_non_admins(client):
    admin = account(client, "admin@example.org", "admin")
    rescuer = account(client, "r@example.org", "rescuer")
    target = user_id(client, account(client, "u@example.org"))
    for method, path, body in [
        ("patch", f"/users/{target}/status", {"status": "suspended", "reason": "test"}),
        ("patch", f"/users/{target}/role", {"role": "admin"}),
        ("post", "/announcements", {"title": "Hello", "body": "Text here"}),
        ("post", "/teams", {"name": "X", "organization": "Y"}),
    ]:
        assert getattr(client, method)(f"{ADMIN}{path}", json=body, headers=rescuer).status_code == 403
    assert client.get(f"{ADMIN}/users", headers=admin).status_code == 200


# ---------------- escalation ----------------

def test_a_user_cannot_make_themselves_admin(client):
    me = account(client, "me@example.org")
    my_id = user_id(client, me)
    assert client.patch(f"{ADMIN}/users/{my_id}/role", json={"role": "admin"}, headers=me).status_code == 403
    assert client.get(f"{AUTH}/me", headers=me).json()["role"] == "user"
    # Registering with a role in the body does not work either (new accounts are always users).
    created = client.post(f"{AUTH}/register", json={"name": "x", "email": "x@example.org", "password": "monsoon-2026", "role": "admin"})
    assert created.json()["user"]["role"] == "user"


def test_an_admin_cannot_change_their_own_role_or_status(client):
    admin = account(client, "admin@example.org", "admin")
    account(client, "admin2@example.org", "admin")
    me = user_id(client, admin)
    assert client.patch(f"{ADMIN}/users/{me}/role", json={"role": "user"}, headers=admin).status_code == 409
    assert client.patch(f"{ADMIN}/users/{me}/status", json={"status": "suspended", "reason": "test"}, headers=admin).status_code == 409


def test_two_admins_removing_each_other_at_once_never_leave_zero_admins(client):
    a1 = account(client, "a1@example.org", "admin")
    a2 = account(client, "a2@example.org", "admin")
    id1, id2 = user_id(client, a1), user_id(client, a2)

    def demote(args):
        headers, target = args
        return client.patch(f"{ADMIN}/users/{target}/role", json={"role": "user"}, headers=headers).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(demote, [(a1, id2), (a2, id1)]))

    assert database().users.count_documents({"role": "admin", "status": {"$ne": "suspended"}}) >= 1
    assert 200 in codes or set(codes) <= {409}


def test_after_one_admin_demotes_the_other_the_demoted_one_cannot_act(client):
    a1 = account(client, "a1@example.org", "admin")
    a2 = account(client, "a2@example.org", "admin")
    id1, id2 = user_id(client, a1), user_id(client, a2)
    assert client.patch(f"{ADMIN}/users/{id2}/role", json={"role": "user"}, headers=a1).status_code == 200
    # a2's token still exists, but the role is read from the database on every request
    assert client.patch(f"{ADMIN}/users/{id1}/role", json={"role": "user"}, headers=a2).status_code == 403
    assert client.get(f"{ADMIN}/overview", headers=a2).status_code == 403


# ---------------- suspension and sessions ----------------

def test_suspension_ends_sessions_blocks_login_and_reactivation_restores(client):
    admin = account(client, "admin@example.org", "admin")
    person = account(client, "p@example.org")
    pid = user_id(client, person)

    answer = client.patch(f"{ADMIN}/users/{pid}/status", json={"status": "suspended", "reason": "abuse reports"}, headers=admin)
    assert answer.status_code == 200 and answer.json()["status"] == "suspended"
    assert client.get(f"{AUTH}/me", headers=person).status_code == 401  # old session no longer works
    assert database().sessions.count_documents({"user_id": pid}) == 0
    login = client.post(f"{AUTH}/login", json={"email": "p@example.org", "password": "monsoon-2026"})
    assert login.status_code == 403 and "suspended" in login.json()["detail"]
    wrong = client.post(f"{AUTH}/login", json={"email": "p@example.org", "password": "wrong-password"})
    assert wrong.status_code == 401  # a wrong password reveals nothing about suspension

    assert client.patch(f"{ADMIN}/users/{pid}/status", json={"status": "active", "reason": "appeal accepted"}, headers=admin).status_code == 200
    again = client.post(f"{AUTH}/login", json={"email": "p@example.org", "password": "monsoon-2026"})
    assert again.status_code == 200 and again.json()["user"]["last_login_at"]

    actions = [e["action"] for e in events()]
    assert "account_suspended" in actions and "account_reactivated" in actions
    suspended = events("account_suspended")[-1]
    assert suspended["reason"] == "abuse reports" and suspended["actor"]["role"] == "admin"


def test_a_suspended_admin_loses_admin_access_at_once(client):
    a1 = account(client, "a1@example.org", "admin")
    a2 = account(client, "a2@example.org", "admin")
    assert client.patch(f"{ADMIN}/users/{user_id(client, a2)}/status", json={"status": "suspended", "reason": "test"}, headers=a1).status_code == 200
    assert client.get(f"{ADMIN}/overview", headers=a2).status_code == 401


def test_an_expired_session_is_refused(client):
    admin = account(client, "admin@example.org", "admin")
    database().sessions.update_many({}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}})
    assert client.get(f"{ADMIN}/overview", headers=admin).status_code == 401


def test_status_change_needs_a_reason(client):
    admin = account(client, "admin@example.org", "admin")
    pid = user_id(client, account(client, "p@example.org"))
    assert client.patch(f"{ADMIN}/users/{pid}/status", json={"status": "suspended"}, headers=admin).status_code == 422


# ---------------- audit log ----------------

def test_admin_actions_are_audited_and_the_log_holds_no_secrets(client):
    admin = account(client, "admin@example.org", "admin")
    rescuer_headers, team = team_member(client, admin, "r@example.org", "Team Audit")
    pid = user_id(client, account(client, "p@example.org"))
    client.patch(f"{ADMIN}/users/{pid}/role", json={"role": "rescuer"}, headers=admin)

    _, receipt = None, client.post(SOS, json=sos()).json()
    client.post(f"{SOS}/{receipt['id']}/close", json={"reason": "duplicate", "note": "same as another"}, headers=admin)

    actions = {e["action"] for e in events()}
    assert {"team_created", "team_membership_changed", "role_changed", "rescue_closed_by_admin"} <= actions

    dump = json.dumps(events(), default=str)
    for secret in ("password", "token", "monsoon-2026", "+880", "contact_phone"):
        assert secret not in dump

    listed = client.get(f"{ADMIN}/audit?action=role_changed", headers=admin).json()
    assert listed["events"] and all(e["action"] == "role_changed" for e in listed["events"])
    assert "role_changed" in listed["actions"]


def test_the_audit_log_cannot_be_changed_through_the_api(client):
    admin = account(client, "admin@example.org", "admin")
    client.get(f"{ADMIN}/overview", headers=account(client, "u@example.org"))  # makes one event
    event_id = events()[0]["_id"]
    for method in ("put", "patch", "delete"):
        assert getattr(client, method)(f"{ADMIN}/audit/{event_id}", headers=admin).status_code in (404, 405)
        assert getattr(client, method)(f"{ADMIN}/audit", headers=admin).status_code in (404, 405)
    assert database().admin_audit.count_documents({"_id": event_id}) == 1


# ---------------- announcements ----------------

def test_announcements_are_labelled_never_official_and_can_be_corrected_and_withdrawn(client):
    admin = account(client, "admin@example.org", "admin")
    made = client.post(f"{ADMIN}/announcements", json={"title": "Portal maintenance", "body": "The map may be slow tonight.", "level": "info"}, headers=admin)
    assert made.status_code == 201
    ann = made.json()
    assert "not an official warning" in ann["label"]

    public = client.get("/api/v1/announcements").json()
    assert [a["title"] for a in public["announcements"]] == ["Portal maintenance"]
    assert "published_by" not in public["announcements"][0] and "history" not in public["announcements"][0]
    assert "ffwc.gov.bd" in public["note"]

    fixed = client.patch(f"{ADMIN}/announcements/{ann['id']}", json={"title": "Portal maintenance tonight", "body": "Slow map 22:00-23:00.", "reason": "time added"}, headers=admin)
    assert fixed.status_code == 200 and fixed.json()["history"][-1]["previous"]["title"] == "Portal maintenance"

    gone = client.post(f"{ADMIN}/announcements/{ann['id']}/withdraw", json={"reason": "finished"}, headers=admin)
    assert gone.status_code == 200 and gone.json()["status"] == "withdrawn"
    assert client.get("/api/v1/announcements").json()["announcements"] == []
    assert client.post(f"{ADMIN}/announcements/{ann['id']}/withdraw", json={"reason": "again"}, headers=admin).status_code == 404

    actions = [e["action"] for e in events()]
    assert {"announcement_published", "announcement_corrected", "announcement_withdrawn"} <= set(actions)


@pytest.mark.parametrize("text", ["Official warning from FFWC: evacuate", "Evacuation order for Sylhet", "This is an official notice", "On behalf of BWDB"])
def test_an_announcement_cannot_pose_as_an_official_warning(client, text):
    admin = account(client, "admin@example.org", "admin")
    assert client.post(f"{ADMIN}/announcements", json={"title": "Notice", "body": text}, headers=admin).status_code == 422


def test_an_announcement_may_point_to_ffwc(client):
    admin = account(client, "admin@example.org", "admin")
    ok = client.post(f"{ADMIN}/announcements", json={"title": "Where to find official warnings", "body": "See ffwc.gov.bd for official FFWC river warnings."}, headers=admin)
    assert ok.status_code == 201


# ---------------- figures come from records ----------------

def test_overview_counts_match_the_database_and_hide_contact_details(client):
    admin = account(client, "admin@example.org", "admin")
    account(client, "u1@example.org")
    account(client, "r1@example.org", "rescuer")
    for _ in range(3):
        client.post(SOS, json=sos())
    overview = client.get(f"{ADMIN}/overview", headers=admin).json()
    assert overview["users"]["total"] == database().users.count_documents({}) == 3
    assert overview["requests"]["total"] == 3 and overview["requests"]["waiting_for_team"] == 3
    assert overview["model"] is None  # no forecast stored in the test database: none is invented
    dump = json.dumps(overview, default=str)
    assert "+880" not in dump and "Rahima" not in dump and "password" not in dump


def test_data_sources_report_unknown_when_nothing_is_stored(client):
    admin = account(client, "admin@example.org", "admin")
    sources = {s["id"]: s for s in client.get(f"{ADMIN}/data-sources", headers=admin).json()["sources"]}
    assert sources["era5"]["status"] == "unknown" and sources["era5"]["latest_data"] is None
    assert sources["model"]["status"] == "unknown"
    assert sources["boundaries"]["status"] == "fixed"
    assert all(s["status"] in {"healthy", "delayed", "failing", "unknown", "fixed"} for s in sources.values())


def test_analytics_counts_real_requests_and_fills_empty_days_with_zero(client):
    admin = account(client, "admin@example.org", "admin")
    client.post(SOS, json=sos())
    a = client.get(f"{ADMIN}/analytics?days=7", headers=admin).json()
    assert len(a["days"]) == 7 and sum(d["received"] for d in a["requests"]) == 1
    assert all(not d["forecast"] for d in a["model_levels"])  # no stored forecasts: none shown


def test_user_directory_search_filter_and_paging(client):
    admin = account(client, "admin@example.org", "admin")
    for i in range(5):
        account(client, f"field{i}@example.org", "rescuer" if i < 2 else "user")
    page = client.get(f"{ADMIN}/users?limit=2&skip=0&role=rescuer", headers=admin).json()
    assert page["total"] == 2 and page["count"] == 2
    found = client.get(f"{ADMIN}/users?q=field3", headers=admin).json()
    assert [u["email"] for u in found["users"]] == ["field3@example.org"]
    assert all("password_hash" not in u for u in found["users"])


def test_repeated_refusals_from_one_account_cannot_flood_the_audit_log(client):
    user = account(client, "noisy@example.org")
    for _ in range(25):
        assert client.get(f"{ADMIN}/overview", headers=user).status_code == 403
    denied = events("permission_denied")
    assert len(denied) == 1
    assert denied[0].get("repeats") == 24


def test_a_faked_true_client_ip_does_not_skip_the_request_limit(client):
    codes = [client.post(SOS, json=sos(), headers={"True-Client-IP": f"10.9.0.{i}"}).status_code for i in range(12)]
    assert 429 in codes
