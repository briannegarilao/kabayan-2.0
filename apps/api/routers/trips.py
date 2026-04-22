# apps/api/routers/trips.py
"""
Trip lifecycle endpoints — called by the Responder Mobile App.
Accept/Decline, Mark Picked Up, Mark Dropped Off.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from services.supabase_client import get_supabase
from services.assignment import run_assignment_engine
from services.candidates import add_geo_exclusion
from services.notifications import notify_citizen_status_change
from services.dev_logs import add_dev_log, new_trace_id

router = APIRouter()


class DeclineRequest(BaseModel):
    reason: str = "unspecified"
    barangay: Optional[str] = None


class PickupRequest(BaseModel):
    incident_id: str
    people_picked_up: int


@router.post("/{trip_id}/accept")
async def accept_trip(
    trip_id: str,
    supabase=Depends(get_supabase),
):
    trace_id = new_trace_id("trip")

    trip = (
        supabase.table("trip_plans")
        .select("id, responder_id, stops, status")
        .eq("id", trip_id)
        .maybe_single()
        .execute()
    )

    if not trip or not trip.data:
        add_dev_log(
            source="RESPONDER",
            level="WARNING",
            event="trip_accept_not_found",
            message=f"Trip {trip_id} not found",
            metadata={"trace_id": trace_id, "trip_id": trip_id},
        )
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.data["status"] != "active":
        add_dev_log(
            source="RESPONDER",
            level="WARNING",
            event="trip_accept_invalid_status",
            message=f"Trip {trip_id} is {trip.data['status']}, cannot accept",
            metadata={"trace_id": trace_id, "trip_id": trip_id},
        )
        raise HTTPException(status_code=400, detail=f"Trip is {trip.data['status']}, cannot accept")

    stops = trip.data.get("stops") or []
    updated_incidents = []

    for stop in stops:
        if stop.get("type") == "pickup" and stop.get("incident_id"):
            try:
                supabase.table("sos_incidents").update({
                    "status": "in_progress",
                }).eq("id", stop["incident_id"]).execute()

                await notify_citizen_status_change(stop["incident_id"], "in_progress")
                updated_incidents.append(stop["incident_id"])
            except Exception as e:
                add_dev_log(
                    source="RESPONDER",
                    level="WARNING",
                    event="trip_accept_incident_update_failed",
                    message=f"Failed to update pickup incident {stop['incident_id']}",
                    metadata={"trace_id": trace_id, "trip_id": trip_id, "error": str(e)},
                )

    add_dev_log(
        source="RESPONDER",
        level="INFO",
        event="trip_accepted",
        message=f"Trip {trip_id} accepted",
        metadata={
            "trace_id": trace_id,
            "trip_id": trip_id,
            "responder_id": trip.data["responder_id"],
            "updated_incident_ids": updated_incidents,
        },
    )

    return {"success": True, "message": "Trip accepted. Navigate to your first stop."}


@router.post("/{trip_id}/decline")
async def decline_trip(
    trip_id: str,
    payload: DeclineRequest,
    background_tasks: BackgroundTasks,
    supabase=Depends(get_supabase),
):
    trace_id = new_trace_id("trip")

    trip = (
        supabase.table("trip_plans")
        .select("id, responder_id, stops, status")
        .eq("id", trip_id)
        .maybe_single()
        .execute()
    )

    if not trip or not trip.data:
        add_dev_log(
            source="RESPONDER",
            level="WARNING",
            event="trip_decline_not_found",
            message=f"Trip {trip_id} not found",
            metadata={"trace_id": trace_id, "trip_id": trip_id},
        )
        raise HTTPException(status_code=404, detail="Trip not found")

    responder_id = trip.data["responder_id"]
    stops = trip.data.get("stops") or []
    reverted_incidents = []

    supabase.table("trip_plans").update({
        "status": "cancelled",
    }).eq("id", trip_id).execute()

    for stop in stops:
        if stop.get("type") == "pickup" and stop.get("incident_id"):
            try:
                supabase.table("sos_incidents").update({
                    "status": "pending",
                    "assigned_responder_id": None,
                    "assigned_at": None,
                }).eq("id", stop["incident_id"]).execute()
                reverted_incidents.append(stop["incident_id"])
            except Exception as e:
                add_dev_log(
                    source="RESPONDER",
                    level="WARNING",
                    event="trip_decline_revert_failed",
                    message=f"Failed to revert incident {stop['incident_id']}",
                    metadata={"trace_id": trace_id, "trip_id": trip_id, "error": str(e)},
                )

    supabase.table("responders").update({
        "is_available": True,
        "current_incident_id": None,
    }).eq("id", responder_id).execute()

    if payload.reason == "route_blocked" and payload.barangay:
        add_geo_exclusion(responder_id, payload.barangay, minutes=30)

        add_dev_log(
            source="RESPONDER",
            level="WARNING",
            event="geo_exclusion_applied",
            message=f"Geo-exclusion applied to responder {responder_id}",
            metadata={
                "trace_id": trace_id,
                "responder_id": responder_id,
                "barangay": payload.barangay,
                "minutes": 30,
            },
        )

    background_tasks.add_task(run_assignment_engine, None)

    add_dev_log(
        source="RESPONDER",
        level="WARNING",
        event="trip_declined",
        message=f"Trip {trip_id} declined",
        metadata={
            "trace_id": trace_id,
            "trip_id": trip_id,
            "responder_id": responder_id,
            "reason": payload.reason,
            "reverted_incident_ids": reverted_incidents,
            "reassignment_queued": True,
        },
    )

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
    trace_id = new_trace_id("trip")

    trip = (
        supabase.table("trip_plans")
        .select("responder_id")
        .eq("id", trip_id)
        .maybe_single()
        .execute()
    )

    if not trip or not trip.data:
        add_dev_log(
            source="RESPONDER",
            level="WARNING",
            event="pickup_trip_not_found",
            message=f"Trip {trip_id} not found for pickup",
            metadata={"trace_id": trace_id, "trip_id": trip_id, "incident_id": incident_id},
        )
        raise HTTPException(status_code=404, detail="Trip not found")

    responder_id = trip.data["responder_id"]

    resp = (
        supabase.table("responders")
        .select("current_load, max_capacity")
        .eq("id", responder_id)
        .maybe_single()
        .execute()
    )

    if not resp or not resp.data:
        add_dev_log(
            source="RESPONDER",
            level="WARNING",
            event="pickup_responder_not_found",
            message=f"Responder {responder_id} not found for pickup",
            metadata={"trace_id": trace_id, "trip_id": trip_id, "incident_id": incident_id},
        )
        raise HTTPException(status_code=404, detail="Responder not found")

    current_load = resp.data.get("current_load", 0) or 0
    max_cap = resp.data.get("max_capacity", 10) or 10
    new_load = current_load + payload.people_picked_up

    if new_load > max_cap:
        add_dev_log(
            source="RESPONDER",
            level="WARNING",
            event="pickup_capacity_violation",
            message=f"Pickup would exceed capacity for responder {responder_id}",
            metadata={
                "trace_id": trace_id,
                "trip_id": trip_id,
                "incident_id": incident_id,
                "current_load": current_load,
                "pickup_people": payload.people_picked_up,
                "max_capacity": max_cap,
            },
        )
        raise HTTPException(
            status_code=400,
            detail=f"Cannot pick up {payload.people_picked_up} people. Current load: {current_load}/{max_cap}",
        )

    supabase.table("responders").update({
        "current_load": new_load,
    }).eq("id", responder_id).execute()

    add_dev_log(
        source="RESPONDER",
        level="INFO",
        event="pickup_completed",
        message=f"Pickup completed for incident {incident_id}",
        metadata={
            "trace_id": trace_id,
            "trip_id": trip_id,
            "incident_id": incident_id,
            "responder_id": responder_id,
            "current_load": new_load,
            "max_capacity": max_cap,
        },
    )

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
    trace_id = new_trace_id("trip")

    trip = (
        supabase.table("trip_plans")
        .select("id, responder_id, stops, evac_center_id")
        .eq("id", trip_id)
        .maybe_single()
        .execute()
    )

    if not trip or not trip.data:
        add_dev_log(
            source="RESPONDER",
            level="WARNING",
            event="dropoff_trip_not_found",
            message=f"Trip {trip_id} not found for dropoff",
            metadata={"trace_id": trace_id, "trip_id": trip_id},
        )
        raise HTTPException(status_code=404, detail="Trip not found")

    responder_id = trip.data["responder_id"]
    stops = trip.data.get("stops") or []
    evac_center_id = trip.data.get("evac_center_id")
    now = datetime.now(timezone.utc).isoformat()

    total_dropped = sum(
        s.get("people_count", 0) for s in stops if s.get("type") == "pickup"
    )

    supabase.table("trip_plans").update({
        "status": "completed",
        "completed_at": now,
    }).eq("id", trip_id).execute()

    resolved_incidents = []
    for stop in stops:
        if stop.get("type") == "pickup" and stop.get("incident_id"):
            try:
                supabase.table("sos_incidents").update({
                    "status": "resolved",
                    "resolved_at": now,
                }).eq("id", stop["incident_id"]).execute()

                await notify_citizen_status_change(stop["incident_id"], "resolved")
                resolved_incidents.append(stop["incident_id"])
            except Exception as e:
                add_dev_log(
                    source="RESPONDER",
                    level="WARNING",
                    event="dropoff_resolve_failed",
                    message=f"Failed to resolve incident {stop['incident_id']}",
                    metadata={"trace_id": trace_id, "trip_id": trip_id, "error": str(e)},
                )

    supabase.table("responders").update({
        "is_available": True,
        "current_load": 0,
        "current_incident_id": None,
    }).eq("id", responder_id).execute()

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
        except Exception as e:
            add_dev_log(
                source="RESPONDER",
                level="WARNING",
                event="dropoff_evac_update_failed",
                message=f"Failed to update evacuation center {evac_center_id}",
                metadata={"trace_id": trace_id, "trip_id": trip_id, "error": str(e)},
            )

    background_tasks.add_task(run_assignment_engine, None)

    add_dev_log(
        source="RESPONDER",
        level="INFO",
        event="dropoff_completed",
        message=f"Dropoff completed for trip {trip_id}",
        metadata={
            "trace_id": trace_id,
            "trip_id": trip_id,
            "responder_id": responder_id,
            "evac_center_id": evac_center_id,
            "people_dropped": total_dropped,
            "resolved_incident_ids": resolved_incidents,
            "reassignment_queued": True,
        },
    )

    return {
        "success": True,
        "message": f"Drop-off complete. {total_dropped} people delivered to evacuation center.",
        "people_dropped": total_dropped,
    }