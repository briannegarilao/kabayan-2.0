// apps/web/lib/salitran-motion.ts
"use client";

import { parseLocation } from "./types";

export type LatLng = [number, number];

interface SimStop {
  lat?: number;
  lng?: number;
}

interface SimTripLike {
  route_geometry?: {
    type?: string;
    coordinates?: [number, number][];
  } | null;
  stops?: SimStop[];
}

const EARTH_RADIUS_METERS = 6371000;

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function cumulativeMeters(points: LatLng[]): number[] {
  if (points.length === 0) return [];
  const result = [0];

  for (let i = 1; i < points.length; i++) {
    result[i] = result[i - 1] + haversineMeters(points[i - 1], points[i]);
  }

  return result;
}

export function interpolateAlong(
  points: LatLng[],
  cumulative: number[],
  targetMeters: number,
): LatLng {
  if (points.length === 0) return [14.3294, 120.9367];
  if (points.length === 1) return points[0];
  if (targetMeters <= 0) return points[0];

  const total = cumulative[cumulative.length - 1] ?? 0;
  if (targetMeters >= total) return points[points.length - 1];

  for (let i = 1; i < cumulative.length; i++) {
    if (targetMeters <= cumulative[i]) {
      const prevD = cumulative[i - 1];
      const nextD = cumulative[i];
      const span = Math.max(nextD - prevD, 0.0001);
      const t = (targetMeters - prevD) / span;

      const [lat1, lng1] = points[i - 1];
      const [lat2, lng2] = points[i];

      return [lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t];
    }
  }

  return points[points.length - 1];
}

export function nearestIndexFrom(
  points: LatLng[],
  target: LatLng,
  startIndex: number,
): number {
  let bestIndex = Math.max(0, startIndex);
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = Math.max(0, startIndex); i < points.length; i++) {
    const d = haversineMeters(points[i], target);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export function buildRoutePoints(
  trip: SimTripLike,
  responderLocation: string | Record<string, any> | null | undefined,
): LatLng[] {
  const routeGeometry = trip.route_geometry;

  if (
    routeGeometry?.type === "LineString" &&
    Array.isArray(routeGeometry.coordinates) &&
    routeGeometry.coordinates.length >= 2
  ) {
    const routePoints = routeGeometry.coordinates
      .filter(
        (coord): coord is [number, number] =>
          Array.isArray(coord) &&
          coord.length === 2 &&
          typeof coord[0] === "number" &&
          typeof coord[1] === "number",
      )
      .map(([lng, lat]) => [lat, lng] as LatLng);

    if (routePoints.length >= 2) return routePoints;
  }

  const fallback: LatLng[] = [];
  const responderCoords = parseLocation(responderLocation);
  if (responderCoords) fallback.push(responderCoords);

  for (const stop of trip.stops ?? []) {
    if (typeof stop?.lat === "number" && typeof stop?.lng === "number") {
      fallback.push([stop.lat, stop.lng]);
    }
  }

  return fallback;
}

export function buildStopAnchors(
  points: LatLng[],
  trip: SimTripLike,
): number[] {
  const anchors: number[] = [];
  let cursor = 0;

  for (const stop of trip.stops ?? []) {
    if (typeof stop?.lat !== "number" || typeof stop?.lng !== "number")
      continue;
    const index = nearestIndexFrom(points, [stop.lat, stop.lng], cursor);
    anchors.push(index);
    cursor = index;
  }

  return anchors;
}
