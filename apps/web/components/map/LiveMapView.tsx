// apps/web/components/map/LiveMapView.tsx
"use client";

import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";

import { createClient } from "../../lib/supabase/client";
import { MAP_CONFIG, SEVERITY_COLORS } from "../../lib/map-config";
import { parseLocation } from "../../lib/types";

const supabase = createClient();

// ── Types ────────────────────────────────────────────────
interface SOSIncident {
  id: string;
  barangay: string;
  flood_severity: string | null;
  status: string;
  people_count: number | null;
  message: string | null;
  location: any; // `any` — Supabase returns geography in various formats
  created_at: string;
}

interface Responder {
  id: string;
  team_name: string | null;
  vehicle_type: string | null;
  is_available: boolean;
  current_load: number | null;
  max_capacity: number | null;
  current_location: any; // `any` — same reason
  last_location_update: string | null;
}

interface EvacCenter {
  id: string;
  name: string;
  barangay: string;
  capacity: number | null;
  current_occupancy: number;
  is_open: boolean;
  location: any; // `any` — same reason
}

interface TripPlan {
  id: string;
  responder_id: string;
  status: string;
  stops: any[];
}

// ── Icon factories ────────────────────────────────────────
function createSOSIcon(severity: string | null, isCritical: boolean): L.DivIcon {
  const color = SEVERITY_COLORS[severity || "pending"] || SEVERITY_COLORS.pending;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:22px;height:22px;background:${color};
      border:2.5px solid white;border-radius:50%;
      box-shadow:0 2px 8px rgba(0,0,0,0.6);
      ${isCritical ? "animation:kabayan-pulse 1.5s infinite;" : ""}
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function createResponderIcon(isAvailable: boolean): L.DivIcon {
  const color = isAvailable ? "#22c55e" : "#f59e0b";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:24px;height:24px;background:${color};
      border:3px solid white;border-radius:6px;
      box-shadow:0 2px 8px rgba(0,0,0,0.6);
      display:flex;align-items:center;justify-content:center;
      font-size:11px;color:white;font-weight:700;
    ">R</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createEvacIcon(isOpen: boolean): L.DivIcon {
  const color = isOpen ? "#3b82f6" : "#6b7280";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:22px;height:22px;background:${color};
      border:2.5px solid white;border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,0.5);
      display:flex;align-items:center;justify-content:center;
      font-size:11px;color:white;font-weight:700;
    ">E</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// ── Popup builders ────────────────────────────────────────
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
        ${new Date(inc.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>`;
  return el;
}

function buildResponderPopup(r: Responder): HTMLElement {
  const el = document.createElement("div");
  el.style.minWidth = "200px";
  const loadPct = r.max_capacity && r.max_capacity > 0
    ? Math.round(((r.current_load ?? 0) / r.max_capacity) * 100) : 0;
  const statusColor = r.is_available ? "#22c55e" : "#f59e0b";
  el.innerHTML = `
    <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${r.team_name || "Responder"}</div>
      <div style="color:#9ca3af;margin-bottom:4px;">${r.vehicle_type || "—"}</div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${statusColor};"></span>
        <span style="color:${statusColor};font-weight:600;font-size:11px;">${r.is_available ? "Available" : "On Trip"}</span>
      </div>
      <div style="color:#9ca3af;font-size:12px;">
        Load: <strong>${r.current_load ?? 0}/${r.max_capacity ?? 0}</strong> (${loadPct}%)
      </div>
      ${r.last_location_update ? `<div style="color:#6b7280;font-size:11px;margin-top:4px;">
        Last update: ${new Date(r.last_location_update).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
      </div>` : ""}
    </div>`;
  return el;
}

function buildEvacPopup(e: EvacCenter): HTMLElement {
  const el = document.createElement("div");
  el.style.minWidth = "200px";
  const capacity = e.capacity ?? 0;
  const occPct = capacity > 0 ? Math.round((e.current_occupancy / capacity) * 100) : 0;
  const statusColor = e.is_open ? "#3b82f6" : "#6b7280";
  el.innerHTML = `
    <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${e.name}</div>
      <div style="color:#9ca3af;margin-bottom:4px;">${e.barangay}</div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${statusColor};"></span>
        <span style="color:${statusColor};font-weight:600;font-size:11px;">${e.is_open ? "OPEN" : "Closed"}</span>
      </div>
      ${capacity > 0 ? `<div style="color:#9ca3af;font-size:12px;">
        Occupancy: <strong>${e.current_occupancy}/${capacity}</strong> (${occPct}%)
      </div>` : ""}
    </div>`;
  return el;
}

const TRIP_COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#14b8a6"];
function tripColor(responderId: string): string {
  const hash = responderId.charCodeAt(0) + responderId.charCodeAt(responderId.length - 1);
  return TRIP_COLORS[hash % TRIP_COLORS.length];
}

// ═══════════════════════════════════════════════════════════
export default function LiveMapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const sosClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const responderLayerRef = useRef<L.LayerGroup | null>(null);
  const evacLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<any>(null);

  const [incidents, setIncidents] = useState<SOSIncident[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [evacCenters, setEvacCenters] = useState<EvacCenter[]>([]);
  const [activeTrips, setActiveTrips] = useState<TripPlan[]>([]);

  const [showSOS, setShowSOS] = useState(true);
  const [showResponders, setShowResponders] = useState(true);
  const [showEvacs, setShowEvacs] = useState(true);
  const [showTrips, setShowTrips] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [sosStatusFilter, setSosStatusFilter] = useState<string>("active");

  // ── INIT MAP ──────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: MAP_CONFIG.defaultCenter,
      zoom: MAP_CONFIG.defaultZoom,
      maxBounds: L.latLngBounds(MAP_CONFIG.maxBounds),
      maxBoundsViscosity: 1.0,
      preferCanvas: true,
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

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      sosClusterRef.current = null;
      responderLayerRef.current = null;
      evacLayerRef.current = null;
      routeLayerRef.current = null;
      heatLayerRef.current = null;
    };
  }, []);

  // ── DATA FETCH ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [incRes, respRes, evacRes, tripRes] = await Promise.all([
        supabase
          .from("sos_incidents")
          .select("id, barangay, flood_severity, status, people_count, message, location, created_at")
          .in("status", ["pending", "assigned", "in_progress"])
          .limit(200),
        supabase
          .from("responders")
          .select("id, team_name, vehicle_type, is_available, current_load, max_capacity, current_location, last_location_update"),
        supabase
          .from("evacuation_centers")
          .select("id, name, barangay, capacity, current_occupancy, is_open, location"),
        supabase
          .from("trip_plans")
          .select("id, responder_id, status, stops")
          .eq("status", "active"),
      ]);

      if (incRes.data) setIncidents(incRes.data as SOSIncident[]);
      if (respRes.data) setResponders(respRes.data as Responder[]);
      if (evacRes.data) setEvacCenters(evacRes.data as EvacCenter[]);
      if (tripRes.data) setActiveTrips(tripRes.data as TripPlan[]);
    })();
  }, []);

  // ── REALTIME ──────────────────────────────────────────────
  useEffect(() => {
    const channelId = `livemap-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_incidents" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const n = payload.new as SOSIncident;
          if (["pending", "assigned", "in_progress"].includes(n.status)) {
            setIncidents((prev) => [n, ...prev]);
          }
        } else if (payload.eventType === "UPDATE") {
          const u = payload.new as SOSIncident;
          if (["resolved", "false_alarm"].includes(u.status)) {
            setIncidents((prev) => prev.filter((i) => i.id !== u.id));
          } else {
            setIncidents((prev) => prev.map((i) => (i.id === u.id ? { ...i, ...u } : i)));
          }
        } else if (payload.eventType === "DELETE") {
          setIncidents((prev) => prev.filter((i) => i.id !== (payload.old as any).id));
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "responders" }, (payload) => {
        setResponders((prev) => prev.map((r) => (r.id === payload.new.id ? { ...r, ...(payload.new as Responder) } : r)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "evacuation_centers" }, (payload) => {
        setEvacCenters((prev) => prev.map((e) => (e.id === payload.new.id ? { ...e, ...(payload.new as EvacCenter) } : e)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_plans" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const n = payload.new as TripPlan;
          if (n.status === "active") setActiveTrips((prev) => [...prev, n]);
        } else if (payload.eventType === "UPDATE") {
          const u = payload.new as TripPlan;
          if (u.status === "active") {
            setActiveTrips((prev) => {
              const has = prev.find((t) => t.id === u.id);
              return has ? prev.map((t) => (t.id === u.id ? u : t)) : [...prev, u];
            });
          } else {
            setActiveTrips((prev) => prev.filter((t) => t.id !== u.id));
          }
        } else if (payload.eventType === "DELETE") {
          setActiveTrips((prev) => prev.filter((t) => t.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── RENDER SOS MARKERS / HEATMAP ──────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const cluster = sosClusterRef.current;
    if (!map || !cluster) return;

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    cluster.clearLayers();
    if (!showSOS) return;

    const filtered = incidents.filter((i) => {
      if (sosStatusFilter === "active") return ["pending", "assigned", "in_progress"].includes(i.status);
      if (sosStatusFilter === "all") return true;
      return i.status === sosStatusFilter;
    });

    if (heatmapMode) {
      const pts: [number, number, number][] = [];
      for (const inc of filtered) {
        const coords = parseLocation(inc.location);
        if (!coords) continue;
        const w = inc.flood_severity === "critical" ? 1.0 : inc.flood_severity === "high" ? 0.7 : inc.flood_severity === "moderate" ? 0.5 : 0.3;
        pts.push([coords[0], coords[1], w]);
      }
      if (pts.length > 0) {
        // @ts-ignore
        const layer = L.heatLayer(pts, { radius: 30, blur: 22, maxZoom: 17, gradient: { 0.2: "#22c55e", 0.5: "#f59e0b", 0.8: "#f97316", 1.0: "#ef4444" } });
        layer.addTo(map);
        heatLayerRef.current = layer;
      }
      return;
    }

    for (const inc of filtered) {
      const coords = parseLocation(inc.location);
      if (!coords) continue;
      const marker = L.marker(coords, { icon: createSOSIcon(inc.flood_severity, inc.flood_severity === "critical") });
      marker.bindPopup(() => buildSOSPopup(inc), { maxWidth: 280 });
      cluster.addLayer(marker);
    }
  }, [incidents, showSOS, heatmapMode, sosStatusFilter]);

  // ── RENDER RESPONDER MARKERS ──────────────────────────────
  useEffect(() => {
    const layer = responderLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!showResponders) return;

    for (const r of responders) {
      const coords = parseLocation(r.current_location);
      if (!coords) continue;
      const marker = L.marker(coords, { icon: createResponderIcon(r.is_available) });
      marker.bindPopup(() => buildResponderPopup(r), { maxWidth: 260 });
      layer.addLayer(marker);
    }
  }, [responders, showResponders]);

  // ── RENDER EVAC MARKERS ───────────────────────────────────
  useEffect(() => {
    const layer = evacLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!showEvacs) return;

    for (const e of evacCenters) {
      const coords = parseLocation(e.location);
      if (!coords) continue;
      const marker = L.marker(coords, { icon: createEvacIcon(e.is_open) });
      marker.bindPopup(() => buildEvacPopup(e), { maxWidth: 260 });
      layer.addLayer(marker);
    }
  }, [evacCenters, showEvacs]);

  // ── RENDER TRIP ROUTES ────────────────────────────────────
  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!showTrips) return;

    for (const trip of activeTrips) {
      const responder = responders.find((r) => r.id === trip.responder_id);
      const responderCoords = responder ? parseLocation(responder.current_location) : null;

      const stopCoords: [number, number][] = (trip.stops || [])
        .filter((s: any) => typeof s?.lat === "number" && typeof s?.lng === "number")
        .map((s: any) => [s.lat as number, s.lng as number]);

      const path: [number, number][] = [];
      if (responderCoords) path.push(responderCoords);
      path.push(...stopCoords);
      if (path.length < 2) continue;

      const polyline = L.polyline(path, {
        color: tripColor(trip.responder_id),
        weight: 4,
        opacity: 0.75,
        dashArray: "8, 8",
      });
      layer.addLayer(polyline);
    }
  }, [activeTrips, responders, showTrips]);

  const filteredIncCount = incidents.filter((i) => {
    if (sosStatusFilter === "active") return ["pending", "assigned", "in_progress"].includes(i.status);
    if (sosStatusFilter === "all") return true;
    return i.status === sosStatusFilter;
  }).length;

  return (
    <div className="relative h-full w-full bg-gray-950">
      <div ref={containerRef} className="h-full w-full" />

      {/* Filter panel */}
      <div className="absolute left-4 top-4 z-[1000] w-64 rounded-xl border border-gray-800 bg-gray-900/95 p-4 shadow-2xl backdrop-blur">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Map Layers</h3>

        <div className="space-y-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={showSOS} onChange={(e) => setShowSOS(e.target.checked)} className="h-4 w-4 rounded accent-red-500" />
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span>SOS Incidents</span>
            <span className="ml-auto text-[10px] text-gray-500">{filteredIncCount}</span>
          </label>

          {showSOS && (
            <div className="ml-6">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={heatmapMode} onChange={(e) => setHeatmapMode(e.target.checked)} className="h-3 w-3 rounded accent-orange-500" />
                <Flame className="h-3 w-3 text-orange-400" />
                Heatmap mode
              </label>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={showResponders} onChange={(e) => setShowResponders(e.target.checked)} className="h-4 w-4 rounded accent-amber-500" />
            <Users className="h-4 w-4 text-amber-400" />
            <span>Responders</span>
            <span className="ml-auto text-[10px] text-gray-500">{responders.length}</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={showEvacs} onChange={(e) => setShowEvacs(e.target.checked)} className="h-4 w-4 rounded accent-blue-500" />
            <Building2 className="h-4 w-4 text-blue-400" />
            <span>Evac Centers</span>
            <span className="ml-auto text-[10px] text-gray-500">{evacCenters.length}</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={showTrips} onChange={(e) => setShowTrips(e.target.checked)} className="h-4 w-4 rounded accent-purple-500" />
            <Activity className="h-4 w-4 text-purple-400" />
            <span>Active Routes</span>
            <span className="ml-auto text-[10px] text-gray-500">{activeTrips.length}</span>
          </label>
        </div>

        {showSOS && (
          <div className="mt-4 border-t border-gray-800 pt-3">
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">SOS Status</label>
            <select
              value={sosStatusFilter}
              onChange={(e) => setSosStatusFilter(e.target.value)}
              className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500"
            >
              <option value="active">Active (pending/assigned/in progress)</option>
              <option value="pending">Pending only</option>
              <option value="assigned">Assigned only</option>
              <option value="in_progress">In Progress only</option>
              <option value="all">All (including resolved)</option>
            </select>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] rounded-xl border border-gray-800 bg-gray-900/95 px-3 py-2 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span className="text-gray-500">Severity:</span>
          <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Low</div>
          <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> Moderate</div>
          <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f97316]" /> High</div>
          <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#ef4444]" /> Critical</div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes kabayan-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}
