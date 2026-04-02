# apps/api/services/trip_planner.py
"""
Rule 4 — Trip Planning (greedy multi-stop + evac center)
Rule 6 — Evac Center Selection: (proximity × 0.6) + (availability × 0.4)
Rule 9 — Capacity is sacred: current_load + new_pickup ≤ max_capacity NEVER violated
"""
import math
from services.supabase_client import get_supabase
from services.candidates import _haversine, _parse_location


def build_trip(
    responder: dict,
    primary_incident: dict,
    all_pending: list[dict],
) -> dict:
    """
    Build a multi-stop trip plan for a responder.

    1. Start with the primary (highest priority) incident
    2. Greedily add nearby pending incidents that fit within capacity
    3. Select the best evacuation center for drop-off
    4. Return the complete trip plan ready for DB insertion

    responder: dict with responder_id, lat, lng, max_capacity, current_load
    primary_incident: the highest-priority incident being assigned
    all_pending: all other pending incidents (for clustering)
    """
    max_cap = responder.get("max_capacity", 10)
    current_load = responder.get("current_load", 0)
    remaining = max_cap - current_load

    # Primary incident location
    primary_coords = _extract_coords(primary_incident)
    primary_people = primary_incident.get("people_count", 1) or 1

    # Start building stops
    stops = []
    total_people = 0

    # Stop 1: primary incident (always included)
    stops.append({
        "incident_id": primary_incident["id"],
        "type": "pickup",
        "barangay": primary_incident.get("barangay", ""),
        "people_count": primary_people,
        "lat": primary_coords[0] if primary_coords else 0,
        "lng": primary_coords[1] if primary_coords else 0,
        "severity": primary_incident.get("flood_severity", ""),
        "sequence": 1,
    })
    total_people += primary_people

    # --- Greedy clustering: add nearby incidents within capacity ---
    # Only consider incidents within 1.5km of the primary incident
    CLUSTER_RADIUS_M = 1500
    used_ids = {primary_incident["id"]}

    if primary_coords:
        nearby = []
        for inc in all_pending:
            if inc["id"] in used_ids:
                continue
            inc_coords = _extract_coords(inc)
            if not inc_coords:
                continue
            dist = _haversine(primary_coords[0], primary_coords[1], inc_coords[0], inc_coords[1])
            if dist <= CLUSTER_RADIUS_M:
                nearby.append((dist, inc, inc_coords))

        # Sort by distance from primary
        nearby.sort(key=lambda x: x[0])

        for dist, inc, coords in nearby:
            inc_people = inc.get("people_count", 1) or 1

            # Rule 9: capacity is sacred
            if total_people + inc_people > remaining:
                continue

            stops.append({
                "incident_id": inc["id"],
                "type": "pickup",
                "barangay": inc.get("barangay", ""),
                "people_count": inc_people,
                "lat": coords[0],
                "lng": coords[1],
                "severity": inc.get("flood_severity", ""),
                "sequence": len(stops) + 1,
            })
            total_people += inc_people
            used_ids.add(inc["id"])

            # Don't add more than 4 pickup stops total (keeps trips manageable)
            if len(stops) >= 4:
                break

    # --- Select best evacuation center (Rule 6) ---
    evac = _select_evac_center(
        last_stop_lat=stops[-1]["lat"],
        last_stop_lng=stops[-1]["lng"],
        total_people=total_people,
    )

    evac_center_id = None
    if evac:
        evac_center_id = evac["id"]
        stops.append({
            "incident_id": None,
            "type": "dropoff",
            "barangay": evac.get("barangay", ""),
            "people_count": total_people,
            "lat": evac["lat"],
            "lng": evac["lng"],
            "evac_center_name": evac.get("name", ""),
            "sequence": len(stops) + 1,
        })

    # Calculate rough distance estimate
    total_dist_km = _estimate_trip_distance(responder, stops)

    return {
        "stops": stops,
        "evac_center_id": evac_center_id,
        "total_people": total_people,
        "total_distance_km": round(total_dist_km, 2),
        "estimated_time_minutes": round(total_dist_km / 0.5, 1),  # ~30 km/h in flood
        "pickup_incident_ids": [s["incident_id"] for s in stops if s["type"] == "pickup"],
    }


def _select_evac_center(
    last_stop_lat: float,
    last_stop_lng: float,
    total_people: int,
) -> dict | None:
    """
    Rule 6: evac_score = (proximity × 0.6) + (availability × 0.4)
    Exclude centers where remaining_spots < total_people.
    """
    supabase = get_supabase()

    result = (
        supabase.table("evacuation_centers")
        .select("id, name, barangay, location, capacity, current_occupancy, is_open")
        .eq("is_open", True)
        .execute()
    )

    if not result.data:
        return None

    candidates = []
    for ec in result.data:
        capacity = ec.get("capacity") or 0
        occupancy = ec.get("current_occupancy") or 0
        remaining_spots = capacity - occupancy

        # Exclude if can't fit everyone
        if remaining_spots < total_people:
            continue

        ec_coords = _parse_location(ec.get("location"))
        if not ec_coords:
            continue

        dist_m = _haversine(last_stop_lat, last_stop_lng, ec_coords[0], ec_coords[1])

        # Proximity score: 0–1 (closer = higher), max distance 10km
        proximity = max(0.0, 1.0 - (dist_m / 10000.0))

        # Availability score: 0–1 (more room = higher)
        availability = remaining_spots / capacity if capacity > 0 else 0.0

        score = (proximity * 0.6) + (availability * 0.4)

        candidates.append({
            "id": ec["id"],
            "name": ec.get("name", ""),
            "barangay": ec.get("barangay", ""),
            "lat": ec_coords[0],
            "lng": ec_coords[1],
            "distance_m": round(dist_m, 0),
            "remaining_spots": remaining_spots,
            "score": round(score, 3),
        })

    if not candidates:
        return None

    # Best score wins
    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates[0]


def _extract_coords(incident: dict) -> tuple[float, float] | None:
    """Extract (lat, lng) from an incident's location field."""
    loc = incident.get("location")
    return _parse_location(loc)


def _estimate_trip_distance(responder: dict, stops: list[dict]) -> float:
    """Rough estimate of total trip distance in km using haversine between stops."""
    points = [(responder["lat"], responder["lng"])]
    for s in stops:
        if s.get("lat") and s.get("lng"):
            points.append((s["lat"], s["lng"]))

    total_m = 0.0
    for i in range(len(points) - 1):
        total_m += _haversine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])

    # Road distance is typically 1.3–1.5x straight-line
    return (total_m * 1.4) / 1000.0
