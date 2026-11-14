
/**
 * @file src/types/lunar-observer.ts
 * @description Types for the MOONLINE lunar observer input contract.
 *
 * Defines coordinate conventions, observer height and datum,
 * reference-frame compatibility, pole behavior, provider readiness,
 * and structured runtime validation results.
 *
 * @author Sultan
 *
 * Ownership: Data & Science
 *
 * IMPORTANT:
 * Moon Trek map coordinates are not automatically interchangeable
 * with JPL Horizons lunar reference frames.
 *
 * A verified transformation is required before ephemeris calculations.
 * Unknown or unavailable scientific information must remain explicit.
 */

/* -------------------------------------------------------------------------- */
/* Coordinate conventions                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Coordinate system used by the current Moonline Explorer map.
 *
 * This identifies the map coordinate source, not an ephemeris frame.
 */
export type LunarCoordinateSystem = 'MOON_TREK_MAP';

/**
 * Canonical longitude convention used by normalized observer coordinates.
 */
export type LunarLongitudeConvention = 'positive_east';

/**
 * Reference frames relevant to lunar scientific calculations.
 *
 * MOON_ME, MOON_PA, and IAU_MOON are distinct frames.
 * They must not be treated as interchangeable without a verified transform.
 */
export type LunarReferenceFrame =
  | 'MOON_ME'
  | 'MOON_PA'
  | 'IAU_MOON';

/**
 * Raw coordinate input after the runtime boundary has been validated.
 *
 * Latitude is in degrees within [-90, +90].
 * Longitude is normalized to [-180, +180).
 */
export interface LunarCoordinateInput {
  latitudeDeg: number;
  longitudeDeg: number;
  coordinateSystem: LunarCoordinateSystem;
  longitudeConvention: LunarLongitudeConvention;
}

/**
 * Validated map coordinates that can exist independently
 * of a complete observer height.
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
 * Records whether the map coordinate source has a verified
 * transformation into a scientific lunar reference frame.
 *
 * A verified result requires a real, documented transformation.
 * A frame name alone is not proof of compatibility.
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
/* Height and datum                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Reference surface relative to which observer height is measured.
 *
 * reference_sphere:
 * Height relative to the application's lunar reference sphere.
 *
 * terrain_surface:
 * Height above a documented local terrain surface.
 */
export type LunarHeightDatum =
  | 'reference_sphere'
  | 'terrain_surface';

/**
 * Meaning of a supplied observer height.
 *
 * reference_surface_zero:
 * Explicitly selected zero metres on the reference sphere.
 * It is not measured terrain elevation.
 *
 * reference_surface_offset:
 * An offset above or below the reference sphere.
 *
 * measured_terrain_elevation:
 * Terrain elevation measured relative to the reference sphere,
 * using a documented elevation data source.
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
 * Validated observer height input.
 *
 * Missing height must never be silently converted to zero.
 */
export interface LunarHeightInput {
  /** Height in metres relative to the declared datum. */
  heightMeters: number;

  /** Surface relative to which the height is defined. */
  heightDatum: LunarHeightDatum;

  /** Scientific interpretation of the height. */
  heightInterpretation: LunarHeightInterpretation;

  /** Optional provenance for the supplied height. */
  heightSource?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Lunar reference sphere                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Reference sphere used by the current Moonline map convention.
 *
 * Its radius describes the map model. It does not establish
 * terrain elevation or ephemeris-frame compatibility.
 */
export interface LunarReferenceSphere {
  model: 'MOON_2000_SPHERE';
  radiusMeters: 1737400;
}

/* -------------------------------------------------------------------------- */
/* Pole and azimuth behavior                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Exact-pole classification.
 */
export type LunarPoleStatus =
  | 'not_at_pole'
  | 'north_pole'
  | 'south_pole';

/**
 * Local azimuth definition.
 *
 * At an exact pole, azimuth remains undefined unless a separate
 * orientation convention is explicitly adopted.
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
/* Provider compatibility                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Indicates whether the observer is ready for a provider query.
 *
 * A complete local observer does not automatically imply that
 * JPL Horizons compatibility has been verified.
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
 * Complete validated lunar observer.
 *
 * All required coordinates and height information must be present.
 * Frame and provider compatibility can still be unavailable.
 *
 * This type does not perform or authorize an ephemeris calculation.
 */
export interface ValidatedLunarObserver {
  /** Optional user-provided site name. */
  name: string | null;

  /** Normalized coordinate input. */
  coordinates: LunarCoordinateInput;

  /** Latitude in degrees. */
  latitudeDeg: number;

  /** Positive-east longitude in [-180, +180). */
  longitudeDeg: number;

  /** Explicit observer height and datum. */
  height: LunarHeightInput;

  /** Application reference-sphere model. */
  referenceSphere: LunarReferenceSphere;

  /** Exact-pole classification. */
  poleStatus: LunarPoleStatus;

  /** Local azimuth definition. */
  azimuth: LunarAzimuthDefinition;

  /** Map-to-scientific-frame compatibility. */
  frameCompatibility: LunarFrameCompatibility;

  /** JPL Horizons provider compatibility. */
  providerCompatibility: LunarProviderCompatibility;
}

/* -------------------------------------------------------------------------- */
/* Validation fields and errors                                               */
/* -------------------------------------------------------------------------- */

/**
 * Fields the UI can request when the observer input is incomplete.
 */
export type LunarObserverMissingField =
  | 'heightMeters'
  | 'heightDatum'
  | 'heightInterpretation'
  | 'frameCompatibility';

/**
 * Input fields that can contain validation issues.
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
 * Machine-readable validation error codes.
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
 * Actionable validation issue for one input field.
 */
export interface LunarObserverValidationIssue {
  field: LunarObserverField;
  code: LunarObserverErrorCode;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Validation result                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Result returned by validateLunarObserver(input: unknown).
 *
 * complete:
 * Required observer fields are valid. Scientific provider compatibility
 * can still be unavailable.
 *
 * incomplete:
 * Coordinates are valid, but required observer information is missing.
 * The result preserves partial coordinates and unavailable frame status.
 *
 * rejected:
 * Input structure, coordinate values, datum, or supplied metadata is invalid.
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
      frameCompatibility: LunarFrameCompatibility;
    }
  | {
      success: false;
      status: 'rejected';
      errors: LunarObserverValidationIssue[];
    };
