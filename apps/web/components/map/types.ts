export interface SOSIncident {
  id: string;
  barangay: string;
  flood_severity: string | null;
  status: string;
  people_count: number | null;
  message: string | null;
  location: any;
  created_at: string;
}

export interface Responder {
  id: string;
  team_name: string | null;
  vehicle_type: string | null;
  is_available: boolean;
  current_load: number | null;
  max_capacity: number | null;
  current_location: any;
  last_location_update: string | null;
  home_barangay: string | null;
}

export interface EvacCenter {
  id: string;
  name: string;
  barangay: string;
  capacity: number | null;
  current_occupancy: number;
  is_open: boolean;
  location: any;
}

export interface TripPlan {
  id: string;
  responder_id: string;
  status: string;
  stops: any[];
  route_geometry?: {
    type: "LineString";
    coordinates: [number, number][];
  } | null;
  route_distance_meters?: number | null;
  route_duration_seconds?: number | null;
}

export type TabId = "sos" | "responders" | "evacs";

export interface BoundaryGeoJSON {
  type: "Feature";
  properties: { name: string };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export interface BarangaysGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { name: string; osm_name?: string };
    geometry: { type: "Polygon"; coordinates: number[][][] };
  }>;
}
