# apps/api/services/route_planner.py
from __future__ import annotations

import hashlib
from datetime import datetime, timezone, timedelta

import httpx

from config import get_settings
from services.supabase_client import get_supabase


def _build_cache_key(waypoints: list[tuple[float, float]]) -> str:
    raw = "trip:" + "|".join(
        f"{round(lat, 5)},{round(lng, 5)}" for lat, lng in waypoints
    )
    return hashlib.md5(raw.encode()).hexdigest()


def _normalize_route_result(route_data: dict, source: str) -> dict:
    routes = route_data.get("routes") or []
    if not routes:
        return {
            "ok": False,
            "source": source,
            "geometry": None,
            "legs": [],
            "distance_meters": None,
            "duration_seconds": None,
            "raw": route_data,
        }

    route = routes[0]
    return {
        "ok": True,
        "source": source,
        "geometry": route.get("geometry"),
        "legs": route.get("legs", []),
        "distance_meters": route.get("distance"),
        "duration_seconds": route.get("duration"),
        "raw": route_data,
    }


async def build_route_for_waypoints(
    waypoints: list[tuple[float, float]],
) -> dict:
    """
    Build a road-following route for an already-ordered waypoint sequence.

    waypoints = [(lat, lng), (lat, lng), ...]
    minimum 2 points required
    """
    if len(waypoints) < 2:
        return {
            "ok": False,
            "source": "invalid",
            "geometry": None,
            "legs": [],
            "distance_meters": None,
            "duration_seconds": None,
            "raw": None,
            "error": "At least 2 waypoints are required.",
        }

    settings = get_settings()
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    cache_key = _build_cache_key(waypoints)

    # OSRM expects lng,lat
    coords = ";".join(
        f"{round(lng, 5)},{round(lat, 5)}" for lat, lng in waypoints
    )

    # 1) Try cache first
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
            return _normalize_route_result(cached.data["route_data"], "cache")
    except Exception:
        pass

    # 2) Fetch from OSRM
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
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

        result = _normalize_route_result(route_data, "live")

        # 3) Cache result
        try:
            expires_at = (
                now + timedelta(hours=settings.ROUTE_CACHE_HOURS)
            ).isoformat()

            (
                supabase.table("route_cache")
                .delete()
                .eq("cache_key", cache_key)
                .execute()
            )

            (
                supabase.table("route_cache")
                .insert(
                    {
                        "cache_key": cache_key,
                        "route_data": route_data,
                        "expires_at": expires_at,
                    }
                )
                .execute()
            )
        except Exception:
            pass

        return result

    except httpx.HTTPError as e:
        return {
            "ok": False,
            "source": "error",
            "geometry": None,
            "legs": [],
            "distance_meters": None,
            "duration_seconds": None,
            "raw": None,
            "error": str(e),
        }