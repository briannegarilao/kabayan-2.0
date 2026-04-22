// apps/web/components/dev/ResponderControlPanel.tsx
"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

export function ResponderControlPanel({
  responders,
  busy,
  onSubmit,
}: {
  responders: Array<{
    id: string;
    team_name?: string | null;
    vehicle_type?: string | null;
    is_available?: boolean | null;
    current_load?: number | null;
    max_capacity?: number | null;
  }>;
  busy: string | null;
  onSubmit: (payload: {
    responder_id: string;
    is_available: boolean;
    reset_load?: boolean;
    clear_current_incident?: boolean;
    latitude?: number;
    longitude?: number;
  }) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [resetLoad, setResetLoad] = useState(true);
  const [clearIncident, setClearIncident] = useState(true);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const selectedResponder = useMemo(
    () => responders.find((r) => r.id === selectedId),
    [responders, selectedId],
  );

  async function handleApply() {
    if (!selectedId) return;

    await onSubmit({
      responder_id: selectedId,
      is_available: isAvailable,
      reset_load: resetLoad,
      clear_current_incident: clearIncident,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
    });
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-200">
          Responder Controls
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Force availability, clear load, and optionally move a responder
          manually
        </p>
      </div>

      <div className="space-y-3">
        <label className="space-y-1 block">
          <span className="text-xs text-gray-400">Select Responder</span>
          <select
            value={selectedId}
            onChange={(e) => {
              const next = e.target.value;
              setSelectedId(next);
              const responder = responders.find((r) => r.id === next);
              setIsAvailable(Boolean(responder?.is_available));
            }}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          >
            <option value="">Choose responder...</option>
            {responders.map((responder) => (
              <option key={responder.id} value={responder.id}>
                {responder.team_name || responder.id}
              </option>
            ))}
          </select>
        </label>

        {selectedResponder ? (
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3 text-xs text-gray-400">
            <p className="text-white font-medium">
              {selectedResponder.team_name}
            </p>
            <p className="mt-1">
              Vehicle: {selectedResponder.vehicle_type || "Unknown"} ·
              Availability: {String(selectedResponder.is_available)} · Load:{" "}
              {selectedResponder.current_load ?? 0}/
              {selectedResponder.max_capacity ?? 0}
            </p>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
          />
          Set responder as available
        </label>

        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={resetLoad}
            onChange={(e) => setResetLoad(e.target.checked)}
          />
          Reset current load to 0
        </label>

        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={clearIncident}
            onChange={(e) => setClearIncident(e.target.checked)}
          />
          Clear current incident assignment
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-gray-400">Latitude (optional)</span>
            <input
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-gray-400">Longitude (optional)</span>
            <input
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>

        <button
          onClick={handleApply}
          disabled={busy !== null || !selectedId}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "responder-force" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Apply Responder Override
        </button>
      </div>
    </div>
  );
}
