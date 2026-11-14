/**
 * @file tests/science/lunar-observer.spec.ts
 * @description Comprehensive scientific test suite for MOONLINE Lunar Observer Contract.
 *
 * Fully type-checked for strict tsc --noEmit and @playwright/test.
 *
 * Covers:
 * 1. Proves unknown/missing height is NEVER treated as successful observer ("Unknown is not zero").
 * 2. Strict datum validation ('reference_sphere' only) & zero-height constraint.
 * 3. Metadata validation: rejects unsupported coordinate systems (WGS84) & longitude conventions (positive_west).
 * 4. Exact-pole azimuth singularity policy (-90° and +90°).
 * 5. Latitude boundaries ([-90, +90]) and immediate invalid exterior neighbors (±90.0001°).
 * 6. Longitude normalization ([-180, +180), +180° -> -180°, 360° -> 0°).
 * 7. Both signs of infinity (+Infinity and -Infinity) and NaN rejection.
 * 8. Array guards (plain arrays and property-carrying arrays rejected with ARRAY_NOT_PERMITTED).
 * 9. Type guard runtime safety (isLunarObserver prevents property-access crash).
 * 10. Asserts explicitly unavailable frame and provider compatibility paths.
 *
 * Test runner: @playwright/test (pure unit tests, zero browser overhead).
 */

import { test, expect } from '@playwright/test';
import {
  validateLunarObserver,
  isLunarObserver,
  normalizeLongitude180,
  evaluatePoleStatusAndAzimuth,
} from '../../src/lib/validation/lunar-observer';

test.describe('Lunar Observer Contract — Complete Scientific Test Suite', () => {

  /* ------------------------------------------------------------------------ */
  /* 1. Missing / Unknown Height Rejection ("Unknown is not Zero")            */
  /* ------------------------------------------------------------------------ */
  test.describe('1. Missing / Unknown Height Rejection', () => {
    test('rejects elevationMeters: null from complete status and returns status: "incomplete"', () => {
      const result = validateLunarObserver({
        latitudeDeg: -85.0,
        longitudeDeg: 20.0,
        elevationMeters: null,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('incomplete');
      if (result.status === 'incomplete') {
        expect(result.missingFields).toContain('heightMeters');
        expect(result.missingFields).toContain('heightDatum');
        expect(result.missingFields).toContain('heightInterpretation');
        expect(result.partialCoordinates.latitudeDeg).toBe(-85.0);
        expect(result.partialCoordinates.longitudeDeg).toBe(20.0);
      }
    });

    test('isLunarObserver returns false for incomplete observer inputs', () => {
      const mapClick = {
        latitudeDeg: -85.0,
        longitudeDeg: 20.0,
      };

      expect(isLunarObserver(mapClick)).toBe(false);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 2. Datum & Height Interpretation Consistency                             */
  /* ------------------------------------------------------------------------ */
  test.describe('2. Datum & Height Interpretation Consistency', () => {
    test('accepts reference_sphere with reference_surface_zero when heightMeters === 0', () => {
      const result = validateLunarObserver({
        latitudeDeg: -85.0,
        longitudeDeg: 20.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('complete');
      if (result.status === 'complete') {
        expect(result.observer.height.heightMeters).toBe(0);
        expect(result.observer.height.heightDatum).toBe('reference_sphere');
        expect(result.observer.height.heightInterpretation).toBe('reference_surface_zero');
      }
    });

    test('STRICTLY rejects reference_surface_zero when heightMeters is non-zero (e.g. 150m)', () => {
      const result = validateLunarObserver({
        latitudeDeg: -85.0,
        longitudeDeg: 20.0,
        heightMeters: 150,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        const mismatchError = result.errors.some(
          (e) => e.field === 'heightInterpretation' && e.code === 'DATUM_INTERPRETATION_MISMATCH'
        );
        expect(mismatchError).toBe(true);
      }
    });

    test('accepts measured_terrain_elevation relative to reference_sphere', () => {
      const result = validateLunarObserver({
        latitudeDeg: -85.99,
        longitudeDeg: 2.93,
        heightMeters: 5040,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'measured_terrain_elevation',
        heightSource: 'LOLA DEM 20m/px',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('complete');
      if (result.status === 'complete') {
        expect(result.observer.height.heightInterpretation).toBe('measured_terrain_elevation');
        expect(result.observer.height.heightDatum).toBe('reference_sphere');
      }
    });

    test('rejects unsupported datum (e.g. terrain_surface or WGS84)', () => {
      const result = validateLunarObserver({
        latitudeDeg: -85.0,
        longitudeDeg: 20.0,
        heightMeters: 100,
        heightDatum: 'terrain_surface', // Unsupported in Sultan's types
        heightInterpretation: 'measured_terrain_elevation',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.errors.some((e) => e.code === 'UNSUPPORTED_DATUM')).toBe(true);
      }
    });

    test('rejects unsupported / invented height interpretations', () => {
      const result = validateLunarObserver({
        latitudeDeg: -85.0,
        longitudeDeg: 20.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'invented_interpretation',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.errors.some((e) => e.code === 'DATUM_INTERPRETATION_MISMATCH')).toBe(true);
      }
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 3. Metadata & Coordinate System Declarations                             */
  /* ------------------------------------------------------------------------ */
  test.describe('3. Metadata & Coordinate System Declarations', () => {
    test('rejects unsupported coordinateSystem: "WGS84"', () => {
      const result = validateLunarObserver({
        latitudeDeg: -85.0,
        longitudeDeg: 20.0,
        coordinateSystem: 'WGS84',
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.errors.some((e) => e.code === 'UNSUPPORTED_COORDINATE_SYSTEM')).toBe(true);
      }
    });

    test('rejects unsupported longitudeConvention: "positive_west"', () => {
      const result = validateLunarObserver({
        latitudeDeg: -85.0,
        longitudeDeg: 20.0,
        longitudeConvention: 'positive_west',
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.errors.some((e) => e.code === 'UNSUPPORTED_LONGITUDE_CONVENTION')).toBe(true);
      }
    });

    test('accepts valid MOON_TREK_MAP and positive_east metadata', () => {
      const result = validateLunarObserver({
        latitudeDeg: -85.0,
        longitudeDeg: 20.0,
        coordinateSystem: 'MOON_TREK_MAP',
        longitudeConvention: 'positive_east',
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('complete');
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 4. Exact-Pole Azimuth Singularity Policy                                 */
  /* ------------------------------------------------------------------------ */
  test.describe('4. Exact-Pole Azimuth Singularity Policy', () => {
    test('marks exact North Pole (+90°) as undefined_at_pole azimuth', () => {
      const result = validateLunarObserver({
        latitudeDeg: 90.0,
        longitudeDeg: 0.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('complete');
      if (result.status === 'complete') {
        expect(result.observer.poleStatus).toBe('north_pole');
        expect(result.observer.azimuth.status).toBe('undefined_at_pole');
        if (result.observer.azimuth.status === 'undefined_at_pole') {
          expect(result.observer.azimuth.reason).toContain('all directions point south');
        }
      }
    });

    test('marks exact South Pole (-90°) as undefined_at_pole azimuth', () => {
      const result = validateLunarObserver({
        latitudeDeg: -90.0,
        longitudeDeg: 0.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('complete');
      if (result.status === 'complete') {
        expect(result.observer.poleStatus).toBe('south_pole');
        expect(result.observer.azimuth.status).toBe('undefined_at_pole');
      }
    });

    test('marks non-polar coordinates as defined azimuth', () => {
      const result = validateLunarObserver({
        latitudeDeg: -85.0,
        longitudeDeg: 0.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('complete');
      if (result.status === 'complete') {
        expect(result.observer.poleStatus).toBe('not_at_pole');
        expect(result.observer.azimuth.status).toBe('defined');
      }
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 5. Latitude & Longitude Boundaries                                       */
  /* ------------------------------------------------------------------------ */
  test.describe('5. Latitude & Longitude Boundaries', () => {
    test('accepts exact latitude boundaries -90° and +90°', () => {
      const south = validateLunarObserver({ latitudeDeg: -90.0, longitudeDeg: 0.0, heightMeters: 0, heightDatum: 'reference_sphere', heightInterpretation: 'reference_surface_zero' });
      const north = validateLunarObserver({ latitudeDeg: 90.0, longitudeDeg: 0.0, heightMeters: 0, heightDatum: 'reference_sphere', heightInterpretation: 'reference_surface_zero' });

      expect(south.success).toBe(true);
      expect(north.success).toBe(true);
    });

    test('rejects immediate exterior latitude neighbors ±90.0001°', () => {
      const southOut = validateLunarObserver({ latitudeDeg: -90.0001, longitudeDeg: 0.0 });
      const northOut = validateLunarObserver({ latitudeDeg: 90.0001, longitudeDeg: 0.0 });

      expect(southOut.success).toBe(false);
      expect(northOut.success).toBe(false);
    });

    test('normalizes longitude endpoint +180° to -180°', () => {
      expect(normalizeLongitude180(180)).toBe(-180);
      expect(normalizeLongitude180(-180)).toBe(-180);
      expect(normalizeLongitude180(360)).toBe(0);
      expect(normalizeLongitude180(0)).toBe(0);
      expect(normalizeLongitude180(20)).toBe(20);
      expect(Number.isNaN(normalizeLongitude180(360.1))).toBe(true);
      expect(Number.isNaN(normalizeLongitude180(-180.1))).toBe(true);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 6. Array Guards & Input Security                                         */
  /* ------------------------------------------------------------------------ */
  test.describe('6. Array Guards & Input Security', () => {
    test('rejects empty and standard arrays with ARRAY_NOT_PERMITTED', () => {
      const result = validateLunarObserver([]);
      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.errors.some((e) => e.code === 'ARRAY_NOT_PERMITTED')).toBe(true);
      }
    });

    test('rejects property-carrying arrays with ARRAY_NOT_PERMITTED', () => {
      const arrayWithProps = Object.assign([], {
        latitudeDeg: -85.0,
        longitudeDeg: 20.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });

      const result = validateLunarObserver(arrayWithProps);
      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.errors.some((e) => e.code === 'ARRAY_NOT_PERMITTED')).toBe(true);
      }
    });

    test('rejects non-object primitives (null, string, number)', () => {
      expect(validateLunarObserver(null).success).toBe(false);
      expect(validateLunarObserver('invalid').success).toBe(false);
      expect(validateLunarObserver(42).success).toBe(false);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 7. Infinities and NaN Rejection                                          */
  /* ------------------------------------------------------------------------ */
  test.describe('7. Infinities and NaN Rejection', () => {
    test('rejects +Infinity and -Infinity for latitude and longitude', () => {
      const infLat = validateLunarObserver({ latitudeDeg: Infinity, longitudeDeg: 0.0 });
      const negInfLon = validateLunarObserver({ latitudeDeg: 0.0, longitudeDeg: -Infinity });

      expect(infLat.success).toBe(false);
      expect(negInfLon.success).toBe(false);
    });

    test('rejects NaN in numeric fields', () => {
      const nanResult = validateLunarObserver({ latitudeDeg: NaN, longitudeDeg: 0.0 });
      expect(nanResult.success).toBe(false);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 8. Type Guard Runtime Safety (isLunarObserver)                           */
  /* ------------------------------------------------------------------------ */
  test.describe('8. Type Guard Runtime Safety (isLunarObserver)', () => {
    test('returns false for flat raw input objects to prevent runtime crashes', () => {
      const flatInput = {
        latitudeDeg: -85.0,
        longitudeDeg: 20.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      };

      // Raw flat inputs lack nested properties like .height, so isLunarObserver returns false
      expect(isLunarObserver(flatInput)).toBe(false);
    });

    test('returns true for complete ValidatedLunarObserver objects', () => {
      const validation = validateLunarObserver({
        latitudeDeg: -85.0,
        longitudeDeg: 20.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });

      expect(validation.success).toBe(true);
      if (validation.success && validation.status === 'complete') {
        expect(isLunarObserver(validation.observer)).toBe(true);
        // Reading properties is completely safe and won't crash
        expect(validation.observer.height.heightMeters).toBe(0);
        expect(validation.observer.coordinates.coordinateSystem).toBe('MOON_TREK_MAP');
      }
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 9. Unverified Frame & Provider Compatibility Path                        */
  /* ------------------------------------------------------------------------ */
  test.describe('9. Unverified Frame & Provider Compatibility Path', () => {
    test('exposes frameCompatibility and providerCompatibility as unavailable', () => {
      const result = validateLunarObserver({
        latitudeDeg: -85.99,
        longitudeDeg: 2.93,
        heightMeters: 5040,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'measured_terrain_elevation',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('complete');
      if (result.status === 'complete') {
        expect(result.observer.frameCompatibility.status).toBe('unavailable');
        expect(result.observer.frameCompatibility.sourceFrame).toBe('MOON_TREK_MAP');
        expect(result.observer.frameCompatibility.targetFrame).toBe('MOON_ME');

        expect(result.observer.providerCompatibility.status).toBe('unavailable');
        expect(result.observer.providerCompatibility.provider).toBe('JPL_HORIZONS');
      }
    });
  });

});
