"use client";

import { useEffect } from "react";
import L from "leaflet";
import { parseLocation } from "../../../lib/types";
import { buildEvacPopup } from "../popups";
import { createEvacIcon } from "../icons";
import type { EvacCenter } from "../types";

interface UseEvacLayerArgs {
  evacCenters: EvacCenter[];
  showEvacs: boolean;
  evacLayerRef: React.MutableRefObject<L.LayerGroup | null>;
  evacMarkersRef: React.MutableRefObject<Map<string, L.Marker>>;
  disposedRef: React.MutableRefObject<boolean>;
}

export function useEvacLayer({
  evacCenters,
  showEvacs,
  evacLayerRef,
  evacMarkersRef,
  disposedRef,
}: UseEvacLayerArgs) {
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
}
