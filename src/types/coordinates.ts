
/**
 * Scientific coordinate types for MOONLINE.
 *
 * Coordinates use the lunar Mean Earth (ME) reference
 * system. See docs/science/lunar-coordinates.md.
 */

export type LunarReferenceFrame = "ME";

export type LongitudeConvention =
  | "signed-east"
  | "positive-east-360";

/**
 * Latitude and longitude are expressed in degrees.
 * Latitude is planetocentric for the spherical reference model.
 */
export interface LunarCoordinate {
  readonly latitude: number;
  readonly longitude: number;
  readonly referenceFrame: LunarReferenceFrame;
  readonly longitudeConvention: LongitudeConvention;
}

/**
 * Lunar surface observer used for astronomical calculations.
 * Elevation is measured in metres above the reference sphere.
 */
export interface LunarObserver extends LunarCoordinate {
  readonly elevationMeters: number | null;
}

/** Categories of lunar sites supported by MOONLINE. */
export type LunarSiteCategory =
  | "artemis-candidate"
  | "historic-landing"
  | "polar-feature"
  | "custom";

/** Candidate or reference lunar landing site. */
export interface LunarSite {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly referenceFrame: LunarReferenceFrame;
  readonly longitudeConvention: LongitudeConvention;
  readonly category: LunarSiteCategory;
  readonly significance: string;
  readonly elevationMeters: number | null;
}
