# apps/api/services/trip_planner.py
"""
Rule 4 — Trip Planning (greedy multi-stop + evac center)
Rule 6 — Evac Center Selection: (proximity × 0.6) + (availability × 0.4)
Rule 9 — Capacity is sacred: current_load + new_pickup ≤ max_capacity NEVER violated
"""

from services.supabase_client import get_supabase
from services.candidates import _haversine, _parse_location
from services.route_planner import build_route_for_waypoints


async def build_trip(
    responder: dict,
    primary_incident: dict,
    all_pending: list[dict],
) -> dict:
    """
    Build a multi-stop trip plan for a responder.

    Phase 1 behavior:
    - keep current greedy stop selection
    - generate a real OSRM road route for the selected stop sequence
    - return geometry + actual road distance/duration for the map
    """
    max_cap = responder.get("max_capacity", 10)
    current_load = responder.get("current_load", 0)
    remaining = max_cap - current_load

    primary_coords = _extract_coords(primary_incident)
    primary_people = primary_incident.get("people_count", 1) or 1

    stops = []
    total_people = 0

    # Stop 1: primary incident
    stops.append(
        {
            "incident_id": primary_incident["id"],
            "type": "pickup",
            "barangay": primary_incident.get("barangay", ""),
            "people_count": primary_people,
            "lat": primary_coords[0] if primary_coords else 0,
            "lng": primary_coords[1] if primary_coords else 0,
            "severity": primary_incident.get("flood_severity", ""),
            "sequence": 1,
        }
    )
    total_people += primary_people

    # Greedy clustering
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

            dist = _haversine(
                primary_coords[0],
                primary_coords[1],
                inc_coords[0],
                inc_coords[1],
            )

            if dist <= CLUSTER_RADIUS_M:
                nearby.append((dist, inc, inc_coords))

        nearby.sort(key=lambda x: x[0])

        for dist, inc, coords in nearby:
            inc_people = inc.get("people_count", 1) or 1

            if total_people + inc_people > remaining:
                continue

            stops.append(
                {
                    "incident_id": inc["id"],
                    "type": "pickup",
                    "barangay": inc.get("barangay", ""),
                    "people_count": inc_people,
                    "lat": coords[0],
                    "lng": coords[1],
                    "severity": inc.get("flood_severity", ""),
                    "sequence": len(stops) + 1,
                }
            )
            total_people += inc_people
            used_ids.add(inc["id"])

            if len(stops) >= 4:
                break

    # Select evac center
    evac = _select_evac_center(
        last_stop_lat=stops[-1]["lat"],
        last_stop_lng=stops[-1]["lng"],
        total_people=total_people,
    )

    evac_center_id = None
    if evac:
        evac_center_id = evac["id"]
        stops.append(
            {
                "incident_id": None,
                "type": "dropoff",
                "barangay": evac.get("barangay", ""),
                "people_count": total_people,
                "lat": evac["lat"],
                "lng": evac["lng"],
                "evac_center_name": evac.get("name", ""),
                "sequence": len(stops) + 1,
            }
        )

    # Build routed geometry using current stop order
    route_geometry = None
    route_legs = []
    route_distance_meters = None
    route_duration_seconds = None

    responder_start = None
    if responder.get("lat") is not None and responder.get("lng") is not None:
        responder_start = (responder["lat"], responder["lng"])

    waypoint_sequence: list[tuple[float, float]] = []
    if responder_start:
        waypoint_sequence.append(responder_start)

    waypoint_sequence.extend(
        [
            (stop["lat"], stop["lng"])
            for stop in stops
            if isinstance(stop.get("lat"), (int, float))
            and isinstance(stop.get("lng"), (int, float))
        ]
    )

    route_result = await build_route_for_waypoints(waypoint_sequence)

    if route_result["ok"]:
        route_geometry = route_result["geometry"]
        route_legs = route_result["legs"]
        route_distance_meters = route_result["distance_meters"]
        route_duration_seconds = route_result["duration_seconds"]

        total_distance_km = round((route_distance_meters or 0) / 1000.0, 2)
        estimated_time_minutes = round((route_duration_seconds or 0) / 60.0, 1)
    else:
        total_dist_km = _estimate_trip_distance(responder, stops)
        total_distance_km = round(total_dist_km, 2)
        estimated_time_minutes = round(total_dist_km / 0.5, 1)  # ~30 km/h

    return {
        "stops": stops,
        "evac_center_id": evac_center_id,
        "total_people": total_people,
        "total_distance_km": total_distance_km,
        "estimated_time_minutes": estimated_time_minutes,
        "pickup_incident_ids": [
            s["incident_id"] for s in stops if s["type"] == "pickup"
        ],
        "route_geometry": route_geometry,
        "route_legs": route_legs,
        "route_distance_meters": route_distance_meters,
        "route_duration_seconds": route_duration_seconds,
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

        if remaining_spots < total_people:
            continue

        ec_coords = _parse_location(ec.get("location"))
        if not ec_coords:
            continue

        dist_m = _haversine(last_stop_lat, last_stop_lng, ec_coords[0], ec_coords[1])

        proximity = max(0.0, 1.0 - (dist_m / 10000.0))
        availability = remaining_spots / capacity if capacity > 0 else 0.0
        score = (proximity * 0.6) + (availability * 0.4)

        candidates.append(
            {
                "id": ec["id"],
                "name": ec.get("name", ""),
                "barangay": ec.get("barangay", ""),
                "lat": ec_coords[0],
                "lng": ec_coords[1],
                "distance_m": round(dist_m, 0),
                "remaining_spots": remaining_spots,
                "score": round(score, 3),
            }
        )

    if not candidates:
        return None

    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates[0]


def _extract_coords(incident: dict) -> tuple[float, float] | None:
    loc = incident.get("location")
    return _parse_location(loc)


def _estimate_trip_distance(responder: dict, stops: list[dict]) -> float:
    points = [(responder["lat"], responder["lng"])]
    for s in stops:
        if s.get("lat") and s.get("lng"):
            points.append((s["lat"], s["lng"]))

    total_m = 0.0
    for i in range(len(points) - 1):
        total_m += _haversine(
            points[i][0],
            points[i][1],
            points[i + 1][0],
            points[i + 1][1],
        )

    return (total_m * 1.4) / 1000.0