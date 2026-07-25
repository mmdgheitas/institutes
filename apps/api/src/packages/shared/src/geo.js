"use strict";
/**
 * Pure geo helpers. These are duplicated logic-free utilities used by both the
 * API (for validation / fallback maths) and the web client (for clustering and
 * distance labels). PostGIS remains the source of truth for real queries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EARTH_RADIUS_METERS = void 0;
exports.isValidLatitude = isValidLatitude;
exports.isValidLongitude = isValidLongitude;
exports.isValidLatLng = isValidLatLng;
exports.haversineMeters = haversineMeters;
exports.boundingBoxFor = boundingBoxFor;
exports.formatDistance = formatDistance;
exports.clampZoom = clampZoom;
exports.EARTH_RADIUS_METERS = 6_371_008.8;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;
function isValidLatitude(lat) {
    return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}
function isValidLongitude(lng) {
    return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}
function isValidLatLng(point) {
    return isValidLatitude(point.lat) && isValidLongitude(point.lng);
}
/** Great-circle distance in meters (haversine). */
function haversineMeters(a, b) {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * exports.EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}
/**
 * Bounding box around a point for a given radius, used to pre-filter before
 * the exact PostGIS `ST_DWithin` pass.
 */
function boundingBoxFor(center, radiusMeters) {
    const latDelta = toDeg(radiusMeters / exports.EARTH_RADIUS_METERS);
    const cosLat = Math.cos(toRad(center.lat));
    // Guard against division by ~0 at the poles.
    const lngDelta = Math.abs(cosLat) < 1e-9
        ? 180
        : toDeg(radiusMeters / (exports.EARTH_RADIUS_METERS * Math.abs(cosLat)));
    return {
        minLat: Math.max(-90, center.lat - latDelta),
        maxLat: Math.min(90, center.lat + latDelta),
        minLng: Math.max(-180, center.lng - lngDelta),
        maxLng: Math.min(180, center.lng + lngDelta),
    };
}
/** Human readable distance label, e.g. "820 m" or "3.4 km". */
function formatDistance(meters) {
    if (!Number.isFinite(meters) || meters < 0)
        return '—';
    if (meters < 1000)
        return `${Math.round(meters)} m`;
    if (meters < 10_000)
        return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters / 1000)} km`;
}
/** Clamp a zoom level into the range supported by tile providers. */
function clampZoom(zoom, min = 3, max = 19) {
    if (!Number.isFinite(zoom))
        return min;
    return Math.min(max, Math.max(min, zoom));
}
//# sourceMappingURL=geo.js.map