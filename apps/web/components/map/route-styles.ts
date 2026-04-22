import L from "leaflet";

const TRIP_COLORS = [
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#14b8a6",
];

export function tripColor(responderId: string): string {
  const hash =
    responderId.charCodeAt(0) + responderId.charCodeAt(responderId.length - 1);
  return TRIP_COLORS[hash % TRIP_COLORS.length];
}

export function addStyledRouteToLayer(
  layer: L.LayerGroup,
  latlngs: [number, number][],
  color: string,
) {
  const routeBack = L.polyline(latlngs, {
    color: "#020617",
    weight: 9,
    opacity: 0.8,
    lineCap: "round",
    lineJoin: "round",
  });

  const routeFront = L.polyline(latlngs, {
    color,
    weight: 5,
    opacity: 0.95,
    dashArray: "10, 10",
    lineCap: "round",
    lineJoin: "round",
  });

  layer.addLayer(routeBack);
  layer.addLayer(routeFront);
}
