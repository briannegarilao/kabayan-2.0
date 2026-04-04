// services/sosService.ts
// Handles SOS submission to FastAPI with offline queue fallback.
// If network is down, queues locally in AsyncStorage and auto-flushes on reconnect.
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import Config from "../utils/config";

const QUEUE_KEY = "kabayan_sos_queue";

export interface SOSPayload {
  reporter_id: string;
  latitude: number;
  longitude: number;
  barangay: string;
  message: string | null;
  image_url: string | null;
  people_count: number;
  vulnerability_flags: string[];
}

interface QueuedSOS {
  id: string;
  payload: SOSPayload;
  timestamp: number;
  retries: number;
}

// Submit SOS to FastAPI backend
async function submitToAPI(payload: SOSPayload): Promise<{ incident_id: string }> {
  const resp = await fetch(`${Config.API_BASE_URL}/api/sos/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API error ${resp.status}: ${err}`);
  }

  return resp.json();
}

// Main function: try online first, fall back to offline queue
export async function submitSOS(
  payload: SOSPayload
): Promise<{ success: boolean; incident_id?: string; queued?: boolean }> {
  const netState = await NetInfo.fetch();

  if (netState.isConnected) {
    try {
      const result = await submitToAPI(payload);
      return { success: true, incident_id: result.incident_id };
    } catch (e) {
      console.warn("Online SOS submission failed, queuing:", e);
    }
  }

  // Offline or API failed — queue locally
  const item: QueuedSOS = {
    id: `sos_${Date.now()}`,
    payload,
    timestamp: Date.now(),
    retries: 0,
  };

  try {
    const existing: QueuedSOS[] = JSON.parse(
      (await AsyncStorage.getItem(QUEUE_KEY)) || "[]"
    );
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...existing, item]));
  } catch {
    // AsyncStorage write failed — very rare
  }

  return { success: true, queued: true };
}

// Flush the offline queue — called when network reconnects
export async function flushSOSQueue(): Promise<number> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(QUEUE_KEY);
  } catch {
    return 0;
  }

  const queue: QueuedSOS[] = raw ? JSON.parse(raw) : [];
  if (queue.length === 0) return 0;

  const sent: string[] = [];

  for (const item of queue) {
    if (item.retries >= 3) {
      sent.push(item.id); // Drop after 3 retries
      continue;
    }
    try {
      await submitToAPI(item.payload);
      sent.push(item.id);
    } catch {
      item.retries++;
    }
  }

  const remaining = queue.filter((item) => !sent.includes(item.id));
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return sent.length;
}

// Start watching for network reconnect — call once at app startup
let _watching = false;
export function startQueueWatcher() {
  if (_watching) return;
  _watching = true;

  NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      flushSOSQueue().then((count) => {
        if (count > 0) console.log(`[SOS Queue] Flushed ${count} queued reports`);
      });
    }
  });
}
