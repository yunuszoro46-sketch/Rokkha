"""
Admin Control Centre API (all under /admin, every route checks a permission on the server), plus the
public, read-only list of administrative announcements (/announcements).
"""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.modules.accounts import service as accounts
from app.modules.accounts.schemas import StatusRequest, UserResponse
from app.modules.admin import audit, service
from app.modules.admin.permissions import permissions_of, require_permission

router = APIRouter(prefix="/admin", tags=["Admin Control Centre"])

# An administrator writes as Rokkha, never as a government agency. Mentioning FFWC as a place to look is
# fine; claiming to be, or to speak for, an authority is refused. Every announcement is also shown with the
# label "not an official warning".
CLAIMS_OF_AUTHORITY = (
    "official warning from", "this is an official", "on behalf of", "government order", "evacuation order",
    "issued by ffwc", "issued by bwdb", "issued by the government", "সরকারি নির্দেশ", "সরকারি আদেশ",
)


def check_not_official(value: str) -> str:
    lowered = value.lower()
    for phrase in CLAIMS_OF_AUTHORITY:
        if phrase in lowered:
            raise ValueError("Announcements cannot present themselves as an official or government warning.")
    return value.strip()
public_router = APIRouter(tags=["Announcements"])


@router.get("/me")
async def me(user: dict = Depends(require_permission("admin.view"))):
    """Who is using the control centre, and what they may do (the UI hides what is not allowed;
    the server refuses it anyway)."""
    return {"user": {"id": user["id"], "name": user["name"], "role": user["role"]}, "permissions": permissions_of(user)}


@router.get("/overview")
async def get_overview(user: dict = Depends(require_permission("admin.view"))):
    return await service.overview()


@router.get("/analytics")
async def get_analytics(days: int = Query(default=30, ge=7, le=180), user: dict = Depends(require_permission("admin.view"))):
    return await service.analytics(days)


@router.get("/data-sources")
async def get_data_sources(user: dict = Depends(require_permission("admin.view"))):
    return {"checked_at": service._now(), "today": service._today().isoformat(), "sources": await service.data_sources(),
            "status_rule": "healthy: newest data no older than the source's normal delay; delayed: older; failing: the "
                           "latest run failed after the latest success; unknown: nothing stored; fixed: a dataset that "
                           "changes only with a new release. Daily batches, never 'live'."}


@router.get("/ingestion-runs")
async def get_ingestion_runs(
    limit: int = Query(default=50, ge=1, le=200),
    kind: str | None = Query(default=None, max_length=40),
    status: str | None = Query(default=None, max_length=20),
    user: dict = Depends(require_permission("admin.view")),
):
    return {"runs": await service.ingestion_runs(limit, kind, status)}


@router.get("/system-health")
async def get_system_health(user: dict = Depends(require_permission("admin.view"))):
    return await service.system_health()


@router.get("/audit")
async def get_audit(
    action: str | None = Query(default=None, max_length=60),
    actor_id: str | None = Query(default=None, max_length=60),
    result: Literal["success", "denied", "failed"] | None = None,
    q: str | None = Query(default=None, max_length=100),
    before: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    user: dict = Depends(require_permission("audit.view")),
):
    events = await audit.list_events(action, actor_id, result, q, before, limit)
    return {"events": events, "actions": await audit.distinct_actions(),
            "next_before": events[-1]["at"] if len(events) == limit else None}


# ---------- accounts ----------

@router.patch("/users/{user_id}/status", response_model=UserResponse)
async def change_status(user_id: str, data: StatusRequest, admin: dict = Depends(require_permission("users.manage"))):
    action = "account_suspended" if data.status == "suspended" else "account_reactivated"
    try:
        before, after = await accounts.set_status(admin, user_id, data.status)
    except accounts.OwnRole:
        await audit.record(admin, action, "user", user_id, result="denied", reason=data.reason, details={"why": "own account"})
        raise HTTPException(status_code=409, detail="You cannot change your own account status.")
    except accounts.LastAdmin:
        await audit.record(admin, action, "user", user_id, result="denied", reason=data.reason, details={"why": "last active admin"})
        raise HTTPException(status_code=409, detail="This is the last active admin; make another admin first.")
    except accounts.UserNotFound:
        raise HTTPException(status_code=404, detail="User not found")
    await audit.record(admin, action, "user", user_id, after["name"], reason=data.reason,
                       details={"from": before.get("status", "active"), "to": data.status, "role": after["role"]})
    return after


# ---------- announcements ----------

class AnnouncementIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=3, max_length=1000)
    level: Literal["info", "important"] = "info"
    district_pcodes: list[str] = Field(default_factory=list, max_length=64)

    @field_validator("district_pcodes")
    @classmethod
    def pcodes(cls, value: list[str]) -> list[str]:
        for code in value:
            if not (code.startswith("BD") and code[2:].isdigit() and len(code) == 6):
                raise ValueError(f"Unknown district code: {code}")
        return sorted(set(value))

    @field_validator("title", "body")
    @classmethod
    def not_official(cls, value: str) -> str:
        return check_not_official(value)


class AnnouncementFix(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=3, max_length=1000)
    reason: str = Field(min_length=3, max_length=300)


class Reason(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


@router.get("/announcements")
async def all_announcements(user: dict = Depends(require_permission("announcements.publish"))):
    return {"announcements": await service.list_announcements(only_published=False, limit=100)}


@router.post("/announcements", status_code=201)
async def publish(data: AnnouncementIn, admin: dict = Depends(require_permission("announcements.publish"))):
    ann = await service.publish_announcement(admin, data.title, data.body, data.level, data.district_pcodes)
    await audit.record(admin, "announcement_published", "announcement", ann["id"], ann["title"],
                       details={"level": data.level, "districts": len(data.district_pcodes) or "all"})
    return ann


@router.patch("/announcements/{ann_id}")
async def correct(ann_id: str, data: AnnouncementFix, admin: dict = Depends(require_permission("announcements.publish"))):
    try:
        check_not_official(data.title)
        check_not_official(data.body)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
    try:
        before, after = await service.correct_announcement(admin, ann_id, data.title.strip(), data.body.strip(), data.reason)
    except service.AnnouncementNotFound:
        raise HTTPException(status_code=404, detail="No published announcement with this id.")
    await audit.record(admin, "announcement_corrected", "announcement", ann_id, after["title"], reason=data.reason,
                       details={"previous_title": before["title"]})
    return after


@router.post("/announcements/{ann_id}/withdraw")
async def withdraw(ann_id: str, data: Reason, admin: dict = Depends(require_permission("announcements.publish"))):
    try:
        after = await service.withdraw_announcement(admin, ann_id, data.reason)
    except service.AnnouncementNotFound:
        raise HTTPException(status_code=404, detail="No published announcement with this id.")
    await audit.record(admin, "announcement_withdrawn", "announcement", ann_id, after["title"], reason=data.reason)
    return after


@public_router.get("/announcements")
async def public_announcements():
    """Announcements from Rokkha's administrators that are currently published. Never official warnings."""
    return {"announcements": await service.list_announcements(only_published=True, limit=20),
            "note": "Written by Rokkha administrators. Not an official warning; official flood warnings come from FFWC (ffwc.gov.bd)."}
