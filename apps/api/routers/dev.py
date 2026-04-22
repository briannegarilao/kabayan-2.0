# apps/api/routers/dev.py
from fastapi import APIRouter, Depends, HTTPException, Query
from config import get_settings, Settings
from services.dev_logs import add_dev_log, get_recent_logs
from services.dev_auth import require_dev_console_backend

router = APIRouter()


def require_dev_console_enabled(settings: Settings = Depends(get_settings)) -> Settings:
    if not settings.dev_console_backend_enabled:
        raise HTTPException(status_code=403, detail="Dev console is disabled in this environment.")
    return settings


@router.get("/health")
async def dev_health(settings: Settings = Depends(require_dev_console_enabled)):
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
    settings: Settings = Depends(require_dev_console_enabled),
):
    return {
        "logs": get_recent_logs(limit=n, source=source),
        "count": len(get_recent_logs(limit=n, source=source)),
    }