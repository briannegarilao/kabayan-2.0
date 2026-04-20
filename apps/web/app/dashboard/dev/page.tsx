// apps/web/app/dashboard/dev/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Wrench, Building2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";

const supabase = createClient();

interface EvacSummary {
  total: number;
  open: number;
  closed: number;
}

export default function DevConsolePage() {
  const [evacSummary, setEvacSummary] = useState<EvacSummary>({ total: 0, open: 0, closed: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  async function refreshEvacSummary() {
    const [totalRes, openRes] = await Promise.all([
      supabase.from("evacuation_centers").select("id", { count: "exact", head: true }),
      supabase.from("evacuation_centers").select("id", { count: "exact", head: true }).eq("is_open", true),
    ]);
    const total = totalRes.count ?? 0;
    const open = openRes.count ?? 0;
    setEvacSummary({ total, open, closed: total - open });
  }

  useEffect(() => {
    refreshEvacSummary();
  }, []);

  async function bulkOpenAllEvacs() {
    if (!confirm("Open ALL evacuation centers? This will set is_open=true for every center.")) return;
    setBusy("open-all");
    setResult(null);

    // PostgREST update without a WHERE clause is rejected by Supabase by default.
    // We update only rows that are currently closed.
    const { error, count } = await supabase
      .from("evacuation_centers")
      .update({ is_open: true }, { count: "exact" })
      .eq("is_open", false);

    setBusy(null);

    if (error) {
      setResult({ type: "err", msg: `Failed: ${error.message}` });
      return;
    }

    setResult({ type: "ok", msg: `Opened ${count ?? "all"} previously-closed centers.` });
    refreshEvacSummary();
  }

  async function bulkCloseAllEvacs() {
    if (!confirm("Close ALL evacuation centers? This will set is_open=false and reset current_occupancy to 0 for every center.")) return;
    setBusy("close-all");
    setResult(null);

    const { error, count } = await supabase
      .from("evacuation_centers")
      .update({ is_open: false, current_occupancy: 0 }, { count: "exact" })
      .eq("is_open", true);

    setBusy(null);

    if (error) {
      setResult({ type: "err", msg: `Failed: ${error.message}` });
      return;
    }

    setResult({ type: "ok", msg: `Closed ${count ?? "all"} previously-open centers and reset occupancy.` });
    refreshEvacSummary();
  }

  async function resetAllOccupancy() {
    if (!confirm("Reset current_occupancy to 0 for ALL evacuation centers?")) return;
    setBusy("reset-occ");
    setResult(null);

    const { error, count } = await supabase
      .from("evacuation_centers")
      .update({ current_occupancy: 0 }, { count: "exact" })
      .gt("current_occupancy", 0);

    setBusy(null);

    if (error) {
      setResult({ type: "err", msg: `Failed: ${error.message}` });
      return;
    }

    setResult({ type: "ok", msg: `Reset ${count ?? "all"} centers to 0 occupancy.` });
    refreshEvacSummary();
  }

  return (
    <div className="space-y-5">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-400/10 p-4">
        <Wrench className="h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <p className="text-sm font-medium text-amber-300">Developer Console</p>
          <p className="mt-0.5 text-xs text-amber-400/80">
            Internal tools for testing and demo setup. Actions here directly modify production data.
            Use with caution during presentations.
          </p>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
            result.type === "ok"
              ? "border-emerald-500/30 bg-emerald-400/10 text-emerald-300"
              : "border-red-500/30 bg-red-400/10 text-red-300"
          }`}
        >
          {result.type === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{result.msg}</span>
        </div>
      )}

      {/* Evacuation center controls */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-teal-400" />
          <h3 className="text-sm font-medium text-gray-200">Evacuation Centers — Bulk Actions</h3>
        </div>

        {/* Current stats */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Total</p>
            <p className="mt-0.5 text-xl font-bold text-white">{evacSummary.total}</p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-400/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Open</p>
            <p className="mt-0.5 text-xl font-bold text-emerald-400">{evacSummary.open}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Closed</p>
            <p className="mt-0.5 text-xl font-bold text-gray-400">{evacSummary.closed}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            onClick={bulkOpenAllEvacs}
            disabled={busy !== null || evacSummary.closed === 0}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === "open-all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Open ALL Centers
          </button>

          <button
            onClick={bulkCloseAllEvacs}
            disabled={busy !== null || evacSummary.open === 0}
            className="flex items-center justify-center gap-2 rounded-lg bg-gray-700 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === "close-all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Close ALL Centers
          </button>

          <button
            onClick={resetAllOccupancy}
            disabled={busy !== null}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === "reset-occ" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Reset Occupancy
          </button>
        </div>

        <p className="mt-3 text-[10px] text-gray-600">
          Closing a center also resets its current_occupancy to 0. Real-time subscriptions on the
          Evacuation page will pick up these changes automatically.
        </p>
      </div>

      {/* Placeholder for future tools */}
      <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/30 p-5">
        <h3 className="text-sm font-medium text-gray-400">More tools coming soon</h3>
        <ul className="mt-2 space-y-1 text-xs text-gray-600">
          <li>• Seed synthetic SOS incidents for demo</li>
          <li>• Simulate responder movement along OSRM routes</li>
          <li>• Bulk-reset trip plans</li>
          <li>• Force-trigger ML pipelines</li>
          <li>• Toggle all responders available/unavailable</li>
        </ul>
      </div>
    </div>
  );
}
