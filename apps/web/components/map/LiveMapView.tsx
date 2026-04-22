"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.heat";

import { parseLocation } from "../../lib/types";
import { useBarangayFilter } from "../../lib/barangay-filter";
import { matchesResponderBarangay } from "./barangay-utils";
import { createSOSIcon, createResponderIcon, createEvacIcon } from "./icons";
import { MapLegend } from "./MapLegend";
import { MapSidePanel } from "./MapSidePanel";
import { buildSOSPopup, buildResponderPopup, buildEvacPopup } from "./popups";
import { addStyledRouteToLayer, tripColor } from "./route-styles";
import { useLeafletMap } from "./hooks/useLeafletMap";
import { useLiveMapData } from "./hooks/useLiveMapData";
import { useMapRealtime } from "./hooks/useMapRealtime";
import { useMapBoundaries } from "./hooks/useMapBoundaries";
import type { TabId } from "./types";

export default function LiveMapView() {
  const router = useRouter();
  const { selectedBarangay } = useBarangayFilter();

  const {
    containerRef,
    mapRef,
    sosClusterRef,
    responderLayerRef,
    evacLayerRef,
    routeLayerRef,
    heatLayerRef,
    maskLayerRef,
    cityOutlineRef,
    cityGlowRef,
    barangaysLayerRef,
    highlightLayerRef,
    sosMarkersRef,
    responderMarkersRef,
    evacMarkersRef,
    disposedRef,
  } = useLeafletMap();

  const { cityBoundary, barangays } = useMapBoundaries({
    mapRef,
    disposedRef,
    selectedBarangay,
    showBarangays: true, // actual toggle still handled below via state
    maskLayerRef,
    cityOutlineRef,
    cityGlowRef,
    barangaysLayerRef,
    highlightLayerRef,
  });

  const {
    incidents,
    setIncidents,
    responders,
    setResponders,
    evacCenters,
    setEvacCenters,
    activeTrips,
    setActiveTrips,
  } = useLiveMapData(selectedBarangay, disposedRef);

  useMapRealtime(
    selectedBarangay,
    disposedRef,
    setIncidents,
    setResponders,
    setEvacCenters,
    setActiveTrips,
  );

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

  // keep barangay layer toggle in main because it is UI-driven
  useEffect(() => {
    const map = mapRef.current;
    const layer = barangaysLayerRef.current;
    if (!map || !layer || disposedRef.current) return;

    if (showBarangays) {
      if (!map.hasLayer(layer)) map.addLayer(layer);
    } else {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    }
  }, [showBarangays, mapRef, barangaysLayerRef, disposedRef]);

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
  }, [
    incidents,
    showSOS,
    heatmapMode,
    sosStatusFilter,
    mapRef,
    sosClusterRef,
    heatLayerRef,
    sosMarkersRef,
    disposedRef,
  ]);

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
  }, [
    responders,
    showResponders,
    responderLayerRef,
    responderMarkersRef,
    disposedRef,
  ]);

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
  }, [evacCenters, showEvacs, evacLayerRef, evacMarkersRef, disposedRef]);

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
  }, [activeTrips, responders, showTrips, routeLayerRef, disposedRef]);

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
