// apps/web/components/map/LiveMapView.tsx
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.heat";
import {
  AlertTriangle,
  Users,
  Building2,
  Flame,
  Activity,
  Search,
  ExternalLink,
  MapPin,
} from "lucide-react";

import { createClient } from "../../lib/supabase/client";
import { MAP_CONFIG, SEVERITY_COLORS } from "../../lib/map-config";
import { parseLocation } from "../../lib/types";
import { useBarangayFilter } from "../../lib/barangay-filter";

const supabase = createClient();

// ── Types ────────────────────────────────────────────────────
interface SOSIncident {
  id: string;
  barangay: string;
  flood_severity: string | null;
  status: string;
  people_count: number | null;
  message: string | null;
  location: any;
  created_at: string;
}

interface Responder {
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

interface EvacCenter {
  id: string;
  name: string;
  barangay: string;
  capacity: number | null;
  current_occupancy: number;
  is_open: boolean;
  location: any;
}

interface TripPlan {
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

type TabId = "sos" | "responders" | "evacs";

function normalizeBarangay(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function matchesResponderBarangay(
  responder: Pick<Responder, "home_barangay" | "team_name">,
  selectedBarangay: string,
) {
  const target = normalizeBarangay(selectedBarangay);
  if (!target) return true;

  if (normalizeBarangay(responder.home_barangay) === target) {
    return true;
  }

  return responder.team_name?.toLowerCase().includes(target) ?? false;
}

// ── Visual helpers ───────────────────────────────────────────
function addStyledRouteToLayer(
  layer: L.LayerGroup,
  latlngs: [number, number][],
  color: string,
) {
  const routeBack = L.polyline(latlngs, {
    color: "#020617",
    weight: 9,
    opacity: 0.8,
    lineCap: "round",
    lineJoin: "round",
  });

  const routeFront = L.polyline(latlngs, {
    color,
    weight: 5,
    opacity: 0.95,
    dashArray: "10, 10",
    lineCap: "round",
    lineJoin: "round",
  });

  layer.addLayer(routeBack);
  layer.addLayer(routeFront);
}

// ── Icon factories ────────────────────────────────────────────
function createSOSIcon(
  severity: string | null,
  isCritical: boolean,
): L.DivIcon {
  const color =
    SEVERITY_COLORS[severity || "pending"] || SEVERITY_COLORS.pending;

  const halo =
    severity === "critical"
      ? "0 0 0 5px rgba(239,68,68,0.22), 0 0 20px rgba(239,68,68,0.55)"
      : severity === "high"
        ? "0 0 0 4px rgba(249,115,22,0.18), 0 0 16px rgba(249,115,22,0.45)"
        : severity === "moderate"
          ? "0 0 0 4px rgba(245,158,11,0.16), 0 0 14px rgba(245,158,11,0.35)"
          : "0 0 0 4px rgba(34,197,94,0.14), 0 0 12px rgba(34,197,94,0.25)";

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:28px;
        height:28px;
        border-radius:50%;
        background:${color};
        border:3px solid #ffffff;
        box-shadow:${halo};
        display:flex;
        align-items:center;
        justify-content:center;
        ${isCritical ? "animation:kabayan-pulse 1.35s infinite;" : ""}
      ">
        <div style="
          width:8px;
          height:8px;
          border-radius:50%;
          background:white;
        "></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createResponderIcon(isAvailable: boolean): L.DivIcon {
  const color = isAvailable ? "#22c55e" : "#f59e0b";

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:28px;
        height:28px;
        border-radius:8px;
        background:${color};
        border:3px solid #ffffff;
        box-shadow:0 0 0 4px ${isAvailable ? "rgba(34,197,94,0.16)" : "rgba(245,158,11,0.16)"}, 0 4px 12px rgba(0,0,0,0.45);
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-weight:800;
        font-size:12px;
      ">R</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createEvacIcon(isOpen: boolean): L.DivIcon {
  const color = isOpen ? "#0d9488" : "#475569";
  const glow = isOpen
    ? "0 0 0 4px rgba(20,184,166,0.14), 0 4px 12px rgba(0,0,0,0.45)"
    : "0 0 0 4px rgba(100,116,139,0.14), 0 4px 12px rgba(0,0,0,0.45)";

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:30px;
        height:30px;
        border-radius:8px;
        background:${color};
        border:3px solid #ffffff;
        box-shadow:${glow};
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <div style="position:relative;width:14px;height:14px;">
          <div style="
            position:absolute;
            left:5px;
            top:0;
            width:4px;
            height:14px;
            background:white;
            border-radius:2px;
          "></div>
          <div style="
            position:absolute;
            left:0;
            top:5px;
            width:14px;
            height:4px;
            background:white;
            border-radius:2px;
          "></div>
        </div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// ── Popup builders ──────────────────────────────────────────
function buildSOSPopup(inc: SOSIncident): HTMLElement {
  const el = document.createElement("div");
  el.style.minWidth = "220px";
  const color = SEVERITY_COLORS[inc.flood_severity || "pending"];
  el.innerHTML = `
    <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${inc.barangay}</div>
      <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
        <span style="padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${color}22;color:${color};">
          ${inc.flood_severity || "Assessing..."}
        </span>
        <span style="padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#374151;color:#d1d5db;">
          ${inc.status.replace("_", " ")}
        </span>
      </div>
      <div style="color:#9ca3af;margin-bottom:4px;">
        <strong>${inc.people_count ?? 1}</strong> ${(inc.people_count ?? 1) === 1 ? "person" : "people"}
      </div>
      ${inc.message ? `<div style="color:#9ca3af;font-style:italic;margin-bottom:4px;">"${inc.message}"</div>` : ""}
      <div style="color:#6b7280;font-size:11px;">
        ${new Date(inc.created_at).toLocaleString("en-PH", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </div>`;
  return el;
}

function buildResponderPopup(r: Responder): HTMLElement {
  const el = document.createElement("div");
  el.style.minWidth = "200px";
  const loadPct =
    r.max_capacity && r.max_capacity > 0
      ? Math.round(((r.current_load ?? 0) / r.max_capacity) * 100)
      : 0;
  const statusColor = r.is_available ? "#22c55e" : "#f59e0b";
  el.innerHTML = `
    <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${r.team_name || "Responder"}</div>
      <div style="color:#9ca3af;margin-bottom:4px;">${r.vehicle_type || "—"}</div>
      ${r.home_barangay ? `<div style="color:#9ca3af;margin-bottom:4px;font-size:11px;">Home: ${r.home_barangay}</div>` : ""}
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${statusColor};"></span>
        <span style="color:${statusColor};font-weight:600;font-size:11px;">${r.is_available ? "Available" : "On Trip"}</span>
      </div>
      <div style="color:#9ca3af;font-size:12px;">
        Load: <strong>${r.current_load ?? 0}/${r.max_capacity ?? 0}</strong> (${loadPct}%)
      </div>
    </div>`;
  return el;
}

function buildEvacPopup(e: EvacCenter): HTMLElement {
  const el = document.createElement("div");
  el.style.minWidth = "200px";
  const capacity = e.capacity ?? 0;
  const occPct =
    capacity > 0 ? Math.round((e.current_occupancy / capacity) * 100) : 0;
  const statusColor = e.is_open ? "#14b8a6" : "#64748b";
  el.innerHTML = `
    <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${e.name}</div>
      <div style="color:#9ca3af;margin-bottom:4px;">${e.barangay}</div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${statusColor};"></span>
        <span style="color:${statusColor};font-weight:600;font-size:11px;">${e.is_open ? "OPEN" : "Closed"}</span>
      </div>
      ${
        capacity > 0
          ? `<div style="color:#9ca3af;font-size:12px;">
        Occupancy: <strong>${e.current_occupancy}/${capacity}</strong> (${occPct}%)
      </div>`
          : ""
      }
    </div>`;
  return el;
}

const TRIP_COLORS = [
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#14b8a6",
];

function tripColor(responderId: string): string {
  const hash =
    responderId.charCodeAt(0) + responderId.charCodeAt(responderId.length - 1);
  return TRIP_COLORS[hash % TRIP_COLORS.length];
}

// ── GeoJSON types ─────────────────────────────────────────────
interface BoundaryGeoJSON {
  type: "Feature";
  properties: { name: string };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

interface BarangaysGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { name: string; osm_name?: string };
    geometry: { type: "Polygon"; coordinates: number[][][] };
  }>;
}

// ═══════════════════════════════════════════════════════════════
export default function LiveMapView() {
  const router = useRouter();
  const { selectedBarangay } = useBarangayFilter();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const sosClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const responderLayerRef = useRef<L.LayerGroup | null>(null);
  const evacLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<any>(null);

  const maskLayerRef = useRef<L.Polygon | null>(null);
  const cityOutlineRef = useRef<L.GeoJSON | null>(null);
  const cityGlowRef = useRef<L.GeoJSON | null>(null);
  const barangaysLayerRef = useRef<L.GeoJSON | null>(null);
  const highlightLayerRef = useRef<L.GeoJSON | null>(null);

  const sosMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const responderMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const evacMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  const disposedRef = useRef(false);

  const [incidents, setIncidents] = useState<SOSIncident[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [evacCenters, setEvacCenters] = useState<EvacCenter[]>([]);
  const [activeTrips, setActiveTrips] = useState<TripPlan[]>([]);

  const [cityBoundary, setCityBoundary] = useState<BoundaryGeoJSON | null>(
    null,
  );
  const [barangays, setBarangays] = useState<BarangaysGeoJSON | null>(null);

  const [showSOS, setShowSOS] = useState(true);
  const [showResponders, setShowResponders] = useState(true);
  const [showEvacs, setShowEvacs] = useState(true);
  const [showTrips, setShowTrips] = useState(true);
  const [showBarangays, setShowBarangays] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [sosStatusFilter, setSosStatusFilter] = useState<string>("active");

  const [activeTab, setActiveTab] = useState<TabId>("evacs");
  const [listSearch, setListSearch] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // ── Load GeoJSON files once ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/geo/dasma-boundary.json").then((r) => r.json()),
      fetch("/geo/dasma-barangays.json").then((r) => r.json()),
    ])
      .then(([boundary, brgy]) => {
        if (cancelled) return;
        setCityBoundary(boundary as BoundaryGeoJSON);
        setBarangays(brgy as BarangaysGeoJSON);
      })
      .catch((err) => console.error("Failed to load boundary GeoJSON:", err));

    return () => {
      cancelled = true;
    };
  }, []);

  // ── INIT MAP ────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    disposedRef.current = false;

    const map = L.map(containerRef.current, {
      center: MAP_CONFIG.defaultCenter,
      zoom: MAP_CONFIG.defaultZoom,
      maxBounds: L.latLngBounds(MAP_CONFIG.maxBounds),
      maxBoundsViscosity: 1.0,
    });

    L.tileLayer(MAP_CONFIG.tileUrl, {
      attribution: MAP_CONFIG.attribution,
      maxZoom: MAP_CONFIG.maxZoom,
      minZoom: MAP_CONFIG.minZoom,
    }).addTo(map);

    const sosCluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true,
      chunkedLoading: true,
      chunkInterval: 50,
      chunkDelay: 10,
      showCoverageOnHover: false,
      iconCreateFunction(cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({
          className: "",
          html: `
            <div style="
              width:40px;
              height:40px;
              border-radius:9999px;
              background:#ef4444;
              color:white;
              border:3px solid #ffffff;
              box-shadow:0 0 0 5px rgba(239,68,68,0.18), 0 8px 18px rgba(0,0,0,0.35);
              display:flex;
              align-items:center;
              justify-content:center;
              font-weight:800;
              font-size:13px;
            ">
              ${count}
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
      },
    });

    const responderLayer = L.layerGroup();
    const evacLayer = L.layerGroup();
    const routeLayer = L.layerGroup();

    map.addLayer(sosCluster);
    map.addLayer(responderLayer);
    map.addLayer(evacLayer);
    map.addLayer(routeLayer);

    mapRef.current = map;
    sosClusterRef.current = sosCluster;
    responderLayerRef.current = responderLayer;
    evacLayerRef.current = evacLayer;
    routeLayerRef.current = routeLayer;

    const invalidateTimer = setTimeout(() => {
      if (!disposedRef.current) map.invalidateSize();
    }, 100);

    return () => {
      disposedRef.current = true;
      clearTimeout(invalidateTimer);

      try {
        map.remove();
      } catch {
        // cleanup only
      }

      mapRef.current = null;
      sosClusterRef.current = null;
      responderLayerRef.current = null;
      evacLayerRef.current = null;
      routeLayerRef.current = null;
      heatLayerRef.current = null;
      maskLayerRef.current = null;
      cityOutlineRef.current = null;
      cityGlowRef.current = null;
      barangaysLayerRef.current = null;
      highlightLayerRef.current = null;
      sosMarkersRef.current.clear();
      responderMarkersRef.current.clear();
      evacMarkersRef.current.clear();
    };
  }, []);

  // ── RENDER BOUNDARY OVERLAYS ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cityBoundary || !barangays || disposedRef.current) return;

    const dasmaRing: [number, number][] =
      cityBoundary.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
    const worldRing: [number, number][] = [
      [14.1, 120.6],
      [14.1, 121.3],
      [14.55, 121.3],
      [14.55, 120.6],
    ];

    const mask = L.polygon([worldRing, dasmaRing], {
      color: "transparent",
      fillColor: "#020617",
      fillOpacity: 0.58,
      stroke: false,
      interactive: false,
    });
    mask.addTo(map);
    maskLayerRef.current = mask;

    const cityGlow = L.geoJSON(cityBoundary as any, {
      style: {
        color: "#ffffff",
        weight: 8,
        opacity: 0.16,
        fill: false,
        interactive: false,
      } as any,
      interactive: false,
    });
    cityGlow.addTo(map);
    cityGlowRef.current = cityGlow;

    const cityOutline = L.geoJSON(cityBoundary as any, {
      style: {
        color: "#60a5fa",
        weight: 3.6,
        opacity: 1,
        fill: false,
        interactive: false,
      } as any,
      interactive: false,
    });
    cityOutline.addTo(map);
    cityOutlineRef.current = cityOutline;

    const brgyLayer = L.geoJSON(barangays as any, {
      style: {
        color: "#93c5fd",
        weight: 1.5,
        opacity: 0.8,
        fillColor: "#bfdbfe",
        fillOpacity: 0.035,
        interactive: false,
      } as any,
      interactive: false,
    });
    brgyLayer.addTo(map);
    barangaysLayerRef.current = brgyLayer;

    mask.bringToBack();
    cityGlow.bringToBack();
    cityOutline.bringToBack();
    brgyLayer.bringToBack();

    return () => {
      if (disposedRef.current) return;
      if (maskLayerRef.current && map.hasLayer(maskLayerRef.current)) {
        map.removeLayer(maskLayerRef.current);
      }
      if (cityGlowRef.current && map.hasLayer(cityGlowRef.current)) {
        map.removeLayer(cityGlowRef.current);
      }
      if (cityOutlineRef.current && map.hasLayer(cityOutlineRef.current)) {
        map.removeLayer(cityOutlineRef.current);
      }
      if (
        barangaysLayerRef.current &&
        map.hasLayer(barangaysLayerRef.current)
      ) {
        map.removeLayer(barangaysLayerRef.current);
      }
      maskLayerRef.current = null;
      cityGlowRef.current = null;
      cityOutlineRef.current = null;
      barangaysLayerRef.current = null;
    };
  }, [cityBoundary, barangays]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = barangaysLayerRef.current;
    if (!map || !layer || disposedRef.current) return;

    if (showBarangays) {
      if (!map.hasLayer(layer)) map.addLayer(layer);
    } else {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    }
  }, [showBarangays]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || disposedRef.current) return;

    if (highlightLayerRef.current && map.hasLayer(highlightLayerRef.current)) {
      map.removeLayer(highlightLayerRef.current);
      highlightLayerRef.current = null;
    }

    if (!selectedBarangay || !barangays) {
      if (!selectedBarangay && cityBoundary) {
        map.flyTo(MAP_CONFIG.defaultCenter, MAP_CONFIG.defaultZoom, {
          duration: 0.9,
        });
      }
      return;
    }

    const feat = barangays.features.find(
      (f) => f.properties.name.toLowerCase() === selectedBarangay.toLowerCase(),
    );
    if (!feat) return;

    const highlight = L.geoJSON(feat as any, {
      style: {
        color: "#f8fafc",
        weight: 4,
        opacity: 1,
        fillColor: "#3b82f6",
        fillOpacity: 0.16,
        interactive: false,
      } as any,
      interactive: false,
    });
    highlight.addTo(map);
    highlightLayerRef.current = highlight;

    const bounds = highlight.getBounds();
    if (bounds.isValid()) {
      map.flyToBounds(bounds, { duration: 0.9, padding: [40, 40] });
    }
  }, [selectedBarangay, barangays, cityBoundary]);

  // ── DATA FETCH ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let incQ = supabase
        .from("sos_incidents")
        .select(
          "id, barangay, flood_severity, status, people_count, message, location, created_at",
        )
        .in("status", ["pending", "assigned", "in_progress"])
        .limit(200);

      if (selectedBarangay) incQ = incQ.eq("barangay", selectedBarangay);

      let evacQ = supabase
        .from("evacuation_centers")
        .select(
          "id, name, barangay, capacity, current_occupancy, is_open, location",
        );

      if (selectedBarangay) evacQ = evacQ.eq("barangay", selectedBarangay);

      const [incRes, respRes, evacRes, tripRes] = await Promise.all([
        incQ,
        supabase
          .from("responders")
          .select(
            "id, team_name, vehicle_type, is_available, current_load, max_capacity, current_location, last_location_update",
          ),
        evacQ,
        supabase
          .from("trip_plans")
          .select(
            "id, responder_id, status, stops, route_geometry, route_distance_meters, route_duration_seconds",
          )
          .eq("status", "active"),
      ]);

      if (cancelled || disposedRef.current) return;

      if (incRes.error)
        console.error("[LiveMap] incidents error:", incRes.error);
      if (respRes.error)
        console.error("[LiveMap] responders error:", respRes.error);
      if (evacRes.error) console.error("[LiveMap] evacs error:", evacRes.error);
      if (tripRes.error) console.error("[LiveMap] trips error:", tripRes.error);

      if (incRes.data) setIncidents(incRes.data as SOSIncident[]);

      if (respRes.data) {
        const responderIds = (respRes.data as any[])
          .map((r) => r.id)
          .filter(Boolean);

        const barangayById = new Map<string, string>();

        if (responderIds.length > 0) {
          const respUsersRes = await supabase
            .from("users")
            .select("id, barangay")
            .in("id", responderIds);

          if (cancelled || disposedRef.current) return;

          if (respUsersRes.error) {
            console.warn("[LiveMap] users barangay error:", respUsersRes.error);
          } else {
            (respUsersRes.data ?? []).forEach((u: any) => {
              if (u?.id && u?.barangay) barangayById.set(u.id, u.barangay);
            });
          }
        }

        const merged: Responder[] = (respRes.data as any[]).map((r) => ({
          id: r.id,
          team_name: r.team_name,
          vehicle_type: r.vehicle_type,
          is_available: r.is_available,
          current_load: r.current_load,
          max_capacity: r.max_capacity,
          current_location: r.current_location,
          last_location_update: r.last_location_update,
          home_barangay: barangayById.get(r.id) ?? null,
        }));

        setResponders(merged);
      }

      if (evacRes.data) setEvacCenters(evacRes.data as EvacCenter[]);
      if (tripRes.data) setActiveTrips(tripRes.data as TripPlan[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedBarangay]);

  // ── REALTIME ────────────────────────────────────────────────
  useEffect(() => {
    const channelId = `livemap-${Date.now()}`;

    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sos_incidents" },
        (payload) => {
          if (disposedRef.current) return;

          if (payload.eventType === "INSERT") {
            const n = payload.new as SOSIncident;
            if (!["pending", "assigned", "in_progress"].includes(n.status))
              return;
            if (selectedBarangay && n.barangay !== selectedBarangay) return;
            setIncidents((prev) => [n, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const u = payload.new as SOSIncident;
            if (["resolved", "false_alarm"].includes(u.status)) {
              setIncidents((prev) => prev.filter((i) => i.id !== u.id));
            } else if (selectedBarangay && u.barangay !== selectedBarangay) {
              setIncidents((prev) => prev.filter((i) => i.id !== u.id));
            } else {
              setIncidents((prev) =>
                prev.map((i) => (i.id === u.id ? { ...i, ...u } : i)),
              );
            }
          } else if (payload.eventType === "DELETE") {
            setIncidents((prev) =>
              prev.filter((i) => i.id !== (payload.old as any).id),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "responders" },
        (payload) => {
          if (disposedRef.current) return;
          setResponders((prev) =>
            prev.map((r) =>
              r.id !== payload.new.id
                ? r
                : {
                    ...r,
                    ...(payload.new as any),
                    home_barangay: r.home_barangay,
                  },
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "evacuation_centers" },
        (payload) => {
          if (disposedRef.current) return;
          const u = payload.new as EvacCenter;
          if (selectedBarangay && u.barangay !== selectedBarangay) return;
          setEvacCenters((prev) =>
            prev.map((e) => (e.id === u.id ? { ...e, ...u } : e)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_plans" },
        (payload) => {
          if (disposedRef.current) return;

          if (payload.eventType === "INSERT") {
            const n = payload.new as TripPlan;
            if (n.status === "active") {
              setActiveTrips((prev) => [...prev, n]);
            }
          } else if (payload.eventType === "UPDATE") {
            const u = payload.new as TripPlan;
            if (u.status === "active") {
              setActiveTrips((prev) => {
                const has = prev.find((t) => t.id === u.id);
                return has
                  ? prev.map((t) => (t.id === u.id ? u : t))
                  : [...prev, u];
              });
            } else {
              setActiveTrips((prev) => prev.filter((t) => t.id !== u.id));
            }
          } else if (payload.eventType === "DELETE") {
            setActiveTrips((prev) =>
              prev.filter((t) => t.id !== (payload.old as any).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedBarangay]);

  // ── RENDER SOS MARKERS / HEATMAP ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const cluster = sosClusterRef.current;
    if (!map || !cluster || disposedRef.current) return;

    if (heatLayerRef.current && map.hasLayer(heatLayerRef.current)) {
      map.removeLayer(heatLayerRef.current);
    }
    heatLayerRef.current = null;
    cluster.clearLayers();
    sosMarkersRef.current.clear();

    if (!showSOS) return;

    const filtered = incidents.filter((i) => {
      if (sosStatusFilter === "active") {
        return ["pending", "assigned", "in_progress"].includes(i.status);
      }
      if (sosStatusFilter === "all") return true;
      return i.status === sosStatusFilter;
    });

    if (heatmapMode) {
      const pts: [number, number, number][] = [];

      for (const inc of filtered) {
        const coords = parseLocation(inc.location);
        if (!coords) continue;

        const w =
          inc.flood_severity === "critical"
            ? 1.0
            : inc.flood_severity === "high"
              ? 0.7
              : inc.flood_severity === "moderate"
                ? 0.5
                : 0.3;

        pts.push([coords[0], coords[1], w]);
      }

      if (pts.length > 0) {
        // @ts-ignore
        const layer = L.heatLayer(pts, {
          radius: 34,
          blur: 24,
          maxZoom: 17,
          gradient: {
            0.2: "#22c55e",
            0.5: "#f59e0b",
            0.8: "#f97316",
            1.0: "#ef4444",
          },
        });
        layer.addTo(map);
        heatLayerRef.current = layer;
      }

      return;
    }

    for (const inc of filtered) {
      const coords = parseLocation(inc.location);
      if (!coords) continue;

      const marker = L.marker(coords, {
        icon: createSOSIcon(
          inc.flood_severity,
          inc.flood_severity === "critical",
        ),
      });
      marker.bindPopup(() => buildSOSPopup(inc), { maxWidth: 280 });
      cluster.addLayer(marker);
      sosMarkersRef.current.set(inc.id, marker);
    }
  }, [incidents, showSOS, heatmapMode, sosStatusFilter]);

  // ── RENDER RESPONDER MARKERS ────────────────────────────────
  useEffect(() => {
    const layer = responderLayerRef.current;
    if (!layer || disposedRef.current) return;

    layer.clearLayers();
    responderMarkersRef.current.clear();

    if (!showResponders) return;

    for (const r of responders) {
      const coords = parseLocation(r.current_location);
      if (!coords) continue;

      const marker = L.marker(coords, {
        icon: createResponderIcon(r.is_available),
      });
      marker.bindPopup(() => buildResponderPopup(r), { maxWidth: 260 });
      layer.addLayer(marker);
      responderMarkersRef.current.set(r.id, marker);
    }
  }, [responders, showResponders]);

  // ── RENDER EVAC MARKERS ─────────────────────────────────────
  useEffect(() => {
    const layer = evacLayerRef.current;
    if (!layer || disposedRef.current) return;

    layer.clearLayers();
    evacMarkersRef.current.clear();

    if (!showEvacs) return;

    for (const e of evacCenters) {
      const coords = parseLocation(e.location);
      if (!coords) continue;

      const marker = L.marker(coords, {
        icon: createEvacIcon(e.is_open),
      });
      marker.bindPopup(() => buildEvacPopup(e), { maxWidth: 260 });
      layer.addLayer(marker);
      evacMarkersRef.current.set(e.id, marker);
    }
  }, [evacCenters, showEvacs]);

  // ── RENDER TRIP ROUTES ──────────────────────────────────────
  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer || disposedRef.current) return;

    layer.clearLayers();
    if (!showTrips) return;

    for (const trip of activeTrips) {
      const color = tripColor(trip.responder_id);

      const geometry = trip.route_geometry;
      if (
        geometry &&
        geometry.type === "LineString" &&
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length >= 2
      ) {
        const latlngs = geometry.coordinates
          .filter(
            (coord): coord is [number, number] =>
              Array.isArray(coord) &&
              coord.length === 2 &&
              typeof coord[0] === "number" &&
              typeof coord[1] === "number",
          )
          .map(([lng, lat]) => [lat, lng] as [number, number]);

        if (latlngs.length >= 2) {
          addStyledRouteToLayer(layer, latlngs, color);
          continue;
        }
      }

      const responder = responders.find((r) => r.id === trip.responder_id);
      const responderCoords = responder
        ? parseLocation(responder.current_location)
        : null;

      const stopCoords: [number, number][] = (trip.stops || [])
        .filter(
          (s: any) => typeof s?.lat === "number" && typeof s?.lng === "number",
        )
        .map((s: any) => [s.lat as number, s.lng as number]);

      const path: [number, number][] = [];
      if (responderCoords) path.push(responderCoords);
      path.push(...stopCoords);

      if (path.length < 2) continue;

      addStyledRouteToLayer(layer, path, color);
    }
  }, [activeTrips, responders, showTrips]);

  // ── List handlers ───────────────────────────────────────────
  function focusLocation(
    coords: [number, number],
    markerKey: string,
    markerType: TabId,
  ) {
    const map = mapRef.current;
    if (!map || disposedRef.current) return;

    map.flyTo(coords, 17, { duration: 1.2 });

    setTimeout(() => {
      if (disposedRef.current) return;

      if (markerType === "sos") {
        const marker = sosMarkersRef.current.get(markerKey);
        const cluster = sosClusterRef.current;
        if (marker && cluster) {
          cluster.zoomToShowLayer(marker, () => marker.openPopup());
        }
      } else if (markerType === "responders") {
        const marker = responderMarkersRef.current.get(markerKey);
        if (marker) marker.openPopup();
      } else if (markerType === "evacs") {
        const marker = evacMarkersRef.current.get(markerKey);
        if (marker) marker.openPopup();
      }
    }, 1250);

    setHighlightedId(markerKey);
  }

  function viewDetails(tab: TabId, id: string) {
    if (tab === "sos") router.push(`/dashboard/incidents?focus=${id}`);
    else if (tab === "responders") {
      router.push(`/dashboard/responders?focus=${id}`);
    } else if (tab === "evacs") {
      router.push(`/dashboard/evacuation?focus=${id}`);
    }
  }

  // ── Derived filtered lists ──────────────────────────────────
  const filteredIncidents = useMemo(() => {
    const base = incidents.filter((i) => {
      if (sosStatusFilter === "active") {
        return ["pending", "assigned", "in_progress"].includes(i.status);
      }
      if (sosStatusFilter === "all") return true;
      return i.status === sosStatusFilter;
    });

    if (!listSearch.trim()) return base;

    const q = listSearch.toLowerCase();
    return base.filter(
      (i) =>
        i.barangay.toLowerCase().includes(q) ||
        (i.message?.toLowerCase().includes(q) ?? false) ||
        (i.flood_severity?.toLowerCase().includes(q) ?? false),
    );
  }, [incidents, sosStatusFilter, listSearch]);

  const filteredResponders = useMemo(() => {
    let base = responders;

    if (selectedBarangay) {
      base = base.filter((r) => matchesResponderBarangay(r, selectedBarangay));
    }

    if (!listSearch.trim()) return base;

    const q = listSearch.toLowerCase();
    return base.filter(
      (r) =>
        (r.team_name?.toLowerCase().includes(q) ?? false) ||
        (r.vehicle_type?.toLowerCase().includes(q) ?? false),
    );
  }, [responders, listSearch, selectedBarangay]);

  const filteredEvacs = useMemo(() => {
    if (!listSearch.trim()) return evacCenters;
    const q = listSearch.toLowerCase();

    return evacCenters.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.barangay.toLowerCase().includes(q),
    );
  }, [evacCenters, listSearch]);

  const activeCounts = {
    sos: filteredIncidents.length,
    responders: filteredResponders.length,
    evacs: filteredEvacs.length,
  };

  return (
    <div className="relative h-full w-full bg-gray-950">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute bottom-4 right-4 z-[1000] rounded-xl border border-gray-800 bg-gray-900/95 px-3 py-2 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span className="text-gray-500">Severity:</span>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Low
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> Moderate
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#f97316]" /> High
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#ef4444]" /> Critical
          </div>
        </div>
      </div>

      <div className="absolute left-4 top-4 bottom-4 z-[1000] flex w-80 flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900/95 shadow-2xl backdrop-blur">
        <div className="border-b border-gray-800 p-4">
          {selectedBarangay && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-600/10 px-2.5 py-1.5 text-xs text-blue-300">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Focused: {selectedBarangay}</span>
            </div>
          )}

          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Map Layers
          </h3>

          <div className="space-y-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={showSOS}
                onChange={(e) => setShowSOS(e.target.checked)}
                className="h-4 w-4 rounded accent-red-500"
              />
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span>SOS Incidents</span>
              <span className="ml-auto text-[10px] text-gray-500">
                {activeCounts.sos}
              </span>
            </label>

            {showSOS && (
              <div className="ml-6">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-400">
                  <input
                    type="checkbox"
                    checked={heatmapMode}
                    onChange={(e) => setHeatmapMode(e.target.checked)}
                    className="h-3 w-3 rounded accent-orange-500"
                  />
                  <Flame className="h-3 w-3 text-orange-400" />
                  Heatmap mode
                </label>
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={showResponders}
                onChange={(e) => setShowResponders(e.target.checked)}
                className="h-4 w-4 rounded accent-amber-500"
              />
              <Users className="h-4 w-4 text-amber-400" />
              <span>Responders</span>
              <span className="ml-auto text-[10px] text-gray-500">
                {responders.length}
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={showEvacs}
                onChange={(e) => setShowEvacs(e.target.checked)}
                className="h-4 w-4 rounded accent-teal-500"
              />
              <Building2 className="h-4 w-4 text-teal-400" />
              <span>Evac Centers</span>
              <span className="ml-auto text-[10px] text-gray-500">
                {evacCenters.length}
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={showTrips}
                onChange={(e) => setShowTrips(e.target.checked)}
                className="h-4 w-4 rounded accent-purple-500"
              />
              <Activity className="h-4 w-4 text-purple-400" />
              <span>Active Routes</span>
              <span className="ml-auto text-[10px] text-gray-500">
                {activeTrips.length}
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={showBarangays}
                onChange={(e) => setShowBarangays(e.target.checked)}
                className="h-4 w-4 rounded accent-slate-500"
              />
              <MapPin className="h-4 w-4 text-slate-400" />
              <span>Barangay Outlines</span>
              <span className="ml-auto text-[10px] text-gray-500">
                {barangays?.features.length ?? "—"}
              </span>
            </label>
          </div>

          {showSOS && (
            <div className="mt-3 border-t border-gray-800 pt-3">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">
                SOS Status
              </label>
              <select
                value={sosStatusFilter}
                onChange={(e) => setSosStatusFilter(e.target.value)}
                className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500"
              >
                <option value="active">
                  Active (pending/assigned/in progress)
                </option>
                <option value="pending">Pending only</option>
                <option value="assigned">Assigned only</option>
                <option value="in_progress">In Progress only</option>
                <option value="all">All (including resolved)</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex border-b border-gray-800">
            <TabButton
              active={activeTab === "sos"}
              onClick={() => setActiveTab("sos")}
              label="SOS"
              count={activeCounts.sos}
              color="text-red-400"
            />
            <TabButton
              active={activeTab === "responders"}
              onClick={() => setActiveTab("responders")}
              label="Responders"
              count={activeCounts.responders}
              color="text-amber-400"
            />
            <TabButton
              active={activeTab === "evacs"}
              onClick={() => setActiveTab("evacs")}
              label="Evacs"
              count={activeCounts.evacs}
              color="text-teal-400"
            />
          </div>

          <div className="relative border-b border-gray-800 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-md border border-gray-700 bg-gray-800 py-1.5 pl-8 pr-3 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === "sos" &&
              (filteredIncidents.length === 0 ? (
                <EmptyState message="No SOS incidents" />
              ) : (
                <ul className="divide-y divide-gray-800">
                  {filteredIncidents.map((inc) => (
                    <SOSListItem
                      key={inc.id}
                      incident={inc}
                      highlighted={highlightedId === inc.id}
                      onFocus={() => {
                        const coords = parseLocation(inc.location);
                        if (coords) focusLocation(coords, inc.id, "sos");
                      }}
                      onViewDetails={() => viewDetails("sos", inc.id)}
                    />
                  ))}
                </ul>
              ))}

            {activeTab === "responders" &&
              (filteredResponders.length === 0 ? (
                <EmptyState message="No responders" />
              ) : (
                <ul className="divide-y divide-gray-800">
                  {filteredResponders.map((r) => (
                    <ResponderListItem
                      key={r.id}
                      responder={r}
                      highlighted={highlightedId === r.id}
                      onFocus={() => {
                        const coords = parseLocation(r.current_location);
                        if (coords) focusLocation(coords, r.id, "responders");
                      }}
                      onViewDetails={() => viewDetails("responders", r.id)}
                    />
                  ))}
                </ul>
              ))}

            {activeTab === "evacs" &&
              (filteredEvacs.length === 0 ? (
                <EmptyState message="No evacuation centers" />
              ) : (
                <ul className="divide-y divide-gray-800">
                  {filteredEvacs.map((e) => (
                    <EvacListItem
                      key={e.id}
                      evac={e}
                      highlighted={highlightedId === e.id}
                      onFocus={() => {
                        const coords = parseLocation(e.location);
                        if (coords) focusLocation(coords, e.id, "evacs");
                      }}
                      onViewDetails={() => viewDetails("evacs", e.id)}
                    />
                  ))}
                </ul>
              ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes kabayan-pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.82;
          }
        }
      `}</style>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 border-b-2 px-2 py-2.5 text-xs font-medium transition-colors ${
        active
          ? `border-blue-500 ${color}`
          : "border-transparent text-gray-500 hover:text-gray-300"
      }`}
    >
      {label}
      <span className="ml-1 text-[10px] text-gray-500">({count})</span>
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center px-4 text-center">
      <MapPin className="mb-2 h-6 w-6 text-gray-700" />
      <p className="text-xs text-gray-500">{message}</p>
    </div>
  );
}

function SOSListItem({
  incident,
  highlighted,
  onFocus,
  onViewDetails,
}: {
  incident: SOSIncident;
  highlighted: boolean;
  onFocus: () => void;
  onViewDetails: () => void;
}) {
  const color = SEVERITY_COLORS[incident.flood_severity || "pending"];

  return (
    <li
      className={`group transition-colors ${
        highlighted ? "bg-blue-600/10" : "hover:bg-gray-800/50"
      }`}
    >
      <div className="flex items-start gap-2 p-2.5">
        <button
          onClick={onFocus}
          className="flex flex-1 items-start gap-2 text-left"
        >
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-gray-200">
              {incident.barangay}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="capitalize">
                {incident.flood_severity || "assessing"}
              </span>
              <span>•</span>
              <span>{incident.status.replace("_", " ")}</span>
              <span>•</span>
              <span>{incident.people_count ?? 1}p</span>
            </div>
          </div>
        </button>

        <button
          onClick={onViewDetails}
          title="View details"
          className="shrink-0 rounded p-1 text-gray-500 opacity-0 transition-all hover:bg-gray-700 hover:text-gray-200 group-hover:opacity-100"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function ResponderListItem({
  responder,
  highlighted,
  onFocus,
  onViewDetails,
}: {
  responder: Responder;
  highlighted: boolean;
  onFocus: () => void;
  onViewDetails: () => void;
}) {
  const color = responder.is_available ? "#22c55e" : "#f59e0b";
  const loadPct =
    responder.max_capacity && responder.max_capacity > 0
      ? Math.round(
          ((responder.current_load ?? 0) / responder.max_capacity) * 100,
        )
      : 0;

  return (
    <li
      className={`group transition-colors ${
        highlighted ? "bg-blue-600/10" : "hover:bg-gray-800/50"
      }`}
    >
      <div className="flex items-start gap-2 p-2.5">
        <button
          onClick={onFocus}
          className="flex flex-1 items-start gap-2 text-left"
        >
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-gray-200">
              {responder.team_name || "Responder"}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
              <span>{responder.vehicle_type || "—"}</span>
              <span>•</span>
              <span>{responder.is_available ? "Available" : "On Trip"}</span>
              <span>•</span>
              <span>Load {loadPct}%</span>
            </div>
            {responder.home_barangay && (
              <div className="mt-0.5 text-[10px] text-gray-600">
                {responder.home_barangay}
              </div>
            )}
          </div>
        </button>

        <button
          onClick={onViewDetails}
          title="View details"
          className="shrink-0 rounded p-1 text-gray-500 opacity-0 transition-all hover:bg-gray-700 hover:text-gray-200 group-hover:opacity-100"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function EvacListItem({
  evac,
  highlighted,
  onFocus,
  onViewDetails,
}: {
  evac: EvacCenter;
  highlighted: boolean;
  onFocus: () => void;
  onViewDetails: () => void;
}) {
  const color = evac.is_open ? "#14b8a6" : "#64748b";
  const capacity = evac.capacity ?? 0;

  return (
    <li
      className={`group transition-colors ${
        highlighted ? "bg-blue-600/10" : "hover:bg-gray-800/50"
      }`}
    >
      <div className="flex items-start gap-2 p-2.5">
        <button
          onClick={onFocus}
          className="flex flex-1 items-start gap-2 text-left"
        >
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-gray-200">
              {evac.name}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="truncate">{evac.barangay}</span>
              <span>•</span>
              <span
                className={evac.is_open ? "text-teal-400" : "text-gray-500"}
              >
                {evac.is_open ? "OPEN" : "Closed"}
              </span>
              {capacity > 0 && (
                <>
                  <span>•</span>
                  <span>
                    {evac.current_occupancy}/{capacity}
                  </span>
                </>
              )}
            </div>
          </div>
        </button>

        <button
          onClick={onViewDetails}
          title="View details"
          className="shrink-0 rounded p-1 text-gray-500 opacity-0 transition-all hover:bg-gray-700 hover:text-gray-200 group-hover:opacity-100"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
