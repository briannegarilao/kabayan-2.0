# apps/api/services/priority.py
"""
Rule 2 — Incident Priority Scoring
priority = (severity × 40) + (people × 20) + (wait_time × 20) + (vulnerability × 20)
Hard cap: pending > 45 min → 100
"""
from datetime import datetime, timezone

# Severity string → normalized weight (0–1)
SEVERITY_WEIGHTS = {
    "critical": 1.0,
    "high": 0.75,
    "moderate": 0.5,
    "low": 0.25,
}

# Max minutes before wait_time component maxes out
WAIT_MAX_MINUTES = 30.0

# Hard cap: any incident older than this gets max priority
STARVATION_CAP_MINUTES = 45.0


def compute_priority(incident: dict) -> float:
    """
    Compute priority score (0–100) for a single incident.
    Called on every pending incident each time the engine runs.
    """
    now = datetime.now(timezone.utc)

    # --- Wait time (Rule 7: starvation prevention) ---
    created_str = incident.get("created_at", "")
    if created_str:
        try:
            # Handle both offset-aware and naive timestamps
            created = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            minutes_waiting = (now - created).total_seconds() / 60.0
        except (ValueError, TypeError):
            minutes_waiting = 0.0
    else:
        minutes_waiting = 0.0

    # Hard cap: 45+ minutes → automatic max priority
    if minutes_waiting >= STARVATION_CAP_MINUTES:
        return 100.0

    # --- Severity weight (0–1) ---
    severity = incident.get("flood_severity") or ""
    severity_w = SEVERITY_WEIGHTS.get(severity, 0.5)  # Default 0.5 if ML hasn't run

    # --- People weight (0–1) ---
    people_count = incident.get("people_count", 1) or 1
    people_w = min(people_count / 10.0, 1.0)

    # --- Wait weight (0–1), linear ramp over 30 min ---
    wait_w = min(minutes_waiting / WAIT_MAX_MINUTES, 1.0)

    # --- Vulnerability weight (0–1) ---
    flags = incident.get("vulnerability_flags") or []
    # Each flag adds 0.25, capped at 1.0
    vuln_w = min(len(flags) * 0.25, 1.0)

    # --- Final score ---
    score = (
        (severity_w * 40.0)
        + (people_w * 20.0)
        + (wait_w * 20.0)
        + (vuln_w * 20.0)
    )

    return round(min(score, 100.0), 2)


def score_all_pending(incidents: list[dict]) -> list[dict]:
    """
    Score all pending incidents. Returns sorted list (highest priority first).
    Also returns the computed score with each incident for DB update.
    """
    scored = []
    for inc in incidents:
        score = compute_priority(inc)
        scored.append({**inc, "_priority_score": score})

    # Sort descending by priority
    scored.sort(key=lambda x: x["_priority_score"], reverse=True)
    return scored
