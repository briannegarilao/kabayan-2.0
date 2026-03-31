// apps/web/components/map/HeatmapLayer.tsx
"use client";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet.heat";

interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number;
}

export function HeatmapLayer({
  map,
  points,
}: {
  map: L.Map;
  points: HeatPoint[];
}) {
  useEffect(() => {
    if (!points.length) return;

    const heatData: [number, number, number][] = points.map((p) => [
      p.lat,
      p.lng,
      p.intensity,
    ]);

    const heatLayer = (L as any).heatLayer(heatData, {
      radius: 35,
      blur: 25,
      maxZoom: 17,
      gradient: {
        0.2: "#22c55e", // Low density: green
        0.5: "#f59e0b", // Medium: amber
        0.8: "#f97316", // High: orange
        1.0: "#ef4444", // Critical: red
      },
    });

    heatLayer.addTo(map);
    return () => {
      heatLayer.remove();
    };
  }, [map, points]);

  return null;
}
