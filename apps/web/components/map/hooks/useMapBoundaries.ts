"use client";

import { useEffect, useState } from "react";
import L from "leaflet";
import { MAP_CONFIG } from "../../../lib/map-config";
import type { BarangaysGeoJSON, BoundaryGeoJSON } from "../types";

interface UseMapBoundariesArgs {
  mapRef: React.MutableRefObject<L.Map | null>;
  disposedRef: React.MutableRefObject<boolean>;
  selectedBarangay: string | null;
  showBarangays: boolean;
  maskLayerRef: React.MutableRefObject<L.Polygon | null>;
  cityOutlineRef: React.MutableRefObject<L.GeoJSON | null>;
  cityGlowRef: React.MutableRefObject<L.GeoJSON | null>;
  barangaysLayerRef: React.MutableRefObject<L.GeoJSON | null>;
  highlightLayerRef: React.MutableRefObject<L.GeoJSON | null>;
}

export function useMapBoundaries({
  mapRef,
  disposedRef,
  selectedBarangay,
  showBarangays,
  maskLayerRef,
  cityOutlineRef,
  cityGlowRef,
  barangaysLayerRef,
  highlightLayerRef,
}: UseMapBoundariesArgs) {
  const [cityBoundary, setCityBoundary] = useState<BoundaryGeoJSON | null>(
    null,
  );
  const [barangays, setBarangays] = useState<BarangaysGeoJSON | null>(null);

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
  }, [
    mapRef,
    cityBoundary,
    barangays,
    disposedRef,
    maskLayerRef,
    cityGlowRef,
    cityOutlineRef,
    barangaysLayerRef,
  ]);

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
  }, [
    selectedBarangay,
    barangays,
    cityBoundary,
    mapRef,
    highlightLayerRef,
    disposedRef,
  ]);

  return {
    cityBoundary,
    barangays,
  };
}
