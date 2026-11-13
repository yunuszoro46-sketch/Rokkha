"""
Give an existing account a role: user, rescuer or admin.

The first admin has to be made this way, because only an admin can change
roles through the API. Run it on a developer's machine; it talks straight to
the database in Backend/.env.

Usage (from the Backend folder):
    python scripts/set_role.py someone@example.org admin
    python scripts/set_role.py someone@example.org rescuer

The person must have registered first (in the portal, or POST /auth/register).
"""

import sys
from pathlib import Path

from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402

ROLES = ("user", "rescuer", "admin")


def set_role(database, email: str, role: str) -> bool:
    """Returns False when no account has that email."""

    if role not in ROLES:
        raise ValueError(f"role must be one of {', '.join(ROLES)}")

    result = database["users"].update_one({"email": email.strip().lower()}, {"$set": {"role": role}})

    return result.matched_count == 1


def main():

    if len(sys.argv) != 3 or sys.argv[2] not in ROLES:
        sys.exit(__doc__)

    email, role = sys.argv[1], sys.argv[2]

    with MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=10000) as client:
        found = set_role(client[settings.MONGODB_DATABASE], email, role)

    if not found:
        sys.exit(f"No account with the email {email}. The person must register first.")

    print(f"{email} is now: {role}")


if __name__ == "__main__":
    main()
