// services/tripService.ts
// All trip lifecycle API calls to FastAPI.
// Each function is a single HTTP request — no polling, no loops.
import Config from "../utils/config";

export interface TripPlan {
  id: string;
  responder_id: string;
  status: string;
  stops: TripStop[];
  evac_center_id: string | null;
  total_distance_km: number | null;
  estimated_time_minutes: number | null;
  created_at: string;
}

export interface TripStop {
  lng: number;
  lat: number;
  incident_id: string;
  type: "pickup" | "dropoff";
  location: { lat: number; lng: number } | string;
  people_count: number;
  barangay?: string;
  sequence: number;
}

export async function acceptTrip(
  tripId: string,
): Promise<{ success: boolean; message?: string }> {
  const resp = await fetch(
    `${Config.API_BASE_URL}/api/trips/${tripId}/accept`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Accept failed: ${err}`);
  }
  return resp.json();
}

export async function declineTrip(
  tripId: string,
  reason: string,
  barangay?: string,
): Promise<{ success: boolean }> {
  const resp = await fetch(
    `${Config.API_BASE_URL}/api/trips/${tripId}/decline`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, barangay: barangay || null }),
    },
  );
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Decline failed: ${err}`);
  }
  return resp.json();
}

export async function markPickup(
  tripId: string,
  incidentId: string,
  peopleCount: number,
): Promise<{ current_load: number; max_capacity: number; remaining: number }> {
  const resp = await fetch(
    `${Config.API_BASE_URL}/api/trips/${tripId}/pickup/${incidentId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incident_id: incidentId,
        people_picked_up: peopleCount,
      }),
    },
  );
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Pickup failed: ${err}`);
  }
  return resp.json();
}

export async function markDropoff(
  tripId: string,
): Promise<{ success: boolean; people_dropped: number }> {
  const resp = await fetch(
    `${Config.API_BASE_URL}/api/trips/${tripId}/dropoff`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Dropoff failed: ${err}`);
  }
  return resp.json();
}
