# services/assignment.py
from services.supabase_client import get_supabase_admin
from services.notifications import notify_responder_assignment

async def auto_assign_responder(incident_id: str, lat: float, lng: float):
    supabase = get_supabase_admin()
    location_geo = f"POINT({lng} {lat})"

    # Use PostGIS function defined in Phase 1
    result = supabase.rpc(
        "find_nearest_responder",
        {
            "incident_location": location_geo,
            "max_distance_meters": 10000
        }
    ).execute()

    if not result.data:
        # No responder in range — notify LGU admin for manual dispatch
        await notify_lgu_no_responder_available(incident_id)
        return

    nearest = result.data[0]
    responder_id = nearest["responder_id"]

    # Assign the responder
    supabase.table("sos_incidents").update({
        "assigned_responder_id": responder_id,
        "status": "assigned",
        "assigned_at": "NOW()"
    }).eq("id", incident_id).execute()

    # Mark responder as unavailable
    supabase.table("responders").update({
        "is_available": False,
        "current_incident_id": incident_id
    }).eq("id", responder_id).execute()

    # Push notification to responder's phone
    await notify_responder_assignment(responder_id, incident_id)