// apps/web/components/analytics/DBSCANMap.tsx
"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_CONFIG } from "../../lib/map-config";

// ── Types ──────────────────────────────────────────────────
// Matches the shape seeded by scripts/seed_dbscan_sample.sql
interface DBSCANPoint {
  id: string;
  lat: number;
  lng: number;
}
interface DBSCANCluster {
  cluster_id: number;
  barangay: string;
  incident_count: number;
  center_lat: number;
  center_lng: number;
  points: DBSCANPoint[];
}
export interface DBSCANPayload {
  clusters: DBSCANCluster[];
  noise_count?: number;
  silhouette_score?: number;
  algorithm_params?: {
    eps_km?: number;
    min_samples?: number;
  };
}

// 8 distinct, high-contrast cluster colors.
// These are chosen to be distinguishable AND accessible on a dark basemap.
const CLUSTER_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#eab308", // yellow
];

function colorForCluster(id: number): string {
  if (id < 0) return "#6b7280"; // noise
  return CLUSTER_COLORS[id % CLUSTER_COLORS.length];
}

// Point marker
function createClusterPointIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 14px; height: 14px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.6);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// Centroid marker — bigger, with cluster id
function createCentroidIcon(color: string, clusterId: number, count: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      position: relative;
      width: 36px; height: 36px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 10px rgba(0,0,0,0.7);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 700; font-size: 12px;
      font-family: system-ui, sans-serif;
    ">${count}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
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
    properties: { name: string };
    geometry: { type: "Polygon"; coordinates: number[][][] };
  }>;
}

interface Props {
  data: DBSCANPayload | null;
}

export default function DBSCANMap({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const boundaryLoadedRef = useRef(false);

  // Initialize map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: MAP_CONFIG.defaultCenter,
      zoom: MAP_CONFIG.defaultZoom,
      maxBounds: L.latLngBounds(MAP_CONFIG.maxBounds),
      maxBoundsViscosity: 1.0,
      preferCanvas: true,
      zoomControl: true,
    });

    L.tileLayer(MAP_CONFIG.tileUrl, {
      attribution: MAP_CONFIG.attribution,
      maxZoom: MAP_CONFIG.maxZoom,
      minZoom: MAP_CONFIG.minZoom,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = group;

    setTimeout(() => map.invalidateSize(), 100);

    // Load boundary overlay (same treatment as Overview / LiveMap)
    Promise.all([
      fetch("/geo/dasma-boundary.json").then((r) => r.json()),
      fetch("/geo/dasma-barangays.json").then((r) => r.json()),
    ])
      .then(([boundary, brgy]: [BoundaryGeoJSON, BarangaysGeoJSON]) => {
        if (!mapRef.current || boundaryLoadedRef.current) return;
        boundaryLoadedRef.current = true;

        const dasmaRing: [number, number][] = boundary.geometry.coordinates[0].map(
          ([lng, lat]) => [lat, lng]
        );
        const worldRing: [number, number][] = [
          [14.10, 120.60],
          [14.10, 121.30],
          [14.55, 121.30],
          [14.55, 120.60],
        ];

        const mask = L.polygon([worldRing, dasmaRing], {
          color: "transparent",
          fillColor: "#020617",
          fillOpacity: 0.55,
          stroke: false,
          interactive: false,
        });
        mask.addTo(mapRef.current);

        const cityOutline = L.geoJSON(boundary as any, {
          style: {
            color: "#60a5fa",
            weight: 2.5,
            opacity: 0.9,
            fill: false,
            interactive: false,
          } as any,
          interactive: false,
        });
        cityOutline.addTo(mapRef.current);

        const brgyLayer = L.geoJSON(brgy as any, {
          style: {
            color: "#64748b",
            weight: 0.8,
            opacity: 0.5,
            fillOpacity: 0.0,
            interactive: false,
          } as any,
          interactive: false,
        });
        brgyLayer.addTo(mapRef.current);

        mask.bringToBack();
        cityOutline.bringToBack();
        brgyLayer.bringToBack();
        mask.bringToBack();
      })
      .catch((err) => console.error("DBSCANMap: failed to load boundaries:", err));

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      boundaryLoadedRef.current = false;
    };
  }, []);

  // Render clusters
  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (!data || !data.clusters || data.clusters.length === 0) return;

    const allPoints: [number, number][] = [];

    for (const cluster of data.clusters) {
      const color = colorForCluster(cluster.cluster_id);

      // Hull polygon (convex-ish): simply draw a filled, semi-transparent circle
      // around the centroid sized by the furthest point. Simpler than convex hull
      // and looks fine for a thesis presentation.
      let maxDist = 0;
      for (const p of cluster.points) {
        const d = Math.hypot(p.lat - cluster.center_lat, p.lng - cluster.center_lng);
        if (d > maxDist) maxDist = d;
      }
      // maxDist is in degrees; convert roughly to meters for Leaflet circle radius
      // 1 degree ≈ 111,000 meters at equator. Round up a bit for padding.
      const radiusMeters = Math.max(80, maxDist * 111000 * 1.25);

      const hullCircle = L.circle([cluster.center_lat, cluster.center_lng], {
        radius: radiusMeters,
        color,
        weight: 1.5,
        opacity: 0.7,
        fillColor: color,
        fillOpacity: 0.12,
        interactive: false,
      });
      group.addLayer(hullCircle);

      // Individual incident points
      for (const p of cluster.points) {
        const marker = L.marker([p.lat, p.lng], { icon: createClusterPointIcon(color) });
        marker.bindPopup(
          `<div style="font-family:system-ui,sans-serif;font-size:12px;">
             <div style="font-weight:700;">${p.id}</div>
             <div style="color:#6b7280;">Cluster #${cluster.cluster_id} &middot; ${cluster.barangay}</div>
             <div style="color:#9ca3af;font-size:11px;">${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</div>
           </div>`,
          { maxWidth: 220 }
        );
        group.addLayer(marker);
        allPoints.push([p.lat, p.lng]);
      }

      // Centroid
      const centroid = L.marker(
        [cluster.center_lat, cluster.center_lng],
        { icon: createCentroidIcon(color, cluster.cluster_id, cluster.incident_count) }
      );
      centroid.bindPopup(
        `<div style="font-family:system-ui,sans-serif;font-size:13px;min-width:180px;">
           <div style="font-weight:700;font-size:14px;margin-bottom:4px;">Cluster #${cluster.cluster_id}</div>
           <div style="color:#9ca3af;margin-bottom:2px;">${cluster.barangay}</div>
           <div style="color:#9ca3af;font-size:12px;"><strong>${cluster.incident_count}</strong> incidents</div>
         </div>`,
        { maxWidth: 240 }
      );
      group.addLayer(centroid);
    }

    // Fit to show all points
    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [data]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-[480px] w-full overflow-hidden rounded-lg border border-gray-800"
      />
      {/* Legend — only show if data present */}
      {data && data.clusters && data.clusters.length > 0 && (
        <div className="absolute right-3 top-3 z-[500] max-h-[450px] overflow-y-auto rounded-lg border border-gray-800 bg-gray-900/95 p-3 text-xs shadow-2xl backdrop-blur">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Clusters ({data.clusters.length})
          </div>
          <ul className="space-y-1.5">
            {data.clusters.map((c) => {
              const color = colorForCluster(c.cluster_id);
              return (
                <li key={c.cluster_id} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-white/70"
                    style={{ backgroundColor: color }}
                  />
                  <span className="flex-1 text-gray-300">
                    #{c.cluster_id} — {c.barangay}
                  </span>
                  <span className="text-gray-500">{c.incident_count}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
