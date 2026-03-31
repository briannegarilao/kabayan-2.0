// apps/web/lib/types.ts
// Shared types for the dashboard — keeps components type-safe without
// needing Supabase generated types (which require CLI setup)

export interface SOSIncident {
  id: string;
  status: "pending" | "assigned" | "in_progress" | "resolved" | "false_alarm";
  barangay: string;
  flood_severity: "low" | "moderate" | "high" | "critical" | null;
  flood_severity_score: number | null;
  message: string | null;
  image_url: string | null;
  created_at: string;
  assigned_at: string | null;
  location: string; // PostGIS returns WKT like "POINT(120.9367 14.3294)"
  reporter?: {
    full_name: string;
    phone_number: string | null;
  } | null;
  responder?: {
    full_name: string;
  } | null;
}

export interface Responder {
  id: string;
  is_available: boolean;
  current_location: string | null;
  current_incident_id: string | null;
  last_location_update: string | null;
  vehicle_type: string | null;
  team_name: string | null;
  user?: {
    full_name: string;
    phone_number: string | null;
    barangay: string;
  } | null;
}

// --- UTILITY: Parse PostGIS location string to [lat, lng] ---
// PostGIS returns "POINT(longitude latitude)" or the Supabase REST API
// might return it as a stringified geography. Handle both.
export function parseLocation(
  location: string | null | undefined
): [number, number] | null {
  if (!location) return null;

  // Format: "POINT(120.9367 14.3294)"
  const match = location.match(
    /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i
  );
  if (match) {
    const lng = parseFloat(match[1]);
    const lat = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
  }

  return null;
}
