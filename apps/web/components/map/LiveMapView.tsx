"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { parseLocation } from "../../lib/types";
import { useBarangayFilter } from "../../lib/barangay-filter";
import { matchesResponderBarangay } from "./barangay-utils";
import { MapLegend } from "./MapLegend";
import { MapSidePanel } from "./MapSidePanel";
import { useLeafletMap } from "./hooks/useLeafletMap";
import { useLiveMapData } from "./hooks/useLiveMapData";
import { useMapRealtime } from "./hooks/useMapRealtime";
import { useMapBoundaries } from "./hooks/useMapBoundaries";
import { useSOSLayer } from "./hooks/useSOSLayer";
import { useResponderLayer } from "./hooks/useResponderLayer";
import { useEvacLayer } from "./hooks/useEvacLayer";
import { useTripRouteLayer } from "./hooks/useTripRouteLayer";
import { useSalitranSimulationPlayback } from "./hooks/useSalitranSimulationPlayback";
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

  const { barangays } = useMapBoundaries({
    mapRef,
    disposedRef,
    selectedBarangay,
    showBarangays,
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

  const { displayResponders } = useSalitranSimulationPlayback({
    activeTrips,
    responders,
  });

  const mapResponders = useMemo(() => {
    if (!selectedBarangay) return displayResponders;
    return displayResponders.filter((r) =>
      matchesResponderBarangay(r, selectedBarangay),
    );
  }, [displayResponders, selectedBarangay]);

  useSOSLayer({
    incidents,
    showSOS,
    heatmapMode,
    sosStatusFilter,
    mapRef,
    sosClusterRef,
    heatLayerRef,
    sosMarkersRef,
    disposedRef,
  });

  useResponderLayer({
    responders: mapResponders,
    showResponders,
    responderLayerRef,
    responderMarkersRef,
    disposedRef,
  });

  useEvacLayer({
    evacCenters,
    showEvacs,
    evacLayerRef,
    evacMarkersRef,
    disposedRef,
  });

  useTripRouteLayer({
    activeTrips,
    responders: mapResponders,
    showTrips,
    routeLayerRef,
    disposedRef,
  });

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
          const simulatedResponder = displayResponders.find((r) => r.id === id);
          const coords = responder
            ? parseLocation(
                simulatedResponder?.current_location ?? responder.current_location,
              )
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
