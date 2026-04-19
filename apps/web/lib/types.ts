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
  location: string;
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

// ── parseLocation ─────────────────────────────────────────────────────────────
// Supabase returns PostGIS geography columns as EWKB hex strings via REST API.
// Format: 0101000020E6100000<8 bytes lng><8 bytes lat>
//
//   Byte 0:     01           byte order (little-endian)
//   Bytes 1-4:  01000020     geometry type uint32 LE = 0x20000001
//                            bit 0x20000000 set = has SRID
//   Bytes 5-8:  E6100000     SRID uint32 LE = 4326
//   Bytes 9-16: <8 bytes>    X = longitude (IEEE 754 double, little-endian)
//   Bytes 17-24:<8 bytes>    Y = latitude  (IEEE 754 double, little-endian)
//
// Also handles:
//   - WKT string:    "POINT(120.9367 14.3294)"
//   - GeoJSON object: { type: "Point", coordinates: [lng, lat] }
//   - GeoJSON string: '{"type":"Point","coordinates":[120.93,14.32]}'
//
// Returns [lat, lng] (Leaflet order) or null if unparseable.
// ─────────────────────────────────────────────────────────────────────────────
export function parseLocation(
  location: string | Record<string, any> | null | undefined
): [number, number] | null {
  if (!location) return null;

  // ── GeoJSON object ─────────────────────────────────────────────────────────
  if (typeof location === "object") {
    const coords = (location as any).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lng = parseFloat(coords[0]);
      const lat = parseFloat(coords[1]);
      if (isFinite(lat) && isFinite(lng)) return [lat, lng];
    }
    return null;
  }

  const str = location as string;

  // ── WKT "POINT(120.9367 14.3294)" ─────────────────────────────────────────
  const wktMatch = str.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (wktMatch) {
    const lng = parseFloat(wktMatch[1]);
    const lat = parseFloat(wktMatch[2]);
    if (isFinite(lat) && isFinite(lng)) return [lat, lng];
  }

  // ── GeoJSON string ─────────────────────────────────────────────────────────
  if (str.startsWith("{")) {
    try {
      const obj = JSON.parse(str);
      const coords = obj.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const lng = parseFloat(coords[0]);
        const lat = parseFloat(coords[1]);
        if (isFinite(lat) && isFinite(lng)) return [lat, lng];
      }
    } catch {}
    return null;
  }

  // ── EWKB hex (what Supabase REST API actually returns) ─────────────────────
  // Must be at least 42 hex chars: 1 byte order + 4 type + 4 srid + 8 lng + 8 lat = 25 bytes = 50 hex chars
  // Without SRID: 1 + 4 + 8 + 8 = 21 bytes = 42 hex chars
  if (/^[0-9a-fA-F]+$/.test(str) && str.length >= 42) {
    try {
      // Convert hex string to byte array
      const bytes = new Uint8Array(str.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(str.substring(i * 2, i * 2 + 2), 16);
      }

      const view = new DataView(bytes.buffer);
      const byteOrder = bytes[0]; // 01 = little-endian, 00 = big-endian
      const isLE = byteOrder === 1;

      // Read geometry type as uint32 to check SRID flag (bit 0x20000000)
      const geomType = view.getUint32(1, isLE);
      const hasSrid = (geomType & 0x20000000) !== 0;

      // Coordinate offset: 5 bytes header + optional 4 bytes SRID
      const coordOffset = hasSrid ? 9 : 5;

      if (bytes.length >= coordOffset + 16) {
        const lng = view.getFloat64(coordOffset, isLE);
        const lat = view.getFloat64(coordOffset + 8, isLE);

        // Sanity check: Philippines is roughly lat 4–22, lng 116–128
        if (isFinite(lat) && isFinite(lng) && lat > -90 && lat < 90 && lng > -180 && lng < 180) {
          return [lat, lng];
        }
      }
    } catch {}
    return null;
  }

  return null;
}
