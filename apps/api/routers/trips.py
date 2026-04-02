# apps/api/routers/trips.py
"""
Trip lifecycle endpoints — called by the Responder Mobile App.
Accept/Decline (Rule 8), Mark Picked Up, Mark Dropped Off.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from services.supabase_client import get_supabase
from services.assignment import run_assignment_engine
from services.candidates import add_geo_exclusion
from services.notifications import notify_citizen_status_change

router = APIRouter()


# ── Request Models ────────────────────────────────────────────────────

class DeclineRequest(BaseModel):
    reason: str = "unspecified"  # "route_blocked", "vehicle_issue", "off_duty", "other"
    barangay: Optional[str] = None  # For geo-exclusion


class PickupRequest(BaseModel):
    incident_id: str
    people_picked_up: int


# ── Endpoints ─────────────────────────────────────────────────────────

@router.post("/{trip_id}/accept")
async def accept_trip(
    trip_id: str,
    supabase=Depends(get_supabase),
):
    """
    Responder accepts the assigned trip.
    Updates trip status and all related incidents to 'in_progress'.
    """
    # Fetch the trip
    trip = (
        supabase.table("trip_plans")
        .select("id, responder_id, stops, status")
        .eq("id", trip_id)
        .maybe_single()
        .execute()
    )

    if not trip or not trip.data:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.data["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Trip is {trip.data['status']}, cannot accept")

    # Update all pickup incidents to in_progress
    stops = trip.data.get("stops") or []
    for stop in stops:
        if stop.get("type") == "pickup" and stop.get("incident_id"):
            try:
                supabase.table("sos_incidents").update({
                    "status": "in_progress",
                }).eq("id", stop["incident_id"]).execute()

                await notify_citizen_status_change(stop["incident_id"], "in_progress")
            except Exception:
                pass

    return {"success": True, "message": "Trip accepted. Navigate to your first stop."}


@router.post("/{trip_id}/decline")
async def decline_trip(
    trip_id: str,
    payload: DeclineRequest,
    background_tasks: BackgroundTasks,
    supabase=Depends(get_supabase),
):
    """
    Rule 8: Responder declines.
    - Trip cancelled
    - All pickup incidents reverted to 'pending'
    - Geographic exclusion applied if route_blocked
    - Assignment engine re-runs immediately
    """
    trip = (
        supabase.table("trip_plans")
        .select("id, responder_id, stops, status")
        .eq("id", trip_id)
        .maybe_single()
        .execute()
    )

    if not trip or not trip.data:
        raise HTTPException(status_code=404, detail="Trip not found")

    responder_id = trip.data["responder_id"]
    stops = trip.data.get("stops") or []

    # Cancel the trip
    supabase.table("trip_plans").update({
        "status": "cancelled",
    }).eq("id", trip_id).execute()

    # Revert all pickup incidents to pending
    for stop in stops:
        if stop.get("type") == "pickup" and stop.get("incident_id"):
            try:
                supabase.table("sos_incidents").update({
                    "status": "pending",
                    "assigned_responder_id": None,
                    "assigned_at": None,
                }).eq("id", stop["incident_id"]).execute()
            except Exception:
                pass

    # Make responder available again
    supabase.table("responders").update({
        "is_available": True,
        "current_incident_id": None,
    }).eq("id", responder_id).execute()

    # Apply geographic exclusion if route was blocked (Rule 8)
    if payload.reason == "route_blocked" and payload.barangay:
        add_geo_exclusion(responder_id, payload.barangay, minutes=30)
        print(f"[TRIPS] Geo-exclusion: {responder_id} excluded from {payload.barangay} for 30min")

    # Re-run assignment engine for the now-pending incidents
    background_tasks.add_task(run_assignment_engine, None)

    return {
        "success": True,
        "message": "Trip declined. Incidents will be reassigned.",
        "reason": payload.reason,
    }


@router.post("/{trip_id}/pickup/{incident_id}")
async def mark_pickup(
    trip_id: str,
    incident_id: str,
    payload: PickupRequest,
    supabase=Depends(get_supabase),
):
    """
    Responder marks people picked up at a stop.
    Updates responder current_load.
    """
    # Get trip to verify it exists and get responder_id
    trip = (
        supabase.table("trip_plans")
        .select("responder_id")
        .eq("id", trip_id)
        .maybe_single()
        .execute()
    )

    if not trip or not trip.data:
        raise HTTPException(status_code=404, detail="Trip not found")

    responder_id = trip.data["responder_id"]

    # Get current load
    resp = (
        supabase.table("responders")
        .select("current_load, max_capacity")
        .eq("id", responder_id)
        .maybe_single()
        .execute()
    )

    if not resp or not resp.data:
        raise HTTPException(status_code=404, detail="Responder not found")

    current_load = resp.data.get("current_load", 0) or 0
    max_cap = resp.data.get("max_capacity", 10) or 10
    new_load = current_load + payload.people_picked_up

    # Rule 9: capacity cannot be violated
    if new_load > max_cap:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot pick up {payload.people_picked_up} people. "
                   f"Current load: {current_load}/{max_cap}",
        )

    # Update responder load
    supabase.table("responders").update({
        "current_load": new_load,
    }).eq("id", responder_id).execute()

    return {
        "success": True,
        "current_load": new_load,
        "max_capacity": max_cap,
        "remaining": max_cap - new_load,
    }


@router.post("/{trip_id}/dropoff")
async def mark_dropoff(
    trip_id: str,
    background_tasks: BackgroundTasks,
    supabase=Depends(get_supabase),
):
    """
    Responder marks drop-off at evacuation center.
    - Resets current_load to 0
    - Marks trip as completed
    - Resolves all pickup incidents
    - Makes responder available
    - Triggers assignment engine re-run (Rule 1: responder available)
    """
    trip = (
        supabase.table("trip_plans")
        .select("id, responder_id, stops, evac_center_id")
        .eq("id", trip_id)
        .maybe_single()
        .execute()
    )

    if not trip or not trip.data:
        raise HTTPException(status_code=404, detail="Trip not found")

    responder_id = trip.data["responder_id"]
    stops = trip.data.get("stops") or []
    evac_center_id = trip.data.get("evac_center_id")
    now = datetime.now(timezone.utc).isoformat()

    # Count total people dropped off
    total_dropped = sum(
        s.get("people_count", 0) for s in stops if s.get("type") == "pickup"
    )

    # Complete the trip
    supabase.table("trip_plans").update({
        "status": "completed",
        "completed_at": now,
    }).eq("id", trip_id).execute()

    # Resolve all pickup incidents
    for stop in stops:
        if stop.get("type") == "pickup" and stop.get("incident_id"):
            try:
                supabase.table("sos_incidents").update({
                    "status": "resolved",
                    "resolved_at": now,
                }).eq("id", stop["incident_id"]).execute()

                await notify_citizen_status_change(stop["incident_id"], "resolved")
            except Exception:
                pass

    # Reset responder: available, load = 0
    supabase.table("responders").update({
        "is_available": True,
        "current_load": 0,
        "current_incident_id": None,
    }).eq("id", responder_id).execute()

    # Update evac center occupancy
    if evac_center_id and total_dropped > 0:
        try:
            evac = (
                supabase.table("evacuation_centers")
                .select("current_occupancy")
                .eq("id", evac_center_id)
                .maybe_single()
                .execute()
            )
            if evac and evac.data:
                new_occ = (evac.data.get("current_occupancy") or 0) + total_dropped
                supabase.table("evacuation_centers").update({
                    "current_occupancy": new_occ,
                }).eq("id", evac_center_id).execute()
        except Exception:
            pass

    # Rule 1: responder available → re-run assignment engine
    background_tasks.add_task(run_assignment_engine, None)

    return {
        "success": True,
        "message": f"Drop-off complete. {total_dropped} people delivered to evacuation center.",
        "people_dropped": total_dropped,
    }
