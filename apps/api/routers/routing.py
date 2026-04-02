# apps/api/routers/routing.py
import httpx
import hashlib
from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from services.supabase_client import get_supabase
from config import get_settings

router = APIRouter()


@router.get("/route")
async def get_route(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    supabase=Depends(get_supabase),
):
    settings = get_settings()

    coords = (
        f"{round(start_lng, 4)},{round(start_lat, 4)};"
        f"{round(end_lng, 4)},{round(end_lat, 4)}"
    )
    cache_key = hashlib.md5(coords.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    # Check route cache
    try:
        cached = (
            supabase.table("route_cache")
            .select("route_data")
            .eq("cache_key", cache_key)
            .gt("expires_at", now.isoformat())
            .maybe_single()
            .execute()
        )
        if cached and cached.data:
            return {"source": "cache", "route": cached.data["route_data"]}
    except Exception:
        pass

    # Fetch from OSRM
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.OSRM_BASE_URL}/route/v1/driving/{coords}",
                params={
                    "overview": "full",
                    "geometries": "geojson",
                    "steps": "true",
                },
            )
            resp.raise_for_status()
            route_data = resp.json()
    except httpx.HTTPError as e:
        return {"source": "error", "route": None, "error": str(e)}

    # Cache for 24 hours
    expires_at = (now + timedelta(hours=settings.ROUTE_CACHE_HOURS)).isoformat()

    try:
        supabase.table("route_cache").delete().eq(
            "cache_key", cache_key
        ).execute()

        supabase.table("route_cache").insert(
            {
                "cache_key": cache_key,
                "route_data": route_data,
                "expires_at": expires_at,
            }
        ).execute()
    except Exception:
        pass

    return {"source": "live", "route": route_data}