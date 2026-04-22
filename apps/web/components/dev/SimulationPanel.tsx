// apps/web/components/dev/SimulationPanel.tsx
import { Loader2, PlayCircle, Sparkles } from "lucide-react";

export function SimulationPanel({
  busy,
  onSeedSingle,
  onSeedCluster,
}: {
  busy: string | null;
  onSeedSingle: () => void;
  onSeedCluster: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-200">
          Simulation Controls
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Quick seed actions for validating backend assignment and state
          transitions
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={onSeedSingle}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "seed-single" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="h-4 w-4" />
          )}
          Seed Single SOS
        </button>

        <button
          onClick={onSeedCluster}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "seed-cluster" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Seed Clustered SOS
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-gray-800 bg-gray-950/40 p-3">
        <p className="text-xs text-gray-500">
          Part 5 keeps seeding simple on purpose. Manual forms, responder
          controls, and scenario runner come in later parts.
        </p>
      </div>
    </div>
  );
}
