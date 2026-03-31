# routers/routing.py
import httpx, hashlib, json
from fastapi import APIRouter, Query
from services.supabase_client import get_supabase
from datetime import datetime, timedelta

router = APIRouter()
OSRM_BASE = "http://router.project-osrm.org"

@router.get("/route")
async def get_route(
    start_lat: float, start_lng: float,
    end_lat: float, end_lng: float,
    supabase=Depends(get_supabase)
):
    # Round coordinates to 4 decimal places (~11m precision) for cache efficiency
    coords = f"{round(start_lng,4)},{round(start_lat,4)};{round(end_lng,4)},{round(end_lat,4)}"
    cache_key = hashlib.md5(coords.encode()).hexdigest()

    # Check in-memory route cache table
    cached = supabase.table("route_cache")\
        .select("route_data")\
        .eq("cache_key", cache_key)\
        .gt("expires_at", datetime.utcnow().isoformat())\
        .maybe_single()\
        .execute()

    if cached.data:
        return {"source": "cache", "route": cached.data["route_data"]}

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{OSRM_BASE}/route/v1/driving/{coords}",
            params={"overview": "full", "geometries": "geojson", "steps": "true"}
        )
        route_data = resp.json()

    # Cache route for 24 hours — road routes rarely change
    supabase.table("route_cache").upsert({
        "cache_key": cache_key,
        "route_data": route_data,
        "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat()
    }).execute()

    return {"source": "live", "route": route_data}