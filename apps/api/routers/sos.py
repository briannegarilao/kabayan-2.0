# apps/api/routers/sos.py
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional
from services.supabase_client import get_supabase
from services.assignment import auto_assign_responder
from services.notifications import notify_lgu_new_sos

router = APIRouter()


# ── Request/Response Models ───────────────────────────────────────────

class SOSCreateRequest(BaseModel):
    reporter_id: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    barangay: str
    message: Optional[str] = None
    image_url: Optional[str] = None
    people_count: int = Field(default=1, ge=1, le=50)
    vulnerability_flags: Optional[list[str]] = None  # ["children", "elderly", "disabled", "medical"]


class SOSResponse(BaseModel):
    success: bool
    incident_id: str
    message: str


# ── Endpoints ─────────────────────────────────────────────────────────

@router.post("/create", response_model=SOSResponse)
async def create_sos(
    payload: SOSCreateRequest,
    background_tasks: BackgroundTasks,
    supabase=Depends(get_supabase),
):
    """
    Citizen submits an SOS.
    1. Insert into sos_incidents (status: pending)
    2. Return 200 immediately (< 200ms target)
    3. BackgroundTask: auto-assign nearest responder
    4. BackgroundTask: notify LGU dashboard (Realtime handles this automatically)
    """
    # PostGIS geography point: POINT(longitude latitude)
    location_wkt = f"POINT({payload.longitude} {payload.latitude})"

    insert_data = {
        "reporter_id": payload.reporter_id,
        "location": location_wkt,
        "barangay": payload.barangay,
        "message": payload.message,
        "image_url": payload.image_url,
        "people_count": payload.people_count,
        "vulnerability_flags": payload.vulnerability_flags,
        "status": "pending",
    }

    result = supabase.table("sos_incidents").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create SOS incident")

    incident_id = result.data[0]["id"]

    # Fire background tasks — citizen NEVER waits for these
    background_tasks.add_task(
        auto_assign_responder, incident_id, payload.latitude, payload.longitude
    )
    background_tasks.add_task(notify_lgu_new_sos, incident_id, payload.barangay)

    return SOSResponse(
        success=True,
        incident_id=incident_id,
        message="SOS received. Help is on the way.",
    )


@router.get("/active")
async def get_active_incidents(
    barangay: Optional[str] = Query(None, description="Filter by barangay"),
    supabase=Depends(get_supabase),
):
    """Fetch all active (non-resolved) incidents. Used by dashboard + responder app."""
    query = (
        supabase.table("sos_incidents")
        .select(
            "id, status, barangay, flood_severity, flood_severity_score, "
            "message, image_url, created_at, assigned_at, location, "
            "people_count, priority_score, assigned_responder_id"
        )
        .in_("status", ["pending", "assigned", "in_progress"])
        .order("created_at", desc=True)
        .limit(100)
    )

    if barangay:
        query = query.eq("barangay", barangay)

    result = query.execute()
    return {"incidents": result.data or []}


@router.get("/mine")
async def get_my_incidents(
    reporter_id: str = Query(..., description="The citizen's user ID"),
    supabase=Depends(get_supabase),
):
    """Citizen views their own SOS history with statuses."""
    result = (
        supabase.table("sos_incidents")
        .select(
            "id, status, barangay, flood_severity, message, "
            "created_at, assigned_at, resolved_at, people_count"
        )
        .eq("reporter_id", reporter_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"incidents": result.data or []}


@router.get("/{incident_id}")
async def get_incident_detail(
    incident_id: str,
    supabase=Depends(get_supabase),
):
    """Get full details of a specific incident."""
    result = (
        supabase.table("sos_incidents")
        .select("*")
        .eq("id", incident_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Incident not found")

    return result.data
