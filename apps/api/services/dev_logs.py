# apps/api/services/dev_logs.py
from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Literal, TypedDict


LogSource = Literal["SYSTEM", "ENGINE", "SOS", "RESPONDER", "SIM", "DB", "REALTIME", "DEV"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR"]


class DevLogEntry(TypedDict):
    timestamp: str
    source: LogSource
    level: LogLevel
    event: str
    message: str
    metadata: dict[str, Any]


_LOG_BUFFER: deque[DevLogEntry] = deque(maxlen=500)
_LOG_LOCK = Lock()


def add_dev_log(
    *,
    source: LogSource,
    level: LogLevel,
    event: str,
    message: str,
    metadata: dict[str, Any] | None = None,
) -> DevLogEntry:
    entry: DevLogEntry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "level": level,
        "event": event,
        "message": message,
        "metadata": metadata or {},
    }

    with _LOG_LOCK:
        _LOG_BUFFER.append(entry)

    # Keep console printing for local dev visibility
    print(f"[{entry['source']}][{entry['level']}][{entry['event']}] {entry['message']}")
    return entry


def get_recent_logs(limit: int = 100, source: str | None = None) -> list[DevLogEntry]:
    with _LOG_LOCK:
        items = list(_LOG_BUFFER)

    if source:
        items = [item for item in items if item["source"] == source]

    return items[-max(1, min(limit, 500)) :]


def clear_logs() -> None:
    with _LOG_LOCK:
        _LOG_BUFFER.clear()