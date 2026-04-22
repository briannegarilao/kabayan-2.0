// apps/web/components/dev/DatabaseControlPanel.tsx
import { Building2, Database, Loader2 } from "lucide-react";

interface EvacSummary {
  total: number;
  open: number;
  closed: number;
}

export function DatabaseControlPanel({
  evacSummary,
  busy,
  onSoftReset,
  onFullReset,
  onOpenAllEvacs,
  onCloseAllEvacs,
  onResetOccupancy,
}: {
  evacSummary: EvacSummary;
  busy: string | null;
  onSoftReset: () => void;
  onFullReset: () => void;
  onOpenAllEvacs: () => void;
  onCloseAllEvacs: () => void;
  onResetOccupancy: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-medium text-gray-200">
            Environment Reset
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={onSoftReset}
            disabled={busy !== null}
            className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "soft-reset" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Soft Reset
          </button>

          <button
            onClick={onFullReset}
            disabled={busy !== null}
            className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "full-reset" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Full Reset
          </button>
        </div>

        <p className="mt-3 text-[11px] text-gray-500">
          Soft reset preserves simulation history but resolves active simulated
          state. Full reset removes simulated rows and returns the environment
          to a cleaner baseline.
        </p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-teal-400" />
          <h3 className="text-sm font-medium text-gray-200">
            Evacuation Centers — Bulk Actions
          </h3>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">
              Total
            </p>
            <p className="mt-1 text-xl font-bold text-white">
              {evacSummary.total}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-400/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">
              Open
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-400">
              {evacSummary.open}
            </p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">
              Closed
            </p>
            <p className="mt-1 text-xl font-bold text-gray-400">
              {evacSummary.closed}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            onClick={onOpenAllEvacs}
            disabled={busy !== null || evacSummary.closed === 0}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "open-all" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Open ALL Centers
          </button>

          <button
            onClick={onCloseAllEvacs}
            disabled={busy !== null || evacSummary.open === 0}
            className="flex items-center justify-center gap-2 rounded-lg bg-gray-700 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "close-all" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Close ALL Centers
          </button>

          <button
            onClick={onResetOccupancy}
            disabled={busy !== null}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "reset-occ" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Reset Occupancy
          </button>
        </div>

        <p className="mt-3 text-[10px] text-gray-600">
          These still use your current direct Supabase mutation flow for
          evacuation centers. They stay here for continuity until later backend
          consolidation.
        </p>
      </div>
    </div>
  );
}
