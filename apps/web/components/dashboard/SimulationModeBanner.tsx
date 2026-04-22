"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, MapPin, XCircle } from "lucide-react";
import {
  clearSalitranSimulationSession,
  readSalitranSimulationSession,
  type SalitranSimSession,
} from "../../lib/salitran-sim";

export function SimulationModeBanner() {
  const router = useRouter();
  const [session, setSession] = useState<SalitranSimSession | null>(null);

  useEffect(() => {
    setSession(readSalitranSimulationSession());
  }, []);

  if (!session) return null;

  function handleExit() {
    clearSalitranSimulationSession({ clearBarangayFilter: true });
    setSession(null);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-violet-300" />
            <span className="text-sm font-semibold text-violet-200">
              Salitran IV Simulation Mode
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-violet-100/80">
            <span>{session.scenarioTitle}</span>
            <span className="text-violet-300/60">•</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {session.barangay}
            </span>
          </div>
        </div>

        <button
          onClick={handleExit}
          className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-950/40 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-900/50"
        >
          <XCircle className="h-4 w-4" />
          Exit sim mode
        </button>
      </div>
    </div>
  );
}
