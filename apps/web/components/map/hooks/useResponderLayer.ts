"use client";

import { useEffect } from "react";
import L from "leaflet";
import { parseLocation } from "../../../lib/types";
import { buildResponderPopup } from "../popups";
import { createResponderIcon } from "../icons";
import type { Responder } from "../types";

interface UseResponderLayerArgs {
  responders: Responder[];
  showResponders: boolean;
  responderLayerRef: React.MutableRefObject<L.LayerGroup | null>;
  responderMarkersRef: React.MutableRefObject<Map<string, L.Marker>>;
  disposedRef: React.MutableRefObject<boolean>;
}

export function useResponderLayer({
  responders,
  showResponders,
  responderLayerRef,
  responderMarkersRef,
  disposedRef,
}: UseResponderLayerArgs) {
  useEffect(() => {
    const layer = responderLayerRef.current;
    if (!layer || disposedRef.current) return;

    layer.clearLayers();
    responderMarkersRef.current.clear();

    if (!showResponders) return;

    for (const r of responders) {
      const coords = parseLocation(r.current_location);
      if (!coords) continue;

      const marker = L.marker(coords, {
        icon: createResponderIcon(r.is_available),
      });
      marker.bindPopup(() => buildResponderPopup(r), { maxWidth: 260 });
      layer.addLayer(marker);
      responderMarkersRef.current.set(r.id, marker);
    }
  }, [
    responders,
    showResponders,
    responderLayerRef,
    responderMarkersRef,
    disposedRef,
  ]);
}
