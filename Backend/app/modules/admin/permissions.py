"""
Permissions on top of roles.

Today there is one administrative role (`admin`, the platform administrator). Routes check a named
permission instead of a role, so a future organisation administrator or rescue coordinator can be a
new entry in ROLE_PERMISSIONS without rewriting the routes. Checks always run on the server.
"""

from fastapi import Depends, HTTPException, status

from app.modules.accounts.router import current_user
from app.modules.admin import audit

ADMIN_PERMISSIONS = {
    "admin.view",            # open the control centre: overview, analytics, data sources, health
    "users.manage",          # list accounts, change roles, suspend / reactivate
    "teams.manage",          # create teams, put rescuers in teams
    "announcements.publish", # publish, correct and withdraw administrative announcements
    "rescue.oversee",        # read the whole rescue board for oversight
    "rescue.intervene",      # release a request from its team, close a request (reason required)
    "audit.view",            # read the audit log
}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin": set(ADMIN_PERMISSIONS),
    "rescuer": set(),
    "user": set(),
}


def has_permission(user: dict | None, permission: str) -> bool:
    return bool(user) and user.get("status") != "suspended" and permission in ROLE_PERMISSIONS.get(user.get("role"), set())


def permissions_of(user: dict) -> list[str]:
    return sorted(ROLE_PERMISSIONS.get(user.get("role"), set()))


def require_permission(permission: str):
    async def check(user: dict = Depends(current_user)) -> dict:
        if not has_permission(user, permission):
            # A logged-in account trying an administrative action is a security-relevant event.
            await audit.record(user, "permission_denied", result="denied", details={"permission": permission})
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account is not allowed to do this.")
        return user

    return check
