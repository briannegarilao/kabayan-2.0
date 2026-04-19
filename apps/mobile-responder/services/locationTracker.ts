// services/locationTracker.ts
// Foreground GPS tracking every 15 seconds.
// Sends PATCH to FastAPI (REST, not Realtime — client→server is always REST).
// Auto-starts when duty is ON, stops when OFF.
// Battery optimized: Accuracy.Balanced (~30% less battery than High).
import * as Location from "expo-location";
import Config from "../utils/config";

let intervalId: ReturnType<typeof setInterval> | null = null;
let isTracking = false;

export interface LocationStatus {
  isTracking: boolean;
  lastLat: number | null;
  lastLng: number | null;
  lastUpdate: string | null;
  error: string | null;
}

let _status: LocationStatus = {
  isTracking: false,
  lastLat: null,
  lastLng: null,
  lastUpdate: null,
  error: null,
};

// Callback for UI updates
let _onStatusChange: ((status: LocationStatus) => void) | null = null;

export function onLocationStatusChange(cb: (status: LocationStatus) => void) {
  _onStatusChange = cb;
}

function updateStatus(partial: Partial<LocationStatus>) {
  _status = { ..._status, ...partial };
  if (_onStatusChange) _onStatusChange(_status);
}

export function getLocationStatus(): LocationStatus {
  return _status;
}

export async function startTracking(responderId: string): Promise<boolean> {
  if (isTracking) return true;

  // Request permission
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    updateStatus({ error: "Location permission denied." });
    return false;
  }

  isTracking = true;
  updateStatus({ isTracking: true, error: null });

  // Send first update immediately
  await sendLocationUpdate(responderId);

  // Then every 30 seconds
  intervalId = setInterval(() => {
    sendLocationUpdate(responderId);
  }, 30000);

  return true;
}

export function stopTracking() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isTracking = false;
  updateStatus({ isTracking: false });
}

async function sendLocationUpdate(responderId: string) {
  try {
    // One GPS request per cycle — Balanced accuracy saves battery
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const lat = loc.coords.latitude;
    const lng = loc.coords.longitude;
    const now = new Date().toISOString();

    updateStatus({ lastLat: lat, lastLng: lng, lastUpdate: now, error: null });

    // REST PATCH to FastAPI — not Supabase direct
    // This goes through the API which uses the service role key
    const resp = await fetch(
      `${Config.API_BASE_URL}/api/responders/${responderId}/location`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      },
    );

    if (!resp.ok) {
      // Non-critical — next update in 15s
      console.warn(`GPS PATCH failed: ${resp.status}`);
    }
  } catch (e: any) {
    // GPS or network failure — silently skip, try again in 15s
    // Stale location data is acceptable for a 15s window
    updateStatus({ error: e.message || "GPS update failed" });
  }
}
