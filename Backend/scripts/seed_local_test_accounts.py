"""
Create the LOCAL test accounts used by the portal's browser tests (rescue board).

Makes, through the normal API (so passwords are hashed and sessions made exactly as for real users):
  - one admin            E2E_ADMIN_EMAIL     / E2E_ADMIN_PASSWORD
  - rescuer in team A    E2E_RESCUER_EMAIL   / E2E_RESCUER_PASSWORD   ("Local Test Team A")
  - rescuer in team B    E2E_RESCUER2_EMAIL  / E2E_RESCUER2_PASSWORD  ("Local Test Team B")
The first admin role is set straight in the database, the same way scripts/set_role.py does;
everything else (teams, team membership, the rescuer role) goes through the admin API.

Safety:
  - refuses to run unless the database AND the backend are on this computer (localhost / 127.0.0.1);
  - refuses Atlas URIs;
  - no password is written in this file or the repository: they come from the environment
    (keep them in Frontend/.env.e2e.local, which git ignores);
  - running it again changes nothing that already exists (idempotent).

Usage (from the Backend folder, with the local backend running):
    set -a; . ../Frontend/.env.e2e.local; set +a
    MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DATABASE=rokkha_preview \
        python scripts/seed_local_test_accounts.py --api http://localhost:8001/api/v1
"""

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import httpx
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from scripts.set_role import set_role  # noqa: E402

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
TEAM_ORG = "Local test (not a real team)"


def is_local(url: str) -> bool:
    if url.startswith("mongodb+srv") or "mongodb.net" in url:
        return False
    host = urlparse(url).hostname or ""
    return host in LOCAL_HOSTS


def need(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(f"Set {name} (for example in Frontend/.env.e2e.local).")
    return value


def session(api: str, name: str, email: str, password: str) -> dict:
    """Register, or log in when the account already exists. Returns the Authorization header."""
    made = httpx.post(f"{api}/auth/register", json={"name": name, "email": email, "password": password}, timeout=30)
    if made.status_code == 201:
        return {"Authorization": f"Bearer {made.json()['token']}"}
    if made.status_code != 409:
        sys.exit(f"Could not register {email}: {made.status_code} {made.text}")
    logged = httpx.post(f"{api}/auth/login", json={"email": email, "password": password}, timeout=30)
    if logged.status_code != 200:
        sys.exit(f"{email} exists but the password does not match ({logged.status_code}).")
    return {"Authorization": f"Bearer {logged.json()['token']}"}


def team(api: str, admin: dict, name: str) -> dict:
    teams = httpx.get(f"{api}/admin/teams", headers=admin, timeout=30).json()["teams"]
    found = next((t for t in teams if t["name"] == name and t["organization"] == TEAM_ORG), None)
    if found:
        return found
    made = httpx.post(f"{api}/admin/teams", json={"name": name, "organization": TEAM_ORG}, headers=admin, timeout=30)
    if made.status_code != 201:
        sys.exit(f"Could not create team {name}: {made.status_code} {made.text}")
    return made.json()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api", default="http://localhost:8001/api/v1")
    api = parser.parse_args().api.rstrip("/")

    if not is_local(settings.MONGODB_URI) or not is_local(api):
        sys.exit("Refusing: the database and the API must both be on this computer (local test data only).")

    admin_email, admin_pw = need("E2E_ADMIN_EMAIL"), need("E2E_ADMIN_PASSWORD")
    rescuers = [
        (need("E2E_RESCUER_EMAIL"), need("E2E_RESCUER_PASSWORD"), "Local Test Team A"),
        (need("E2E_RESCUER2_EMAIL"), need("E2E_RESCUER2_PASSWORD"), "Local Test Team B"),
    ]

    session(api, "Local test admin", admin_email, admin_pw)
    with MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000) as client:
        if not set_role(client[settings.MONGODB_DATABASE], admin_email, "admin"):
            sys.exit("The admin account was not found in the database the backend uses.")
    admin = session(api, "Local test admin", admin_email, admin_pw)

    users = httpx.get(f"{api}/admin/users", headers=admin, params={"limit": 500}, timeout=30).json()["users"]
    for email, password, team_name in rescuers:
        session(api, f"Local test rescuer ({team_name})", email, password)
        users = httpx.get(f"{api}/admin/users", headers=admin, params={"limit": 500}, timeout=30).json()["users"]
        user = next(u for u in users if u["email"] == email.lower())
        if user["role"] != "rescuer":
            r = httpx.patch(f"{api}/admin/users/{user['id']}/role", json={"role": "rescuer"}, headers=admin, timeout=30)
            if r.status_code != 200:
                sys.exit(f"Could not make {email} a rescuer: {r.status_code} {r.text}")
        t = team(api, admin, team_name)
        if (user.get("team") or {}).get("id") != t["id"]:
            r = httpx.patch(f"{api}/admin/users/{user['id']}/team", json={"team_id": t["id"]}, headers=admin, timeout=30)
            if r.status_code != 200:
                sys.exit(f"Could not put {email} in {team_name}: {r.status_code} {r.text}")
        print(f"{email}: rescuer in {team_name}")

    print(f"{admin_email}: admin")


if __name__ == "__main__":
    main()
