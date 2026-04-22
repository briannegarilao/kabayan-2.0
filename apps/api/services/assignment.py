# apps/api/services/assignment.py
"""
PWCD Assignment Engine — Priority-Weighted Capacitated Dispatch
The brain of KABAYAN.
"""
from datetime import datetime, timezone

from services.supabase_client import get_supabase
from services.priority import compute_priority, score_all_pending
from services.candidates import find_candidates, _parse_location
from services.scoring import score_candidates
from services.trip_planner import build_trip
from services.notifications import notify_responder_assignment, notify_citizen_status_change
from services.dev_logs import add_dev_log, new_trace_id


async def run_assignment_engine(trigger_incident_id: str | None = None) -> dict:
    """
    Main entry point. Runs the full assignment cycle.

    Can be triggered by:
      - New SOS
      - Responder available / decline / timeout

    Returns summary of what was assigned.
    """
    supabase = get_supabase()
    assignments_made = []
    run_id = new_trace_id("engine")

    add_dev_log(
        source="ENGINE",
        level="INFO",
        event="engine_start",
        message="Assignment engine cycle started",
        metadata={"run_id": run_id, "trigger_incident_id": trigger_incident_id},
    )

    # Step 1: Fetch all pending incidents
    pending_result = (
        supabase.table("sos_incidents")
        .select(
            "id, status, barangay, flood_severity, flood_severity_score, "
            "message, created_at, location, people_count, priority_score, "
            "vulnerability_flags, assigned_responder_id, "
            "is_simulated, simulation_label, simulation_metadata"
        )
        .eq("status", "pending")
        .order("created_at", desc=False)
        .limit(50)
        .execute()
    )

    pending = pending_result.data if pending_result and pending_result.data else []

    add_dev_log(
        source="ENGINE",
        level="INFO",
        event="pending_fetched",
        message=f"Fetched {len(pending)} pending incident(s)",
        metadata={"run_id": run_id, "pending_count": len(pending)},
    )

    if not pending:
        add_dev_log(
            source="ENGINE",
            level="INFO",
            event="no_pending",
            message="No pending incidents",
            metadata={"run_id": run_id},
        )
        return {"assignments": [], "message": "No pending incidents"}

    # Step 2: Score all pending incidents
    scored_incidents = score_all_pending(pending)

    for inc in scored_incidents:
        try:
            supabase.table("sos_incidents").update(
                {"priority_score": inc["_priority_score"]}
            ).eq("id", inc["id"]).execute()
        except Exception as e:
            add_dev_log(
                source="ENGINE",
                level="WARNING",
                event="priority_update_failed",
                message=f"Failed to persist priority score for incident {inc['id']}",
                metadata={"run_id": run_id, "incident_id": inc["id"], "error": str(e)},
            )

    add_dev_log(
        source="ENGINE",
        level="INFO",
        event="scoring_complete",
        message="Pending incidents scored",
        metadata={
            "run_id": run_id,
            "pending_count": len(scored_incidents),
            "top_incident_id": scored_incidents[0]["id"],
            "top_barangay": scored_incidents[0]["barangay"],
            "top_priority_score": scored_incidents[0]["_priority_score"],
        },
    )

    assigned_incident_ids = set()

    for incident in scored_incidents:
        if incident["id"] in assigned_incident_ids:
            continue

        coords = _parse_location(incident.get("location"))
        if not coords:
            add_dev_log(
                source="ENGINE",
                level="WARNING",
                event="incident_skipped_invalid_location",
                message=f"Skipping incident {incident['id']} due to invalid location",
                metadata={"run_id": run_id, "incident_id": incident["id"]},
            )
            continue

        inc_lat, inc_lng = coords
        people_needed = incident.get("people_count", 1) or 1

        add_dev_log(
            source="ENGINE",
            level="INFO",
            event="incident_considered",
            message=f"Considering incident {incident['id']} in {incident['barangay']}",
            metadata={
                "run_id": run_id,
                "incident_id": incident["id"],
                "barangay": incident["barangay"],
                "people_needed": people_needed,
                "priority_score": incident.get("_priority_score"),
                "is_simulated": incident.get("is_simulated", False),
                "simulation_label": incident.get("simulation_label"),
            },
        )

        # Step 3: Find candidate responders
        candidates = find_candidates(
            incident_lat=inc_lat,
            incident_lng=inc_lng,
            incident_barangay=incident.get("barangay", ""),
            people_needed=people_needed,
        )

        if not candidates:
            add_dev_log(
                source="ENGINE",
                level="WARNING",
                event="no_candidates",
                message=f"No responders available for incident {incident['id']}",
                metadata={
                    "run_id": run_id,
                    "incident_id": incident["id"],
                    "barangay": incident["barangay"],
                    "people_needed": people_needed,
                },
            )
            continue

        nearby_count = 0
        for other in scored_incidents:
            if other["id"] == incident["id"] or other["id"] in assigned_incident_ids:
                continue
            other_coords = _parse_location(other.get("location"))
            if other_coords:
                from services.candidates import _haversine
                dist = _haversine(inc_lat, inc_lng, other_coords[0], other_coords[1])
                if dist <= 1500:
                    nearby_count += 1

        add_dev_log(
            source="ENGINE",
            level="INFO",
            event="candidates_found",
            message=f"Found {len(candidates)} candidate responder(s)",
            metadata={
                "run_id": run_id,
                "incident_id": incident["id"],
                "candidate_count": len(candidates),
                "nearby_pending_count": nearby_count,
            },
        )

        # Step 4: Score candidates
        scored_responders = await score_candidates(
            candidates=candidates,
            incident_lat=inc_lat,
            incident_lng=inc_lng,
            people_needed=people_needed,
            nearby_pending_count=nearby_count,
        )

        if not scored_responders:
            add_dev_log(
                source="ENGINE",
                level="WARNING",
                event="candidate_scoring_empty",
                message=f"Responder scoring returned no usable responders for incident {incident['id']}",
                metadata={"run_id": run_id, "incident_id": incident["id"]},
            )
            continue

        best = scored_responders[0]

        add_dev_log(
            source="ENGINE",
            level="INFO",
            event="best_responder_selected",
            message=f"Selected {best['team_name']} for incident {incident['id']}",
            metadata={
                "run_id": run_id,
                "incident_id": incident["id"],
                "responder_id": best["responder_id"],
                "team_name": best["team_name"],
                "final_score": best["final_score"],
                "travel_minutes": best["travel_minutes"],
                "remaining_capacity": best["remaining_capacity"],
            },
        )

        # Step 5: Build trip
        remaining_pending = [
            inc for inc in scored_incidents
            if inc["id"] not in assigned_incident_ids and inc["id"] != incident["id"]
        ]

        trip = build_trip(
            responder=best,
            primary_incident=incident,
            all_pending=remaining_pending,
        )

        add_dev_log(
            source="ENGINE",
            level="INFO",
            event="trip_built",
            message=f"Built trip for responder {best['team_name']}",
            metadata={
                "run_id": run_id,
                "incident_id": incident["id"],
                "pickup_count": len(trip["pickup_incident_ids"]),
                "total_people": trip["total_people"],
                "evac_center_id": trip["evac_center_id"],
                "estimated_time_minutes": trip["estimated_time_minutes"],
                "total_distance_km": trip["total_distance_km"],
            },
        )

        now = datetime.now(timezone.utc).isoformat()

        trip_id = None
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
                    "is_simulated": incident.get("is_simulated", False),
                    "simulation_label": incident.get("simulation_label"),
                    "simulation_metadata": {
                        "engine_run_id": run_id,
                        "seeded_from_incident_id": incident["id"],
                    } if incident.get("is_simulated", False) else {},
                })
                .execute()
            )
            trip_id = trip_result.data[0]["id"] if trip_result.data else None

            add_dev_log(
                source="DB",
                level="INFO",
                event="trip_inserted",
                message=f"Trip plan created for incident {incident['id']}",
                metadata={
                    "run_id": run_id,
                    "incident_id": incident["id"],
                    "trip_id": trip_id,
                    "is_simulated": incident.get("is_simulated", False),
                    "simulation_label": incident.get("simulation_label"),
                },
            )
        except Exception as e:
            add_dev_log(
                source="DB",
                level="ERROR",
                event="trip_insert_failed",
                message=f"Failed to create trip plan for incident {incident['id']}",
                metadata={"run_id": run_id, "incident_id": incident["id"], "error": str(e)},
            )

        for inc_id in trip["pickup_incident_ids"]:
            try:
                supabase.table("sos_incidents").update({
                    "assigned_responder_id": best["responder_id"],
                    "status": "assigned",
                    "assigned_at": now,
                }).eq("id", inc_id).execute()

                add_dev_log(
                    source="DB",
                    level="INFO",
                    event="incident_assigned",
                    message=f"Incident {inc_id} assigned to responder {best['responder_id']}",
                    metadata={
                        "run_id": run_id,
                        "incident_id": inc_id,
                        "responder_id": best["responder_id"],
                        "trip_id": trip_id,
                    },
                )
            except Exception as e:
                add_dev_log(
                    source="DB",
                    level="ERROR",
                    event="incident_assignment_failed",
                    message=f"Failed to update incident {inc_id}",
                    metadata={"run_id": run_id, "incident_id": inc_id, "error": str(e)},
                )

            assigned_incident_ids.add(inc_id)

        try:
            supabase.table("responders").update({
                "is_available": False,
                "current_incident_id": incident["id"],
            }).eq("id", best["responder_id"]).execute()

            add_dev_log(
                source="DB",
                level="INFO",
                event="responder_marked_busy",
                message=f"Responder {best['responder_id']} marked unavailable",
                metadata={
                    "run_id": run_id,
                    "responder_id": best["responder_id"],
                    "primary_incident_id": incident["id"],
                },
            )
        except Exception as e:
            add_dev_log(
                source="DB",
                level="ERROR",
                event="responder_update_failed",
                message=f"Failed to update responder {best['responder_id']}",
                metadata={"run_id": run_id, "responder_id": best["responder_id"], "error": str(e)},
            )

        # Notifications should not crash the engine
        try:
            await notify_responder_assignment(best["responder_id"], incident["id"])
            add_dev_log(
                source="RESPONDER",
                level="INFO",
                event="responder_assignment_notified",
                message=f"Responder notification sent for incident {incident['id']}",
                metadata={"run_id": run_id, "responder_id": best["responder_id"], "incident_id": incident["id"]},
            )
        except Exception as e:
            add_dev_log(
                source="RESPONDER",
                level="WARNING",
                event="responder_assignment_notify_failed",
                message=f"Responder notification failed for incident {incident['id']}",
                metadata={"run_id": run_id, "responder_id": best["responder_id"], "incident_id": incident["id"], "error": str(e)},
            )

        for inc_id in trip["pickup_incident_ids"]:
            try:
                await notify_citizen_status_change(inc_id, "assigned")
                add_dev_log(
                    source="SOS",
                    level="INFO",
                    event="citizen_status_notified",
                    message=f"Citizen notified that incident {inc_id} is assigned",
                    metadata={"run_id": run_id, "incident_id": inc_id},
                )
            except Exception as e:
                add_dev_log(
                    source="SOS",
                    level="WARNING",
                    event="citizen_status_notify_failed",
                    message=f"Citizen notification failed for incident {inc_id}",
                    metadata={"run_id": run_id, "incident_id": inc_id, "error": str(e)},
                )

        assignments_made.append({
            "incident_id": incident["id"],
            "responder_id": best["responder_id"],
            "responder_name": best["team_name"],
            "trip_id": trip_id,
            "pickup_count": len(trip["pickup_incident_ids"]),
            "total_people": trip["total_people"],
            "travel_minutes": best["travel_minutes"],
        })

        add_dev_log(
            source="ENGINE",
            level="INFO",
            event="assignment_completed",
            message=f"Assigned {best['team_name']} to incident {incident['id']}",
            metadata={
                "run_id": run_id,
                "incident_id": incident["id"],
                "responder_id": best["responder_id"],
                "trip_id": trip_id,
                "pickup_count": len(trip["pickup_incident_ids"]),
                "total_people": trip["total_people"],
            },
        )

    unassigned = len(scored_incidents) - len(assigned_incident_ids)
    if unassigned > 0:
        add_dev_log(
            source="ENGINE",
            level="WARNING",
            event="engine_unassigned_remaining",
            message=f"{unassigned} incident(s) remain unassigned",
            metadata={"run_id": run_id, "unassigned": unassigned},
        )

    summary = {
        "assignments": assignments_made,
        "total_pending": len(scored_incidents),
        "total_assigned": len(assignments_made),
        "unassigned": unassigned,
        "engine_run_id": run_id,
    }

    add_dev_log(
        source="ENGINE",
        level="INFO",
        event="engine_complete",
        message="Assignment engine cycle completed",
        metadata=summary,
    )

    return summary


async def auto_assign_responder(incident_id: str, lat: float, lng: float) -> None:
    """
    Called as BackgroundTask from POST /api/sos/create.
    """
    result = await run_assignment_engine(trigger_incident_id=incident_id)

    add_dev_log(
        source="ENGINE",
        level="INFO",
        event="auto_assign_complete",
        message=f"Auto-assign completed for incident {incident_id}",
        metadata={
            "incident_id": incident_id,
            "total_assigned": result["total_assigned"],
            "unassigned": result["unassigned"],
            "engine_run_id": result.get("engine_run_id"),
        },
    )