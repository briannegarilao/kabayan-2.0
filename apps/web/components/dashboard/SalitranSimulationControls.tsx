"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PauseCircle,
  PlayCircle,
  SkipForward,
  RefreshCw,
  Rocket,
  Truck,
  MapPinned,
  ShieldCheck,
} from "lucide-react";
import {
  readSalitranSimulationSession,
  updateSalitranSimulationSession,
  type SalitranSimSession,
  type SalitranSpeedPreset,
} from "../../lib/salitran-sim";
import { getDevStateActive, postSimulationAdvance } from "../../lib/dev-api";

type SimTrip = {
  id: string;
  simulation_label?: string | null;
  is_simulated?: boolean;
  created_at?: string;
};

type SimIncident = {
  id: string;
  simulation_label?: string | null;
  is_simulated?: boolean;
};

export function SalitranSimulationControls() {
  const [session, setSession] = useState<SalitranSimSession | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [activeTripCount, setActiveTripCount] = useState(0);
  const [activeIncidentCount, setActiveIncidentCount] = useState(0);
  const [lastAction, setLastAction] = useState<string>("idle");
  const [statusText, setStatusText] = useState<string>("No active simulation.");
  const [speedPreset, setSpeedPreset] = useState<SalitranSpeedPreset>("normal");

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const stored = readSalitranSimulationSession();
    setSession(stored);

    if (stored?.speedPreset) {
      setSpeedPreset(stored.speedPreset);
    }

    if (
      stored?.runMode === "setup_and_trigger" &&
      stored?.status !== "complete"
    ) {
      setIsRunning(stored.status === "running" || stored.status === "prepared");
      setStatusText("Autoplay armed for this scenario.");
    }
  }, []);

  const tickMs = useMemo(() => {
    return speedPreset === "fast" ? 1200 : 2500;
  }, [speedPreset]);

  const targetSimulationLabel = useMemo(() => {
    if (!session) return null;
    return `salitran-iv:${session.scenarioId}`;
  }, [session]);

  async function refreshState() {
    if (!session || !targetSimulationLabel) return null;

    const result = await getDevStateActive();
    const state = result?.state ?? {};

    const activeTrips = ((state.active_trips ?? []) as SimTrip[])
      .filter(
        (trip) =>
          trip?.is_simulated === true &&
          trip?.simulation_label === targetSimulationLabel,
      )
      .sort((a, b) => {
        const aTime = new Date(a.created_at ?? 0).getTime();
        const bTime = new Date(b.created_at ?? 0).getTime();
        return aTime - bTime;
      });

    const activeIncidents = (
      (state.active_incidents ?? []) as SimIncident[]
    ).filter(
      (incident) =>
        incident?.is_simulated === true &&
        incident?.simulation_label === targetSimulationLabel,
    );

    setActiveTripCount(activeTrips.length);
    setActiveIncidentCount(activeIncidents.length);

    return {
      activeTrips,
      activeIncidents,
    };
  }

  function syncSessionPatch(patch: Partial<SalitranSimSession>) {
    const next = updateSalitranSimulationSession(patch);
    if (next) setSession(next);
  }

  async function advanceOneStep() {
    if (!session || !targetSimulationLabel || isBusy) return;

    setIsBusy(true);

    try {
      const snapshot = await refreshState();
      const trip = snapshot?.activeTrips?.[0];

      if (!trip) {
        setStatusText(
          "No active simulated trip found. Scenario appears complete.",
        );
        setLastAction("complete");
        setIsRunning(false);
        syncSessionPatch({ status: "complete", speedPreset });
        return;
      }

      const result = await postSimulationAdvance({
        trip_id: trip.id,
        action: "auto_step",
      });

      const action = result?.result?.action ?? "unknown";
      setLastAction(action);

      if (action === "accept") {
        setStatusText("Responder accepted the simulated trip.");
        syncSessionPatch({ status: "running", speedPreset });
      } else if (action === "pickup") {
        setStatusText("Responder reached the next pickup checkpoint.");
        syncSessionPatch({ status: "running", speedPreset });
      } else if (action === "dropoff") {
        setStatusText("Responder completed dropoff. Scenario complete.");
        setIsRunning(false);
        syncSessionPatch({ status: "complete", speedPreset });
      } else if (action === "blocked") {
        setStatusText(
          "Simulation step was blocked by capacity or rule checks.",
        );
        setIsRunning(false);
        syncSessionPatch({ status: "blocked", speedPreset });
      } else if (action === "noop") {
        setStatusText("No further simulated action was available.");
        setIsRunning(false);
        syncSessionPatch({ status: "complete", speedPreset });
      } else {
        setStatusText(`Last simulation action: ${action}`);
      }

      await refreshState();
    } catch (error) {
      setStatusText(
        error instanceof Error
          ? error.message
          : "Failed to advance simulation step.",
      );
      setIsRunning(false);
      syncSessionPatch({ status: "blocked", speedPreset });
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    if (!session || !isRunning) return;

    let cancelled = false;

    async function loop() {
      if (cancelled) return;
      await advanceOneStep();

      if (cancelled) return;
      timerRef.current = window.setTimeout(loop, tickMs);
    }

    timerRef.current = window.setTimeout(loop, 800);

    return () => {
      cancelled = true;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, session, tickMs]);

  useEffect(() => {
    if (!session) return;
    void refreshState();
  }, [session]);

  if (!session) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3">
        <p className="text-sm text-gray-400">
          No active Salitran IV simulation. Start a scenario from the launcher.
        </p>
      </div>
    );
  }

  const isComplete = session.status === "complete";

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet-200">
            Salitran IV Simulation Controls
          </p>
          <p className="text-xs text-violet-100/75">
            {session.scenarioTitle} · {session.runMode ?? "setup_only"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={speedPreset}
            onChange={(e) => {
              const next = e.target.value as SalitranSpeedPreset;
              setSpeedPreset(next);
              syncSessionPatch({ speedPreset: next });
            }}
            className="rounded-lg border border-violet-400/20 bg-violet-950/40 px-3 py-2 text-xs font-medium text-violet-200 outline-none"
          >
            <option value="normal">Normal speed</option>
            <option value="fast">Fast speed</option>
          </select>

          <button
            onClick={() => {
              setIsRunning(true);
              syncSessionPatch({ status: "running", speedPreset });
            }}
            disabled={isRunning || isBusy || isComplete}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-950/40 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PlayCircle className="h-4 w-4" />
            Auto play
          </button>

          <button
            onClick={() => {
              setIsRunning(false);
              syncSessionPatch({ status: "paused", speedPreset });
            }}
            disabled={!isRunning}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-950/40 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PauseCircle className="h-4 w-4" />
            Pause
          </button>

          <button
            onClick={() => void advanceOneStep()}
            disabled={isBusy || isComplete}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-950/40 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SkipForward className="h-4 w-4" />
            Step once
          </button>

          <button
            onClick={() => void refreshState()}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-950/40 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Truck className="h-4 w-4 text-violet-300" />
            <span className="text-xs uppercase tracking-wider text-gray-500">
              Active sim trips
            </span>
          </div>
          <p className="text-lg font-semibold text-white">{activeTripCount}</p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <MapPinned className="h-4 w-4 text-violet-300" />
            <span className="text-xs uppercase tracking-wider text-gray-500">
              Active sim incidents
            </span>
          </div>
          <p className="text-lg font-semibold text-white">
            {activeIncidentCount}
          </p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Rocket className="h-4 w-4 text-violet-300" />
            <span className="text-xs uppercase tracking-wider text-gray-500">
              Speed
            </span>
          </div>
          <p className="text-sm font-semibold text-white capitalize">
            {speedPreset}
          </p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-300" />
            <span className="text-xs uppercase tracking-wider text-gray-500">
              Last action
            </span>
          </div>
          <p className="text-sm font-semibold capitalize text-white">
            {lastAction.replaceAll("_", " ")}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-2">
        <p className="text-xs text-gray-300">{statusText}</p>
      </div>

      {isComplete && (
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3">
          <p className="text-sm font-semibold text-emerald-200">
            Scenario complete
          </p>
          <p className="mt-1 text-xs text-emerald-100/80">
            You can rerun from the launcher, or keep this dashboard open for
            Q&amp;A.
          </p>
        </div>
      )}
    </div>
  );
}
