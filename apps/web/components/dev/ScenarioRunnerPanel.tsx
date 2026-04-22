// apps/web/components/dev/ScenarioRunnerPanel.tsx
"use client";

import { Loader2, PlayCircle } from "lucide-react";

type Scenario = {
  id: string;
  title: string;
  description: string;
  supported_modes: string[];
  expected_outcomes: string[];
};

export function ScenarioRunnerPanel({
  scenarios,
  busy,
  selectedModes,
  onModeChange,
  onRunScenario,
}: {
  scenarios: Scenario[];
  busy: string | null;
  selectedModes: Record<
    string,
    "setup_only" | "setup_and_trigger" | "full_run"
  >;
  onModeChange: (
    scenarioId: string,
    mode: "setup_only" | "setup_and_trigger" | "full_run",
  ) => void;
  onRunScenario: (scenarioId: string) => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-200">Scenario Runner</h3>
        <p className="mt-1 text-xs text-gray-500">
          Repeatable setup flows for dispatch testing and thesis demos
        </p>
      </div>

      <div className="space-y-4">
        {scenarios.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 text-sm text-gray-500">
            Scenario catalog not loaded yet.
          </div>
        ) : (
          scenarios.map((scenario) => {
            const selectedMode =
              selectedModes[scenario.id] ?? "setup_and_trigger";

            return (
              <div
                key={scenario.id}
                className="rounded-lg border border-gray-800 bg-gray-950/40 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {scenario.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {scenario.description}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500">
                        Expected Outcomes
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-400">
                        {scenario.expected_outcomes.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="w-full max-w-xs space-y-3">
                    <label className="block space-y-1">
                      <span className="text-xs text-gray-400">Mode</span>
                      <select
                        value={selectedMode}
                        onChange={(e) =>
                          onModeChange(
                            scenario.id,
                            e.target.value as
                              | "setup_only"
                              | "setup_and_trigger"
                              | "full_run",
                          )
                        }
                        className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                      >
                        <option value="setup_only">Setup Only</option>
                        <option value="setup_and_trigger">
                          Setup + Trigger
                        </option>
                        <option value="full_run">Full Run</option>
                      </select>
                    </label>

                    <button
                      onClick={() => onRunScenario(scenario.id)}
                      disabled={busy !== null}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === `scenario-${scenario.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="h-4 w-4" />
                      )}
                      Run Scenario
                    </button>

                    {selectedMode === "full_run" ? (
                      <p className="text-[10px] text-amber-400/80">
                        For now, Full Run behaves like Setup + Trigger.
                        Automatic progression comes in Part 9.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
