// apps/web/components/dev/BackendStatusPanel.tsx
import { ShieldCheck, ShieldAlert, RefreshCcw } from "lucide-react";

interface BackendHealth {
  enabled: boolean;
  app_env: string;
  dev_console_enabled: boolean;
  dev_console_admin_enabled: boolean;
  service: string;
  version: string;
}

export function BackendStatusPanel({
  health,
  loading,
  onRefresh,
}: {
  health: BackendHealth | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const healthy = Boolean(health?.enabled);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-200">Backend Status</h3>
          <p className="mt-1 text-xs text-gray-500">
            FastAPI Dev Router connectivity and environment state
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-50"
        >
          <RefreshCcw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {!health ? (
        <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 text-sm text-gray-500">
          Backend health not loaded yet.
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
              healthy
                ? "border-emerald-500/20 bg-emerald-400/5 text-emerald-300"
                : "border-red-500/20 bg-red-500/5 text-red-300"
            }`}
          >
            {healthy ? (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
              <p className="font-medium">{health.service}</p>
              <p className="mt-1 text-xs opacity-80">
                Version: {health.version} · Env: {health.app_env}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
              <p className="text-gray-500">Dev Console Enabled</p>
              <p className="mt-1 font-semibold text-white">
                {String(health.dev_console_enabled)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
              <p className="text-gray-500">Admin Override</p>
              <p className="mt-1 font-semibold text-white">
                {String(health.dev_console_admin_enabled)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
