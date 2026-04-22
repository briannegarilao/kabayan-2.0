// apps/web/components/dashboard/SalitranSimulationControls.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PauseCircle,
  PlayCircle,
  SkipForward,
  RefreshCw,
  RotateCcw,
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
import { appendClientSimulationFeed } from "../../lib/salitran-sim-feed";

type SimTrip = {
  id: string;
  simulation_label?: string | null;
  is_simulated?: boolean;
};

type SimIncident = {
  id: string;
  simulation_label?: string | null;
  is_simulated?: boolean;
};

const SPEED_OPTIONS: SalitranSpeedPreset[] = ["1x", "2x", "4x"];

export function SalitranSimulationControls() {
  const router = useRouter();
  const [session, setSession] = useState<SalitranSimSession | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [activeTripCount, setActiveTripCount] = useState(0);
  const [activeIncidentCount, setActiveIncidentCount] = useState(0);
  const [lastAction, setLastAction] = useState<string>("idle");
  const [statusText, setStatusText] = useState<string>("No active simulation.");
  const [speedPreset, setSpeedPreset] = useState<SalitranSpeedPreset>("1x");

  useEffect(() => {
    const sync = () => {
      const stored = readSalitranSimulationSession();
      setSession(stored);
      if (stored?.speedPreset) setSpeedPreset(stored.speedPreset);
    };

    sync();
    const interval = window.setInterval(sync, 500);
    return () => window.clearInterval(interval);
  }, []);

  const targetSimulationLabel = useMemo(() => {
    if (!session) return null;
    return `salitran-iv:${session.scenarioId}`;
  }, [session]);

  async function refreshState() {
    if (!session || !targetSimulationLabel) return null;

    const result = await getDevStateActive();
    const state = result?.state ?? {};

    const activeTrips = ((state.active_trips ?? []) as SimTrip[]).filter(
      (trip) =>
        trip?.is_simulated === true &&
        trip?.simulation_label === targetSimulationLabel,
    );

    const activeIncidents = (
      (state.active_incidents ?? []) as SimIncident[]
    ).filter(
      (incident) =>
        incident?.is_simulated === true &&
        incident?.simulation_label === targetSimulationLabel,
    );

    setActiveTripCount(activeTrips.length);
    setActiveIncidentCount(activeIncidents.length);

    if (activeTrips.length === 0 && session.status === "running") {
      updateSalitranSimulationSession({ status: "complete" });
      setStatusText("No active simulated trips left. Scenario complete.");
    }

    return { activeTrips, activeIncidents };
  }

  useEffect(() => {
    if (!session) return;
    void refreshState();

    const interval = window.setInterval(() => {
      void refreshState();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [session, targetSimulationLabel]);

  if (!session) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3">
        <p className="text-sm text-gray-400">
          No active Salitran IV simulation. Start a scenario from the launcher.
        </p>
      </div>
    );
  }

  const isRunning = session.status === "running";
  const isComplete = session.status === "complete";
  const isPaused = session.status === "paused";
  const isBlocked = session.status === "blocked";

  function handleStartOrResume() {
    updateSalitranSimulationSession({ status: "running", speedPreset });
    setStatusText(
      "Playback running. Movement is client-side and DB writes happen only at checkpoints.",
    );
    appendClientSimulationFeed({
      level: "INFO",
      event: isPaused ? "playback_resumed" : "playback_started",
      title: isPaused ? "Playback Resumed" : "Playback Started",
      message:
        "Client-side theater playback is active. Backend changes are checkpoint-based.",
    });
  }

  function handlePause() {
    updateSalitranSimulationSession({ status: "paused", speedPreset });
    setStatusText("Playback paused.");
    appendClientSimulationFeed({
      level: "INFO",
      event: "playback_paused",
      title: "Playback Paused",
      message: "Client-side movement has been paused.",
    });
  }

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet-200">
            Salitran IV Playback Controls
          </p>
          <p className="text-xs text-violet-100/75">
            {session.scenarioTitle} · polished demo theater mode
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => {
                setSpeedPreset(option);
                updateSalitranSimulationSession({ speedPreset: option });
                appendClientSimulationFeed({
                  level: "INFO",
                  event: "speed_changed",
                  title: "Playback Speed Updated",
                  message: `Simulation speed set to ${option}.`,
                });
              }}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                speedPreset === option
                  ? "bg-violet-600 text-white"
                  : "border border-violet-400/20 bg-violet-950/40 text-violet-200 hover:bg-violet-900/50"
              }`}
            >
              {option}
            </button>
          ))}

          <button
            onClick={handleStartOrResume}
            disabled={isBusy || isRunning || isComplete || isBlocked}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-950/40 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PlayCircle className="h-4 w-4" />
            {isPaused ? "Resume" : "Start"}
          </button>

          <button
            onClick={handlePause}
            disabled={!isRunning}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-950/40 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PauseCircle className="h-4 w-4" />
            Pause
          </button>

          <button
            onClick={async () => {
              if (!targetSimulationLabel) return;
              setIsBusy(true);
              try {
                const snapshot = await refreshState();
                const trip = snapshot?.activeTrips?.[0];
                if (!trip) {
                  setStatusText("No active simulated trip found.");
                  return;
                }

                const result = await postSimulationAdvance({
                  trip_id: trip.id,
                  action: "auto_step",
                });

                const action = result?.result?.action ?? "unknown";
                setLastAction(action);
                setStatusText(`Manual step executed: ${action}`);
              } finally {
                setIsBusy(false);
                await refreshState();
              }
            }}
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

          <button
            onClick={() => router.push("/dashboard/salitran-iv-sim")}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-950/40 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-900/50"
          >
            <RotateCcw className="h-4 w-4" />
            Rerun
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
          <p className="text-sm font-semibold text-white">{speedPreset}</p>
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
    </div>
  );
}
