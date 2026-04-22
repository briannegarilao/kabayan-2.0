// apps/web/lib/dev-api.ts

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function parseJsonOrThrow(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === "string"
        ? body
        : body?.detail || body?.message || "Request failed";
    throw new Error(message);
  }

  return body;
}

export async function getDevHealth() {
  const response = await fetch(`${API_BASE_URL}/api/dev/health`, {
    method: "GET",
    cache: "no-store",
  });
  return parseJsonOrThrow(response);
}

export async function getDevStats() {
  const response = await fetch(`${API_BASE_URL}/api/dev/stats`, {
    method: "GET",
    cache: "no-store",
  });
  return parseJsonOrThrow(response);
}

export async function getDevLogs(params?: { n?: number; source?: string }) {
  const search = new URLSearchParams();
  if (params?.n) search.set("n", String(params.n));
  if (params?.source) search.set("source", params.source);

  const response = await fetch(
    `${API_BASE_URL}/api/dev/logs${search.toString() ? `?${search.toString()}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  return parseJsonOrThrow(response);
}

export async function getDevStateActive() {
  const response = await fetch(`${API_BASE_URL}/api/dev/state/active`, {
    method: "GET",
    cache: "no-store",
  });
  return parseJsonOrThrow(response);
}

export async function postDevReset(mode: "soft" | "full") {
  const response = await fetch(`${API_BASE_URL}/api/dev/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  return parseJsonOrThrow(response);
}

export async function postSeedSOS(payload: {
  barangay: string;
  count?: number;
  people_count?: number;
  vulnerability_flags?: string[];
  message?: string;
  latitude?: number;
  longitude?: number;
  simulation_label?: string;
  cluster?: boolean;
  run_engine_after_seed?: boolean;
}) {
  const response = await fetch(`${API_BASE_URL}/api/dev/seed/sos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}

export async function postForceResponderStatus(payload: {
  responder_id: string;
  is_available: boolean;
  reset_load?: boolean;
  clear_current_incident?: boolean;
  latitude?: number;
  longitude?: number;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/dev/responders/force-status`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return parseJsonOrThrow(response);
}

export async function postDevTripsClear() {
  const response = await fetch(`${API_BASE_URL}/api/dev/trips/clear`, {
    method: "POST",
  });
  return parseJsonOrThrow(response);
}

export async function postTripAccept(tripId: string) {
  const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/accept`, {
    method: "POST",
  });
  return parseJsonOrThrow(response);
}

export async function postTripDecline(payload: {
  tripId: string;
  reason: string;
  barangay?: string;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/trips/${payload.tripId}/decline`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: payload.reason,
        barangay: payload.barangay ?? null,
      }),
    },
  );
  return parseJsonOrThrow(response);
}

export async function postTripPickup(payload: {
  tripId: string;
  incidentId: string;
  peoplePickedUp: number;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/trips/${payload.tripId}/pickup/${payload.incidentId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incident_id: payload.incidentId,
        people_picked_up: payload.peoplePickedUp,
      }),
    },
  );
  return parseJsonOrThrow(response);
}

export async function postTripDropoff(tripId: string) {
  const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/dropoff`, {
    method: "POST",
  });
  return parseJsonOrThrow(response);
}

export async function getDevScenarios() {
  const response = await fetch(`${API_BASE_URL}/api/dev/scenarios`, {
    method: "GET",
    cache: "no-store",
  });
  return parseJsonOrThrow(response);
}

export async function postRunDevScenario(payload: {
  scenario_id: string;
  mode: "setup_only" | "setup_and_trigger" | "full_run";
}) {
  const response = await fetch(`${API_BASE_URL}/api/dev/scenarios/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}

export async function postSimulationAdvance(payload: {
  trip_id?: string;
  action?: "auto_step" | "accept" | "pickup_next" | "dropoff";
}) {
  const response = await fetch(`${API_BASE_URL}/api/dev/simulation/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trip_id: payload.trip_id ?? null,
      action: payload.action ?? "auto_step",
    }),
  });
  return parseJsonOrThrow(response);
}

export async function postSimulationAutoRun(payload?: {
  trip_id?: string;
  max_steps?: number;
}) {
  const response = await fetch(`${API_BASE_URL}/api/dev/simulation/auto-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trip_id: payload?.trip_id ?? null,
      max_steps: payload?.max_steps ?? 10,
    }),
  });
  return parseJsonOrThrow(response);
}
