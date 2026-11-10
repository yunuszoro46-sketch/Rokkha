from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.modules.alerts.schemas import AlertListResponse
from app.modules.alerts.service import alerts_for


router = APIRouter(
    prefix="/alerts",
    tags=["Alerts"]
)


@router.get(
    "",
    response_model=AlertListResponse
)
async def get_alerts(
    target_date: date,
    min_level: Literal["watch", "alert"] = Query(
        default="watch",
        description="'watch' returns watches and alerts; 'alert' only alerts"
    )
):

    alerts = await alerts_for(target_date, min_level)

    if alerts is None:
        raise HTTPException(
            status_code=404,
            detail="No predictions stored for that day. Create them with POST /api/v1/predictions."
        )

    return alerts
