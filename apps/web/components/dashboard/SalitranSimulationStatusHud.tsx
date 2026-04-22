// apps/web/components/dashboard/SalitranSimulationStatusHud.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Clock3, MapPinned, ShieldCheck, Users } from "lucide-react";
import {
  getSalitranScenarioById,
  readSalitranSimulationSession,
  type SalitranSimSession,
} from "../../lib/salitran-sim";
import { getDevStateActive } from "../../lib/dev-api";

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

function formatElapsed(startedAt: string) {
  const started = new Date(startedAt).getTime();
  const now = Date.now();
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function SalitranSimulationStatusHud() {
  const [session, setSession] = useState<SalitranSimSession | null>(null);
  const [activeTripCount, setActiveTripCount] = useState(0);
  const [activeIncidentCount, setActiveIncidentCount] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const syncSession = () => setSession(readSalitranSimulationSession());
    syncSession();

    const sessionInterval = window.setInterval(syncSession, 500);
    const elapsedInterval = window.setInterval(
      () => setTick((v) => v + 1),
      1000,
    );

    return () => {
      window.clearInterval(sessionInterval);
      window.clearInterval(elapsedInterval);
    };
  }, []);

  const targetLabel = useMemo(() => {
    if (!session) return null;
    return `salitran-iv:${session.scenarioId}`;
  }, [session]);

  useEffect(() => {
    if (!session || !targetLabel) return;

    let cancelled = false;

    async function loadState() {
      const result = await getDevStateActive();
      if (cancelled) return;

      const state = result?.state ?? {};

      const activeTrips = ((state.active_trips ?? []) as SimTrip[]).filter(
        (trip) =>
          trip?.is_simulated === true && trip?.simulation_label === targetLabel,
      );

      const activeIncidents = (
        (state.active_incidents ?? []) as SimIncident[]
      ).filter(
        (incident) =>
          incident?.is_simulated === true &&
          incident?.simulation_label === targetLabel,
      );

      setActiveTripCount(activeTrips.length);
      setActiveIncidentCount(activeIncidents.length);
    }

    void loadState();
    const interval = window.setInterval(loadState, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session, targetLabel]);

  if (!session) return null;

  const scenario = getSalitranScenarioById(session.scenarioId);
  const totalPeople =
    scenario?.incidentSeeds.reduce((sum, item) => sum + item.peopleCount, 0) ??
    0;
  const totalIncidents = scenario?.incidentSeeds.length ?? 0;

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-[1100] hidden w-[280px] xl:block">
      <div className="rounded-2xl border border-violet-500/20 bg-gray-900/92 p-4 shadow-2xl backdrop-blur">
        <div className="mb-3">
          <p className="text-xs uppercase tracking-wider text-violet-300/70">
            Salitran IV Theater HUD
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {session.scenarioTitle}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-violet-300" />
              <span className="text-[11px] uppercase tracking-wider text-gray-500">
                Elapsed
              </span>
            </div>
            <p className="text-sm font-semibold text-white">
              {formatElapsed(session.startedAt)}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Activity className="h-4 w-4 text-violet-300" />
              <span className="text-[11px] uppercase tracking-wider text-gray-500">
                Status
              </span>
            </div>
            <p className="text-sm font-semibold capitalize text-white">
              {session.status ?? "prepared"}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <div className="mb-1 flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-violet-300" />
              <span className="text-[11px] uppercase tracking-wider text-gray-500">
                Incidents
              </span>
            </div>
            <p className="text-sm font-semibold text-white">
              {activeIncidentCount} / {totalIncidents}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <div className="mb-1 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-violet-300" />
              <span className="text-[11px] uppercase tracking-wider text-gray-500">
                Trips
              </span>
            </div>
            <p className="text-sm font-semibold text-white">
              {activeTripCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-300" />
              <span className="text-[11px] uppercase tracking-wider text-gray-500">
                People
              </span>
            </div>
            <p className="text-sm font-semibold text-white">{totalPeople}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Activity className="h-4 w-4 text-violet-300" />
              <span className="text-[11px] uppercase tracking-wider text-gray-500">
                Speed
              </span>
            </div>
            <p className="text-sm font-semibold text-white">
              {session.speedPreset ?? "1x"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
