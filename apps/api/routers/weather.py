# apps/api/routers/weather.py
import httpx
from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from services.supabase_client import get_supabase
from config import get_settings

router = APIRouter()


@router.get("/current")
async def get_current_weather(supabase=Depends(get_supabase)):
    settings = get_settings()
    cache_key = "dasma-cavite"
    now = datetime.now(timezone.utc)

    # Check DB cache — wrapped in try/except because table might be empty
    try:
        cached = (
            supabase.table("weather_cache")
            .select("weather_data, expires_at")
            .eq("location_key", cache_key)
            .gt("expires_at", now.isoformat())
            .maybe_single()
            .execute()
        )
        if cached and cached.data:
            return {"source": "cache", "data": cached.data["weather_data"]}
    except Exception:
        pass  # Cache miss — proceed to fetch live

    # Fetch live from Open-Meteo (free, no API key)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": settings.DASMA_LAT,
                    "longitude": settings.DASMA_LNG,
                    "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation",
                    "hourly": "precipitation,weather_code,temperature_2m",
                    "daily": "precipitation_sum,weather_code,temperature_2m_max,temperature_2m_min",
                    "forecast_days": 3,
                    "timezone": "Asia/Manila",
                },
            )
            resp.raise_for_status()
            weather_data = resp.json()
    except httpx.HTTPError as e:
        return {"source": "error", "data": None, "error": str(e)}

    # Save to cache — delete old then insert new (avoids upsert issues)
    expires_at = (now + timedelta(minutes=settings.WEATHER_CACHE_MINUTES)).isoformat()

    try:
        supabase.table("weather_cache").delete().eq(
            "location_key", cache_key
        ).execute()

        supabase.table("weather_cache").insert(
            {
                "location_key": cache_key,
                "weather_data": weather_data,
                "fetched_at": now.isoformat(),
                "expires_at": expires_at,
            }
        ).execute()
    except Exception:
        pass  # Cache write failure is non-critical — data still returned

    return {"source": "live", "data": weather_data}