from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    PROJECT_NAME: str = "Climate Shield"

    API_V1_PREFIX: str = "/api/v1"

    MONGODB_URI: str

    MONGODB_DATABASE: str = "climate_shield"

    DEBUG: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()
