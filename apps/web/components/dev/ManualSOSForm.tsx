// apps/web/components/dev/ManualSOSForm.tsx
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

const DEFAULT_FORM = {
  barangay: "Salitran III",
  count: 1,
  people_count: 1,
  vulnerability_flags: "",
  message: "[SIM] Manual SOS from Dev Console",
  latitude: "",
  longitude: "",
  simulation_label: "manual-form-seed",
  cluster: false,
};

export function ManualSOSForm({
  busy,
  onSubmit,
}: {
  busy: string | null;
  onSubmit: (payload: {
    barangay: string;
    count: number;
    people_count: number;
    vulnerability_flags: string[];
    message?: string;
    latitude?: number;
    longitude?: number;
    simulation_label?: string;
    cluster?: boolean;
    run_engine_after_seed?: boolean;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState(DEFAULT_FORM);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const vulnerabilityFlags = form.vulnerability_flags
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    await onSubmit({
      barangay: form.barangay,
      count: Number(form.count),
      people_count: Number(form.people_count),
      vulnerability_flags: vulnerabilityFlags,
      message: form.message || undefined,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      simulation_label: form.simulation_label || undefined,
      cluster: form.cluster,
      run_engine_after_seed: true,
    });
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-200">
          Manual SOS Creator
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Create custom simulated incidents without touching Supabase manually
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <label className="space-y-1">
          <span className="text-xs text-gray-400">Barangay</span>
          <input
            value={form.barangay}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, barangay: e.target.value }))
            }
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-gray-400">Count</span>
          <input
            type="number"
            min={1}
            max={20}
            value={form.count}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, count: Number(e.target.value) }))
            }
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-gray-400">People Count</span>
          <input
            type="number"
            min={1}
            max={50}
            value={form.people_count}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                people_count: Number(e.target.value),
              }))
            }
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-gray-400">Simulation Label</span>
          <input
            value={form.simulation_label}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, simulation_label: e.target.value }))
            }
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-gray-400">
            Vulnerability Flags (comma-separated)
          </span>
          <input
            value={form.vulnerability_flags}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                vulnerability_flags: e.target.value,
              }))
            }
            placeholder="children, elderly, disabled"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-gray-400">Message</span>
          <textarea
            value={form.message}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, message: e.target.value }))
            }
            rows={3}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-gray-400">Latitude (optional)</span>
          <input
            value={form.latitude}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, latitude: e.target.value }))
            }
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-gray-400">Longitude (optional)</span>
          <input
            value={form.longitude}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, longitude: e.target.value }))
            }
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="sm:col-span-2 flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={form.cluster}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, cluster: e.target.checked }))
            }
          />
          Cluster the seeded incidents around the target point/barangay
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "manual-sos" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Create Manual SOS
          </button>
        </div>
      </form>
    </div>
  );
}
