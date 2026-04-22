# apps/api/services/dev_auth.py
from fastapi import Depends, HTTPException
from config import get_settings, Settings


def require_dev_console_backend(settings: Settings = Depends(get_settings)) -> Settings:
    if not settings.dev_console_backend_enabled:
        raise HTTPException(status_code=403, detail="Dev console is disabled in this environment.")
    return settings