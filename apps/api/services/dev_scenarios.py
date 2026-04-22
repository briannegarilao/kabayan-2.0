# apps/api/services/dev_scenarios.py
from __future__ import annotations

from datetime import datetime, timezone

from services.supabase_client import get_supabase
from services.dev_logs import add_dev_log, new_trace_id
from services.dev_reset import run_dev_reset
from services.dev_seed import seed_simulated_sos
from services.assignment import run_assignment_engine
from services.dev_simulation import auto_run_simulation


SCENARIO_CATALOG = [
    {
        "id": "single_clean_dispatch",
        "title": "Single Clean Dispatch",
        "description": "One SOS, one responder, one trip, one evac outcome.",
        "supported_modes": ["setup_only", "setup_and_trigger", "full_run"],
        "expected_outcomes": [
            "One pending SOS is created",
            "One responder gets assigned",
            "One active trip is created",
            "No capacity violation occurs",
        ],
    },
    {
        "id": "reroute_before_pickup",
        "title": "Reroute Before Pickup",
        "description": "Two incidents where the second one should become more urgent before pickup.",
        "supported_modes": ["setup_only", "setup_and_trigger", "full_run"],
        "expected_outcomes": [
            "Initial assignment is created",
            "A second higher-priority style incident appears",
            "Engine re-evaluates while current_load is still 0",
            "Logs should show a fresh scoring/selection cycle",
        ],
    },
    {
        "id": "capacity_stress",
        "title": "Capacity Stress",
        "description": "Multiple incidents with people counts designed to pressure capacity planning.",
        "supported_modes": ["setup_only", "setup_and_trigger", "full_run"],
        "expected_outcomes": [
            "Multiple incidents are seeded",
            "Trips are built according to available responder capacity",
            "No pickup should exceed max_capacity",
            "Some incidents may remain pending if capacity is insufficient",
        ],
    },
    {
        "id": "starvation_test",
        "title": "Starvation Test",
        "description": "One older incident is backdated so the engine should eventually favor it.",
        "supported_modes": ["setup_only", "setup_and_trigger", "full_run"],
        "expected_outcomes": [
            "A far/older incident is seeded",
            "At least one newer incident is also seeded",
            "The older incident gets a stronger priority signal",
            "Logs should show its presence in the scoring cycle",
        ],
    },
    {
        "id": "decline_reassignment",
        "title": "Decline and Reassignment",
        "description": "Sets up an assigned trip so you can immediately test decline and reassignment.",
        "supported_modes": ["setup_only", "setup_and_trigger", "full_run"],
        "expected_outcomes": [
            "An active assigned trip is created",
            "Trip Controls can immediately be used to decline it",
            "Decline should revert incidents and trigger reassignment",
            "Logs should show reassignment behavior after decline",
        ],
    },
]


def list_scenarios() -> list[dict]:
    return SCENARIO_CATALOG


def _catalog_entry_or_raise(scenario_id: str) -> dict:
    for item in SCENARIO_CATALOG:
        if item["id"] == scenario_id:
            return item
    raise ValueError(f"Unknown scenario_id: {scenario_id}")


def _now_label(prefix: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{prefix}-{ts}"


def _backdate_sim_incident(incident_id: str, minutes: int) -> dict:
    supabase = get_supabase()
    result = supabase.rpc(
        "dev_backdate_sim_incident",
        {
            "p_incident_id": incident_id,
            "p_minutes": minutes,
        },
    ).execute()
    return result.data if result.data else {}


async def _scenario_single_clean_dispatch(run_label: str) -> dict:
    seeded = await seed_simulated_sos(
        barangay="Salitran III",
        count=1,
        people_count=3,
        vulnerability_flags=["children"],
        message="[SIM][SCENARIO] Single clean dispatch",
        simulation_label=run_label,
        cluster=False,
        run_engine_after_seed=False,
    )

    return {
        "seeded_incident_ids": seeded["seeded_incident_ids"],
        "notes": [
            "Baseline single-assignment case",
            "Use logs to confirm one trip creation and one responder selection",
        ],
    }


async def _scenario_reroute_before_pickup(run_label: str) -> dict:
    first = await seed_simulated_sos(
        barangay="Paliparan I",
        count=1,
        people_count=1,
        vulnerability_flags=[],
        message="[SIM][SCENARIO] First incident before reroute",
        simulation_label=run_label,
        cluster=False,
        run_engine_after_seed=False,
    )

    second = await seed_simulated_sos(
        barangay="Paliparan I",
        count=1,
        people_count=4,
        vulnerability_flags=["children", "elderly"],
        message="[SIM][SCENARIO] Higher-urgency incident before pickup",
        simulation_label=run_label,
        cluster=False,
        run_engine_after_seed=False,
    )

    return {
        "seeded_incident_ids": [
            *first["seeded_incident_ids"],
            *second["seeded_incident_ids"],
        ],
        "notes": [
            "Both incidents are seeded before a new assignment cycle is triggered",
            "Check ENGINE logs to see which incident rises first in the queue",
            "This scenario is about observing re-evaluation before pickup, not forcing a fake reroute",
        ],
    }


async def _scenario_capacity_stress(run_label: str) -> dict:
    seeded_ids: list[str] = []

    for spec in [
        ("Sampaloc II", 1, 6, ["children"]),
        ("Sampaloc II", 1, 4, []),
        ("Paliparan I", 1, 2, []),
        ("Salitran III", 1, 3, ["elderly"]),
    ]:
        barangay, count, people_count, flags = spec
        result = await seed_simulated_sos(
            barangay=barangay,
            count=count,
            people_count=people_count,
            vulnerability_flags=flags,
            message=f"[SIM][SCENARIO] Capacity stress in {barangay}",
            simulation_label=run_label,
            cluster=False,
            run_engine_after_seed=False,
        )
        seeded_ids.extend(result["seeded_incident_ids"])

    return {
        "seeded_incident_ids": seeded_ids,
        "notes": [
            "Designed to pressure capacity and trip building",
            "Check total people per trip and remaining pending incidents",
        ],
    }


async def _scenario_starvation_test(run_label: str) -> dict:
    far_old = await seed_simulated_sos(
        barangay="Langkaan I",
        count=1,
        people_count=2,
        vulnerability_flags=[],
        message="[SIM][SCENARIO] Older far-away incident",
        simulation_label=run_label,
        cluster=False,
        run_engine_after_seed=False,
    )

    near_new = await seed_simulated_sos(
        barangay="Paliparan I",
        count=1,
        people_count=1,
        vulnerability_flags=[],
        message="[SIM][SCENARIO] Newer nearby incident",
        simulation_label=run_label,
        cluster=False,
        run_engine_after_seed=False,
    )

    old_ids = far_old["seeded_incident_ids"]
    if old_ids:
        _backdate_sim_incident(old_ids[0], 46)

    return {
        "seeded_incident_ids": [
            *far_old["seeded_incident_ids"],
            *near_new["seeded_incident_ids"],
        ],
        "notes": [
            "The far-away incident is backdated by 46 minutes",
            "Check ENGINE logs and priority ordering after trigger",
        ],
    }


async def _scenario_decline_reassignment(run_label: str) -> dict:
    seeded = await seed_simulated_sos(
        barangay="Sampaloc II",
        count=1,
        people_count=3,
        vulnerability_flags=["children"],
        message="[SIM][SCENARIO] Ready-to-decline trip",
        simulation_label=run_label,
        cluster=False,
        run_engine_after_seed=False,
    )

    return {
        "seeded_incident_ids": seeded["seeded_incident_ids"],
        "notes": [
            "This scenario creates an assigned trip state",
            "After trigger, go to Trip Controls and decline the created trip",
            "That keeps the real decline lifecycle in play instead of duplicating it in the runner",
        ],
    }


async def run_scenario(scenario_id: str, mode: str = "setup_and_trigger") -> dict:
    scenario = _catalog_entry_or_raise(scenario_id)
    trace_id = new_trace_id("scenario")
    run_label = _now_label(f"scenario-{scenario_id}")

    if mode not in {"setup_only", "setup_and_trigger", "full_run"}:
        raise ValueError("mode must be setup_only, setup_and_trigger, or full_run")

    add_dev_log(
        source="SIM",
        level="INFO",
        event="scenario_start",
        message=f"Starting scenario: {scenario_id}",
        metadata={"trace_id": trace_id, "scenario_id": scenario_id, "mode": mode},
    )

    # Always reset first so every run is repeatable
    reset_result = run_dev_reset("full")

    if scenario_id == "single_clean_dispatch":
        scenario_result = await _scenario_single_clean_dispatch(run_label)
    elif scenario_id == "reroute_before_pickup":
        scenario_result = await _scenario_reroute_before_pickup(run_label)
    elif scenario_id == "capacity_stress":
        scenario_result = await _scenario_capacity_stress(run_label)
    elif scenario_id == "starvation_test":
        scenario_result = await _scenario_starvation_test(run_label)
    elif scenario_id == "decline_reassignment":
        scenario_result = await _scenario_decline_reassignment(run_label)
    else:
        raise ValueError(f"Unsupported scenario_id: {scenario_id}")

    engine_result = None
    simulation_result = None

    if mode in {"setup_and_trigger", "full_run"}:
        engine_result = await run_assignment_engine(None)

    if mode == "full_run":
        simulation_result = await auto_run_simulation(max_steps=10)

    result = {
        "trace_id": trace_id,
        "scenario_id": scenario_id,
        "mode": mode,
        "run_label": run_label,
        "reset_result": reset_result,
        "scenario_result": scenario_result,
        "engine_result": engine_result,
        "simulation_result": simulation_result,
        "full_run_note": None,
        "expected_outcomes": scenario["expected_outcomes"],
    }

    add_dev_log(
        source="SIM",
        level="INFO",
        event="scenario_complete",
        message=f"Scenario complete: {scenario_id}",
        metadata={
            "trace_id": trace_id,
            "scenario_id": scenario_id,
            "mode": mode,
            "seeded_incident_ids": scenario_result.get("seeded_incident_ids", []),
            "engine_result": engine_result,
        },
    )

    return result