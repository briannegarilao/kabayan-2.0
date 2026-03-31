// apps/web/lib/map-config.ts
// All map constants hardcoded — zero API calls, zero cost

export const MAP_CONFIG = {
  // --- TILE PROVIDER ---
  // OSM direct tiles — completely free, no API key, no account needed
  // Stadia Maps (200K tiles/month free) is an upgrade option if you want
  // prettier tiles later, but for zero-cost we use OSM direct.
  tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',

  // --- DASMARIÑAS CITY CENTER ---
  defaultCenter: [14.3294, 120.9367] as [number, number],
  defaultZoom: 13,
  maxZoom: 18,
  minZoom: 11,

  // --- HARD BOUNDS: lock map to Dasmariñas area ---
  // Users cannot pan outside this bounding box
  maxBounds: [
    [14.25, 120.85], // Southwest corner
    [14.42, 121.02], // Northeast corner
  ] as [[number, number], [number, number]],
} as const;

// --- SEVERITY VISUAL SCALE ---
// Matches YOLOv8n classification + heatmap gradient
export const SEVERITY_COLORS: Record<string, string> = {
  low: "#22c55e",       // green-500
  moderate: "#f59e0b",  // amber-500
  high: "#f97316",      // orange-500
  critical: "#ef4444",  // red-500
  pending: "#6b7280",   // gray-500 (no ML result yet)
};

// --- STATUS DISPLAY ---
export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
  },
  assigned: {
    label: "Assigned",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
  in_progress: {
    label: "In Progress",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
  },
  resolved: {
    label: "Resolved",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
  },
  false_alarm: {
    label: "False Alarm",
    color: "text-gray-400",
    bgColor: "bg-gray-400/10",
  },
};

// --- DASMARIÑAS BARANGAYS ---
// Hardcoded list — saves a DB call every time a dropdown renders
export const DASMARINAS_BARANGAYS = [
  "Burol I", "Burol II", "Burol III",
  "Datu Esmael", "Emmanuel Bergado I", "Emmanuel Bergado II",
  "Fatima I", "Fatima II", "Fatima III",
  "Langkaan I", "Langkaan II",
  "Luzviminda I", "Luzviminda II",
  "Paliparan I", "Paliparan II", "Paliparan III",
  "Sabang", "Salawag",
  "Salitran I", "Salitran II", "Salitran III", "Salitran IV",
  "Sampaloc I", "Sampaloc II", "Sampaloc III", "Sampaloc IV", "Sampaloc V",
  "San Agustin I", "San Agustin II", "San Agustin III",
  "San Andres I", "San Andres II",
  "San Dionisio", "San Esteban", "San Francisco",
  "San Jose", "San Juan", "San Lorenzo Ruiz I", "San Lorenzo Ruiz II",
  "San Luis I", "San Luis II",
  "San Manuel I", "San Manuel II",
  "San Marcos", "San Miguel", "San Miguel II",
  "San Nicolas I", "San Nicolas II",
  "San Roque", "San Simon",
  "Santa Cristina I", "Santa Cristina II",
  "Santa Cruz I", "Santa Cruz II",
  "Santa Fe", "Santa Lucia", "Santa Maria",
  "Santo Cristo", "Santo Niño I", "Santo Niño II",
  "Victoria Reyes", "Zone I", "Zone I-A",
  "Zone II", "Zone III", "Zone IV",
  "Congressional Road (Burol Zone I-A)",
  "Dasmariñas (Poblacion)",
  "Governors Drive (San Miguel Zone II)",
] as const;
