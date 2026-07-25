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
export declare const EARTH_RADIUS_METERS = 6371008.8;
export declare function isValidLatitude(lat: number): boolean;
export declare function isValidLongitude(lng: number): boolean;
export declare function isValidLatLng(point: LatLng): boolean;
export declare function haversineMeters(a: LatLng, b: LatLng): number;
export declare function boundingBoxFor(center: LatLng, radiusMeters: number): BoundingBox;
export declare function formatDistance(meters: number): string;
export declare function clampZoom(zoom: number, min?: number, max?: number): number;
