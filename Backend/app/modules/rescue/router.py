from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.modules.accounts.router import current_user, optional_user, require_role
from app.modules.rescue import service
from app.modules.rescue.schemas import (
    SosCreate,
    SosListResponse,
    SosResponse,
    SosStatusResponse,
    SosUpdate,
)


router = APIRouter(
    prefix="/sos",
    tags=["Rescue requests (SOS)"]
)

rescuers = require_role("rescuer", "admin")


def _sender_address(request: Request) -> str:

    # Only used, hashed, to limit floods of requests. On Render, Cloudflare sits
    # in front and puts the visitor's real address in CF-Connecting-IP,
    # replacing any value the visitor sent. X-Forwarded-For is NOT used: Render
    # keeps whatever the visitor wrote there, so anyone could fake a new
    # address on every request and skip the limit.
    for header in ("cf-connecting-ip", "true-client-ip"):
        address = request.headers.get(header, "").strip()
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
            {**data.model_dump(), "location": data.location}, user, _sender_address(request)
        )

    except service.OutsideBangladesh:
        raise HTTPException(status_code=422, detail="The location must be inside Bangladesh.")

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
        raise HTTPException(status_code=409, detail=f"The request is already {error.current}.")


@router.get(
    "/mine",
    response_model=list[SosStatusResponse]
)
async def my_requests(user: dict = Depends(current_user)):

    # Requests sent while logged in, newest first.
    return await service.requests_of(user)


# ==========================================
# FOR RESCUERS AND ADMINS
# ==========================================

@router.get(
    "",
    response_model=SosListResponse
)
async def list_sos(
    sos_status: Literal["new", "acknowledged", "team_sent", "resolved", "cancelled"] | None = Query(
        default=None,
        alias="status",
        description="One status. Default: every request that is still open."
    ),
    district_pcode: str | None = None,
    limit: int = Query(default=200, ge=1, le=500),
    rescuer: dict = Depends(rescuers),
):

    return await service.list_for_rescuers(sos_status, district_pcode, limit)


@router.patch(
    "/{request_id}",
    response_model=SosResponse
)
async def update_sos(
    request_id: str,
    data: SosUpdate,
    rescuer: dict = Depends(rescuers),
):

    try:
        return await service.update_by_rescuer(request_id, data.status, data.message_to_sender)

    except service.NotFound:
        raise HTTPException(status_code=404, detail="Request not found")

    except service.NotAllowed as error:
        raise HTTPException(
            status_code=409,
            detail=f"The request is {error.current}; it cannot become {data.status}.",
        )
