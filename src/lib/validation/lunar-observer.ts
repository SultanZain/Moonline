
import type {
  LunarCoordinate,
  LunarObserver,
  LongitudeConvention,
} from "@/types/coordinates";

/**
 * Checks whether a value is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validates longitude according to its declared convention.
 *
 * signed-east: -180 <= longitude < 180
 * positive-east-360: 0 <= longitude < 360
 */
export function isValidLongitude(
  longitude: number,
  convention: LongitudeConvention,
): boolean {
  if (!Number.isFinite(longitude)) return false;

  if (convention === "signed-east") {
    return longitude >= -180 && longitude < 180;
  }

  if (convention === "positive-east-360") {
    return longitude >= 0 && longitude < 360;
  }

  return false;
}

/**
 * Normalizes longitude to the signed east-positive range [-180, 180).
 */
export function normalizeLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) {
    throw new RangeError("Longitude must be a finite number.");
  }

  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

/**
 * Validates a lunar coordinate object.
 */
export function isLunarCoordinate(
  value: unknown,
): value is LunarCoordinate {
  if (!isRecord(value)) return false;

  const { latitude, longitude, referenceFrame, longitudeConvention } = value;

  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    return false;
  }

  if (typeof longitude !== "number") return false;

  if (referenceFrame !== "ME") return false;

  if (
    longitudeConvention !== "signed-east" &&
    longitudeConvention !== "positive-east-360"
  ) {
    return false;
  }

  return isValidLongitude(longitude, longitudeConvention);
}

/**
 * Validates a lunar surface observer.
 * Unknown elevation is represented by null.
 */
export function isLunarObserver(
  value: unknown,
): value is LunarObserver {
   if (!isRecord(value)) return false;

  const elevation = value.elevationMeters;

  if (!isLunarCoordinate(value)) return false;

  return (
    elevation === null ||
    (typeof elevation === "number" && Number.isFinite(elevation))
  );
}
