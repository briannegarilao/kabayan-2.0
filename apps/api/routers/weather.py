# routers/weather.py
import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter
from services.supabase_client import get_supabase

router = APIRouter()

DASMA_LAT = 14.3294
DASMA_LNG = 120.9367
CACHE_DURATION_MINUTES = 30

@router.get("/current")
async def get_weather(supabase=Depends(get_supabase)):
    cache_key = "dasma-cavite"

    # Check DB cache first
    cached = supabase.table("weather_cache")\
        .select("weather_data, expires_at")\
        .eq("location_key", cache_key)\
        .gt("expires_at", datetime.utcnow().isoformat())\
        .maybe_single()\
        .execute()

    if cached.data:
        return {"source": "cache", "data": cached.data["weather_data"]}

    # Fetch from Open-Meteo (free, no API key needed)
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": DASMA_LAT,
                "longitude": DASMA_LNG,
                "hourly": "precipitation,weathercode",
                "daily": "precipitation_sum,weathercode",
                "forecast_days": 7,
                "timezone": "Asia/Manila"
            }
        )
        weather_data = response.json()

    expires_at = datetime.utcnow() + timedelta(minutes=CACHE_DURATION_MINUTES)

    # Upsert into weather cache
    supabase.table("weather_cache").upsert({
        "location_key": cache_key,
        "weather_data": weather_data,
        "fetched_at": datetime.utcnow().isoformat(),
        "expires_at": expires_at.isoformat()
    }).execute()

    return {"source": "live", "data": weather_data}