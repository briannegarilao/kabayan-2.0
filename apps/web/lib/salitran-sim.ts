// apps/web/lib/salitran-sim.ts
"use client";

export const SALITRAN_IV_NAME = "Salitran IV";
export const SALITRAN_SIM_STORAGE_KEY = "kabayan.salitranSimSession";
export const BARANGAY_FILTER_STORAGE_KEY = "kabayan.barangayFilter";

export type FloodSeverity = "low" | "moderate" | "high" | "critical";
export type SalitranRunMode = "setup_only" | "setup_and_trigger";
export type SalitranSpeedPreset = "1x" | "2x" | "4x";
export type SalitranSimulationStatus =
  | "armed"
  | "prepared"
  | "running"
  | "paused"
  | "complete"
  | "blocked";

export interface DemoPoint {
  label: string;
  lat: number;
  lng: number;
}

export interface DemoResponderStaging extends DemoPoint {
  responderCode: string;
  vehicleType: string;
  notes: string;
}

export interface DemoIncidentSeed extends DemoPoint {
  requesterName: string;
  household: string;
  peopleCount: number;
  severity: FloodSeverity;
  message: string;
}

export interface DemoEvacCenterSeed extends DemoPoint {
  name: string;
  barangay: string;
  notes: string;
}

export interface SalitranScenarioDef {
  id: string;
  title: string;
  subtitle: string;
  objective: string;
  expected: string[];
  primaryEvac: DemoEvacCenterSeed;
  responderStaging: DemoResponderStaging[];
  incidentSeeds: DemoIncidentSeed[];
}

export interface SalitranSimSession {
  mode: "salitran-iv";
  barangay: string;
  scenarioId: string;
  scenarioTitle: string;
  startedAt: string;
  runMode?: SalitranRunMode;
  speedPreset?: SalitranSpeedPreset;
  status?: SalitranSimulationStatus;
  seededIncidentIds?: string[];
  stagedResponderIds?: string[];
  openedEvacNames?: string[];
  notes?: string[];
}

const PRIMARY_EVAC: DemoEvacCenterSeed = {
  name: "Primary Salitran IV Demo Evac",
  barangay: SALITRAN_IV_NAME,
  label: "Primary Demo Evac",
  lat: 14.351817,
  lng: 120.954085,
  notes:
    "Phase 1 uses this as the fixed Salitran IV evac target. Existing Salitran IV rows are opened when present.",
};

const RESPONDER_STAGING: DemoResponderStaging[] = [
  {
    responderCode: "Alpha-1",
    vehicleType: "Rescue Boat",
    label: "Alpha Staging",
    lat: 14.352493,
    lng: 120.952994,
    notes: "Primary water rescue unit staging point.",
  },
  {
    responderCode: "Bravo-1",
    vehicleType: "Rescue Truck",
    label: "Bravo Staging",
    lat: 14.347429,
    lng: 120.954976,
    notes: "Secondary ground extraction unit staging point.",
  },
  {
    responderCode: "Charlie-1",
    vehicleType: "Utility Rescue Van",
    label: "Charlie Staging",
    lat: 14.347278,
    lng: 120.960336,
    notes: "Reserve responder for overflow or reassignment demo.",
  },
];

export const SALITRAN_SCENARIOS: SalitranScenarioDef[] = [
  {
    id: "clean-single-dispatch",
    title: "Clean Single Dispatch",
    subtitle: "One SOS, one responder, one evac outcome.",
    objective:
      "Use the simplest Salitran IV run for baseline demonstration and panel explanations.",
    expected: [
      "Barangay filter is forced to Salitran IV",
      "One incident seed is inserted",
      "One staged responder is enough to explain the expected flow",
    ],
    primaryEvac: PRIMARY_EVAC,
    responderStaging: [RESPONDER_STAGING[0], RESPONDER_STAGING[1]],
    incidentSeeds: [
      {
        requesterName: "Maria Santos",
        household: "Block 3 Lot 7",
        label: "Maria Santos Household",
        lat: 14.343631,
        lng: 120.95773,
        peopleCount: 3,
        severity: "high",
        message:
          "Floodwater already waist-deep. One child and two adults need rescue.",
      },
    ],
  },
  {
    id: "two-requests-one-route",
    title: "Two Requests, One Route",
    subtitle: "Controlled multi-request theater flow.",
    objective:
      "Prepare a fixed two-household Salitran IV route demo with one primary responder and one standby responder.",
    expected: [
      "Two fixed request points are inserted",
      "Scenario is ready for future route and movement automation",
      "Responder staging uses Alpha-1 and Bravo-1",
    ],
    primaryEvac: PRIMARY_EVAC,
    responderStaging: [RESPONDER_STAGING[0], RESPONDER_STAGING[1]],
    incidentSeeds: [
      {
        requesterName: "Ana Dela Cruz",
        household: "Phase 2A Corner Home",
        label: "Ana Dela Cruz Household",
        lat: 14.34493,
        lng: 120.961984,
        peopleCount: 2,
        severity: "moderate",
        message:
          "Need evacuation for two adults. Water is entering the first floor.",
      },
      {
        requesterName: "John Paul Reyes",
        household: "Blk 9 Lot 4",
        label: "John Paul Reyes Household",
        lat: 14.343469,
        lng: 120.964139,
        peopleCount: 3,
        severity: "high",
        message:
          "Three people stranded near the corner road, including one senior citizen.",
      },
    ],
  },
  {
    id: "capacity-pressure",
    title: "Capacity Pressure",
    subtitle: "Fixed Salitran IV dataset for future capacity handling demo.",
    objective:
      "Prepare a repeatable pressure case with more total people than one responder should comfortably absorb.",
    expected: [
      "Multiple households are pre-authored inside Salitran IV",
      "Scenario is ready for later capacity and fallback responder automation",
      "Alpha-1, Bravo-1, and Charlie-1 are available as staged units",
    ],
    primaryEvac: PRIMARY_EVAC,
    responderStaging: [...RESPONDER_STAGING],
    incidentSeeds: [
      {
        requesterName: "Jessa Garcia",
        household: "East Interior Cluster A",
        label: "Garcia Household",
        lat: 14.356056,
        lng: 120.949077,
        peopleCount: 4,
        severity: "high",
        message: "Water is rising quickly. Four family members need transport.",
      },
      {
        requesterName: "Carlo Mendoza",
        household: "East Interior Cluster B",
        label: "Mendoza Household",
        lat: 14.355418,
        lng: 120.949805,
        peopleCount: 3,
        severity: "high",
        message: "Three adults waiting on the elevated front area.",
      },
      {
        requesterName: "Elaine Navarro",
        household: "East Interior Cluster C",
        label: "Navarro Household",
        lat: 14.357267,
        lng: 120.948528,
        peopleCount: 2,
        severity: "critical",
        message:
          "Household trapped with one child. Water already near chest level.",
      },
    ],
  },
  {
    id: "decline-and-reassign",
    title: "Decline and Reassign",
    subtitle: "Fixed data pack for reassignment theater mode.",
    objective:
      "Prepare a clean Salitran IV incident that can later be used to demonstrate responder decline and immediate reassignment.",
    expected: [
      "One high-priority incident is staged",
      "Two responders are already defined for future reassignment",
      "Dashboard stays focused on Salitran IV as the main stage",
    ],
    primaryEvac: PRIMARY_EVAC,
    responderStaging: [RESPONDER_STAGING[0], RESPONDER_STAGING[2]],
    incidentSeeds: [
      {
        requesterName: "Joshua Fernandez",
        household: "South Access Road Home",
        label: "Fernandez Household",
        lat: 14.347278,
        lng: 120.960336,
        peopleCount: 1,
        severity: "critical",
        message:
          "One person stranded on the roof edge. Immediate rescue needed.",
      },
    ],
  },
];

export function startSalitranSimulationSession(
  scenario: SalitranScenarioDef,
  options?: {
    runMode?: SalitranRunMode;
    speedPreset?: SalitranSpeedPreset;
    seededIncidentIds?: string[];
    stagedResponderIds?: string[];
    openedEvacNames?: string[];
    notes?: string[];
    status?: SalitranSimulationStatus;
  },
): void {
  if (typeof window === "undefined") return;

  const session: SalitranSimSession = {
    mode: "salitran-iv",
    barangay: SALITRAN_IV_NAME,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    startedAt: new Date().toISOString(),
    runMode: options?.runMode,
    speedPreset: options?.speedPreset ?? "1x",
    seededIncidentIds: options?.seededIncidentIds ?? [],
    stagedResponderIds: options?.stagedResponderIds ?? [],
    openedEvacNames: options?.openedEvacNames ?? [],
    notes: options?.notes ?? [],
    status: options?.status ?? "armed",
  };

  sessionStorage.setItem(SALITRAN_SIM_STORAGE_KEY, JSON.stringify(session));
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

export function updateSalitranSimulationSession(
  patch: Partial<SalitranSimSession>,
): SalitranSimSession | null {
  if (typeof window === "undefined") return null;

  const current = readSalitranSimulationSession();
  if (!current) return null;

  const next = { ...current, ...patch };
  sessionStorage.setItem(SALITRAN_SIM_STORAGE_KEY, JSON.stringify(next));
  return next;
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

// polygon helpers
export function pointInPolygon(
  lng: number,
  lat: number,
  polygon: number[][],
): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

export function getSalitranIVPolygon(
  featureCollection: any,
): number[][] | null {
  const feat = featureCollection?.features?.find(
    (f: any) =>
      String(f?.properties?.name ?? "").toLowerCase() ===
      SALITRAN_IV_NAME.toLowerCase(),
  );

  const coords = feat?.geometry?.coordinates?.[0];
  if (!Array.isArray(coords)) return null;
  return coords as number[][];
}

export function validateScenariosAgainstPolygon(
  polygon: number[][],
  scenarios: SalitranScenarioDef[],
) {
  const incidentChecks = scenarios.flatMap((scenario) =>
    scenario.incidentSeeds.map((seed) => ({
      scenarioId: scenario.id,
      label: seed.label,
      inside: pointInPolygon(seed.lng, seed.lat, polygon),
      kind: "incident" as const,
    })),
  );

  const stagingChecks = scenarios.flatMap((scenario) =>
    scenario.responderStaging.map((seed) => ({
      scenarioId: scenario.id,
      label: seed.label,
      inside: pointInPolygon(seed.lng, seed.lat, polygon),
      kind: "staging" as const,
    })),
  );

  const evacChecks = scenarios.map((scenario) => ({
    scenarioId: scenario.id,
    label: scenario.primaryEvac.label,
    inside: pointInPolygon(
      scenario.primaryEvac.lng,
      scenario.primaryEvac.lat,
      polygon,
    ),
    kind: "evac" as const,
  }));

  const all = [...incidentChecks, ...stagingChecks, ...evacChecks];

  return {
    total: all.length,
    passed: all.filter((item) => item.inside).length,
    failed: all.filter((item) => !item.inside),
  };
}

export function getSalitranScenarioById(id: string) {
  return SALITRAN_SCENARIOS.find((scenario) => scenario.id === id) ?? null;
}
