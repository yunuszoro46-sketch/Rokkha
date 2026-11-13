from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    PROJECT_NAME: str = "Climate Shield"

    API_V1_PREFIX: str = "/api/v1"

    MONGODB_URI: str

    MONGODB_DATABASE: str = "climate_shield"

    DEBUG: bool = True

    # Open-Meteo free tier: < 5,000 calls per hour and < 10,000 per day
    # (they block IPs that exceed it). The ingestion module stays below
    # these safety limits and pauses a run when the next request would
    # cross them; re-running later resumes where it stopped.
    INGESTION_MAX_CALLS_PER_HOUR: float = 4000
    INGESTION_MAX_CALLS_PER_DAY: float = 8000

    # Web addresses allowed to call this API from a browser (CORS).
    # Defaults cover common frontend dev servers (React/Next.js, Vite).
    # Override in .env as a JSON list, e.g.
    # CORS_ORIGINS=["https://climate-shield.example.org"]
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Set to true on a server the public can reach. Requests that change
    # shared data (assets, ingestion runs, predictions, weather, locations)
    # are then refused with 403; reading, the point checks and user
    # accounts keep working. Until admin logins exist, this is what stops a
    # stranger from deleting assets or using up the Open-Meteo call budget.
    PUBLIC_READ_ONLY: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()
