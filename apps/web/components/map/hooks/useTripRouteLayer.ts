"use client";

import { useEffect } from "react";
import L from "leaflet";
import { parseLocation } from "../../../lib/types";
import { addStyledRouteToLayer, tripColor } from "../route-styles";
import type { Responder, TripPlan } from "../types";

interface UseTripRouteLayerArgs {
  activeTrips: TripPlan[];
  responders: Responder[];
  showTrips: boolean;
  routeLayerRef: React.MutableRefObject<L.LayerGroup | null>;
  disposedRef: React.MutableRefObject<boolean>;
}

export function useTripRouteLayer({
  activeTrips,
  responders,
  showTrips,
  routeLayerRef,
  disposedRef,
}: UseTripRouteLayerArgs) {
  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer || disposedRef.current) return;

    layer.clearLayers();
    if (!showTrips) return;

    for (const trip of activeTrips) {
      const color = tripColor(trip.responder_id);

      const geometry = trip.route_geometry;
      if (
        geometry &&
        geometry.type === "LineString" &&
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length >= 2
      ) {
        const latlngs = geometry.coordinates
          .filter(
            (coord): coord is [number, number] =>
              Array.isArray(coord) &&
              coord.length === 2 &&
              typeof coord[0] === "number" &&
              typeof coord[1] === "number",
          )
          .map(([lng, lat]) => [lat, lng] as [number, number]);

        if (latlngs.length >= 2) {
          addStyledRouteToLayer(layer, latlngs, color);
          continue;
        }
      }

      const responder = responders.find((r) => r.id === trip.responder_id);
      const responderCoords = responder
        ? parseLocation(responder.current_location)
        : null;

      const stopCoords: [number, number][] = (trip.stops || [])
        .filter(
          (s: any) => typeof s?.lat === "number" && typeof s?.lng === "number",
        )
        .map((s: any) => [s.lat as number, s.lng as number]);

      const path: [number, number][] = [];
      if (responderCoords) path.push(responderCoords);
      path.push(...stopCoords);

      if (path.length < 2) continue;

      addStyledRouteToLayer(layer, path, color);
    }
  }, [activeTrips, responders, showTrips, routeLayerRef, disposedRef]);
}
