// apps/web/components/dev/OperationalSafetyPanel.tsx
"use client";

export function OperationalSafetyPanel({
  appEnv,
  devEnabled,
}: {
  appEnv?: string;
  devEnabled?: boolean;
}) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
      <div>
        <h3 className="text-sm font-medium text-amber-300">
          Operational Safety
        </h3>
        <p className="mt-1 text-xs text-amber-400/80">
          Internal tooling for simulation, testing, and demo runs.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-amber-500/10 bg-black/10 p-3 text-xs text-amber-100/90">
          <p className="font-medium">Environment</p>
          <p className="mt-1">APP_ENV: {appEnv ?? "unknown"}</p>
          <p>Dev Console Enabled: {String(devEnabled ?? false)}</p>
        </div>

        <div className="rounded-lg border border-amber-500/10 bg-black/10 p-3 text-xs text-amber-100/90">
          <p className="font-medium">Reset reminders</p>
          <p className="mt-1">Soft reset preserves more simulation history.</p>
          <p>
            Full reset clears simulated rows and restores a cleaner baseline.
          </p>
        </div>
      </div>

      <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-amber-100/90">
        <li>
          These actions still mutate real rows in the current environment.
        </li>
        <li>Use clear simulation labels before demo runs.</li>
        <li>Use full reset between major scenario runs for cleaner results.</li>
        <li>
          Check the validation checklist after backend or assignment changes.
        </li>
      </ul>
    </div>
  );
}
