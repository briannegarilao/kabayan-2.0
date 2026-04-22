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
