// packages/shared-types/map-config.ts
export const MAP_CONFIG = {
  // Stadia Maps free tier: 200K tiles/month — enough for LGU dashboard
  // Fallback to OSM direct if limit hit
  tileUrl:
    "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
  fallbackTileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; OSM contributors',

  // Dasmariñas City, Cavite center
  defaultCenter: [14.3294, 120.9367] as [number, number],
  defaultZoom: 13,
  maxZoom: 18,
  minZoom: 10,

  // Bounding box to restrict map panning (Dasmariñas area)
  maxBounds: [
    [14.25, 120.88], // Southwest
    [14.4, 121.0], // Northeast
  ] as [[number, number], [number, number]],
};
