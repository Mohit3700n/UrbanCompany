from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "DailyDrill API"
    environment: str = "development"

    database_url: str
    jwt_secret: str
    jwt_expire_minutes: int = 1440

    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    geoapify_api_key: str | None = None

    geocoder_user_agent: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [
            x.strip()
            for x in self.cors_origins.split(",")
            if x.strip()
        ]


settings = Settings()