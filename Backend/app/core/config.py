from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    PROJECT_NAME: str = "Climate Shield"

    API_V1_PREFIX: str = "/api/v1"

    MONGODB_URI: str

    MONGODB_DATABASE: str = "climate_shield"

    DEBUG: bool = True

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

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()
