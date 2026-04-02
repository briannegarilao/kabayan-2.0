# apps/api/services/assignment.py
"""
PWCD Assignment Engine — Priority-Weighted Capacitated Dispatch
The brain of KABAYAN. Replaces the Phase 1 simple nearest-responder stub.

Trigger points (Rule 1):
  - New SOS created
  - Responder becomes available (trip dropoff complete)
  - Responder declines assignment
  - Assignment timeout (3 min no accept)

Flow:
  1. Score ALL pending incidents (Rule 2)
  2. Take highest-priority incident
  3. Find candidate responders (Rule 3)
  4. Score candidates by OSRM travel time + capacity + cluster (Rule 3)
  5. Build trip plan with multi-stop clustering (Rule 4)
  6. Select evac center (Rule 6)
  7. Update DB + send push notification
  8. Repeat for remaining unassigned pending incidents with remaining responders
"""
from datetime import datetime, timezone
from services.supabase_client import get_supabase
from services.priority import compute_priority, score_all_pending
from services.candidates import find_candidates, _parse_location
from services.scoring import score_candidates
from services.trip_planner import build_trip
from services.notifications import notify_responder_assignment, notify_citizen_status_change


async def run_assignment_engine(trigger_incident_id: str | None = None) -> dict:
    """
    Main entry point. Runs the full assignment cycle.

    Can be triggered by:
      - New SOS (trigger_incident_id = the new incident's ID)
      - Responder available / decline / timeout (trigger_incident_id = None, reassess all)

    Returns summary of what was assigned.
    """
    supabase = get_supabase()
    assignments_made = []

    # --- Step 1: Fetch all pending incidents ---
    pending_result = (
        supabase.table("sos_incidents")
        .select(
            "id, status, barangay, flood_severity, flood_severity_score, "
            "message, created_at, location, people_count, priority_score, "
            "vulnerability_flags, assigned_responder_id"
        )
        .eq("status", "pending")
        .order("created_at", desc=False)  # Oldest first (before scoring)
        .limit(50)
        .execute()
    )

    pending = pending_result.data if pending_result and pending_result.data else []

    if not pending:
        print("[ENGINE] No pending incidents.")
        return {"assignments": [], "message": "No pending incidents"}

    # --- Step 2: Score all pending incidents (Rule 2) ---
    scored_incidents = score_all_pending(pending)

    # Update priority_score in DB for dashboard sorting
    for inc in scored_incidents:
        try:
            supabase.table("sos_incidents").update(
                {"priority_score": inc["_priority_score"]}
            ).eq("id", inc["id"]).execute()
        except Exception:
            pass  # Non-critical — dashboard still works without scores

    print(f"[ENGINE] {len(scored_incidents)} pending incidents scored. "
          f"Top priority: {scored_incidents[0]['barangay']} = {scored_incidents[0]['_priority_score']}")

    # --- Step 3: Assign responders to incidents (highest priority first) ---
    assigned_incident_ids = set()

    for incident in scored_incidents:
        if incident["id"] in assigned_incident_ids:
            continue

        # Extract coordinates
        coords = _parse_location(incident.get("location"))
        if not coords:
            print(f"[ENGINE] Skipping incident {incident['id']} — no valid location")
            continue

        inc_lat, inc_lng = coords
        people_needed = incident.get("people_count", 1) or 1

        # --- Find candidate responders (Rule 3) ---
        candidates = find_candidates(
            incident_lat=inc_lat,
            incident_lng=inc_lng,
            incident_barangay=incident.get("barangay", ""),
            people_needed=people_needed,
        )

        if not candidates:
            print(f"[ENGINE] No responders available for incident {incident['id']} "
                  f"({incident['barangay']}, {people_needed} people)")
            continue

        # Count nearby pending incidents for cluster bonus
        nearby_count = 0
        for other in scored_incidents:
            if other["id"] == incident["id"] or other["id"] in assigned_incident_ids:
                continue
            other_coords = _parse_location(other.get("location"))
            if other_coords:
                from services.candidates import _haversine
                dist = _haversine(inc_lat, inc_lng, other_coords[0], other_coords[1])
                if dist <= 1500:  # 1.5km cluster radius
                    nearby_count += 1

        # --- Score candidates (Rule 3 — OSRM + capacity + cluster) ---
        scored_responders = await score_candidates(
            candidates=candidates,
            incident_lat=inc_lat,
            incident_lng=inc_lng,
            people_needed=people_needed,
            nearby_pending_count=nearby_count,
        )

        if not scored_responders:
            continue

        best = scored_responders[0]
        print(f"[ENGINE] Best responder for {incident['barangay']}: "
              f"{best['team_name']} (score={best['final_score']}, "
              f"travel={best['travel_minutes']}min, "
              f"capacity={best['remaining_capacity']})")

        # --- Build trip plan (Rule 4 — multi-stop + evac) ---
        # Filter remaining pending for clustering
        remaining_pending = [
            inc for inc in scored_incidents
            if inc["id"] not in assigned_incident_ids and inc["id"] != incident["id"]
        ]

        trip = build_trip(
            responder=best,
            primary_incident=incident,
            all_pending=remaining_pending,
        )

        # --- Write to database ---
        now = datetime.now(timezone.utc).isoformat()

        # Insert trip plan
        try:
            trip_result = (
                supabase.table("trip_plans")
                .insert({
                    "responder_id": best["responder_id"],
                    "status": "active",
                    "stops": trip["stops"],
                    "evac_center_id": trip["evac_center_id"],
                    "total_distance_km": trip["total_distance_km"],
                    "estimated_time_minutes": trip["estimated_time_minutes"],
                })
                .execute()
            )
            trip_id = trip_result.data[0]["id"] if trip_result.data else None
        except Exception as e:
            print(f"[ENGINE] Failed to create trip plan: {e}")
            trip_id = None

        # Update all pickup incidents to "assigned"
        for inc_id in trip["pickup_incident_ids"]:
            try:
                supabase.table("sos_incidents").update({
                    "assigned_responder_id": best["responder_id"],
                    "status": "assigned",
                    "assigned_at": now,
                }).eq("id", inc_id).execute()
            except Exception as e:
                print(f"[ENGINE] Failed to update incident {inc_id}: {e}")

            assigned_incident_ids.add(inc_id)

        # Mark responder as on duty
        try:
            supabase.table("responders").update({
                "is_available": False,
                "current_incident_id": incident["id"],  # Primary incident
            }).eq("id", best["responder_id"]).execute()
        except Exception as e:
            print(f"[ENGINE] Failed to update responder: {e}")

        # --- Push notifications (fire and forget) ---
        await notify_responder_assignment(best["responder_id"], incident["id"])
        for inc_id in trip["pickup_incident_ids"]:
            await notify_citizen_status_change(inc_id, "assigned")

        assignments_made.append({
            "incident_id": incident["id"],
            "responder_id": best["responder_id"],
            "responder_name": best["team_name"],
            "trip_id": trip_id,
            "pickup_count": len(trip["pickup_incident_ids"]),
            "total_people": trip["total_people"],
            "travel_minutes": best["travel_minutes"],
        })

        print(f"[ENGINE] ✅ Assigned {best['team_name']} → "
              f"{incident['barangay']} ({trip['total_people']} people, "
              f"{len(trip['pickup_incident_ids'])} stops)")

    # Summary
    unassigned = len(scored_incidents) - len(assigned_incident_ids)
    if unassigned > 0:
        print(f"[ENGINE] ⚠️ {unassigned} incidents remain unassigned (no available responders)")

    return {
        "assignments": assignments_made,
        "total_pending": len(scored_incidents),
        "total_assigned": len(assignments_made),
        "unassigned": unassigned,
    }


async def auto_assign_responder(incident_id: str, lat: float, lng: float) -> None:
    """
    Called as BackgroundTask from POST /api/sos/create.
    This is the entry point the SOS router already calls.
    """
    result = await run_assignment_engine(trigger_incident_id=incident_id)
    print(f"[ENGINE] Assignment cycle complete: {result['total_assigned']} assigned, "
          f"{result['unassigned']} unassigned")
