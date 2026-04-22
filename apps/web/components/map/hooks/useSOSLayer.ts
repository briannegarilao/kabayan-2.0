"use client";

import { useEffect } from "react";
import L from "leaflet";
import { parseLocation } from "../../../lib/types";
import { buildSOSPopup } from "../popups";
import { createSOSIcon } from "../icons";
import type { SOSIncident } from "../types";

interface UseSOSLayerArgs {
  incidents: SOSIncident[];
  showSOS: boolean;
  heatmapMode: boolean;
  sosStatusFilter: string;
  mapRef: React.MutableRefObject<L.Map | null>;
  sosClusterRef: React.MutableRefObject<L.MarkerClusterGroup | null>;
  heatLayerRef: React.MutableRefObject<any>;
  sosMarkersRef: React.MutableRefObject<Map<string, L.Marker>>;
  disposedRef: React.MutableRefObject<boolean>;
}

export function useSOSLayer({
  incidents,
  showSOS,
  heatmapMode,
  sosStatusFilter,
  mapRef,
  sosClusterRef,
  heatLayerRef,
  sosMarkersRef,
  disposedRef,
}: UseSOSLayerArgs) {
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
}
