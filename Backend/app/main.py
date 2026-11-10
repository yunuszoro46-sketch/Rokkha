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


from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Database
from app.modules.weather.router import router as weather_router
from app.modules.geospatial.router import router as geospatial_router
from app.modules.assets.router import router as assets_router
from app.modules.ingestion.router import router as ingestion_router
from app.modules.ingestion.repository import close_interrupted_runs
from app.modules.prediction.router import router as prediction_router
from app.modules.alerts.router import router as alerts_router


@asynccontextmanager
async def lifespan(app: FastAPI):

    # Runs once when the server starts (before "yield") and once when it
    # stops (after "yield"): connect to MongoDB and create indexes, then
    # disconnect cleanly.
    await Database.connect()

    # Ingestion runs that were cut off by the last shutdown would otherwise
    # stay "running" forever and block new runs.
    await close_interrupted_runs(datetime.now(timezone.utc))

    try:
        yield

    finally:
        await Database.disconnect()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Flood forecasting and geospatial risk intelligence",
    version="0.5.0",
    lifespan=lifespan
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


@app.get("/api/v1/health/database")
async def database_health():

    try:
        await Database.client.admin.command("ping")

        return {
            "database": "MongoDB",
            "status": "connected"
        }

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable"
        )


# Let the frontend (running on another address) call this API from a browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

app.include_router(
    ingestion_router,
    prefix=settings.API_V1_PREFIX
)

app.include_router(
    prediction_router,
    prefix=settings.API_V1_PREFIX
)

app.include_router(
    alerts_router,
    prefix=settings.API_V1_PREFIX
)
