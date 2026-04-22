# apps/api/routers/dev.py
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

from config import Settings
from services.dev_auth import require_dev_console_backend
from services.dev_logs import add_dev_log, get_recent_logs
from services.dev_stats import fetch_dev_stats
from services.dev_reset import run_dev_reset, clear_active_simulated_trips
from services.dev_seed import seed_simulated_sos
from services.supabase_client import get_supabase

router = APIRouter()


class DevResetRequest(BaseModel):
    mode: str = Field(default="soft", pattern="^(soft|full)$")


class DevSeedSOSRequest(BaseModel):
    barangay: str
    count: int = Field(default=1, ge=1, le=20)
    people_count: int = Field(default=1, ge=1, le=50)
    vulnerability_flags: list[str] = Field(default_factory=list)
    message: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    simulation_label: Optional[str] = None
    cluster: bool = False
    run_engine_after_seed: bool = True


class ForceResponderStatusRequest(BaseModel):
    responder_id: str
    is_available: bool
    reset_load: bool = True
    clear_current_incident: bool = True
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


@router.get("/health")
async def dev_health(settings: Settings = Depends(require_dev_console_backend)):
    return {
        "enabled": True,
        "app_env": settings.APP_ENV,
        "dev_console_enabled": settings.DEV_CONSOLE_ENABLED,
        "dev_console_admin_enabled": settings.DEV_CONSOLE_ADMIN_ENABLED,
        "service": "KABAYAN Dev Console API",
        "version": "0.1.0",
    }


@router.get("/logs")
async def dev_logs(
    n: int = Query(default=100, ge=1, le=500),
    source: str | None = Query(default=None),
    settings: Settings = Depends(require_dev_console_backend),
):
    logs = get_recent_logs(limit=n, source=source)
    return {
        "logs": logs,
        "count": len(logs),
    }


@router.get("/stats")
async def dev_stats(settings: Settings = Depends(require_dev_console_backend)):
    stats = fetch_dev_stats()
    return {"stats": stats}


@router.post("/reset")
async def dev_reset(
    payload: DevResetRequest,
    settings: Settings = Depends(require_dev_console_backend),
):
    result = run_dev_reset(payload.mode)
    return {"success": True, "result": result}


@router.post("/seed/sos")
async def dev_seed_sos(
    payload: DevSeedSOSRequest,
    settings: Settings = Depends(require_dev_console_backend),
):
    try:
        result = await seed_simulated_sos(
            barangay=payload.barangay,
            count=payload.count,
            people_count=payload.people_count,
            vulnerability_flags=payload.vulnerability_flags,
            message=payload.message,
            latitude=payload.latitude,
            longitude=payload.longitude,
            simulation_label=payload.simulation_label,
            cluster=payload.cluster,
            run_engine_after_seed=payload.run_engine_after_seed,
        )
        return {"success": True, "result": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/responders/force-status")
async def dev_force_responder_status(
    payload: ForceResponderStatusRequest,
    settings: Settings = Depends(require_dev_console_backend),
    supabase=Depends(get_supabase),
):
    update_data: dict = {"is_available": payload.is_available}

    if payload.reset_load:
        update_data["current_load"] = 0

    if payload.clear_current_incident:
        update_data["current_incident_id"] = None

    if payload.latitude is not None and payload.longitude is not None:
        update_data["current_location"] = f"POINT({payload.longitude} {payload.latitude})"

    result = (
        supabase.table("responders")
        .update(update_data)
        .eq("id", payload.responder_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Responder not found")

    add_dev_log(
        source="RESPONDER",
        level="WARNING",
        event="force_status",
        message=f"Forced responder status for {payload.responder_id}",
        metadata=update_data,
    )

    return {
        "success": True,
        "responder": result.data[0],
    }


@router.post("/trips/clear")
async def dev_trips_clear(settings: Settings = Depends(require_dev_console_backend)):
    result = clear_active_simulated_trips()
    return {"success": True, "result": result}