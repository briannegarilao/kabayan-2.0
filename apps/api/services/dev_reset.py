# apps/api/services/dev_reset.py
from typing import Any
from services.supabase_client import get_supabase
from services.dev_logs import add_dev_log


def _unwrap_rpc_data(data: Any) -> Any:
    if isinstance(data, list):
        if len(data) == 0:
            return {}
        if len(data) == 1:
            return data[0]
    return data


def run_dev_reset(mode: str = "soft") -> dict:
    supabase = get_supabase()

    result = supabase.rpc("dev_reset", {"mode": mode}).execute()
    data = _unwrap_rpc_data(result.data)

    add_dev_log(
        source="DEV",
        level="WARNING",
        event="reset",
        message=f"Executed Dev Console reset ({mode})",
        metadata={"mode": mode, "result": data},
    )

    return data or {}


def clear_active_simulated_trips() -> dict:
    """
    Cancels active simulated trips only and resets the responders attached to them.
    """
    supabase = get_supabase()

    active_trips_result = (
        supabase.table("trip_plans")
        .select("id, responder_id")
        .eq("is_simulated", True)
        .eq("status", "active")
        .execute()
    )

    trips = active_trips_result.data or []
    trip_ids = [trip["id"] for trip in trips if trip.get("id")]
    responder_ids = [trip["responder_id"] for trip in trips if trip.get("responder_id")]

    if trip_ids:
        (
            supabase.table("trip_plans")
            .update({"status": "cancelled"})
            .in_("id", trip_ids)
            .execute()
        )

    if responder_ids:
        (
            supabase.table("responders")
            .update({
                "is_available": True,
                "current_incident_id": None,
                "current_load": 0,
            })
            .in_("id", responder_ids)
            .execute()
        )

    add_dev_log(
        source="DEV",
        level="WARNING",
        event="trips_clear",
        message="Cleared active simulated trips",
        metadata={
            "cancelled_trip_count": len(trip_ids),
            "reset_responder_count": len(responder_ids),
        },
    )

    return {
        "cancelled_trip_count": len(trip_ids),
        "reset_responder_count": len(responder_ids),
    }