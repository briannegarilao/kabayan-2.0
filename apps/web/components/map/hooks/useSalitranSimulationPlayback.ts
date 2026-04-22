// apps/web/components/map/hooks/useSalitranSimulationPlayback.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseLocation } from "../../../lib/types";
import {
  readSalitranSimulationSession,
  updateSalitranSimulationSession,
  type SalitranSimSession,
} from "../../../lib/salitran-sim";
import { appendClientSimulationFeed } from "../../../lib/salitran-sim-feed";
import {
  buildRoutePoints,
  buildStopAnchors,
  cumulativeMeters,
  interpolateAlong,
  type LatLng,
} from "../../../lib/salitran-motion";
import { postSimulationAdvance } from "../../../lib/dev-api";
import type { Responder, TripPlan } from "../types";

type MotionPhase = "needs_accept" | "moving" | "committing" | "complete";

interface MotionState {
  tripId: string;
  responderId: string;
  points: LatLng[];
  cumulative: number[];
  stopAnchors: number[];
  stopCursor: number;
  progressMeters: number;
  targetMeters: number;
  phase: MotionPhase;
  lastTickAt: number;
}

const SPEED_BY_PRESET: Record<string, number> = {
  normal: 14,
  fast: 24,
};

export function useSalitranSimulationPlayback(params: {
  activeTrips: TripPlan[];
  responders: Responder[];
}) {
  const { activeTrips, responders } = params;

  const [session, setSession] = useState<SalitranSimSession | null>(null);
  const [, setFrame] = useState(0);

  const motionRef = useRef<Map<string, MotionState>>(new Map());
  const busyTripsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const sync = () => setSession(readSalitranSimulationSession());
    sync();

    const interval = window.setInterval(sync, 500);
    return () => window.clearInterval(interval);
  }, []);

  const targetLabel = useMemo(() => {
    if (!session) return null;
    return `salitran-iv:${session.scenarioId}`;
  }, [session]);

  useEffect(() => {
    if (!session || !targetLabel) {
      motionRef.current.clear();
      setFrame((v) => v + 1);
      return;
    }

    const relevantTrips = activeTrips.filter(
      (trip) =>
        trip.is_simulated === true && trip.simulation_label === targetLabel,
    );

    const nextIds = new Set(relevantTrips.map((trip) => trip.id));

    for (const existingId of Array.from(motionRef.current.keys())) {
      if (!nextIds.has(existingId)) {
        motionRef.current.delete(existingId);
      }
    }

    for (const trip of relevantTrips) {
      if (motionRef.current.has(trip.id)) continue;

      const responder = responders.find((r) => r.id === trip.responder_id);
      const routePoints = buildRoutePoints(trip, responder?.current_location);
      const stopAnchors = buildStopAnchors(routePoints, trip);

      if (routePoints.length < 2 || stopAnchors.length === 0) continue;

      const cumulative = cumulativeMeters(routePoints);

      motionRef.current.set(trip.id, {
        tripId: trip.id,
        responderId: trip.responder_id,
        points: routePoints,
        cumulative,
        stopAnchors,
        stopCursor: 0,
        progressMeters: 0,
        targetMeters: cumulative[stopAnchors[0]] ?? 0,
        phase: "needs_accept",
        lastTickAt: Date.now(),
      });

      appendClientSimulationFeed({
        level: "INFO",
        event: "motion_armed",
        title: "Responder Armed",
        message: `Motion engine armed for responder ${trip.responder_id}.`,
        metadata: { trip_id: trip.id },
      });
    }

    setFrame((v) => v + 1);
  }, [activeTrips, responders, session, targetLabel]);

  useEffect(() => {
    if (!session || session.status !== "running") return;

    let cancelled = false;

    async function acceptTrip(motion: MotionState) {
      if (busyTripsRef.current.has(motion.tripId)) return;
      busyTripsRef.current.add(motion.tripId);

      try {
        const result = await postSimulationAdvance({
          trip_id: motion.tripId,
          action: "auto_step",
        });

        const action = result?.result?.action ?? "unknown";

        if (action === "accept" || action === "pickup") {
          const fresh = motionRef.current.get(motion.tripId);
          if (!fresh) return;

          fresh.phase = "moving";
          fresh.lastTickAt = Date.now();

          appendClientSimulationFeed({
            level: "INFO",
            event: "movement_start",
            title: "Responder Moving",
            message: `Responder ${fresh.responderId} is now moving along the route.`,
            metadata: {
              trip_id: fresh.tripId,
              responder_id: fresh.responderId,
            },
          });
        } else if (action === "dropoff" || action === "noop") {
          motionRef.current.delete(motion.tripId);
          appendClientSimulationFeed({
            level: "INFO",
            event: "scenario_trip_complete",
            title: "Scenario Complete",
            message: `Trip ${motion.tripId} completed before movement started.`,
            metadata: { trip_id: motion.tripId },
          });
        } else if (action === "blocked") {
          updateSalitranSimulationSession({ status: "blocked" });
          appendClientSimulationFeed({
            level: "WARNING",
            event: "movement_blocked",
            title: "Movement Blocked",
            message: `Trip ${motion.tripId} was blocked by rule checks.`,
            metadata: { trip_id: motion.tripId },
          });
        }
      } catch (error) {
        updateSalitranSimulationSession({ status: "blocked" });
        appendClientSimulationFeed({
          level: "ERROR",
          event: "movement_error",
          title: "Movement Error",
          message:
            error instanceof Error ? error.message : "Failed to accept trip.",
          metadata: { trip_id: motion.tripId },
        });
      } finally {
        busyTripsRef.current.delete(motion.tripId);
        setFrame((v) => v + 1);
      }
    }

    async function commitCheckpoint(motion: MotionState) {
      if (busyTripsRef.current.has(motion.tripId)) return;
      busyTripsRef.current.add(motion.tripId);

      try {
        const result = await postSimulationAdvance({
          trip_id: motion.tripId,
          action: "auto_step",
        });

        const action = result?.result?.action ?? "unknown";
        const fresh = motionRef.current.get(motion.tripId);

        if (!fresh) return;

        if (action === "pickup") {
          appendClientSimulationFeed({
            level: "INFO",
            event: "simulation_pickup_client",
            title: "Pickup Complete",
            message: `Responder ${fresh.responderId} reached checkpoint ${
              fresh.stopCursor + 1
            }.`,
            metadata: {
              trip_id: fresh.tripId,
              responder_id: fresh.responderId,
              checkpoint_index: fresh.stopCursor,
            },
          });

          fresh.stopCursor += 1;

          if (fresh.stopCursor < fresh.stopAnchors.length) {
            fresh.targetMeters =
              fresh.cumulative[fresh.stopAnchors[fresh.stopCursor]] ??
              fresh.progressMeters;
            fresh.phase = "moving";
            fresh.lastTickAt = Date.now();

            appendClientSimulationFeed({
              level: "INFO",
              event: "movement_resume",
              title: "Responder Moving",
              message: `Responder ${fresh.responderId} continued to the next checkpoint.`,
              metadata: {
                trip_id: fresh.tripId,
                responder_id: fresh.responderId,
              },
            });
          } else {
            fresh.phase = "complete";
          }
        } else if (action === "dropoff") {
          motionRef.current.delete(motion.tripId);

          appendClientSimulationFeed({
            level: "INFO",
            event: "simulation_dropoff_client",
            title: "Dropoff Complete",
            message: `Responder ${motion.responderId} completed the final dropoff.`,
            metadata: {
              trip_id: motion.tripId,
              responder_id: motion.responderId,
            },
          });

          const stillActive = activeTrips.some(
            (trip) =>
              trip.id !== motion.tripId &&
              trip.is_simulated === true &&
              trip.simulation_label === targetLabel,
          );

          if (!stillActive) {
            updateSalitranSimulationSession({ status: "complete" });
          }
        } else if (action === "blocked") {
          fresh.phase = "complete";
          updateSalitranSimulationSession({ status: "blocked" });

          appendClientSimulationFeed({
            level: "WARNING",
            event: "movement_blocked",
            title: "Movement Blocked",
            message: `Checkpoint commit for ${motion.responderId} was blocked.`,
            metadata: {
              trip_id: motion.tripId,
              responder_id: motion.responderId,
            },
          });
        } else if (action === "noop") {
          motionRef.current.delete(motion.tripId);
          updateSalitranSimulationSession({ status: "complete" });
        } else {
          fresh.phase = "moving";
          fresh.lastTickAt = Date.now();
        }
      } catch (error) {
        updateSalitranSimulationSession({ status: "blocked" });
        appendClientSimulationFeed({
          level: "ERROR",
          event: "movement_error",
          title: "Movement Error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to commit checkpoint.",
          metadata: { trip_id: motion.tripId },
        });
      } finally {
        busyTripsRef.current.delete(motion.tripId);
        setFrame((v) => v + 1);
      }
    }

    const interval = window.setInterval(() => {
      if (cancelled) return;

      const speedMps = SPEED_BY_PRESET[session.speedPreset ?? "normal"] ?? 14;
      const now = Date.now();

      for (const motion of motionRef.current.values()) {
        if (motion.phase === "complete") continue;

        if (motion.phase === "needs_accept") {
          void acceptTrip(motion);
          continue;
        }

        if (motion.phase !== "moving") continue;

        const dtSeconds = Math.max(0, (now - motion.lastTickAt) / 1000);
        motion.lastTickAt = now;
        motion.progressMeters = Math.min(
          motion.progressMeters + speedMps * dtSeconds,
          motion.targetMeters,
        );

        if (motion.progressMeters >= motion.targetMeters - 0.5) {
          motion.progressMeters = motion.targetMeters;
          motion.phase = "committing";
          void commitCheckpoint(motion);
        }
      }

      setFrame((v) => v + 1);
    }, 250);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session, activeTrips, targetLabel]);

  const displayResponders = useMemo(() => {
    if (!session || !targetLabel) return responders;

    const motions = motionRef.current;

    return responders.map((responder) => {
      const motion = Array.from(motions.values()).find(
        (m) =>
          m.responderId === responder.id &&
          (m.phase === "moving" || m.phase === "committing"),
      );

      if (!motion) return responder;

      const coords = interpolateAlong(
        motion.points,
        motion.cumulative,
        motion.progressMeters,
      );

      return {
        ...responder,
        current_location: {
          type: "Point",
          coordinates: [coords[1], coords[0]],
        },
      };
    });
  }, [responders, session, targetLabel]);

  return {
    displayResponders,
    isPlaybackActive: session?.status === "running",
  };
}
