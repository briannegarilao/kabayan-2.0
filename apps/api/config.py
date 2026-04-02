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
        "http://localhost:3000",          # Next.js dev
        "https://kabayan.vercel.app",     # Production dashboard
    ]

    # Dasmariñas City coordinates (hardcoded — never changes)
    DASMA_LAT: float = 14.3294
    DASMA_LNG: float = 120.9367

    # Cache durations
    WEATHER_CACHE_MINUTES: int = 30
    ROUTE_CACHE_HOURS: int = 24

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",  # Don't crash on unknown env vars
    }


@lru_cache()
def get_settings() -> Settings:
    """Cached — parsed once at startup, reused for every request."""
    return Settings()
