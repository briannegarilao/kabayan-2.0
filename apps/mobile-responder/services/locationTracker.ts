// apps/mobile-responder/services/locationTracker.ts
import * as Location from "expo-location";
import { supabase } from "@kabayan/database/realtime";

const LOCATION_UPDATE_INTERVAL_MS = 15000; // 15 seconds — NOT continuous stream

let locationInterval: ReturnType<typeof setInterval> | null = null;

export async function startLocationTracking(responderId: string) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return;

  // Clear any existing interval
  if (locationInterval) clearInterval(locationInterval);

  locationInterval = setInterval(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Not Highest — saves battery
      });

      // REST POST, not Realtime channel — responder → server → DB
      // Supabase Realtime is for server → client. This is client → server.
      await supabase
        .from("responders")
        .update({
          current_location: `POINT(${loc.coords.longitude} ${loc.coords.latitude})`,
          last_location_update: new Date().toISOString(),
        })
        .eq("id", responderId);
    } catch (e) {
      console.warn("Location update failed, will retry in 15s:", e);
    }
  }, LOCATION_UPDATE_INTERVAL_MS);
}

export function stopLocationTracking() {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
}
