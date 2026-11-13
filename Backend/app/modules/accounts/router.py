from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.modules.accounts import service
from app.modules.accounts.schemas import (
    LocationReportResponse,
    LocationRequest,
    LoginRequest,
    RegisterRequest,
    SessionResponse,
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
