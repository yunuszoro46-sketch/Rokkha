from fastapi import FastAPI

from app.core.config import settings
from app.modules.weather.router import router as weather_router
from app.modules.geospatial.router import router as geospatial_router


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Flood forecasting and geospatial risk intelligence",
    version="0.3.0"
)


@app.get("/")
async def root():

    return {
        "project": "Climate Shield",
        "status": "running",
        "architecture": "modular monolith"
    }


@app.get("/api/v1/health")
async def health_check():

    return {
        "status": "healthy"
    }


app.include_router(
    weather_router,
    prefix=settings.API_V1_PREFIX
)

app.include_router(
    geospatial_router,
    prefix=settings.API_V1_PREFIX
)
