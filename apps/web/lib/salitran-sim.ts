// apps/web/lib/salitran-sim.ts
"use client";

export const SALITRAN_IV_NAME = "Salitran IV";
export const SALITRAN_SIM_STORAGE_KEY = "kabayan.salitranSimSession";
export const BARANGAY_FILTER_STORAGE_KEY = "kabayan.barangayFilter";

export interface SalitranScenarioDef {
  id: string;
  title: string;
  subtitle: string;
  objective: string;
  expected: string[];
}

export interface SalitranSimSession {
  mode: "salitran-iv";
  barangay: string;
  scenarioId: string;
  scenarioTitle: string;
  startedAt: string;
}

export const SALITRAN_SCENARIOS: SalitranScenarioDef[] = [
  {
    id: "clean-single-dispatch",
    title: "Clean Single Dispatch",
    subtitle: "One SOS, one responder, one evac outcome.",
    objective:
      "Phase 1 launcher only. This arms the dashboard for the simplest Salitran IV demo run.",
    expected: [
      "Barangay filter is forced to Salitran IV",
      "Dashboard opens in simulation mode",
      "Map auto-focuses to Salitran IV",
    ],
  },
  {
    id: "two-requests-one-route",
    title: "Two Requests, One Route",
    subtitle: "Controlled multi-request theater flow.",
    objective:
      "Phase 1 launcher only. This prepares the dashboard for the future two-request Salitran IV route demo.",
    expected: [
      "Dashboard opens with Salitran IV simulation banner",
      "Scenario context is stored in session",
      "Ready for Phase 2 seeded requests",
    ],
  },
  {
    id: "capacity-pressure",
    title: "Capacity Pressure",
    subtitle: "Show future capacity handling in a fixed Salitran IV demo.",
    objective:
      "Phase 1 launcher only. This sets the active scenario context and focuses the map for the capacity demo.",
    expected: [
      "Salitran IV filter is active",
      "Simulation context is armed",
      "Ready for later capacity seeding and logs",
    ],
  },
  {
    id: "decline-and-reassign",
    title: "Decline and Reassign",
    subtitle: "Prepare the dashboard for reassignment theater mode.",
    objective:
      "Phase 1 launcher only. This sets the active scenario and sends the user into the dashboard stage.",
    expected: [
      "Scenario is armed in session storage",
      "Dashboard becomes the main visual stage",
      "Ready for later decline/reassign automation",
    ],
  },
];

export function startSalitranSimulationSession(
  scenario: SalitranScenarioDef,
): void {
  if (typeof window === "undefined") return;

  const session: SalitranSimSession = {
    mode: "salitran-iv",
    barangay: SALITRAN_IV_NAME,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    startedAt: new Date().toISOString(),
  };

  sessionStorage.setItem(SALITRAN_SIM_STORAGE_KEY, JSON.stringify(session));

  // Reuse your existing barangay filter persistence key
  sessionStorage.setItem(BARANGAY_FILTER_STORAGE_KEY, SALITRAN_IV_NAME);
}

export function readSalitranSimulationSession(): SalitranSimSession | null {
  if (typeof window === "undefined") return null;

  const raw = sessionStorage.getItem(SALITRAN_SIM_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SalitranSimSession;
  } catch {
    return null;
  }
}

export function clearSalitranSimulationSession(options?: {
  clearBarangayFilter?: boolean;
}) {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem(SALITRAN_SIM_STORAGE_KEY);

  if (options?.clearBarangayFilter) {
    sessionStorage.setItem(BARANGAY_FILTER_STORAGE_KEY, "");
  }
}
