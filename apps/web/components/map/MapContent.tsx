// apps/web/components/map/MapContent.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { MAP_CONFIG, SEVERITY_COLORS } from "../../lib/map-config";
import { parseLocation } from "../../lib/types";
import type { SOSIncident } from "../../lib/types";

interface BoundaryGeoJSON {
  type: "Feature";
  properties: { name: string };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}
interface BarangaysGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { name: string };
    geometry: { type: "Polygon"; coordinates: number[][][] };
  }>;
}

function createSeverityIcon(severity: string | null): L.DivIcon {
  const color = SEVERITY_COLORS[severity || "pending"] || SEVERITY_COLORS.pending;
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 18px; height: 18px;
      background: ${color};
      border: 2.5px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    "></div>`,
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
  const maskLayerRef = useRef<L.Polygon | null>(null);
  const cityOutlineRef = useRef<L.GeoJSON | null>(null);
  const barangaysLayerRef = useRef<L.GeoJSON | null>(null);
  const disposedRef = useRef(false);

  const [cityBoundary, setCityBoundary] = useState<BoundaryGeoJSON | null>(null);
  const [barangays, setBarangays] = useState<BarangaysGeoJSON | null>(null);

  // Load boundary files
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
    return () => { cancelled = true; };
  }, []);

  // Initialize map ONCE — no preferCanvas (SVG renderer avoids clearRect bug)
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    disposedRef.current = false;

    const map = L.map(containerRef.current, {
      center: MAP_CONFIG.defaultCenter,
      zoom: MAP_CONFIG.defaultZoom,
      maxBounds: L.latLngBounds(MAP_CONFIG.maxBounds),
      maxBoundsViscosity: 1.0,
      zoomControl: true,
      attributionControl: true,
      // preferCanvas: REMOVED — use SVG renderer to avoid clearRect crash
    });

    L.tileLayer(MAP_CONFIG.tileUrl, {
      attribution: MAP_CONFIG.attribution,
      maxZoom: MAP_CONFIG.maxZoom,
      minZoom: MAP_CONFIG.minZoom,
    }).addTo(map);

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true,
      animate: false,
      animateAddingMarkers: false,
      removeOutsideVisibleBounds: false,
      chunkedLoading: true,
      chunkInterval: 50,
      chunkDelay: 10,
    });

    map.addLayer(clusterGroup);

    mapRef.current = map;
    clusterRef.current = clusterGroup;

    const timer = setTimeout(() => {
      if (!disposedRef.current) map.invalidateSize();
    }, 100);

    return () => {
      disposedRef.current = true;
      clearTimeout(timer);
      try {
        map.remove();
      } catch (e) {
        // swallow
      }
      mapRef.current = null;
      clusterRef.current = null;
      maskLayerRef.current = null;
      cityOutlineRef.current = null;
      barangaysLayerRef.current = null;
    };
  }, []);

  // Render boundary overlays once GeoJSON is loaded
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cityBoundary || !barangays || disposedRef.current) return;

    const dasmaRing: [number, number][] = cityBoundary.geometry.coordinates[0].map(
      ([lng, lat]) => [lat, lng]
    );
    const worldRing: [number, number][] = [
      [14.10, 120.60], [14.10, 121.30], [14.55, 121.30], [14.55, 120.60],
    ];

    const mask = L.polygon([worldRing, dasmaRing], {
      color: "transparent",
      fillColor: "#020617",
      fillOpacity: 0.55,
      stroke: false,
      interactive: false,
    });
    mask.addTo(map);
    maskLayerRef.current = mask;

    const cityOutline = L.geoJSON(cityBoundary as any, {
      style: { color: "#60a5fa", weight: 2.5, opacity: 0.9, fill: false, interactive: false } as any,
      interactive: false,
    });
    cityOutline.addTo(map);
    cityOutlineRef.current = cityOutline;

    const brgyLayer = L.geoJSON(barangays as any, {
      style: { color: "#64748b", weight: 0.8, opacity: 0.6, fillColor: "#94a3b8", fillOpacity: 0.0, interactive: false } as any,
      interactive: false,
    });
    brgyLayer.addTo(map);
    barangaysLayerRef.current = brgyLayer;

    mask.bringToBack();
    cityOutline.bringToBack();
    brgyLayer.bringToBack();
    mask.bringToBack();

    return () => {
      if (disposedRef.current) return;
      if (maskLayerRef.current && map.hasLayer(maskLayerRef.current)) map.removeLayer(maskLayerRef.current);
      if (cityOutlineRef.current && map.hasLayer(cityOutlineRef.current)) map.removeLayer(cityOutlineRef.current);
      if (barangaysLayerRef.current && map.hasLayer(barangaysLayerRef.current)) map.removeLayer(barangaysLayerRef.current);
      maskLayerRef.current = null;
      cityOutlineRef.current = null;
      barangaysLayerRef.current = null;
    };
  }, [cityBoundary, barangays]);

  // Update incident markers when list changes
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster || disposedRef.current) return;

    cluster.clearLayers();

    incidents.forEach((incident) => {
      const coords = parseLocation(incident.location);
      if (!coords) return;

      const [lat, lng] = coords;
      const marker = L.marker([lat, lng], {
        icon: createSeverityIcon(incident.flood_severity),
      });

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
                  display: inline-block; padding: 1px 8px; border-radius: 9999px;
                  font-size: 11px; font-weight: 600;
                  background: ${SEVERITY_COLORS[incident.flood_severity || "pending"]}22;
                  color: ${SEVERITY_COLORS[incident.flood_severity || "pending"]};
                ">${incident.flood_severity || "Assessing..."}</span>
                <span style="
                  display: inline-block; padding: 1px 8px; border-radius: 9999px;
                  font-size: 11px; font-weight: 600;
                  background: #374151; color: #d1d5db;
                ">${incident.status.replace("_", " ")}</span>
              </div>
              ${incident.message ? `<div style="color: #9ca3af; font-style: italic; margin-bottom: 4px;">"${incident.message}"</div>` : ""}
              <div style="color: #6b7280; font-size: 11px;">
                ${new Date(incident.created_at).toLocaleString("en-PH", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
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
