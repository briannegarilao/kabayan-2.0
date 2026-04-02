# apps/api/routers/responders.py
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from services.supabase_client import get_supabase

router = APIRouter()


# ── Request Models ────────────────────────────────────────────────────

class LocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class StatusUpdate(BaseModel):
    is_available: bool


# ── Endpoints ─────────────────────────────────────────────────────────

@router.get("/")
async def list_responders(
    available_only: bool = Query(False, description="Filter to available responders only"),
    supabase=Depends(get_supabase),
):
    """List all responders with current status. Used by dashboard."""
    query = supabase.table("responders").select(
        "id, is_available, current_location, current_incident_id, "
        "last_location_update, vehicle_type, team_name, max_capacity, current_load"
    )

    if available_only:
        query = query.eq("is_available", True)

    result = query.order("is_available", desc=True).execute()
    return {"responders": result.data or []}


@router.patch("/{responder_id}/location")
async def update_location(
    responder_id: str,
    payload: LocationUpdate,
    supabase=Depends(get_supabase),
):
    """
    Responder sends GPS update every 15 seconds.
    This is the batched REST approach — NOT Realtime WebSocket.
    Cost: ~5,760 writes/day for 1 responder vs ~86,400 with 1s streaming.
    """
    location_wkt = f"POINT({payload.longitude} {payload.latitude})"
    now = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("responders")
        .update(
            {
                "current_location": location_wkt,
                "last_location_update": now,
            }
        )
        .eq("id", responder_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Responder not found")

    return {"success": True, "updated_at": now}


@router.patch("/{responder_id}/status")
async def update_status(
    responder_id: str,
    payload: StatusUpdate,
    supabase=Depends(get_supabase),
):
    """Responder goes on duty or off duty."""
    update_data: dict = {"is_available": payload.is_available}

    # If going off duty, clear any current assignment
    if not payload.is_available:
        update_data["current_incident_id"] = None

    result = (
        supabase.table("responders")
        .update(update_data)
        .eq("id", responder_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Responder not found")

    return {
        "success": True,
        "is_available": payload.is_available,
    }


@router.get("/{responder_id}")
async def get_responder_detail(
    responder_id: str,
    supabase=Depends(get_supabase),
):
    """Get full details of a specific responder."""
    result = (
        supabase.table("responders")
        .select(
            "id, is_available, current_location, current_incident_id, "
            "last_location_update, vehicle_type, team_name, max_capacity, current_load"
        )
        .eq("id", responder_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Responder not found")

    return result.data
