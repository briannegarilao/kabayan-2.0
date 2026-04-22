# apps/api/services/dev_stats.py
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


def fetch_dev_stats() -> dict:
    supabase = get_supabase()

    result = supabase.rpc("dev_stats_snapshot", {}).execute()
    data = _unwrap_rpc_data(result.data)

    add_dev_log(
        source="DEV",
        level="INFO",
        event="stats_fetch",
        message="Fetched Dev Console stats snapshot",
    )

    return data or {}