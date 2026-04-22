# apps/api/services/dev_state.py
from services.supabase_client import get_supabase
from services.dev_logs import add_dev_log


def fetch_dev_active_state() -> dict:
    supabase = get_supabase()

    responders_result = (
        supabase.table("responders")
        .select(
            "id, is_available, current_location, current_incident_id, "
            "last_location_update, vehicle_type, team_name, max_capacity, current_load"
        )
        .order("team_name")
        .execute()
    )

    incidents_result = (
        supabase.table("sos_incidents")
        .select(
            "id, status, barangay, people_count, message, created_at, "
            "assigned_responder_id, is_simulated, simulation_label, vulnerability_flags"
        )
        .in_("status", ["pending", "assigned", "in_progress"])
        .order("created_at", desc=True)
        .limit(30)
        .execute()
    )

    trips_result = (
        supabase.table("trip_plans")
        .select(
            "id, responder_id, status, stops, evac_center_id, "
            "total_distance_km, estimated_time_minutes, created_at, "
            "is_simulated, simulation_label"
        )
        .eq("status", "active")
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    state = {
        "responders": responders_result.data or [],
        "active_incidents": incidents_result.data or [],
        "active_trips": trips_result.data or [],
    }

    add_dev_log(
        source="DEV",
        level="INFO",
        event="state_active_fetch",
        message="Fetched active Dev Console state snapshot",
        metadata={
            "responders": len(state["responders"]),
            "active_incidents": len(state["active_incidents"]),
            "active_trips": len(state["active_trips"]),
        },
    )

    return state