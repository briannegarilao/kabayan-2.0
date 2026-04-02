# apps/api/routers/analytics.py
from fastapi import APIRouter, Depends, Query
from typing import Optional
from services.supabase_client import get_supabase

router = APIRouter()


@router.get("/latest/{model_type}")
async def get_latest_ml_result(
    model_type: str,
    supabase=Depends(get_supabase),
):
    """
    Fetch the most recent ML result for a given model type.
    Model types: arima, dbscan, apriori
    Results are pre-computed nightly by GitHub Actions (Phase 6).
    """
    if model_type not in ("arima", "dbscan", "apriori"):
        return {"error": f"Unknown model type: {model_type}. Use arima, dbscan, or apriori."}

    result = (
        supabase.table("ml_results")
        .select("model_type, result_json, computed_at, metadata")
        .eq("model_type", model_type)
        .order("computed_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )

    if not result.data:
        return {"model_type": model_type, "data": None, "message": "No results yet. ML pipeline has not run."}

    return {
        "model_type": model_type,
        "data": result.data["result_json"],
        "computed_at": result.data["computed_at"],
        "metadata": result.data.get("metadata"),
    }


@router.get("/summary")
async def get_dashboard_summary(
    supabase=Depends(get_supabase),
):
    """
    Aggregated stats for the dashboard overview.
    Returns counts of active incidents, available responders, open evac centers.
    """
    # Run all three count queries in sequence (Supabase Python client doesn't support parallel)
    incidents = (
        supabase.table("sos_incidents")
        .select("id", count="exact")
        .in_("status", ["pending", "assigned", "in_progress"])
        .execute()
    )

    responders = (
        supabase.table("responders")
        .select("id", count="exact")
        .eq("is_available", True)
        .execute()
    )

    evac = (
        supabase.table("evacuation_centers")
        .select("id", count="exact")
        .eq("is_open", True)
        .execute()
    )

    return {
        "active_incidents": incidents.count or 0,
        "available_responders": responders.count or 0,
        "open_evac_centers": evac.count or 0,
    }
