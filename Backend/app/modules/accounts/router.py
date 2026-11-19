from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.modules.accounts import service
from app.modules.accounts.schemas import (
    LocationReportResponse,
    LocationRequest,
    LoginRequest,
    RegisterRequest,
    RoleRequest,
    SessionResponse,
    UserListResponse,
    UserResponse,
)


router = APIRouter(
    prefix="/auth",
    tags=["Accounts"]
)

# Reads "Authorization: Bearer <token>". auto_error=False: we answer 401
# ourselves with one clear message for "missing" and "not valid".
bearer = HTTPBearer(auto_error=False)

NOT_LOGGED_IN = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not logged in, or the login has expired. Log in again.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def current_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer)
) -> str:

    if credentials is None:
        raise NOT_LOGGED_IN

    return credentials.credentials


async def current_user(token: str = Depends(current_token)) -> dict:

    # Use as a dependency on any route that needs a logged-in user.
    user = await service.user_for_token(token)

    if user is None:
        raise NOT_LOGGED_IN

    return user


async def optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer)
) -> dict | None:

    # For routes that work without a login but record who asked when there is one.
    if credentials is None:
        return None

    return await service.user_for_token(credentials.credentials)


def require_role(*roles: str):

    # Use as a dependency: Depends(require_role("rescuer", "admin")).
    async def check(user: dict = Depends(current_user)) -> dict:

        if user["role"] not in roles:
            if "admin" in roles and "rescuer" not in roles:
                # A logged-in account trying an admin-only action is a security event.
                from app.modules.admin import audit
                await audit.record(user, "permission_denied", result="denied", details={"required": list(roles)})
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is not allowed to do this.",
            )

        return user

    return check


async def admin_on_public_server(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer)
) -> None:

    # For routes that change shared data (assets). On a developer's machine
    # they stay open; on a public server (PUBLIC_READ_ONLY) only an admin may use them.
    if not settings.PUBLIC_READ_ONLY:
        return

    if credentials is None:
        raise NOT_LOGGED_IN

    user = await service.user_for_token(credentials.credentials)

    if user is None:
        raise NOT_LOGGED_IN

    if user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an admin can change this on the public server.",
        )


@router.post(
    "/register",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED
)
async def register(data: RegisterRequest):

    try:
        return await service.register(data.name, data.email, data.password)

    except service.EmailTaken:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")


@router.post(
    "/login",
    response_model=SessionResponse
)
async def login(data: LoginRequest):

    try:
        return await service.login(data.email, data.password)

    # One message for "no such account" and "wrong password", so nobody can
    # find out which emails have accounts by trying to log in.
    except service.WrongCredentials:
        raise HTTPException(status_code=401, detail="Wrong email or password.")

    except service.TooManyAttempts:
        raise HTTPException(
            status_code=429,
            detail="Too many wrong passwords. Wait 15 minutes and try again.",
        )

    except service.AccountSuspended:
        # Only reached with the correct password, so it reveals nothing to someone guessing.
        raise HTTPException(status_code=403, detail="This account is suspended. Contact a Rokkha administrator.")


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT
)
async def logout(token: str = Depends(current_token)):

    await service.logout(token)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me",
    response_model=UserResponse
)
async def me(user: dict = Depends(current_user)):

    return user


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT
)
async def delete_me(user: dict = Depends(current_user)):

    # Removes the account, its saved location and every login.
    await service.delete_account(user)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put(
    "/me/location",
    response_model=UserResponse
)
async def save_location(data: LocationRequest, user: dict = Depends(current_user)):

    try:
        return await service.set_location(user, data.location, data.label)

    except service.OutsideBangladesh:
        raise HTTPException(status_code=422, detail="The location must be inside Bangladesh.")


@router.delete(
    "/me/location",
    response_model=UserResponse
)
async def remove_location(user: dict = Depends(current_user)):

    return await service.clear_location(user)


@router.get(
    "/me/report",
    response_model=LocationReportResponse
)
async def my_report(
    target_date: date | None = Query(
        default=None,
        description="Day of the forecast (YYYY-MM-DD). Default: today (UTC)."
    ),
    user: dict = Depends(current_user),
):

    try:
        return await service.location_report(
            user, target_date or datetime.now(timezone.utc).date()
        )

    except service.NoLocation:
        raise HTTPException(
            status_code=409,
            detail="No location saved yet. Save one with PUT /api/v1/auth/me/location.",
        )


# ==========================================
# ADMIN: accounts and roles
# ==========================================

admin_router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


@admin_router.get(
    "/users",
    response_model=UserListResponse
)
async def list_users(
    limit: int = Query(default=200, ge=1, le=1000),
    q: str | None = Query(default=None, max_length=100, description="Search in name or email."),
    role: Literal["user", "rescuer", "admin"] | None = None,
    status: Literal["active", "suspended"] | None = None,
    skip: int = Query(default=0, ge=0, le=100000),
    admin: dict = Depends(require_role("admin")),
):

    return await service.list_users(limit, q, role, status, skip)


@admin_router.patch(
    "/users/{user_id}/role",
    response_model=UserResponse
)
async def change_role(
    user_id: str,
    data: RoleRequest,
    admin: dict = Depends(require_role("admin")),
):

    from app.modules.admin import audit

    before = await service.find_user(user_id)

    try:
        after = await service.set_role(admin, user_id, data.role)

    except service.OwnRole:
        await audit.record(admin, "role_changed", "user", user_id, result="denied", details={"why": "own role", "to": data.role})
        raise HTTPException(status_code=409, detail="You cannot change your own role.")

    except service.LastAdmin:
        await audit.record(admin, "role_changed", "user", user_id, result="denied", details={"why": "last active admin", "to": data.role})
        raise HTTPException(status_code=409, detail="This is the last active admin; make another admin first.")

    except service.UserNotFound:
        raise HTTPException(status_code=404, detail="User not found")

    await audit.record(admin, "role_changed", "user", user_id, after["name"],
                       details={"from": (before or {}).get("role"), "to": data.role})
    return after
