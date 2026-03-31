# routers/sos.py
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional
import uuid
from services.supabase_client import get_supabase
from services.assignment import auto_assign_responder
from services.notifications import notify_lgu_new_sos

router = APIRouter()

class SOSCreateRequest(BaseModel):
    reporter_id: str
    latitude: float
    longitude: float
    message: Optional[str] = None
    image_url: Optional[str] = None
    barangay: str

@router.post("/create")
async def create_sos(
    payload: SOSCreateRequest,
    background_tasks: BackgroundTasks,
    supabase=Depends(get_supabase)
):
    # Build PostGIS-compatible point string
    location_wkt = f"POINT({payload.longitude} {payload.latitude})"

    result = supabase.table("sos_incidents").insert({
        "reporter_id": payload.reporter_id,
        "location": location_wkt,
        "barangay": payload.barangay,
        "message": payload.message,
        "image_url": payload.image_url,
        "status": "pending"
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create SOS incident")

    incident_id = result.data[0]["id"]

    # Fire background tasks — don't make citizen wait for these
    background_tasks.add_task(auto_assign_responder, incident_id, payload.latitude, payload.longitude)
    background_tasks.add_task(notify_lgu_new_sos, incident_id, payload.barangay)

    # If image submitted, queue YOLOv8n processing
    if payload.image_url:
        background_tasks.add_task(process_image_severity, incident_id, payload.image_url)

    return {
        "success": True,
        "incident_id": incident_id,
        "message": "SOS received. Help is on the way."
    }