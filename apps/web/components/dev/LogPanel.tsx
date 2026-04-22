// apps/web/components/dev/LogPanel.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PauseCircle, PlayCircle, Trash2, Activity } from "lucide-react";

export type DevUILog = {
  id: string;
  timestamp: string;
  source: string;
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type LogFilter = "ALL" | "ENGINE" | "REALTIME" | "SIM" | "DB" | "ERRORS";

const FILTERS: LogFilter[] = [
  "ALL",
  "ENGINE",
  "REALTIME",
  "SIM",
  "DB",
  "ERRORS",
];

function levelClasses(level: DevUILog["level"]) {
  switch (level) {
    case "ERROR":
      return "border-red-500/20 bg-red-500/5 text-red-300";
    case "WARNING":
      return "border-amber-500/20 bg-amber-500/5 text-amber-300";
    case "INFO":
      return "border-gray-800 bg-gray-950/50 text-gray-200";
    default:
      return "border-gray-800 bg-gray-950/50 text-gray-400";
  }
}

export function LogPanel({
  logs,
  filter,
  setFilter,
  paused,
  onTogglePaused,
  onClearLocal,
}: {
  logs: DevUILog[];
  filter: LogFilter;
  setFilter: (next: LogFilter) => void;
  paused: boolean;
  onTogglePaused: () => void;
  onClearLocal: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  const filteredLogs = useMemo(() => {
    if (filter === "ALL") return logs;
    if (filter === "ERRORS") {
      return logs.filter(
        (log) => log.level === "ERROR" || log.level === "WARNING",
      );
    }
    return logs.filter((log) => log.source === filter);
  }, [logs, filter]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !stickToBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [filteredLogs, stickToBottom]);

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distanceFromBottom < 80);
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-200">Live Monitoring</h3>
          <p className="mt-1 text-xs text-gray-500">
            Combined backend logs and Supabase realtime events
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onTogglePaused}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300 transition-colors hover:bg-gray-700"
          >
            {paused ? (
              <>
                <PlayCircle className="h-3.5 w-3.5" />
                Resume
              </>
            ) : (
              <>
                <PauseCircle className="h-3.5 w-3.5" />
                Pause
              </>
            )}
          </button>

          <button
            onClick={onClearLocal}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300 transition-colors hover:bg-gray-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Local View
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const active = item === filter;
          return (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex items-center justify-between text-[11px] text-gray-500">
        <div className="inline-flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" />
          <span>{filteredLogs.length} visible log(s)</span>
        </div>
        <span>{paused ? "Polling paused" : "Polling live"}</span>
      </div>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="max-h-[520px] space-y-2 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950/40 p-3"
      >
        {filteredLogs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-800 p-4 text-sm text-gray-500">
            No logs yet for this filter.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={`${log.id}_${log.timestamp}`}
              className={`rounded-lg border p-3 text-xs ${levelClasses(log.level)}`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-semibold">{log.source}</span>
                <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px]">
                  {log.level}
                </span>
                <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px]">
                  {log.event}
                </span>
                <span className="ml-auto text-[10px] opacity-70">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <p className="leading-relaxed">{log.message}</p>

              {log.metadata && Object.keys(log.metadata).length > 0 ? (
                <pre className="mt-2 overflow-x-auto rounded bg-black/20 p-2 text-[10px] opacity-80">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>

      <p className="mt-3 text-[10px] text-gray-600">
        “Clear Local View” only clears the browser-side combined log list. It
        does not delete backend logs or database records.
      </p>
    </div>
  );
}
