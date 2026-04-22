// apps/web/components/dashboard/FloatingSimulationLogPanel.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Minimize2,
  Maximize2,
  Route,
  Truck,
  Wrench,
  XCircle,
} from "lucide-react";
import { getDevLogs } from "../../lib/dev-api";
import {
  readSalitranSimulationSession,
  type SalitranSimSession,
} from "../../lib/salitran-sim";

type DevLogEntry = {
  timestamp: string;
  source:
    | "SYSTEM"
    | "ENGINE"
    | "SOS"
    | "RESPONDER"
    | "SIM"
    | "DB"
    | "REALTIME"
    | "DEV";
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  event: string;
  message: string;
  metadata: Record<string, any>;
};

function getLogVisual(log: DevLogEntry) {
  if (log.level === "ERROR") {
    return {
      icon: XCircle,
      accent: "border-red-500/30 bg-red-500/10 text-red-200",
      iconColor: "text-red-300",
      title: "Simulation Error",
    };
  }

  if (log.event === "seed_sos") {
    return {
      icon: AlertTriangle,
      accent: "border-red-500/20 bg-red-500/10 text-red-100",
      iconColor: "text-red-300",
      title: "Incident Submitted",
    };
  }

  if (log.source === "ENGINE") {
    return {
      icon: Cpu,
      accent: "border-blue-500/20 bg-blue-500/10 text-blue-100",
      iconColor: "text-blue-300",
      title: "Engine Decision",
    };
  }

  if (log.event === "force_status") {
    return {
      icon: Truck,
      accent: "border-amber-500/20 bg-amber-500/10 text-amber-100",
      iconColor: "text-amber-300",
      title: "Responder Positioned",
    };
  }

  if (log.event === "simulation_accept") {
    return {
      icon: Route,
      accent: "border-violet-500/20 bg-violet-500/10 text-violet-100",
      iconColor: "text-violet-300",
      title: "Responder Accepted Trip",
    };
  }

  if (log.event === "simulation_pickup") {
    return {
      icon: Truck,
      accent: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
      iconColor: "text-emerald-300",
      title: "Pickup Complete",
    };
  }

  if (log.event === "simulation_dropoff") {
    return {
      icon: CheckCircle2,
      accent: "border-teal-500/20 bg-teal-500/10 text-teal-100",
      iconColor: "text-teal-300",
      title: "Dropoff Complete",
    };
  }

  if (log.source === "DEV") {
    return {
      icon: Wrench,
      accent: "border-slate-500/20 bg-slate-500/10 text-slate-100",
      iconColor: "text-slate-300",
      title: "Simulation System",
    };
  }

  return {
    icon: Route,
    accent: "border-violet-500/20 bg-violet-500/10 text-violet-100",
    iconColor: "text-violet-300",
    title: log.event.replaceAll("_", " "),
  };
}

export function FloatingSimulationLogPanel() {
  const [session, setSession] = useState<SalitranSimSession | null>(null);
  const [logs, setLogs] = useState<DevLogEntry[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSession(readSalitranSimulationSession());
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    async function loadLogs() {
      try {
        const res = await getDevLogs({ n: 200 });
        if (cancelled) return;
        setLogs((res?.logs ?? []) as DevLogEntry[]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadLogs();
    const interval = window.setInterval(loadLogs, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session]);

  const filteredLogs = useMemo(() => {
    if (!session) return [];

    const startedAt = new Date(session.startedAt).getTime();
    const allowedSources = new Set(["SIM", "ENGINE", "RESPONDER", "DEV"]);

    return logs.filter((log) => {
      const time = new Date(log.timestamp).getTime();
      return time >= startedAt && allowedSources.has(log.source);
    });
  }, [logs, session]);

  useEffect(() => {
    if (!scrollRef.current || collapsed) return;
    const el = scrollRef.current;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 80) {
      el.scrollTop = el.scrollHeight;
    }
  }, [filteredLogs, collapsed]);

  if (!session) return null;

  if (collapsed) {
    return (
      <div className="absolute right-4 top-4 z-[1200] hidden xl:block">
        <button
          onClick={() => setCollapsed(false)}
          className="inline-flex items-center gap-2 rounded-xl border border-violet-500/20 bg-gray-900/95 px-3 py-2 text-xs font-medium text-violet-200 shadow-2xl backdrop-blur"
        >
          <Maximize2 className="h-4 w-4" />
          Show sim log
        </button>
      </div>
    );
  }

  return (
    <div className="absolute right-4 top-4 bottom-4 z-[1200] hidden w-[360px] xl:flex">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-violet-500/20 bg-gray-900/96 shadow-2xl backdrop-blur">
        <div className="border-b border-gray-800 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-violet-200">
                Live Simulation Feed
              </p>
              <p className="text-[11px] text-violet-100/70">
                {session.scenarioTitle}
              </p>
            </div>

            <button
              onClick={() => setCollapsed(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-950/70 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-800"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Hide
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2">
              <p className="text-gray-500">Entries</p>
              <p className="mt-1 font-semibold text-white">
                {filteredLogs.length}
              </p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2">
              <p className="text-gray-500">Started</p>
              <p className="mt-1 font-semibold text-white">
                {new Date(session.startedAt).toLocaleTimeString("en-PH", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          {isLoading ? (
            <div className="rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3 text-sm text-gray-400">
              Loading simulation logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3 text-sm text-gray-400">
              No simulation log entries yet.
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const visual = getLogVisual(log);
              const Icon = visual.icon;

              return (
                <div
                  key={`${log.timestamp}-${log.event}-${index}`}
                  className={`rounded-xl border px-3 py-3 ${visual.accent}`}
                >
                  <div className="mb-2 flex items-start gap-3">
                    <div
                      className={`mt-0.5 rounded-lg border border-white/10 bg-black/10 p-2 ${visual.iconColor}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">
                          {visual.title}
                        </p>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/70">
                          {log.source}
                        </span>
                      </div>

                      <p className="mt-1 text-[11px] text-white/60">
                        {new Date(log.timestamp).toLocaleTimeString("en-PH", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true,
                        })}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-white/90">{log.message}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
