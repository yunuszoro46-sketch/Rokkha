"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from app.core.config import settings
from app.core.database import Database

from app.modules.weather.router import router as weather_router


@asynccontextmanager
async def lifespan(app: FastAPI):

    try:
        await Database.connect()
        app.state.db = Database.db

        yield

    finally:
        await Database.disconnect()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Flood forecasting and geospatial risk intelligence",
    version="0.2.0",
    lifespan=lifespan
)


@app.get("/")
async def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "running",
        "architecture": "modular monolith"
    }


@app.get(f"{settings.API_V1_PREFIX}/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "climate-shield"
    }


@app.get(f"{settings.API_V1_PREFIX}/health/database")
async def database_health():

    try:
        await Database.client.admin.command("ping")

        return {
            "database": "MongoDB Atlas",
            "status": "connected"
        }

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable"
        )


app.include_router(
    weather_router,
    prefix=settings.API_V1_PREFIX
)
"""


from fastapi import FastAPI

from app.core.config import settings
from app.modules.weather.router import router as weather_router
from app.modules.geospatial.router import router as geospatial_router
from app.modules.assets.router import router as assets_router


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

app.include_router(
    assets_router,
    prefix=settings.API_V1_PREFIX
)
