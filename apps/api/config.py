# apps/api/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """
    All configuration is read from environment variables / .env file.
    Never hardcode secrets. Never commit .env to git.
    """

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str  # Admin key — bypasses RLS

    # OSRM routing (free public demo server for dev)
    OSRM_BASE_URL: str = "http://router.project-osrm.org"

    # Hugging Face YOLOv8n inference (Phase 6 — optional for now)
    HF_INFERENCE_URL: str = ""

    # Expo Push Notifications
    EXPO_ACCESS_TOKEN: str = ""

    # CORS origins allowed to call this API
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://kabayan.vercel.app",
    ]

    # Dasmariñas City coordinates
    DASMA_LAT: float = 14.3294
    DASMA_LNG: float = 120.9367

    # Cache durations
    WEATHER_CACHE_MINUTES: int = 30
    ROUTE_CACHE_HOURS: int = 24

    # App environment
    APP_ENV: str = "development"  # development | staging | production

    # Dev Console controls
    DEV_CONSOLE_ENABLED: bool = False
    DEV_CONSOLE_ADMIN_ENABLED: bool = False

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"

    @property
    def is_staging(self) -> bool:
        return self.APP_ENV == "staging"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def dev_console_backend_enabled(self) -> bool:
        """
        Backend rule:
        - always allow in development if DEV_CONSOLE_ENABLED=true
        - optionally allow later in staging/production if DEV_CONSOLE_ADMIN_ENABLED=true
        """
        if not self.DEV_CONSOLE_ENABLED:
            return False

        if self.is_development:
            return True

        return self.DEV_CONSOLE_ADMIN_ENABLED


@lru_cache()
def get_settings() -> Settings:
    """Cached — parsed once at startup, reused for every request."""
    return Settings()