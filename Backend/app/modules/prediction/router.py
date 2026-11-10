from datetime import date

from fastapi import APIRouter, HTTPException, status

from app.modules.prediction.schemas import (
    ModelInfoResponse,
    PredictionListResponse,
    PredictionRequest,
)
from app.modules.prediction.service import (
    InputsMissing,
    ModelNotReady,
    create_predictions,
    model_info,
    stored_predictions,
)


router = APIRouter(
    prefix="/predictions",
    tags=["Flood prediction"]
)


# Declared before any "/{...}" route so "model" is never read as an id.
@router.get(
    "/model",
    response_model=ModelInfoResponse
)
async def get_model():

    return model_info()


@router.post(
    "",
    response_model=PredictionListResponse,
    status_code=status.HTTP_201_CREATED
)
async def post_predictions(data: PredictionRequest):

    try:
        return await create_predictions(data.target_date)

    # 503 Service Unavailable: the request is fine, the model is not there yet.
    except ModelNotReady as error:
        raise HTTPException(status_code=503, detail=str(error))

    except InputsMissing as error:
        raise HTTPException(status_code=422, detail=str(error))


@router.get(
    "",
    response_model=PredictionListResponse
)
async def get_predictions(target_date: date):

    predictions = await stored_predictions(target_date)

    if predictions is None:
        raise HTTPException(
            status_code=404,
            detail="No predictions stored for that day. Create them with POST /api/v1/predictions."
        )

    return predictions
