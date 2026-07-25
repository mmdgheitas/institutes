/**
 * Pure geo helpers. These are duplicated logic-free utilities used by both the
 * API (for validation / fallback maths) and the web client (for clustering and
 * distance labels). PostGIS remains the source of truth for real queries.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export const EARTH_RADIUS_METERS = 6_371_008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

export function isValidLatLng(point: LatLng): boolean {
  return isValidLatitude(point.lat) && isValidLongitude(point.lng);
}

/** Great-circle distance in meters (haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Bounding box around a point for a given radius, used to pre-filter before
 * the exact PostGIS `ST_DWithin` pass.
 */
export function boundingBoxFor(center: LatLng, radiusMeters: number): BoundingBox {
  const latDelta = toDeg(radiusMeters / EARTH_RADIUS_METERS);
  const cosLat = Math.cos(toRad(center.lat));
  // Guard against division by ~0 at the poles.
  const lngDelta =
    Math.abs(cosLat) < 1e-9
      ? 180
      : toDeg(radiusMeters / (EARTH_RADIUS_METERS * Math.abs(cosLat)));

  return {
    minLat: Math.max(-90, center.lat - latDelta),
    maxLat: Math.min(90, center.lat + latDelta),
    minLng: Math.max(-180, center.lng - lngDelta),
    maxLng: Math.min(180, center.lng + lngDelta),
  };
}

/** Human readable distance label, e.g. "820 m" or "3.4 km". */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}

/** Clamp a zoom level into the range supported by tile providers. */
export function clampZoom(zoom: number, min = 3, max = 19): number {
  if (!Number.isFinite(zoom)) return min;
  return Math.min(max, Math.max(min, zoom));
}
