/**
 * src/lib/validation/lunar-observer.ts
 *
 * Runtime validator and normalizer for the MOONLINE Lunar Observer Contract.
 * Aligned with Sultan's types (src/types/lunar-observer.ts).
 *
 * Fully corrected version: Resolves TS2322, TS2367, and runtime crashes.
 */

import type {
  LunarCoordinateInput,
  ValidatedLunarCoordinates,
  LunarHeightInput,
  LunarHeightDatum,
  LunarHeightInterpretation,
  LunarReferenceSphere,
  LunarPoleStatus,
  LunarAzimuthDefinition,
  LunarFrameCompatibility,
  LunarProviderCompatibility,
  ValidatedLunarObserver,
  LunarObserverMissingField,
  LunarObserverValidationIssue,
  LunarObserverValidationResult,
  LunarCoordinateSystem,
  LunarLongitudeConvention,
  LunarReferenceFrame,
} from '../../types/lunar-observer';

export const MOON_2000_REFERENCE_SPHERE: LunarReferenceSphere = {
  model: 'MOON_2000_SPHERE',
  radiusMeters: 1737400,
};

const MIN_PHYSICAL_SURFACE_HEIGHT_METERS = -12000;
const MAX_PHYSICAL_SURFACE_HEIGHT_METERS = 15000;

// Aligned with Sultan's types: only 'reference_sphere' is the accepted datum
const SUPPORTED_DATUMS: readonly LunarHeightDatum[] = ['reference_sphere'];

// Aligned with Sultan's types: only these 3 interpretations are valid
const SUPPORTED_INTERPRETATIONS: readonly LunarHeightInterpretation[] = [
  'reference_surface_zero',
  'reference_surface_offset',
  'measured_terrain_elevation',
];

const SUPPORTED_COORD_SYSTEMS: readonly LunarCoordinateSystem[] = [
  'MOON_TREK_MAP',
];

const SUPPORTED_LONGITUDE_CONVENTIONS: readonly LunarLongitudeConvention[] = [
  'positive_east',
];

const SUPPORTED_REFERENCE_FRAMES: readonly LunarReferenceFrame[] = [
  'MOON_ME',
  'MOON_PA',
  'IAU_MOON',
];

/**
 * Runtime type guard: Checks if value is a finite number.
 */
export function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

/**
 * Normalizes supported input longitudes into canonical positive-east half-open interval [-180.0, +180.0).
 * - Accepted input ranges: Signed [-180.0, +180.0] or Unsigned [0.0, 360.0].
 * - Inputs outside [-180.0, 360.0] return NaN and are rejected.
 * - +180.0 normalizes to -180.0 (identical meridian on the sphere).
 * - 360.0 normalizes to 0.0.
 */
export function normalizeLongitude180(lonDeg: number): number {
  if (!Number.isFinite(lonDeg)) {
    return NaN;
  }
  // Reject inputs outside supported intervals [-180, 360]
  if (lonDeg < -180 || lonDeg > 360) {
    return NaN;
  }
  let normalized = lonDeg;
  if (normalized > 180) {
    normalized -= 360;
  }
  if (normalized === 180) {
    normalized = -180;
  }
  return Object.is(normalized, -0) ? 0 : normalized;
}

/**
 * Evaluates pole status and horizontal azimuth definition for a latitude in degrees.
 */
export function evaluatePoleStatusAndAzimuth(latitudeDeg: number): {
  poleStatus: LunarPoleStatus;
  azimuth: LunarAzimuthDefinition;
} {
  if (latitudeDeg === 90) {
    return {
      poleStatus: 'north_pole',
      azimuth: {
        status: 'undefined_at_pole',
        reason:
          'At the exact North Pole (+90°), all directions point south along meridians. ' +
          'Local horizontal azimuth is undefined without an explicitly adopted reference meridian.',
      },
    };
  }

  if (latitudeDeg === -90) {
    return {
      poleStatus: 'south_pole',
      azimuth: {
        status: 'undefined_at_pole',
        reason:
          'At the exact South Pole (-90°), all directions point north along meridians. ' +
          'Local horizontal azimuth is undefined without an explicitly adopted reference meridian.',
      },
    };
  }

  return {
    poleStatus: 'not_at_pole',
    azimuth: {
      status: 'defined',
      referenceMeridianDeg: 0,
    },
  };
}

/**
 * Main runtime validation entry point for unknown observer inputs.
 */
export function validateLunarObserver(input: unknown): LunarObserverValidationResult {
  // 1. Structure Check: Must be non-null, non-array plain object
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      success: false,
      status: 'rejected',
      errors: [
        {
          field: 'structure',
          code: Array.isArray(input) ? 'ARRAY_NOT_PERMITTED' : 'INVALID_STRUCTURE',
          message: Array.isArray(input)
            ? 'Observer input must be a plain object, received an array.'
            : 'Observer input must be a non-null object.',
        },
      ],
    };
  }

  const raw = input as Record<string, unknown>;
  const errors: LunarObserverValidationIssue[] = [];
  const warnings: string[] = [];

  // Extract coordinates (supporting latitudeDeg / latitude and longitudeDeg / longitude)
  const coordsObj =
    typeof raw.coordinates === 'object' &&
    raw.coordinates !== null &&
    !Array.isArray(raw.coordinates)
      ? (raw.coordinates as Record<string, unknown>)
      : raw;

  const rawLat = coordsObj.latitudeDeg ?? coordsObj.latitude;
  const rawLon = coordsObj.longitudeDeg ?? coordsObj.longitude;

  // 1.1 Check Coordinate System Metadata if declared
  const rawCoordSys = coordsObj.coordinateSystem ?? raw.coordinateSystem;
  if (rawCoordSys !== undefined && rawCoordSys !== null) {
    if (!SUPPORTED_COORD_SYSTEMS.includes(rawCoordSys as LunarCoordinateSystem)) {
      errors.push({
        field: 'coordinateSystem',
        code: 'UNSUPPORTED_COORDINATE_SYSTEM',
        message: `Coordinate system "${String(rawCoordSys)}" is unsupported. Expected "MOON_TREK_MAP".`,
      });
    }
  }

  // 1.2 Check Longitude Convention Metadata if declared
  const rawLonConv = coordsObj.longitudeConvention ?? raw.longitudeConvention;
  if (rawLonConv !== undefined && rawLonConv !== null) {
    if (!SUPPORTED_LONGITUDE_CONVENTIONS.includes(rawLonConv as LunarLongitudeConvention)) {
      errors.push({
        field: 'longitudeConvention',
        code: 'UNSUPPORTED_LONGITUDE_CONVENTION',
        message: `Longitude convention "${String(rawLonConv)}" is unsupported. Expected "positive_east".`,
      });
    }
  }

  // 1.3 Check Reference Frame Metadata if declared
  const rawFrame = coordsObj.referenceFrame ?? raw.referenceFrame ?? raw.frame;
  if (rawFrame !== undefined && rawFrame !== null) {
    if (!SUPPORTED_REFERENCE_FRAMES.includes(rawFrame as LunarReferenceFrame)) {
      errors.push({
        field: 'frame',
        code: 'UNSUPPORTED_FRAME',
        message: `Reference frame "${String(rawFrame)}" is unsupported.`,
      });
    }
  }

  // 2. Validate Latitude
  let validLat: number | null = null;
  if (rawLat === undefined || rawLat === null) {
    errors.push({
      field: 'latitudeDeg',
      code: 'MISSING_FIELD',
      message: 'Latitude is required.',
    });
  } else if (!isFiniteNumber(rawLat)) {
    errors.push({
      field: 'latitudeDeg',
      code: 'NON_FINITE_NUMBER',
      message: 'Latitude must be a finite numeric value in degrees.',
    });
  } else if (rawLat < -90 || rawLat > 90) {
    errors.push({
      field: 'latitudeDeg',
      code: 'LATITUDE_OUT_OF_BOUNDS',
      message: `Latitude ${rawLat}° is out of bounds [-90.0, +90.0].`,
    });
  } else {
    validLat = rawLat;
  }

  // 3. Validate Longitude
  let validLon: number | null = null;
  if (rawLon === undefined || rawLon === null) {
    errors.push({
      field: 'longitudeDeg',
      code: 'MISSING_FIELD',
      message: 'Longitude is required.',
    });
  } else if (!isFiniteNumber(rawLon)) {
    errors.push({
      field: 'longitudeDeg',
      code: 'NON_FINITE_NUMBER',
      message: 'Longitude must be a finite numeric value in degrees.',
    });
  } else {
    const normalized = normalizeLongitude180(rawLon);
    if (Number.isNaN(normalized)) {
      errors.push({
        field: 'longitudeDeg',
        code: 'LONGITUDE_OUT_OF_BOUNDS',
        message: `Longitude ${rawLon}° is out of supported input intervals ([-180.0, +180.0] or [0.0, 360.0]).`,
      });
    } else {
      validLon = normalized;
    }
  }

  // If coordinates or metadata had fatal errors, reject immediately
  if (validLat === null || validLon === null || errors.length > 0) {
    return {
      success: false,
      status: 'rejected',
      errors,
    };
  }

  const { poleStatus, azimuth } = evaluatePoleStatusAndAzimuth(validLat);
  if (poleStatus !== 'not_at_pole') {
    warnings.push(
      `Observer is located at the exact ${poleStatus === 'north_pole' ? 'North' : 'South'} Pole. ` +
      'Astronomical azimuth is singular without an adopted orientation convention.'
    );
  }

  const partialCoordinates: ValidatedLunarCoordinates = {
    latitudeDeg: validLat,
    longitudeDeg: validLon,
    coordinateSystem: 'MOON_TREK_MAP',
    longitudeConvention: 'positive_east',
    poleStatus,
    azimuth,
  };

  // Define explicitly unavailable frame compatibility path
  const frameCompatibility: LunarFrameCompatibility = {
    status: 'unavailable',
    sourceFrame: 'MOON_TREK_MAP',
    targetFrame: 'MOON_ME',
    reason:
      'Rigorous coordinate transformation from Moon Trek map coordinates to JPL Horizons MOON_ME reference frame ' +
      'is scheduled for verification in Phase 3 (p3-positions). Coarse spherical identity is not assumed.',
  };

  // 4. Extract Height and Datum
  const heightObj =
    typeof raw.height === 'object' &&
    raw.height !== null &&
    !Array.isArray(raw.height)
      ? (raw.height as Record<string, unknown>)
      : raw;

  const rawHeightMeters = heightObj.heightMeters ?? heightObj.elevationMeters;
  const rawHeightDatum = heightObj.heightDatum ?? heightObj.elevationDatum;
  const rawHeightInterpretation = heightObj.heightInterpretation;
  const rawHeightSource =
    typeof heightObj.heightSource === 'string' ? heightObj.heightSource.trim() : null;

  // Validate datum if supplied
  let datumError: LunarObserverValidationIssue | null = null;
  if (rawHeightDatum !== undefined && rawHeightDatum !== null) {
    if (!SUPPORTED_DATUMS.includes(rawHeightDatum as LunarHeightDatum)) {
      datumError = {
        field: 'heightDatum',
        code: 'UNSUPPORTED_DATUM',
        message: `Height datum "${String(rawHeightDatum)}" is unsupported. Supported datum is: "reference_sphere".`,
      };
    }
  }

  // Validate interpretation if supplied
  let interpretationError: LunarObserverValidationIssue | null = null;
  if (rawHeightInterpretation !== undefined && rawHeightInterpretation !== null) {
    if (!SUPPORTED_INTERPRETATIONS.includes(rawHeightInterpretation as LunarHeightInterpretation)) {
      interpretationError = {
        field: 'heightInterpretation',
        code: 'DATUM_INTERPRETATION_MISMATCH',
        message: `Height interpretation "${String(rawHeightInterpretation)}" is unsupported.`,
      };
    }
  }

  const hasHeight = rawHeightMeters !== undefined && rawHeightMeters !== null;
  const hasDatum =
    rawHeightDatum !== undefined && rawHeightDatum !== null && datumError === null;
  const hasInterpretation =
    rawHeightInterpretation !== undefined &&
    rawHeightInterpretation !== null &&
    interpretationError === null;

  // Handle incomplete observer
  if (!hasHeight || !hasDatum || !hasInterpretation) {
    const missingFields: LunarObserverMissingField[] = [];
    const incompleteErrors: LunarObserverValidationIssue[] = [];

    if (datumError) {
      incompleteErrors.push(datumError);
    }
    if (interpretationError) {
      incompleteErrors.push(interpretationError);
    }

    if (!hasHeight) {
      missingFields.push('heightMeters');
      incompleteErrors.push({
        field: 'heightMeters',
        code: 'MISSING_HEIGHT',
        message:
          'Observer height is missing or null. Topocentric ephemeris requires an explicit height; missing height cannot be defaulted to zero.',
      });
    }

    if (!hasDatum && !datumError) {
      missingFields.push('heightDatum');
      incompleteErrors.push({
        field: 'heightDatum',
        code: 'MISSING_DATUM',
        message: 'Height datum is required. Supported values: "reference_sphere".',
      });
    }

    if (!hasInterpretation && !interpretationError) {
      missingFields.push('heightInterpretation');
      incompleteErrors.push({
        field: 'heightInterpretation',
        code: 'MISSING_HEIGHT_INTERPRETATION',
        message:
          'Height interpretation is required. Supported: "reference_surface_zero", "reference_surface_offset", "measured_terrain_elevation".',
      });
    }

    // If an invalid datum or interpretation was explicitly supplied, reject
    if (datumError || interpretationError) {
      return {
        success: false,
        status: 'rejected',
        errors: incompleteErrors,
      };
    }

    return {
      success: false,
      status: 'incomplete',
      errors: incompleteErrors,
      partialCoordinates,
      missingFields,
      frameCompatibility,
    };
  }

  // 5. Validate numeric type and physical range
  if (!isFiniteNumber(rawHeightMeters)) {
    errors.push({
      field: 'heightMeters',
      code: 'NON_FINITE_NUMBER',
      message: 'Observer heightMeters must be a finite numeric value.',
    });
    return { success: false, status: 'rejected', errors };
  }

  if (
    rawHeightMeters < MIN_PHYSICAL_SURFACE_HEIGHT_METERS ||
    rawHeightMeters > MAX_PHYSICAL_SURFACE_HEIGHT_METERS
  ) {
    errors.push({
      field: 'heightMeters',
      code: 'HEIGHT_OUT_OF_BOUNDS',
      message:
        `Observer height ${rawHeightMeters} m is outside physical lunar surface range ` +
        `[${MIN_PHYSICAL_SURFACE_HEIGHT_METERS}, ${MAX_PHYSICAL_SURFACE_HEIGHT_METERS}] m.`,
    });
    return { success: false, status: 'rejected', errors };
  }

  const heightDatum = rawHeightDatum as LunarHeightDatum;
  const heightInterpretation = rawHeightInterpretation as LunarHeightInterpretation;

  // 6. Strict check: reference_surface_zero MUST have heightMeters === 0
  if (heightInterpretation === 'reference_surface_zero') {
    if (rawHeightMeters !== 0) {
      errors.push({
        field: 'heightInterpretation',
        code: 'DATUM_INTERPRETATION_MISMATCH',
        message: `Interpretation "reference_surface_zero" strictly requires heightMeters === 0 (received ${rawHeightMeters}m). Use "reference_surface_offset" for non-zero offsets.`,
      });
      return { success: false, status: 'rejected', errors };
    }
    warnings.push(
      'Observer height is explicitly set to 0 metres on the reference sphere. ' +
      'This represents a mathematical datum, not a measured terrain surface elevation.'
    );
  }

  const heightInput: LunarHeightInput = {
    heightMeters: rawHeightMeters,
    heightDatum,
    heightInterpretation,
    heightSource: rawHeightSource,
  };

  const coordinateInput: LunarCoordinateInput = {
    latitudeDeg: validLat,
    longitudeDeg: validLon,
    coordinateSystem: 'MOON_TREK_MAP',
    longitudeConvention: 'positive_east',
  };

  const providerCompatibility: LunarProviderCompatibility = {
    status: 'unavailable',
    provider: 'JPL_HORIZONS',
    reason:
      'JPL Horizons topocentric ephemeris retrieval requires Phase 3 Horizons query builder and verified frame transformation.',
  };

  const name =
    typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name.trim() : null;

  const observer: ValidatedLunarObserver = {
    name,
    coordinates: coordinateInput,
    latitudeDeg: validLat,
    longitudeDeg: validLon,
    height: heightInput,
    referenceSphere: MOON_2000_REFERENCE_SPHERE,
    poleStatus,
    azimuth,
    frameCompatibility,
    providerCompatibility,
  };

  return {
    success: true,
    status: 'complete',
    observer,
    warnings,
  };
}

/**
 * Boolean type guard for completed lunar observers.
 * Safely checks that input is a structured ValidatedLunarObserver
 * preventing runtime crashes when reading nested properties.
 */
export function isLunarObserver(input: unknown): input is ValidatedLunarObserver {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }
  const obj = input as Record<string, unknown>;

  // Check that the object actually has the structured properties of ValidatedLunarObserver
  const hasStructure =
    typeof obj.latitudeDeg === 'number' &&
    typeof obj.longitudeDeg === 'number' &&
    typeof obj.coordinates === 'object' &&
    obj.coordinates !== null &&
    typeof obj.height === 'object' &&
    obj.height !== null &&
    typeof obj.referenceSphere === 'object' &&
    obj.referenceSphere !== null &&
    typeof obj.azimuth === 'object' &&
    obj.azimuth !== null;

  if (!hasStructure) {
    return false;
  }

  const result = validateLunarObserver(input);
  return result.success && result.status === 'complete';
}
