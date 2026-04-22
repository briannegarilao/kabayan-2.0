// apps/web/components/dev/DebugSnapshotPanel.tsx
"use client";

import { Copy, RefreshCcw } from "lucide-react";

export function DebugSnapshotPanel({
  snapshot,
  loading,
  onRefresh,
  onCopy,
}: {
  snapshot: any;
  loading: boolean;
  onRefresh: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-200">Debug Snapshot</h3>
          <p className="mt-1 text-xs text-gray-500">
            Copy a compact state bundle for troubleshooting
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300 transition-colors hover:bg-gray-700"
          >
            <RefreshCcw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>

          <button
            onClick={onCopy}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300 transition-colors hover:bg-gray-700"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-auto rounded-lg border border-gray-800 bg-gray-950/40 p-3">
        <pre className="text-[11px] leading-relaxed text-gray-300">
          {snapshot
            ? JSON.stringify(snapshot, null, 2)
            : "No snapshot loaded yet."}
        </pre>
      </div>
    </div>
  );
}
