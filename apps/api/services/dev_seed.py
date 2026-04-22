# apps/api/services/dev_seed.py
import random
from typing import Any
from services.supabase_client import get_supabase
from services.dev_logs import add_dev_log
from services.assignment import run_assignment_engine


BARANGAY_PRESETS: dict[str, tuple[float, float]] = {
    "Paliparan I": (14.3008, 120.9517),
    "Salitran II": (14.3080, 120.9555),
    "Salitran III": (14.3060, 120.9570),
    "Sampaloc II": (14.3106, 120.9653),
    "Burol": (14.3238, 120.9548),
    "San Manuel II": (14.3280, 120.9615),
    "Langkaan I": (14.2958, 120.9364),
}


def _make_point_wkt(latitude: float, longitude: float) -> str:
    return f"POINT({longitude} {latitude})"


def _cluster_jitter(base_lat: float, base_lng: float, spread: float = 0.00045) -> tuple[float, float]:
    return (
        base_lat + random.uniform(-spread, spread),
        base_lng + random.uniform(-spread, spread),
    )


def _find_default_reporter_id() -> str | None:
    supabase = get_supabase()

    result = (
        supabase.table("users")
        .select("id")
        .eq("role", "citizen")
        .limit(1)
        .execute()
    )

    rows = result.data or []
    if not rows:
        return None

    return rows[0]["id"]


async def seed_simulated_sos(
    *,
    barangay: str,
    count: int = 1,
    people_count: int = 1,
    vulnerability_flags: list[str] | None = None,
    message: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    simulation_label: str | None = None,
    cluster: bool = False,
    run_engine_after_seed: bool = True,
) -> dict[str, Any]:
    supabase = get_supabase()

    if latitude is None or longitude is None:
        if barangay not in BARANGAY_PRESETS:
            raise ValueError(
                f"No preset coordinates for barangay '{barangay}'. "
                "Provide latitude and longitude explicitly."
            )
        latitude, longitude = BARANGAY_PRESETS[barangay]

    default_reporter_id = _find_default_reporter_id()
    inserted_ids: list[str] = []

    for _ in range(max(1, count)):
        lat, lng = latitude, longitude
        if cluster and count > 1:
            lat, lng = _cluster_jitter(latitude, longitude)

        payload = {
            "reporter_id": default_reporter_id,
            "location": _make_point_wkt(lat, lng),
            "barangay": barangay,
            "message": message or "[SIM] Seeded by Dev Console",
            "people_count": people_count,
            "vulnerability_flags": vulnerability_flags or [],
            "status": "pending",
            "is_simulated": True,
            "simulation_label": simulation_label or "manual-seed",
            "simulation_metadata": {
                "seed_source": "dev_router",
                "cluster": cluster,
            },
        }

        result = supabase.table("sos_incidents").insert(payload).execute()
        row = (result.data or [None])[0]
        if row and row.get("id"):
            inserted_ids.append(row["id"])

    add_dev_log(
        source="SIM",
        level="INFO",
        event="seed_sos",
        message=f"Seeded {len(inserted_ids)} simulated SOS incident(s)",
        metadata={
            "barangay": barangay,
            "count": len(inserted_ids),
            "simulation_label": simulation_label or "manual-seed",
            "cluster": cluster,
            "default_reporter_id": default_reporter_id,
        },
    )

    engine_result = None
    if run_engine_after_seed and inserted_ids:
        engine_result = await run_assignment_engine(None)
        add_dev_log(
            source="ENGINE",
            level="INFO",
            event="seed_trigger_assignment",
            message="Triggered assignment engine after simulation seed",
            metadata={"seeded_ids": inserted_ids},
        )

    return {
        "seeded_incident_ids": inserted_ids,
        "count": len(inserted_ids),
        "engine_result": engine_result,
    }