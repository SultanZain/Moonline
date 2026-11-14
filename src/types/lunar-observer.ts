
/**
 * @file src/types/lunar-observer.ts
 * @description Scientific types for the MOONLINE lunar observer contract.
 *
 * Defines lunar map coordinates, height and datum information,
 * reference-frame compatibility, pole behavior, provider readiness,
 * and runtime validation results.
 *
 * @author Sultan
 *
 * Ownership: Data & Science
 * Consumers: Explorer UI, scientific validation, future ephemeris integration.
 *
 * IMPORTANT:
 * Moon Trek map coordinates must not be assumed to be directly compatible
 * with a JPL Horizons lunar observer frame.
 *
 * A verified coordinate transformation is required before ephemeris use.
 * An unavailable transformation must remain explicitly unavailable.
 */

/* -------------------------------------------------------------------------- */
/* Coordinate conventions                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Coordinate system used by the current Moonline Explorer map.
 *
 * These values describe the map input convention. They do not establish
 * compatibility with a scientific ephemeris reference frame.
 */
export type LunarCoordinateSystem = 'MOON_TREK_MAP';

/**
 * Longitude direction used by Moonline map coordinates.
 */
export type LunarLongitudeConvention = 'positive_east';

/**
 * Supported lunar reference-frame identifiers.
 *
 * These frames are distinct and must not be treated as interchangeable.
 * Their inclusion does not prove that a transformation from Moon Trek
 * map coordinates has been established.
 */
export type LunarReferenceFrame =
  | 'MOON_ME'
  | 'MOON_PA'
  | 'IAU_MOON';

/**
 * Untrusted coordinate input after its structure has been identified.
 */
export interface LunarCoordinateInput {
  /** Latitude in degrees, within [-90, +90]. */
  latitudeDeg: number;

  /** Longitude in degrees, canonical range [-180, +180). */
  longitudeDeg: number;

  /** Coordinate system from which the map coordinates originate. */
  coordinateSystem: LunarCoordinateSystem;

  /** Direction in which longitude increases. */
  longitudeConvention: LunarLongitudeConvention;
}

/**
 * Validated coordinates without a complete observer height.
 *
 * This type is useful when a map selection is valid but the user
 * has not yet supplied all required observer inputs.
 */
export interface ValidatedLunarCoordinates {
  latitudeDeg: number;
  longitudeDeg: number;
  coordinateSystem: LunarCoordinateSystem;
  longitudeConvention: LunarLongitudeConvention;
  poleStatus: LunarPoleStatus;
  azimuth: LunarAzimuthDefinition;
}

/* -------------------------------------------------------------------------- */
/* Reference-frame compatibility                                              */
/* -------------------------------------------------------------------------- */

/**
 * Assessment of a coordinate transformation between reference frames.
 *
 * A verified result requires an actual documented transformation and
 * supporting evidence. Otherwise, compatibility must remain unavailable.
 */
export type LunarFrameCompatibility =
  | {
      status: 'verified';
      sourceFrame: LunarReferenceFrame;
      targetFrame: LunarReferenceFrame;
      transformationReference: string;
    }
  | {
      status: 'unavailable';
      sourceFrame: LunarCoordinateSystem;
      targetFrame: LunarReferenceFrame | null;
      reason: string;
    };

/* -------------------------------------------------------------------------- */
/* Height and datum                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Surface relative to which the supplied height is measured.
 *
 * reference_sphere:
 * Height relative to the application's documented lunar reference sphere.
 *
 * terrain_surface:
 * Height relative to a documented local terrain surface.
 */
export type LunarHeightDatum =
  | 'reference_sphere'
  | 'terrain_surface';

/**
 * Scientific interpretation of the supplied height.
 *
 * reference_surface_zero:
 * Explicitly selected zero height on the reference sphere.
 * This is not a measured terrain elevation.
 *
 * reference_surface_offset:
 * Explicit offset above or below the reference sphere.
 *
 * measured_terrain_elevation:
 * Terrain elevation derived from a documented elevation dataset.
 *
 * height_above_terrain:
 * Observer height above a documented local terrain surface.
 */
export type LunarHeightInterpretation =
  | 'reference_surface_zero'
  | 'reference_surface_offset'
  | 'measured_terrain_elevation'
  | 'height_above_terrain';

/**
 * Explicit observer height input.
 *
 * heightMeters must be a finite number.
 * Missing or unknown height must never be silently replaced with zero.
 */
export interface LunarHeightInput {
  /** Height in metres relative to the declared datum. */
  heightMeters: number;

  /** Surface relative to which heightMeters is measured. */
  heightDatum: LunarHeightDatum;

  /** Scientific meaning of the supplied height. */
  heightInterpretation: LunarHeightInterpretation;

  /** Optional dataset or source identifier. */
  heightSource?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Reference sphere                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Reference sphere used by the current Moonline map convention.
 *
 * The radius describes the map reference sphere. It does not establish
 * compatibility with a provider reference ellipsoid or frame.
 */
export interface LunarReferenceSphere {
  model: 'MOON_2000_SPHERE';
  radiusMeters: 1737400;
}

/* -------------------------------------------------------------------------- */
/* Pole and azimuth behavior                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Exact-pole classification.
 */
export type LunarPoleStatus =
  | 'not_at_pole'
  | 'north_pole'
  | 'south_pole';

/**
 * Local astronomical azimuth definition.
 *
 * At an exact pole, a unique azimuth requires an explicitly adopted
 * reference meridian or local orientation.
 */
export type LunarAzimuthDefinition =
  | {
      status: 'defined';
      referenceMeridianDeg: number;
    }
  | {
      status: 'undefined_at_pole';
      reason: string;
    };

/* -------------------------------------------------------------------------- */
/* Ephemeris provider compatibility                                            */
/* -------------------------------------------------------------------------- */

/**
 * Assessment of future JPL Horizons observer compatibility.
 *
 * A verified status must only be produced after the complete observer
 * configuration and coordinate conventions have been independently checked.
 *
 * A complete observer does not automatically imply provider readiness.
 */
export type LunarProviderCompatibility =
  | {
      status: 'verified';
      provider: 'JPL_HORIZONS';
      observerCenter: '301';
      coordinateSpecification: string;
      evidenceReference: string;
    }
  | {
      status: 'unavailable';
      provider: 'JPL_HORIZONS';
      reason: string;
    };

/* -------------------------------------------------------------------------- */
/* Complete validated observer                                                */
/* -------------------------------------------------------------------------- */

/**
 * Fully validated lunar observer input.
 *
 * All required coordinate and height fields must be present and valid.
 *
 * Provider compatibility can still be unavailable. This type alone
 * does not authorize or perform an ephemeris calculation.
 */
export interface ValidatedLunarObserver {
  /** Optional user-provided site name. */
  name: string | null;

  /** Original coordinate convention represented in normalized form. */
  coordinates: LunarCoordinateInput;

  /** Canonical latitude in degrees. */
  latitudeDeg: number;

  /** Canonical positive-east longitude in [-180, +180). */
  longitudeDeg: number;

  /** Explicit observer height and its interpretation. */
  height: LunarHeightInput;

  /** Application map reference-sphere model. */
  referenceSphere: LunarReferenceSphere;

  /** Exact-pole classification. */
  poleStatus: LunarPoleStatus;

  /** Local astronomical azimuth definition. */
  azimuth: LunarAzimuthDefinition;

  /** Verified or unavailable reference-frame relationship. */
  frameCompatibility: LunarFrameCompatibility;

  /** Verified or unavailable future provider compatibility. */
  providerCompatibility: LunarProviderCompatibility;
}

/* -------------------------------------------------------------------------- */
/* Validation issues                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Fields that can be requested from the UI when input is incomplete.
 */
export type LunarObserverMissingField =
  | 'heightMeters'
  | 'heightDatum'
  | 'heightInterpretation'
  | 'frameCompatibility';

/**
 * Fields that can contain validation issues.
 */
export type LunarObserverField =
  | 'structure'
  | 'name'
  | 'latitudeDeg'
  | 'longitudeDeg'
  | 'coordinateSystem'
  | 'longitudeConvention'
  | 'heightMeters'
  | 'heightDatum'
  | 'heightInterpretation'
  | 'heightSource'
  | 'frame'
  | 'frameCompatibility'
  | 'azimuth';

/**
 * Actionable validation error codes.
 */
export type LunarObserverErrorCode =
  | 'INVALID_STRUCTURE'
  | 'ARRAY_NOT_PERMITTED'
  | 'MISSING_FIELD'
  | 'TYPE_ERROR'
  | 'NON_FINITE_NUMBER'
  | 'LATITUDE_OUT_OF_BOUNDS'
  | 'LONGITUDE_OUT_OF_BOUNDS'
  | 'HEIGHT_OUT_OF_BOUNDS'
  | 'UNSUPPORTED_COORDINATE_SYSTEM'
  | 'UNSUPPORTED_LONGITUDE_CONVENTION'
  | 'MISSING_HEIGHT'
  | 'MISSING_DATUM'
  | 'MISSING_HEIGHT_INTERPRETATION'
  | 'DATUM_INTERPRETATION_MISMATCH'
  | 'UNSUPPORTED_DATUM'
  | 'UNSUPPORTED_FRAME'
  | 'FRAME_COMPATIBILITY_UNAVAILABLE'
  | 'AZIMUTH_UNDEFINED_AT_POLE';

/**
 * Field-level validation issue.
 */
export interface LunarObserverValidationIssue {
  field: LunarObserverField;
  code: LunarObserverErrorCode;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Validation result                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Discriminated runtime validation result.
 *
 * complete:
 * All required observer inputs have passed validation.
 * Provider compatibility may still be unavailable.
 *
 * incomplete:
 * Coordinates are valid, but required observer inputs are missing.
 *
 * rejected:
 * The input structure or one or more supplied values are invalid.
 */
export type LunarObserverValidationResult =
  | {
      success: true;
      status: 'complete';
      observer: ValidatedLunarObserver;
      warnings: string[];
    }
  | {
      success: false;
      status: 'incomplete';
      errors: LunarObserverValidationIssue[];
      partialCoordinates: ValidatedLunarCoordinates;
      missingFields: LunarObserverMissingField[];
    }
  | {
      success: false;
      status: 'rejected';
      errors: LunarObserverValidationIssue[];
    };
