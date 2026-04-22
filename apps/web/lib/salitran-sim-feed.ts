// apps/web/lib/salitran-sim-feed.ts
"use client";

export const SALITRAN_SIM_FEED_KEY = "kabayan.salitranSimFeed";

export type ClientSimFeedLevel = "INFO" | "WARNING" | "ERROR";

export interface ClientSimFeedEntry {
  id: string;
  timestamp: string;
  source: "CLIENT_SIM";
  level: ClientSimFeedLevel;
  event: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

function emitFeedChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("kabayan:salitran-feed-updated"));
}

export function readClientSimulationFeed(): ClientSimFeedEntry[] {
  if (typeof window === "undefined") return [];

  const raw = sessionStorage.getItem(SALITRAN_SIM_FEED_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ClientSimFeedEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearClientSimulationFeed() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SALITRAN_SIM_FEED_KEY, JSON.stringify([]));
  emitFeedChange();
}

export function appendClientSimulationFeed(
  entry: Omit<ClientSimFeedEntry, "id" | "timestamp" | "source">,
) {
  if (typeof window === "undefined") return;

  const current = readClientSimulationFeed();
  const next: ClientSimFeedEntry[] = [
    ...current,
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      source: "CLIENT_SIM",
      level: entry.level,
      event: entry.event,
      title: entry.title,
      message: entry.message,
      metadata: entry.metadata ?? {},
    },
  ].slice(-250);

  sessionStorage.setItem(SALITRAN_SIM_FEED_KEY, JSON.stringify(next));
  emitFeedChange();
}
