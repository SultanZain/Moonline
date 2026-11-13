/**
 * Convert coordinates for NASA's Moon 2000 raster map and its spherical south-polar view.
 * These navigation coordinates do not include observer height, time or an ephemeris frame.
 * @author Sultan
 */
import { moonRadiusMetres, type MoonTrekMode } from "@/config/moon-trek";

export type MapLocation = {
  latitude: number;
  longitude: number;
  name?: string;
  featureType?: string;
};

export function isMapLocation(value: unknown): value is MapLocation {
  if (typeof value !== "object" || value === null) return false;
  return "latitude" in value && typeof value.latitude === "number" && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 &&
    "longitude" in value && typeof value.longitude === "number" && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180 &&
    (!("name" in value) || value.name === undefined || typeof value.name === "string") &&
    (!("featureType" in value) || value.featureType === undefined || typeof value.featureType === "string");
}

export function normalizeMapLongitude(longitude: number) {
  if (longitude >= -180 && longitude < 180) return longitude;
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

export function projectMapLocation(location: MapLocation, mode: MoonTrekMode): [number, number] | null {
  if (!isMapLocation(location)) return null;
  if (mode === "global") return [location.longitude, location.latitude];
  if (location.latitude === 90) return null;
  const radians = Math.PI / 180;
  const radius = 2 * moonRadiusMetres * Math.tan(Math.PI / 4 + location.latitude * radians / 2);
  return [radius * Math.sin(location.longitude * radians), radius * Math.cos(location.longitude * radians)];
}

export function unprojectMapLocation(coordinate: readonly number[], mode: MoonTrekMode): MapLocation | null {
  const [x, y] = coordinate;
  if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (mode === "global") {
    if (Math.abs(y) > 90 || Math.abs(x) > 180) return null;
    return { latitude: y, longitude: normalizeMapLongitude(x) };
  }
  const radius = Math.hypot(x, y);
  // Longitude at the pole is a map convention; use the prime meridian for its single point.
  return {
    latitude: (2 * Math.atan(radius / (2 * moonRadiusMetres)) - Math.PI / 2) * 180 / Math.PI,
    longitude: radius === 0 ? 0 : normalizeMapLongitude(Math.atan2(x, y) * 180 / Math.PI),
  };
}

export function formatMapCoordinates(location: MapLocation) {
  return `${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`;
}
