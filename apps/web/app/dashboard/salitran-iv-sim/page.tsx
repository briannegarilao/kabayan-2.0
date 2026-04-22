// apps/web/app/dashboard/salitran-iv-sim/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  MapPin,
  PlayCircle,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Users,
  House,
  TriangleAlert,
} from "lucide-react";
import {
  SALITRAN_IV_NAME,
  SALITRAN_SCENARIOS,
  getSalitranIVPolygon,
  validateScenariosAgainstPolygon,
  type SalitranRunMode,
  type SalitranScenarioDef,
} from "../../../lib/salitran-sim";
import { prepareSalitranScenarioRun } from "../../../lib/salitran-sim-runner";

interface ValidationState {
  total: number;
  passed: number;
  failed: Array<{
    scenarioId: string;
    label: string;
    inside: boolean;
    kind: "incident" | "staging" | "evac";
  }>;
}

const DEMO_CHECKLIST = [
  "Salitran IV polygon validation passes",
  "Scenario uses fixed request points only",
  "Responders are staged before the run starts",
  "Evac center rows open cleanly for the run",
  "Dashboard shows controls and live feed without manual debugging",
];

export default function SalitranIVSimPage() {
  const router = useRouter();

  const [startingId, setStartingId] = useState<string | null>(null);
  const [modeByScenario, setModeByScenario] = useState<
    Record<string, SalitranRunMode>
  >(
    Object.fromEntries(
      SALITRAN_SCENARIOS.map((scenario) => [scenario.id, "setup_and_trigger"]),
    ) as Record<string, SalitranRunMode>,
  );

  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [validationLoading, setValidationLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function runValidation() {
      try {
        const res = await fetch("/geo/dasma-barangays.json");
        const geo = await res.json();

        const polygon = getSalitranIVPolygon(geo);
        if (!polygon) {
          if (mounted) {
            setValidation({ total: 0, passed: 0, failed: [] });
          }
          return;
        }

        const result = validateScenariosAgainstPolygon(
          polygon,
          SALITRAN_SCENARIOS,
        );

        if (mounted) setValidation(result);
      } catch {
        if (mounted) {
          setValidation({ total: 0, passed: 0, failed: [] });
        }
      } finally {
        if (mounted) setValidationLoading(false);
      }
    }

    runValidation();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleRunScenario(scenario: SalitranScenarioDef) {
    const runMode = modeByScenario[scenario.id] ?? "setup_and_trigger";
    setPageError(null);
    setStartingId(scenario.id);

    try {
      await prepareSalitranScenarioRun({ scenario, runMode });
      router.push("/dashboard");
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Failed to prepare scenario.",
      );
      setStartingId(null);
    }
  }

  const validationSummary = useMemo(() => {
    if (validationLoading) return "Validating Salitran IV demo points...";
    if (!validation) return "Validation unavailable";
    if (validation.total === 0) return "No polygon validation result";
    if (validation.failed.length === 0) {
      return `Validated ${validation.passed}/${validation.total} demo points inside Salitran IV`;
    }
    return `${validation.failed.length} point(s) need review`;
  }, [validation, validationLoading]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-300" />
          <h1 className="text-lg font-semibold text-white">
            Salitran IV Simulation Theater
          </h1>
        </div>

        <p className="max-w-4xl text-sm text-gray-300">
          Fixed-data launcher for repeatable Salitran IV demos. This is Phase 1:
          prepare, stage, seed, trigger, then move to the Dashboard as the live
          theater view.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-950/40 px-2.5 py-1 text-violet-100/80">
            <MapPin className="h-3 w-3" />
            Fixed barangay: {SALITRAN_IV_NAME}
          </span>
          <span className="rounded-full border border-violet-400/20 bg-violet-950/40 px-2.5 py-1 text-violet-100/80">
            Thesis-defense mode
          </span>
          <span className="rounded-full border border-violet-400/20 bg-violet-950/40 px-2.5 py-1 text-violet-100/80">
            Low-cost and hardcoded
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <span className="text-sm font-medium text-white">
              Polygon validation
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">{validationSummary}</p>

          {!validationLoading && validation && validation.failed.length > 0 && (
            <div className="mt-3 space-y-1">
              {validation.failed.map((item) => (
                <div
                  key={`${item.scenarioId}-${item.label}-${item.kind}`}
                  className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
                >
                  {item.kind.toUpperCase()} · {item.label} · {item.scenarioId}
                </div>
              ))}
            </div>
          )}
        </div>

        {pageError && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {pageError}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {SALITRAN_SCENARIOS.map((scenario) => {
          const isStarting = startingId === scenario.id;
          const selectedMode =
            modeByScenario[scenario.id] ?? "setup_and_trigger";

          return (
            <div
              key={scenario.id}
              className="rounded-2xl border border-gray-800 bg-gray-900 p-5"
            >
              <div className="mb-4">
                <h2 className="text-base font-semibold text-white">
                  {scenario.title}
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  {scenario.subtitle}
                </p>
              </div>

              <p className="mb-4 text-sm text-gray-300">{scenario.objective}</p>

              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500">
                    Incidents
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {scenario.incidentSeeds.length}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500">
                    Responders
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {scenario.responderStaging.length}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500">
                    Evac
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">
                    {scenario.primaryEvac.name}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Expected
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

              <div className="mb-4 rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <House className="h-4 w-4 text-teal-300" />
                  <p className="text-sm font-medium text-white">Primary evac</p>
                </div>
                <p className="text-sm text-gray-200">
                  {scenario.primaryEvac.name}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {scenario.primaryEvac.notes}
                </p>
              </div>

              <div className="mb-4 rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-300" />
                  <p className="text-sm font-medium text-white">
                    Responder staging
                  </p>
                </div>

                <div className="space-y-2">
                  {scenario.responderStaging.map((staging) => (
                    <div
                      key={`${scenario.id}-${staging.responderCode}`}
                      className="rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-200">
                            {staging.responderCode}
                          </p>
                          <p className="text-xs text-gray-400">
                            {staging.vehicleType}
                          </p>
                        </div>
                        <span className="text-[11px] text-gray-500">
                          {staging.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4 rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <TriangleAlert className="h-4 w-4 text-red-300" />
                  <p className="text-sm font-medium text-white">
                    Fixed incident seeds
                  </p>
                </div>

                <div className="space-y-2">
                  {scenario.incidentSeeds.map((incident) => (
                    <div
                      key={`${scenario.id}-${incident.requesterName}-${incident.lat}-${incident.lng}`}
                      className="rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-200">
                          {incident.requesterName}
                        </p>
                        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                          {incident.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        {incident.household} · {incident.peopleCount} person
                        {incident.peopleCount > 1 ? "s" : ""}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {incident.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Run mode
                </label>
                <select
                  value={selectedMode}
                  onChange={(e) =>
                    setModeByScenario((prev) => ({
                      ...prev,
                      [scenario.id]: e.target.value as SalitranRunMode,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-800 bg-gray-950/60 px-3 py-3 text-sm text-gray-200 outline-none focus:border-violet-500"
                >
                  <option value="setup_only">Setup only</option>
                  <option value="setup_and_trigger">Setup + Trigger</option>
                </select>
              </div>

              <button
                onClick={() => handleRunScenario(scenario)}
                disabled={isStarting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isStarting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Preparing scenario...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4" />
                    Run Scenario
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
