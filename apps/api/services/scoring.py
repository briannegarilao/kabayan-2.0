# apps/api/services/scoring.py
"""
Rule 3 — Responder Scoring
responder_score = (distance × 0.50) + (capacity_fit × 0.30) + (cluster_bonus × 0.20)
"""
import httpx
from config import get_settings


async def score_candidates(
    candidates: list[dict],
    incident_lat: float,
    incident_lng: float,
    people_needed: int,
    nearby_pending_count: int = 0,
) -> list[dict]:
    """
    Score each candidate responder. Returns list sorted by score (best first).
    Uses OSRM for actual road travel time (not straight-line distance).
    """
    if not candidates:
        return []

    settings = get_settings()
    scored = []

    # Get OSRM travel times for all candidates (batch as individual calls — OSRM doesn't support batch)
    # Limit to top 5 candidates by straight-line to minimize OSRM calls
    top_candidates = candidates[:5]

    for c in top_candidates:
        # --- OSRM travel time ---
        travel_seconds = await _get_osrm_travel_time(
            settings.OSRM_BASE_URL,
            c["lat"], c["lng"],
            incident_lat, incident_lng,
        )

        # Fallback: estimate from straight-line if OSRM fails
        if travel_seconds is None:
            # Assume ~30 km/h average speed in flood conditions
            travel_seconds = (c["straight_line_distance_m"] / 1000.0) / 30.0 * 3600.0

        travel_minutes = travel_seconds / 60.0

        # --- Distance score (0–1, inverted): closer = higher ---
        # Normalize: 0 min → 1.0, 20+ min → 0.0
        distance_score = max(0.0, 1.0 - (travel_minutes / 20.0))

        # --- Capacity fit score (0–1): more remaining capacity = higher ---
        remaining = c["remaining_capacity"]
        max_cap = c["max_capacity"]
        capacity_score = remaining / max_cap if max_cap > 0 else 0.0

        # Bonus: if vehicle can carry exactly or slightly more than needed, good fit
        if remaining >= people_needed:
            capacity_score = min(capacity_score + 0.1, 1.0)

        # --- Cluster bonus (0–1): nearby pending incidents = potential multi-stop ---
        cluster_score = min(nearby_pending_count / 3.0, 1.0)

        # --- Final weighted score ---
        final_score = (
            (distance_score * 0.50)
            + (capacity_score * 0.30)
            + (cluster_score * 0.20)
        )

        scored.append({
            **c,
            "travel_seconds": round(travel_seconds, 0),
            "travel_minutes": round(travel_minutes, 1),
            "distance_score": round(distance_score, 3),
            "capacity_score": round(capacity_score, 3),
            "cluster_score": round(cluster_score, 3),
            "final_score": round(final_score, 3),
        })

    # Sort by final score descending (best responder first)
    scored.sort(key=lambda x: x["final_score"], reverse=True)
    return scored


async def _get_osrm_travel_time(
    osrm_base: str,
    from_lat: float, from_lng: float,
    to_lat: float, to_lng: float,
) -> float | None:
    """Get driving travel time in seconds from OSRM. Returns None on failure."""
    coords = f"{round(from_lng, 4)},{round(from_lat, 4)};{round(to_lng, 4)},{round(to_lat, 4)}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{osrm_base}/route/v1/driving/{coords}",
                params={"overview": "false"},  # Don't need geometry, just duration
            )
            data = resp.json()

            if data.get("code") == "Ok" and data.get("routes"):
                return data["routes"][0]["duration"]  # seconds
    except (httpx.HTTPError, KeyError, IndexError):
        pass

    return None
