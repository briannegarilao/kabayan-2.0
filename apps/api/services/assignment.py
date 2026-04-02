# apps/api/services/assignment.py
"""
Phase 1: Simple nearest-responder assignment.
Phase 2 will replace this with the full PWCD engine (priority scoring,
capacity constraints, multi-stop trips, OSRM routing, starvation prevention).
"""
from services.supabase_client import get_supabase
from services.notifications import notify_responder_assignment, notify_citizen_status_change
from datetime import datetime, timezone


async def auto_assign_responder(incident_id: str, lat: float, lng: float) -> None:
    """
    Find the nearest available responder and assign them to this incident.
    Called as a BackgroundTask — citizen has already received their 200 response.
    """
    supabase = get_supabase()
    location_geo = f"POINT({lng} {lat})"

    # PostGIS: find nearest available responder within 10km
    result = supabase.rpc(
        "find_nearest_responder",
        {"incident_location": location_geo, "max_distance_meters": 10000},
    ).execute()

    if not result.data:
        # No responder available — incident stays "pending"
        # Dashboard shows it in red; LGU can manually dispatch
        print(f"[ASSIGNMENT] No responder available for incident {incident_id}")
        return

    nearest = result.data[0]
    responder_id = nearest["responder_id"]
    distance_m = nearest["distance_meters"]

    print(
        f"[ASSIGNMENT] Assigning responder {responder_id} "
        f"to incident {incident_id} (distance: {distance_m:.0f}m)"
    )

    now = datetime.now(timezone.utc).isoformat()

    # Update incident: pending → assigned
    supabase.table("sos_incidents").update(
        {
            "assigned_responder_id": responder_id,
            "status": "assigned",
            "assigned_at": now,
        }
    ).eq("id", incident_id).execute()

    # Mark responder as unavailable
    supabase.table("responders").update(
        {
            "is_available": False,
            "current_incident_id": incident_id,
        }
    ).eq("id", responder_id).execute()

    # Push notifications (fire-and-forget, non-blocking)
    await notify_responder_assignment(responder_id, incident_id)
    await notify_citizen_status_change(incident_id, "assigned")
