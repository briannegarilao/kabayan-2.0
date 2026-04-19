// apps/web/components/map/MapContent.tsx
"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { MAP_CONFIG, SEVERITY_COLORS } from "../../lib/map-config";
import { parseLocation } from "../../lib/types";
import type { SOSIncident } from "../../lib/types";

// --- Custom marker icon based on severity ---
function createSeverityIcon(severity: string | null): L.DivIcon {
  const color =
    SEVERITY_COLORS[severity || "pending"] || SEVERITY_COLORS.pending;
  return L.divIcon({
    className: "", // Remove default leaflet-div-icon styling
    html: `
      <div style="
        width: 18px; height: 18px;
        background: ${color};
        border: 2.5px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

interface MapContentProps {
  incidents: SOSIncident[];
}

export default function MapContent({ incidents }: MapContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  // --- Initialize map ONCE ---
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: MAP_CONFIG.defaultCenter,
      zoom: MAP_CONFIG.defaultZoom,
      maxBounds: L.latLngBounds(MAP_CONFIG.maxBounds),
      maxBoundsViscosity: 1.0, // Hard stop at edges — no elastic panning
      preferCanvas: true, // Canvas renderer: 2-5x faster than SVG at 50+ markers
      zoomControl: true,
      attributionControl: true,
    });

    // OSM tile layer — completely free, no API key
    L.tileLayer(MAP_CONFIG.tileUrl, {
      attribution: MAP_CONFIG.attribution,
      maxZoom: MAP_CONFIG.maxZoom,
      minZoom: MAP_CONFIG.minZoom,
    }).addTo(map);

    // Initialize empty cluster group
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      disableClusteringAtZoom: 16, // Show individual markers at street level
      spiderfyOnMaxZoom: true,
      chunkedLoading: true, // Process in chunks — prevents UI freeze
      chunkInterval: 50,
      chunkDelay: 10,
    });

    map.addLayer(clusterGroup);

    mapRef.current = map;
    clusterRef.current = clusterGroup;

    // Force a resize after mount (fixes gray tiles in flex containers)
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  // --- Update markers when incidents change ---
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;

    // Clear all existing markers
    cluster.clearLayers();

    incidents.forEach((incident) => {
      const coords = parseLocation(incident.location);
      if (!coords) return; // Skip incidents without valid coordinates

      const [lat, lng] = coords;
      const marker = L.marker([lat, lng], {
        icon: createSeverityIcon(incident.flood_severity),
      });

      // Lazy popup — only renders HTML when user clicks (saves ~70% init work)
      marker.bindPopup(
        () => {
          const el = document.createElement("div");
          el.style.minWidth = "200px";
          el.innerHTML = `
            <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.5;">
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">
                ${incident.barangay}
              </div>
              <div style="display: flex; gap: 6px; margin-bottom: 6px;">
                <span style="
                  display: inline-block;
                  padding: 1px 8px;
                  border-radius: 9999px;
                  font-size: 11px;
                  font-weight: 600;
                  background: ${SEVERITY_COLORS[incident.flood_severity || "pending"]}22;
                  color: ${SEVERITY_COLORS[incident.flood_severity || "pending"]};
                ">${incident.flood_severity || "Assessing..."}</span>
                <span style="
                  display: inline-block;
                  padding: 1px 8px;
                  border-radius: 9999px;
                  font-size: 11px;
                  font-weight: 600;
                  background: #374151;
                  color: #d1d5db;
                ">${incident.status.replace("_", " ")}</span>
              </div>
              ${incident.message ? `<div style="color: #9ca3af; font-style: italic; margin-bottom: 4px;">"${incident.message}"</div>` : ""}
              <div style="color: #6b7280; font-size: 11px;">
                ${new Date(incident.created_at).toLocaleString("en-PH", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          `;
          return el;
        },
        { maxWidth: 280 },
      );

      cluster.addLayer(marker);
    });
  }, [incidents]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-lg"
      style={{ minHeight: "400px" }}
    />
  );
}
