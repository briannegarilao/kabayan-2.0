"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, PlayCircle, ArrowRight, Sparkles } from "lucide-react";
import {
  SALITRAN_IV_NAME,
  SALITRAN_SCENARIOS,
  startSalitranSimulationSession,
  type SalitranScenarioDef,
} from "../../../lib/salitran-sim";

export default function SalitranIVSimPage() {
  const router = useRouter();
  const [startingId, setStartingId] = useState<string | null>(null);

  async function handleStartScenario(scenario: SalitranScenarioDef) {
    setStartingId(scenario.id);

    // Phase 1 = client-side session only
    startSalitranSimulationSession(scenario);

    router.push("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-300" />
          <h1 className="text-lg font-semibold text-white">
            Salitran IV Simulation Theater
          </h1>
        </div>

        <p className="max-w-3xl text-sm text-gray-300">
          This Phase 1 page is the simulation launcher shell. It forces the
          barangay filter to{" "}
          <span className="font-medium text-violet-200">
            {SALITRAN_IV_NAME}
          </span>
          , then sends you to the Dashboard as the main visual stage.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-violet-100/80">
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-950/40 px-2.5 py-1">
            <MapPin className="h-3 w-3" />
            Fixed barangay: {SALITRAN_IV_NAME}
          </span>
          <span className="rounded-full border border-violet-400/20 bg-violet-950/40 px-2.5 py-1">
            Cost: client-side only
          </span>
          <span className="rounded-full border border-violet-400/20 bg-violet-950/40 px-2.5 py-1">
            No backend seeding yet
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {SALITRAN_SCENARIOS.map((scenario) => {
          const isStarting = startingId === scenario.id;

          return (
            <div
              key={scenario.id}
              className="rounded-2xl border border-gray-800 bg-gray-900 p-5"
            >
              <div className="mb-3">
                <h2 className="text-base font-semibold text-white">
                  {scenario.title}
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  {scenario.subtitle}
                </p>
              </div>

              <p className="mb-4 text-sm text-gray-300">{scenario.objective}</p>

              <div className="mb-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Phase 1 outcome
                </p>
                <ul className="space-y-1.5 text-sm text-gray-400">
                  {scenario.expected.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleStartScenario(scenario)}
                disabled={isStarting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isStarting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Launching Dashboard...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4" />
                    Start Scenario
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
