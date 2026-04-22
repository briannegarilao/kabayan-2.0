// apps/web/components/dashboard/SalitranSimulationSummaryCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  getSalitranScenarioById,
  readSalitranSimulationSession,
  type SalitranSimSession,
} from "../../lib/salitran-sim";
import { readClientSimulationFeed } from "../../lib/salitran-sim-feed";

export function SalitranSimulationSummaryCard() {
  const router = useRouter();
  const [session, setSession] = useState<SalitranSimSession | null>(null);

  useEffect(() => {
    const sync = () => setSession(readSalitranSimulationSession());
    sync();
    const interval = window.setInterval(sync, 500);
    return () => window.clearInterval(interval);
  }, []);

  const summary = useMemo(() => {
    if (!session) return null;
    const scenario = getSalitranScenarioById(session.scenarioId);
    if (!scenario) return null;

    const feed = readClientSimulationFeed();

    const peopleMoved = scenario.incidentSeeds.reduce(
      (sum, item) => sum + item.peopleCount,
      0,
    );

    const respondersUsed = new Set(
      feed
        .map((item) => item.metadata?.responder_id)
        .filter((value) => typeof value === "string"),
    ).size;

    const pickupCount = feed.filter((item) =>
      item.event.includes("pickup"),
    ).length;

    const dropoffCount = feed.filter((item) =>
      item.event.includes("dropoff"),
    ).length;

    const blockedCount = feed.filter((item) =>
      item.event.includes("blocked"),
    ).length;

    return {
      scenario,
      peopleMoved,
      respondersUsed,
      pickupCount,
      dropoffCount,
      blockedCount,
    };
  }, [session]);

  if (!session || !summary) return null;
  if (session.status !== "complete" && session.status !== "blocked")
    return null;

  const isBlocked = session.status === "blocked";

  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        isBlocked
          ? "border-red-500/20 bg-red-500/10"
          : "border-emerald-500/20 bg-emerald-500/10"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        {isBlocked ? (
          <TriangleAlert className="h-5 w-5 text-red-300" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
        )}
        <h2 className="text-base font-semibold text-white">
          {isBlocked ? "Simulation ended with a block" : "Simulation summary"}
        </h2>
      </div>

      <p className="mb-4 text-sm text-gray-200">
        {summary.scenario.title} is now in a presentation-safe state for replay,
        explanation, and panel Q&amp;A.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">
            Incidents
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {summary.scenario.incidentSeeds.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">
            People moved
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {summary.peopleMoved}
          </p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">
            Responders used
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {summary.respondersUsed || session.stagedResponderIds?.length || 0}
          </p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">
            Pickups
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {summary.pickupCount}
          </p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">
            Dropoffs
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {summary.dropoffCount}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => router.push("/dashboard/salitran-iv-sim")}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
        >
          <RotateCcw className="h-4 w-4" />
          Back to launcher
        </button>

        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800"
        >
          <Sparkles className="h-4 w-4" />
          Stay on dashboard
        </button>

        {!isBlocked && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            <Users className="h-4 w-4" />
            Capacity warnings: {summary.blockedCount}
          </div>
        )}
      </div>
    </div>
  );
}
