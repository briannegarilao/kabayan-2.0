// apps/web/components/dev/SimulationRunnerPanel.tsx
"use client";

import { useState } from "react";
import { Loader2, FastForward, SkipForward } from "lucide-react";

export function SimulationRunnerPanel({
  trips,
  busy,
  onAdvanceOneStep,
  onAutoRun,
}: {
  trips: Array<{
    id: string;
    responder_id?: string | null;
    simulation_label?: string | null;
    is_simulated?: boolean | null;
    status?: string | null;
  }>;
  busy: string | null;
  onAdvanceOneStep: (tripId?: string) => Promise<void>;
  onAutoRun: (payload?: {
    tripId?: string;
    maxSteps?: number;
  }) => Promise<void>;
}) {
  const [selectedTripId, setSelectedTripId] = useState("");
  const [maxSteps, setMaxSteps] = useState(10);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-200">
          Simulation Progression
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Advance an active simulated trip one lifecycle step at a time, or
          auto-run the happy path
        </p>
      </div>

      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs text-gray-400">Active Simulated Trip</span>
          <select
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          >
            <option value="">Use first active simulated trip</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.id}{" "}
                {trip.simulation_label ? `· ${trip.simulation_label}` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => onAdvanceOneStep(selectedTripId || undefined)}
            disabled={busy !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-700 disabled:opacity-50"
          >
            {busy === "sim-advance" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SkipForward className="h-4 w-4" />
            )}
            Advance One Step
          </button>

          <button
            onClick={() =>
              onAutoRun({
                tripId: selectedTripId || undefined,
                maxSteps,
              })
            }
            disabled={busy !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-fuchsia-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-fuchsia-700 disabled:opacity-50"
          >
            {busy === "sim-auto-run" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FastForward className="h-4 w-4" />
            )}
            Auto Run
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-gray-400">Max Auto Steps</span>
          <input
            type="number"
            min={1}
            max={25}
            value={maxSteps}
            onChange={(e) => setMaxSteps(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
        </label>

        <div className="rounded-lg border border-dashed border-gray-800 bg-gray-950/40 p-3 text-[11px] text-gray-500">
          Progression order: auto-accept → pickup next stop → pickup next stop →
          dropoff. This is intentionally state-based, not map-animation-based.
        </div>
      </div>
    </div>
  );
}
