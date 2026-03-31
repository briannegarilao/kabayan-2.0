// apps/web/components/map/IncidentLayer.tsx
"use client";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import type { SOSIncident } from "@kabayan/shared-types";

const SEVERITY_COLORS = {
  low: "#22c55e", // green
  moderate: "#f59e0b", // amber
  high: "#f97316", // orange
  critical: "#ef4444", // red
  pending: "#6b7280", // gray (no YOLOv8n result yet)
};

function createSeverityIcon(severity: string): L.DivIcon {
  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.pending;
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 20px; height: 20px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

interface IncidentLayerProps {
  map: L.Map;
  incidents: SOSIncident[];
}

export function IncidentLayer({ map, incidents }: IncidentLayerProps) {
  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 16, // Show individual markers at street level
      spiderfyOnMaxZoom: true,
      chunkedLoading: true, // Process markers in chunks — prevents UI freeze
      chunkInterval: 50,
    });

    incidents.forEach((incident) => {
      const [lng, lat] = incident.location.coordinates;
      const marker = L.marker([lat, lng], {
        icon: createSeverityIcon(incident.flood_severity || "pending"),
      });

      // Lazy popup — only renders HTML when opened (performance)
      marker.bindPopup(
        () => {
          const el = document.createElement("div");
          el.innerHTML = `
          <strong>${incident.barangay}</strong><br/>
          Status: <b>${incident.status}</b><br/>
          Severity: <b>${incident.flood_severity || "Assessing..."}</b><br/>
          ${incident.message ? `<em>${incident.message}</em><br/>` : ""}
          <small>${new Date(incident.created_at).toLocaleString("en-PH")}</small>
        `;
          return el;
        },
        { maxWidth: 250 },
      );

      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, incidents]);

  return null;
}
