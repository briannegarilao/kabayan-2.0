# apps/api/services/dev_snapshot.py
from services.dev_logs import get_recent_logs
from services.dev_state import fetch_dev_active_state
from services.dev_stats import fetch_dev_stats


def build_dev_debug_snapshot() -> dict:
    stats = fetch_dev_stats()
    state = fetch_dev_active_state()
    logs = get_recent_logs(limit=50)

    return {
        "stats": stats,
        "state": state,
        "logs": logs,
    }