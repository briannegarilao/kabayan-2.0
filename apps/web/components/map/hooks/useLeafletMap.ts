"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { MAP_CONFIG } from "../../../lib/map-config";

export function useLeafletMap() {
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

  return {
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
  };
}
