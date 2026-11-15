"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

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

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
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
from app.modules.accounts.router import router as accounts_router, admin_router
from app.modules.rescue.router import router as rescue_router


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


# ==========================================
# READ-ONLY MODE FOR A PUBLIC SERVER
# ==========================================
# With PUBLIC_READ_ONLY=true only these non-GET requests are allowed:
# user accounts, and POST endpoints that only calculate and store nothing.
READ_ONLY_ALLOWED = (
    "/auth/",
    # Rescue requests are the reason the public server exists; the routes check
    # who may read or change them.
    "/sos",
    # Admin routes and asset changes check for an admin login themselves.
    "/admin/",
    "/assets",
    "/geospatial/flood/check",
    "/geospatial/boundaries/locate",
    "/geospatial/waterways/nearest",
    "/geospatial/spatial-analysis/",
)


@app.middleware("http")
async def read_only_guard(request: Request, call_next):

    if settings.PUBLIC_READ_ONLY and request.method not in ("GET", "HEAD", "OPTIONS"):

        path = request.url.path.removeprefix(settings.API_V1_PREFIX)

        if not path.startswith(READ_ONLY_ALLOWED):
            return JSONResponse(
                status_code=403,
                content={"detail": "This public server is read-only: stored data cannot be changed here."},
            )

    return await call_next(request)


# Standard browser protections on every answer (added after the guard, so its
# 403 answers get them too): no guessing of content types, no showing the API
# inside another site's frame, no leaking addresses to other sites, and HTTPS only.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
}


@app.middleware("http")
async def security_headers(request: Request, call_next):

    response = await call_next(request)
    for name, value in SECURITY_HEADERS.items():
        response.headers.setdefault(name, value)
    return response


# Let the frontend (running on another address) call this API from a browser.
# (Added after the guard above, so it wraps it: a 403 still carries the CORS headers.)
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

app.include_router(
    accounts_router,
    prefix=settings.API_V1_PREFIX
)

app.include_router(
    admin_router,
    prefix=settings.API_V1_PREFIX
)

app.include_router(
    rescue_router,
    prefix=settings.API_V1_PREFIX
)
