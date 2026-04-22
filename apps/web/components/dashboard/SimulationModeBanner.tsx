"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import {
  clearSalitranSimulationSession,
  readSalitranSimulationSession,
  type SalitranSimSession,
} from "../../lib/salitran-sim";

function statusVisual(status?: string) {
  switch (status) {
    case "running":
      return {
        label: "Running",
        badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
        icon: PlayCircle,
      };
    case "paused":
      return {
        label: "Paused",
        badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
        icon: PauseCircle,
      };
    case "complete":
      return {
        label: "Complete",
        badge: "bg-teal-500/10 text-teal-300 border-teal-500/20",
        icon: ShieldCheck,
      };
    case "blocked":
      return {
        label: "Blocked",
        badge: "bg-red-500/10 text-red-300 border-red-500/20",
        icon: TriangleAlert,
      };
    default:
      return {
        label: "Prepared",
        badge: "bg-violet-500/10 text-violet-200 border-violet-500/20",
        icon: PlayCircle,
      };
  }
}

export function SimulationModeBanner() {
  const router = useRouter();
  const [session, setSession] = useState<SalitranSimSession | null>(null);

  useEffect(() => {
    setSession(readSalitranSimulationSession());
  }, []);

  if (!session) return null;

  const visual = statusVisual(session.status);
  const StatusIcon = visual.icon;

  function handleExit() {
    clearSalitranSimulationSession({ clearBarangayFilter: true });
    setSession(null);
    router.refresh();
  }

  function handleBackToLauncher() {
    router.push("/dashboard/salitran-iv-sim");
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
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${visual.badge}`}
            >
              <StatusIcon className="h-3 w-3" />
              {visual.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-violet-100/80">
            <span>{session.scenarioTitle}</span>
            <span className="text-violet-300/60">•</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {session.barangay}
            </span>
            {session.runMode && (
              <>
                <span className="text-violet-300/60">•</span>
                <span>{session.runMode.replaceAll("_", " ")}</span>
              </>
            )}
            {session.speedPreset && (
              <>
                <span className="text-violet-300/60">•</span>
                <span>Speed: {session.speedPreset}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleBackToLauncher}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-950/40 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-900/50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to launcher
          </button>

          <button
            onClick={handleExit}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-950/40 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-900/50"
          >
            <XCircle className="h-4 w-4" />
            Exit sim mode
          </button>
        </div>
      </div>
    </div>
  );
}
