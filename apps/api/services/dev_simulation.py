# apps/api/services/dev_simulation.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from services.supabase_client import get_supabase
from services.dev_logs import add_dev_log, new_trace_id
from services.notifications import notify_citizen_status_change


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_metadata(trip: dict) -> dict:
    meta = trip.get("simulation_metadata")
    return meta if isinstance(meta, dict) else {}


def _pickup_stops(trip: dict) -> list[dict]:
    return [stop for stop in (trip.get("stops") or []) if stop.get("type") == "pickup"]


def _dropoff_stop(trip: dict) -> dict | None:
    for stop in (trip.get("stops") or []):
        if stop.get("type") in {"dropoff", "evac", "evacuation"}:
            return stop
    return None


def _trip_location_update(supabase, responder_id: str, stop: dict | None) -> None:
    if not stop:
        return

    lat = stop.get("lat") or stop.get("latitude")
    lng = stop.get("lng") or stop.get("longitude")

    if lat is None or lng is None:
        return

    location_wkt = f"POINT({lng} {lat})"
    supabase.table("responders").update({
        "current_location": location_wkt,
        "last_location_update": _now_iso(),
    }).eq("id", responder_id).execute()


def _load_trip(trip_id: str | None = None) -> dict | None:
    supabase = get_supabase()

    query = (
        supabase.table("trip_plans")
        .select(
            "id, responder_id, status, stops, evac_center_id, "
            "simulation_metadata, is_simulated, simulation_label"
        )
        .eq("status", "active")
        .eq("is_simulated", True)
        .order("created_at", desc=False)
        .limit(1)
    )

    if trip_id:
        query = (
            supabase.table("trip_plans")
            .select(
                "id, responder_id, status, stops, evac_center_id, "
                "simulation_metadata, is_simulated, simulation_label"
            )
            .eq("id", trip_id)
            .eq("status", "active")
            .eq("is_simulated", True)
            .limit(1)
        )

    result = query.execute()
    rows = result.data or []
    return rows[0] if rows else None


def _save_trip_metadata(trip_id: str, metadata: dict) -> None:
    supabase = get_supabase()
    supabase.table("trip_plans").update({
        "simulation_metadata": metadata,
    }).eq("id", trip_id).execute()


async def _auto_accept_trip(trip: dict, trace_id: str) -> dict:
    supabase = get_supabase()
    trip_id = trip["id"]
    responder_id = trip["responder_id"]
    metadata = _safe_metadata(trip)

    updated_incidents = []
    for stop in _pickup_stops(trip):
        incident_id = stop.get("incident_id")
        if not incident_id:
            continue

        supabase.table("sos_incidents").update({
            "status": "in_progress",
        }).eq("id", incident_id).execute()

        try:
            await notify_citizen_status_change(incident_id, "in_progress")
        except Exception:
            pass

        updated_incidents.append(incident_id)

    metadata["auto_accepted"] = True
    metadata["completed_pickup_incident_ids"] = metadata.get("completed_pickup_incident_ids", [])
    metadata["auto_step_count"] = int(metadata.get("auto_step_count", 0)) + 1
    metadata["last_auto_action"] = "accept"
    metadata["last_auto_action_at"] = _now_iso()

    _save_trip_metadata(trip_id, metadata)

    add_dev_log(
        source="SIM",
        level="INFO",
        event="simulation_accept",
        message=f"Simulated accept for trip {trip_id}",
        metadata={
            "trace_id": trace_id,
            "trip_id": trip_id,
            "responder_id": responder_id,
            "updated_incident_ids": updated_incidents,
        },
    )

    return {
        "action": "accept",
        "trip_id": trip_id,
        "updated_incident_ids": updated_incidents,
    }


async def _auto_pickup_next(trip: dict, trace_id: str) -> dict:
    supabase = get_supabase()
    trip_id = trip["id"]
    responder_id = trip["responder_id"]
    metadata = _safe_metadata(trip)
    completed_ids = metadata.get("completed_pickup_incident_ids", [])

    next_stop = None
    for stop in _pickup_stops(trip):
        incident_id = stop.get("incident_id")
        if incident_id and incident_id not in completed_ids:
            next_stop = stop
            break

    if not next_stop:
        return {
            "action": "noop",
            "trip_id": trip_id,
            "reason": "no_remaining_pickups",
        }

    incident_id = next_stop.get("incident_id")
    people_count = int(next_stop.get("people_count", 1) or 1)

    responder_result = (
        supabase.table("responders")
        .select("current_load, max_capacity")
        .eq("id", responder_id)
        .maybe_single()
        .execute()
    )

    responder = responder_result.data
    if not responder:
        raise ValueError(f"Responder not found for trip {trip_id}")

    current_load = int(responder.get("current_load", 0) or 0)
    max_capacity = int(responder.get("max_capacity", 0) or 0)
    new_load = current_load + people_count

    if max_capacity and new_load > max_capacity:
        add_dev_log(
            source="SIM",
            level="WARNING",
            event="simulation_pickup_capacity_blocked",
            message=f"Auto pickup blocked by capacity for trip {trip_id}",
            metadata={
                "trace_id": trace_id,
                "trip_id": trip_id,
                "incident_id": incident_id,
                "current_load": current_load,
                "pickup_people": people_count,
                "max_capacity": max_capacity,
            },
        )
        return {
            "action": "blocked",
            "trip_id": trip_id,
            "reason": "capacity_violation",
            "incident_id": incident_id,
        }

    supabase.table("responders").update({
        "current_load": new_load,
    }).eq("id", responder_id).execute()

    _trip_location_update(supabase, responder_id, next_stop)

    completed_ids = [*completed_ids, incident_id]
    metadata["completed_pickup_incident_ids"] = completed_ids
    metadata["auto_accepted"] = True
    metadata["auto_step_count"] = int(metadata.get("auto_step_count", 0)) + 1
    metadata["last_auto_action"] = "pickup"
    metadata["last_auto_action_at"] = _now_iso()
    _save_trip_metadata(trip_id, metadata)

    add_dev_log(
        source="SIM",
        level="INFO",
        event="simulation_pickup",
        message=f"Simulated pickup for incident {incident_id}",
        metadata={
            "trace_id": trace_id,
            "trip_id": trip_id,
            "incident_id": incident_id,
            "responder_id": responder_id,
            "current_load": new_load,
        },
    )

    return {
        "action": "pickup",
        "trip_id": trip_id,
        "incident_id": incident_id,
        "people_picked_up": people_count,
        "current_load": new_load,
    }


async def _auto_dropoff(trip: dict, trace_id: str) -> dict:
    supabase = get_supabase()
    trip_id = trip["id"]
    responder_id = trip["responder_id"]
    now = _now_iso()
    stops = trip.get("stops") or []

    total_dropped = sum(int(stop.get("people_count", 0) or 0) for stop in _pickup_stops(trip))
    resolved_incident_ids = []

    supabase.table("trip_plans").update({
        "status": "completed",
        "completed_at": now,
        "simulation_metadata": {
            **_safe_metadata(trip),
            "auto_completed": True,
            "last_auto_action": "dropoff",
            "last_auto_action_at": now,
        },
    }).eq("id", trip_id).execute()

    for stop in stops:
        if stop.get("type") == "pickup" and stop.get("incident_id"):
            incident_id = stop["incident_id"]

            supabase.table("sos_incidents").update({
                "status": "resolved",
                "resolved_at": now,
            }).eq("id", incident_id).execute()

            try:
                await notify_citizen_status_change(incident_id, "resolved")
            except Exception:
                pass

            resolved_incident_ids.append(incident_id)

    supabase.table("responders").update({
        "is_available": True,
        "current_load": 0,
        "current_incident_id": None,
    }).eq("id", responder_id).execute()

    dropoff_stop = _dropoff_stop(trip)
    _trip_location_update(supabase, responder_id, dropoff_stop)

    evac_center_id = trip.get("evac_center_id")
    if evac_center_id and total_dropped > 0:
        evac_result = (
            supabase.table("evacuation_centers")
            .select("current_occupancy")
            .eq("id", evac_center_id)
            .maybe_single()
            .execute()
        )
        evac = evac_result.data
        if evac:
            new_occupancy = int(evac.get("current_occupancy", 0) or 0) + total_dropped
            supabase.table("evacuation_centers").update({
                "current_occupancy": new_occupancy,
            }).eq("id", evac_center_id).execute()

    add_dev_log(
        source="SIM",
        level="INFO",
        event="simulation_dropoff",
        message=f"Simulated dropoff for trip {trip_id}",
        metadata={
            "trace_id": trace_id,
            "trip_id": trip_id,
            "responder_id": responder_id,
            "people_dropped": total_dropped,
            "resolved_incident_ids": resolved_incident_ids,
            "evac_center_id": evac_center_id,
        },
    )

    return {
        "action": "dropoff",
        "trip_id": trip_id,
        "people_dropped": total_dropped,
        "resolved_incident_ids": resolved_incident_ids,
    }


async def advance_simulation(trip_id: str | None = None, action: str = "auto_step") -> dict:
    trip = _load_trip(trip_id)
    trace_id = new_trace_id("sim")

    if not trip:
        return {
            "trace_id": trace_id,
            "action": "noop",
            "reason": "no_active_simulated_trip",
        }

    metadata = _safe_metadata(trip)
    completed_ids = metadata.get("completed_pickup_incident_ids", [])
    pickup_stops = _pickup_stops(trip)

    if action == "accept":
        return {
            "trace_id": trace_id,
            **await _auto_accept_trip(trip, trace_id),
        }

    if action == "pickup_next":
        return {
            "trace_id": trace_id,
            **await _auto_pickup_next(trip, trace_id),
        }

    if action == "dropoff":
        return {
            "trace_id": trace_id,
            **await _auto_dropoff(trip, trace_id),
        }

    # auto_step progression:
    if not metadata.get("auto_accepted"):
        return {
            "trace_id": trace_id,
            **await _auto_accept_trip(trip, trace_id),
        }

    if len(completed_ids) < len(pickup_stops):
        return {
            "trace_id": trace_id,
            **await _auto_pickup_next(trip, trace_id),
        }

    return {
        "trace_id": trace_id,
        **await _auto_dropoff(trip, trace_id),
    }


async def auto_run_simulation(trip_id: str | None = None, max_steps: int = 10) -> dict:
    steps = []
    trace_id = new_trace_id("simrun")

    for _ in range(max_steps):
        step_result = await advance_simulation(trip_id=trip_id, action="auto_step")
        steps.append(step_result)

        if step_result.get("action") in {"dropoff", "noop", "blocked"}:
            break

    add_dev_log(
        source="SIM",
        level="INFO",
        event="simulation_auto_run_complete",
        message="Completed simulation auto-run",
        metadata={
            "trace_id": trace_id,
            "step_count": len(steps),
            "final_action": steps[-1]["action"] if steps else "noop",
        },
    )

    return {
        "trace_id": trace_id,
        "steps": steps,
        "step_count": len(steps),
    }