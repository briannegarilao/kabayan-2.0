"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.heat";

import { createClient } from "../../lib/supabase/client";
import { MAP_CONFIG } from "../../lib/map-config";
import { parseLocation } from "../../lib/types";
import { useBarangayFilter } from "../../lib/barangay-filter";
import { matchesResponderBarangay } from "./barangay-utils";
import { createSOSIcon, createResponderIcon, createEvacIcon } from "./icons";
import { MapLegend } from "./MapLegend";
import { MapSidePanel } from "./MapSidePanel";
import { buildSOSPopup, buildResponderPopup, buildEvacPopup } from "./popups";
import { addStyledRouteToLayer, tripColor } from "./route-styles";
import type {
  BarangaysGeoJSON,
  BoundaryGeoJSON,
  EvacCenter,
  Responder,
  SOSIncident,
  TabId,
  TripPlan,
} from "./types";

const supabase = createClient();

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

  return (
    <div className="relative h-full w-full bg-gray-950">
      <div ref={containerRef} className="h-full w-full" />

      <MapLegend />

      <MapSidePanel
        selectedBarangay={selectedBarangay}
        showSOS={showSOS}
        setShowSOS={setShowSOS}
        showResponders={showResponders}
        setShowResponders={setShowResponders}
        showEvacs={showEvacs}
        setShowEvacs={setShowEvacs}
        showTrips={showTrips}
        setShowTrips={setShowTrips}
        showBarangays={showBarangays}
        setShowBarangays={setShowBarangays}
        heatmapMode={heatmapMode}
        setHeatmapMode={setHeatmapMode}
        sosStatusFilter={sosStatusFilter}
        setSosStatusFilter={setSosStatusFilter}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        listSearch={listSearch}
        setListSearch={setListSearch}
        filteredIncidents={filteredIncidents}
        filteredResponders={filteredResponders}
        filteredEvacs={filteredEvacs}
        respondersCount={responders.length}
        evacCentersCount={evacCenters.length}
        activeTripsCount={activeTrips.length}
        barangayFeatureCount={barangays?.features.length ?? "—"}
        highlightedId={highlightedId}
        onFocusSOS={(id) => {
          const inc = incidents.find((i) => i.id === id);
          const coords = inc ? parseLocation(inc.location) : null;
          if (coords) focusLocation(coords, id, "sos");
        }}
        onFocusResponder={(id) => {
          const responder = responders.find((r) => r.id === id);
          const coords = responder
            ? parseLocation(responder.current_location)
            : null;
          if (coords) focusLocation(coords, id, "responders");
        }}
        onFocusEvac={(id) => {
          const evac = evacCenters.find((e) => e.id === id);
          const coords = evac ? parseLocation(evac.location) : null;
          if (coords) focusLocation(coords, id, "evacs");
        }}
        onViewSOS={(id) => viewDetails("sos", id)}
        onViewResponder={(id) => viewDetails("responders", id)}
        onViewEvac={(id) => viewDetails("evacs", id)}
      />

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
