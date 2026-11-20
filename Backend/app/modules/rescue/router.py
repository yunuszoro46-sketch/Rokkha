from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.modules.accounts.router import current_user, optional_user, require_role
from app.modules.rescue import service
from app.modules.admin import audit
from app.modules.accounts import repository as accounts_repository
from app.modules.accounts.schemas import UserResponse
from app.modules.rescue.schemas import (
    SosClose,
    SosCreate,
    SosListResponse,
    SosProgress,
    SosRelease,
    SosResponse,
    SosStatus,
    SosStatusResponse,
    SosSupportRequest,
    TeamAssign,
    TeamCreate,
    TeamListResponse,
    TeamResponse,
)


router = APIRouter(
    prefix="/sos",
    tags=["Rescue requests (SOS)"]
)

rescuers = require_role("rescuer", "admin")
admins = require_role("admin")


def _sender_address(request: Request) -> str:

    # Only used, hashed, to limit floods of requests. On Render, Cloudflare sits
    # in front and puts the visitor's real address in CF-Connecting-IP,
    # replacing any value the visitor sent. X-Forwarded-For is NOT used: Render
    # keeps whatever the visitor wrote there, so anyone could fake a new
    # address on every request and skip the limit.
    # Only CF-Connecting-IP: Cloudflare always overwrites it. True-Client-IP is NOT used: on
    # Cloudflare plans without that feature a visitor's own True-Client-IP passes through
    # unchanged, so anyone could fake a new address on every request (found in a security test).
    address = request.headers.get("cf-connecting-ip", "").strip()
    if address:
        return address

    # Running locally, without a proxy.
    return request.client.host if request.client else "unknown"


# ==========================================
# FOR THE PERSON ASKING FOR HELP (no login needed)
# ==========================================

@router.post(
    "",
    response_model=SosStatusResponse,
    status_code=status.HTTP_201_CREATED
)
async def send_sos(
    data: SosCreate,
    request: Request,
    response: Response,
    user: dict | None = Depends(optional_user),
):

    try:
        stored, created = await service.create(
            {**data.model_dump(), "location": data.location, "place": data.place}, user, _sender_address(request)
        )

    except service.OutsideBangladesh:
        raise HTTPException(status_code=422, detail="The location must be inside Bangladesh.")

    except service.UnknownDistrict:
        raise HTTPException(status_code=422, detail="Unknown district. Choose one of Bangladesh's 64 districts.")

    except service.TooManyRequests:
        raise HTTPException(
            status_code=429,
            detail="Too many new requests from this connection in the last hour. "
                   "In an emergency call 999.",
        )

    # A retry of a request that is already stored: 200, same answer, nothing new saved.
    if not created:
        response.status_code = status.HTTP_200_OK

    return stored


@router.get(
    "/status/{client_id}",
    response_model=SosStatusResponse
)
async def my_sos_status(client_id: str):

    try:
        return await service.status_for_sender(client_id)

    except service.NotFound:
        raise HTTPException(status_code=404, detail="No request with this key has reached the server.")


@router.post(
    "/status/{client_id}/cancel",
    response_model=SosStatusResponse
)
async def cancel_my_sos(client_id: str):

    try:
        return await service.cancel_by_sender(client_id)

    except service.NotFound:
        raise HTTPException(status_code=404, detail="No request with this key has reached the server.")

    except service.NotAllowed as error:
        raise HTTPException(status_code=409, detail=error.message)


@router.get(
    "/mine",
    response_model=list[SosStatusResponse]
)
async def my_requests(user: dict = Depends(current_user)):

    # Requests sent while logged in, newest first.
    return await service.requests_of(user)


# ==========================================
# FOR RESCUE TEAMS AND ADMINS: THE SHARED BOARD
# ==========================================
# Errors: 401 not logged in, 403 wrong role / no team / not your team's request,
# 404 unknown request, 409 the request is not in a state that allows this
# (for example another team accepted it first), 422 invalid body.

async def _run(action):

    try:
        return await action

    except service.NotFound:
        raise HTTPException(status_code=404, detail="Request not found")

    except service.NoTeam:
        raise HTTPException(
            status_code=403,
            detail="Your account is not part of a rescue team yet. Ask an admin to add it to one.",
        )

    except service.NotYourRequest:
        raise HTTPException(status_code=403, detail="Only the team responding to this request can do this.")

    except service.NotAllowed as error:
        raise HTTPException(status_code=409, detail=error.message)


@router.get(
    "",
    response_model=SosListResponse
)
async def board(
    sos_status: SosStatus | None = Query(
        default=None,
        alias="status",
        description="One status. Default: every request that is still open."
    ),
    district_pcode: str | None = None,
    mine: bool = Query(default=False, description="Only requests my team responds to or supports."),
    limit: int = Query(default=200, ge=1, le=500),
    rescuer: dict = Depends(rescuers),
):

    return await service.board(rescuer, sos_status, district_pcode, mine, limit)


@router.post("/{request_id}/accept", response_model=SosResponse)
async def accept(request_id: str, rescuer: dict = Depends(rescuers)):

    # Atomic: when two teams accept at the same moment, one gets 200, the other 409.
    return await _run(service.accept(request_id, rescuer))


@router.post("/{request_id}/progress", response_model=SosResponse)
async def progress(request_id: str, data: SosProgress, rescuer: dict = Depends(rescuers)):

    outcome = data.outcome.model_dump() if data.outcome else None
    return await _run(service.progress(request_id, rescuer, data.status, data.message_to_sender, outcome))


@router.post("/{request_id}/release", response_model=SosResponse)
async def release(request_id: str, data: SosRelease, rescuer: dict = Depends(rescuers)):

    released = await _run(service.release(request_id, rescuer, data.reason, data.note))
    if rescuer["role"] == "admin":
        # An administrator taking a request away from a team is an intervention: audit it.
        await audit.record(rescuer, "rescue_released_by_admin", "sos_request", request_id, released.get("reference"),
                           reason=f"{data.reason}{': ' + data.note if data.note else ''}")
    return released


@router.post("/{request_id}/support-request", response_model=SosResponse)
async def ask_support(request_id: str, data: SosSupportRequest, rescuer: dict = Depends(rescuers)):

    return await _run(service.ask_support(request_id, rescuer, data.note))


@router.post("/{request_id}/support", response_model=SosResponse)
async def join_support(request_id: str, rescuer: dict = Depends(rescuers)):

    return await _run(service.join_support(request_id, rescuer))


@router.post("/{request_id}/close", response_model=SosResponse)
async def close(request_id: str, data: SosClose, admin: dict = Depends(admins)):

    # For duplicates and requests that are not genuine. Admins only.
    closed = await _run(service.close_by_admin(request_id, admin, data.reason, data.note))
    await audit.record(admin, "rescue_closed_by_admin", "sos_request", request_id, closed.get("reference"),
                       reason=f"{data.reason}{': ' + data.note if data.note else ''}")
    return closed


# ==========================================
# ADMIN: RESCUE TEAMS
# ==========================================

teams_router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


@teams_router.get("/teams", response_model=TeamListResponse)
async def list_teams(admin: dict = Depends(admins)):

    return {"teams": await service.list_teams()}


@teams_router.post("/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(data: TeamCreate, admin: dict = Depends(admins)):

    try:
        team = await service.create_team(data.name, data.organization)
        await audit.record(admin, "team_created", "team", team["id"], f"{team['name']} ({team['organization']})")
        return team

    except service.TeamExists:
        raise HTTPException(status_code=409, detail="This organisation already has a team with that name.")


@teams_router.patch("/users/{user_id}/team", response_model=UserResponse)
async def assign_team(user_id: str, data: TeamAssign, admin: dict = Depends(admins)):

    if data.team_id is not None and await service.find_team(data.team_id) is None:
        raise HTTPException(status_code=404, detail="Team not found")

    if await accounts_repository.find_user(user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")

    before = await accounts_repository.find_user(user_id)
    after = await accounts_repository.update_user(user_id, {"team_id": data.team_id})
    await audit.record(admin, "team_membership_changed", "user", user_id, after["name"],
                       details={"from": ((before or {}).get("team") or {}).get("name"), "to": (after.get("team") or {}).get("name")})
    return after
