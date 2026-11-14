/**
 * @file tests/science/lunar-observer.spec.ts
 * @description Comprehensive scientific test suite for MOONLINE Lunar Observer Contract.
 *
 * Fully type-checked for strict tsc --noEmit (noUncheckedIndexedAccess) and @playwright/test.
 * Zero TS2532 warnings: uses array guards and .some() to prevent unchecked index access.
 *
 * Covers:
 * 1. Proves unknown/missing height is NEVER treated as successful observer.
 * 2. Tests full datum validation (supported, unsupported, and interpretation mismatches).
 * 3. Tests exact-pole azimuth singularity policy (-90° and +90°).
 * 4. Tests latitude boundaries (-90, +90) and immediate invalid exterior neighbors (-90.0001, +90.0001).
 * 5. Tests both signs of infinity (+Infinity and -Infinity) across all numerical fields.
 * 6. Tests array guards (plain and property-carrying arrays).
 * 7. Asserts explicitly unavailable frame and provider compatibility paths.
 * 8. Preserves explicit reference-surface zero while distinguishing it from terrain.
 *
 * Test runner: @playwright/test (pure unit tests, zero browser overhead).
 */

import { test, expect } from '@playwright/test';
import {
  validateLunarObserver,
  isLunarObserver,
  normalizeLongitude180,
} from '../../src/lib/validation/lunar-observer';

test.describe('Lunar Observer Contract — Complete Scientific Test Suite', () => {

  /* ------------------------------------------------------------------------ */
  /* 1. Missing / Unknown Height Rejection (Unknown is not Zero)              */
  /* ------------------------------------------------------------------------ */
  test.describe('1. Missing / Unknown Height Rejection', () => {
    test('rejects elevationMeters: null from complete status and returns status: "incomplete"', () => {
      const sultanProbe = {
        latitude: -85,
        longitude: 20,
        referenceFrame: 'ME',
        longitudeConvention: 'signed-east',
        elevationMeters: null,
      };

      // Type-guard must NOT return true
      expect(isLunarObserver(sultanProbe)).toBe(false);

      const result = validateLunarObserver(sultanProbe);
      expect(result.success).toBe(false);
      expect(result.status).toBe('incomplete');

      if (result.status === 'incomplete') {
        expect(result.missingFields).toContain('heightMeters');
        expect(result.missingFields).toContain('heightDatum');
        expect(result.missingFields).toContain('heightInterpretation');

        // Partial coordinates preserved for UI prompt
        expect(result.partialCoordinates.latitudeDeg).toBe(-85);
        expect(result.partialCoordinates.longitudeDeg).toBe(20);
        expect(result.partialCoordinates.coordinateSystem).toBe('MOON_TREK_MAP');

        // Frame compatibility remains honestly unavailable
        expect(result.frameCompatibility.status).toBe('unavailable');
      }
    });

    test('reports missing height when only coordinates are provided', () => {
      const coordsOnly = {
        latitudeDeg: -89.9,
        longitudeDeg: 0.0,
      };

      expect(isLunarObserver(coordsOnly)).toBe(false);

      const result = validateLunarObserver(coordsOnly);
      expect(result.success).toBe(false);
      expect(result.status).toBe('incomplete');

      if (result.status === 'incomplete') {
        expect(result.missingFields).toEqual([
          'heightMeters',
          'heightDatum',
          'heightInterpretation',
        ]);
      }
    });

    test('reports missing datum when heightMeters is supplied alone', () => {
      const heightWithoutDatum = {
        latitudeDeg: -85,
        longitudeDeg: 20,
        heightMeters: 500,
      };

      const result = validateLunarObserver(heightWithoutDatum);
      expect(result.success).toBe(false);
      expect(result.status).toBe('incomplete');

      if (result.status === 'incomplete') {
        expect(result.missingFields).toContain('heightDatum');
        expect(result.missingFields).toContain('heightInterpretation');
      }
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 2. Datum Validation & Interpretation Consistency                         */
  /* ------------------------------------------------------------------------ */
  test.describe('2. Datum Validation & Consistency', () => {
    test('accepts supported datums: "reference_sphere" and "terrain_surface"', () => {
      const sphereValid = validateLunarObserver({
        latitudeDeg: -85,
        longitudeDeg: 20,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });
      expect(sphereValid.success).toBe(true);
      expect(sphereValid.status).toBe('complete');

      const terrainValid = validateLunarObserver({
        latitudeDeg: -85,
        longitudeDeg: 20,
        heightMeters: 1500,
        heightDatum: 'terrain_surface',
        heightInterpretation: 'measured_terrain_elevation',
      });
      expect(terrainValid.success).toBe(true);
      expect(terrainValid.status).toBe('complete');
    });

    test('rejects unsupported datums like "terrain-relative" or "wgs84"', () => {
      const unsupportedList = ['terrain-relative', 'wgs84', 'geoid', 'lunar-mean-level'];
      for (const badDatum of unsupportedList) {
        const result = validateLunarObserver({
          latitudeDeg: -85,
          longitudeDeg: 20,
          heightMeters: 100,
          heightDatum: badDatum,
          heightInterpretation: 'measured_terrain_elevation',
        });
        expect(result.success).toBe(false);
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.errors.some(e => e.code === 'UNSUPPORTED_DATUM')).toBe(true);
        }
      }
    });

    test('rejects datum and interpretation mismatches', () => {
      // reference_sphere cannot be measured_terrain_elevation
      const mismatch1 = validateLunarObserver({
        latitudeDeg: 0,
        longitudeDeg: 0,
        heightMeters: 100,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'measured_terrain_elevation',
      });
      expect(mismatch1.success).toBe(false);
      expect(mismatch1.status).toBe('rejected');
      if (mismatch1.status === 'rejected') {
        expect(mismatch1.errors.some(e => e.code === 'DATUM_INTERPRETATION_MISMATCH')).toBe(true);
      }

      // terrain_surface cannot be reference_surface_zero
      const mismatch2 = validateLunarObserver({
        latitudeDeg: 0,
        longitudeDeg: 0,
        heightMeters: 0,
        heightDatum: 'terrain_surface',
        heightInterpretation: 'reference_surface_zero',
      });
      expect(mismatch2.success).toBe(false);
      expect(mismatch2.status).toBe('rejected');
      if (mismatch2.status === 'rejected') {
        expect(mismatch2.errors.some(e => e.code === 'DATUM_INTERPRETATION_MISMATCH')).toBe(true);
      }
    });

    test('preserves explicit reference-surface zero with warning', () => {
      const result = validateLunarObserver({
        latitudeDeg: -85,
        longitudeDeg: 20,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe('complete');
      if (result.status === 'complete') {
        expect(result.observer.height.heightMeters).toBe(0);
        expect(result.observer.height.heightInterpretation).toBe('reference_surface_zero');
        expect(result.warnings.some(w => w.includes('mathematical datum'))).toBe(true);
      }
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 3. Both Signs of Infinity (+Infinity & -Infinity) and Numeric Guards      */
  /* ------------------------------------------------------------------------ */
  test.describe('3. Infinities (+Inf & -Inf) & Non-Numeric Types', () => {
    test('rejects +Infinity and -Infinity across latitude, longitude, and height', () => {
      const infinities = [
        { latitudeDeg: Infinity, longitudeDeg: 0, heightMeters: 0 },
        { latitudeDeg: -Infinity, longitudeDeg: 0, heightMeters: 0 },
        { latitudeDeg: 0, longitudeDeg: Infinity, heightMeters: 0 },
        { latitudeDeg: 0, longitudeDeg: -Infinity, heightMeters: 0 },
        { latitudeDeg: 0, longitudeDeg: 0, heightMeters: Infinity },
        { latitudeDeg: 0, longitudeDeg: 0, heightMeters: -Infinity },
      ];

      for (const item of infinities) {
        const result = validateLunarObserver({
          ...item,
          heightDatum: 'reference_sphere',
          heightInterpretation: 'reference_surface_zero',
        });
        expect(result.success).toBe(false);
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.errors.some(e => e.code === 'NON_FINITE_NUMBER')).toBe(true);
        }
      }
    });

    test('rejects NaN, numeric strings, and booleans', () => {
      const badValues = [
        { latitudeDeg: NaN, longitudeDeg: 0 },
        { latitudeDeg: 0, longitudeDeg: NaN },
        { latitudeDeg: '-85', longitudeDeg: 0 },
        { latitudeDeg: 0, longitudeDeg: '20' },
        { latitudeDeg: true, longitudeDeg: false },
      ];

      for (const item of badValues) {
        const result = validateLunarObserver({
          ...item,
          heightMeters: 0,
          heightDatum: 'reference_sphere',
          heightInterpretation: 'reference_surface_zero',
        });
        expect(result.success).toBe(false);
        expect(result.status).toBe('rejected');
      }
    });

    test('strictly rejects plain arrays and arrays carrying attached properties', () => {
      // Plain array
      const plain = [-85, 20];
      const res1 = validateLunarObserver(plain);
      expect(res1.success).toBe(false);
      expect(res1.status).toBe('rejected');
      if (res1.status === 'rejected') {
        const [firstError] = res1.errors;
        expect(firstError?.code).toBe('ARRAY_NOT_PERMITTED');
        expect(res1.errors.some(e => e.code === 'ARRAY_NOT_PERMITTED')).toBe(true);
      }

      // Array with properties attached
      const propArray: unknown = [];
      (propArray as Record<string, unknown>).latitudeDeg = -85;
      (propArray as Record<string, unknown>).longitudeDeg = 20;
      (propArray as Record<string, unknown>).heightMeters = 0;
      (propArray as Record<string, unknown>).heightDatum = 'reference_sphere';
      (propArray as Record<string, unknown>).heightInterpretation = 'reference_surface_zero';

      expect(isLunarObserver(propArray)).toBe(false);

      const res2 = validateLunarObserver(propArray);
      expect(res2.success).toBe(false);
      expect(res2.status).toBe('rejected');
      if (res2.status === 'rejected') {
        const [firstError] = res2.errors;
        expect(firstError?.code).toBe('ARRAY_NOT_PERMITTED');
        expect(res2.errors.some(e => e.code === 'ARRAY_NOT_PERMITTED')).toBe(true);
      }
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 4. Latitude Boundaries and Neighbors                                     */
  /* ------------------------------------------------------------------------ */
  test.describe('4. Latitude Boundaries & Exterior Neighbors', () => {
    test('accepts exact latitude limits -90.0° and +90.0°', () => {
      const south = validateLunarObserver({
        latitudeDeg: -90.0,
        longitudeDeg: 0.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });
      expect(south.success).toBe(true);
      expect(south.status).toBe('complete');
      if (south.status === 'complete') {
        expect(south.observer.latitudeDeg).toBe(-90.0);
      }

      const north = validateLunarObserver({
        latitudeDeg: 90.0,
        longitudeDeg: 0.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });
      expect(north.success).toBe(true);
      expect(north.status).toBe('complete');
      if (north.status === 'complete') {
        expect(north.observer.latitudeDeg).toBe(90.0);
      }
    });

    test('accepts immediate interior neighbors -89.9999° and +89.9999°', () => {
      const southInterior = validateLunarObserver({
        latitudeDeg: -89.9999,
        longitudeDeg: 0.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });
      expect(southInterior.success).toBe(true);
      expect(southInterior.status).toBe('complete');
      if (southInterior.status === 'complete') {
        expect(southInterior.observer.latitudeDeg).toBe(-89.9999);
      }

      const northInterior = validateLunarObserver({
        latitudeDeg: 89.9999,
        longitudeDeg: 0.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });
      expect(northInterior.success).toBe(true);
      expect(northInterior.status).toBe('complete');
      if (northInterior.status === 'complete') {
        expect(northInterior.observer.latitudeDeg).toBe(89.9999);
      }
    });

    test('rejects immediate exterior neighbors -90.0001° and +90.0001°', () => {
      const southExterior = validateLunarObserver({
        latitudeDeg: -90.0001,
        longitudeDeg: 0.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });
      expect(southExterior.success).toBe(false);
      expect(southExterior.status).toBe('rejected');
      if (southExterior.status === 'rejected') {
        const [firstError] = southExterior.errors;
        expect(firstError?.code).toBe('LATITUDE_OUT_OF_BOUNDS');
        expect(southExterior.errors.some(e => e.code === 'LATITUDE_OUT_OF_BOUNDS')).toBe(true);
      }

      const northExterior = validateLunarObserver({
        latitudeDeg: 90.0001,
        longitudeDeg: 0.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });
      expect(northExterior.success).toBe(false);
      expect(northExterior.status).toBe('rejected');
      if (northExterior.status === 'rejected') {
        const [firstError] = northExterior.errors;
        expect(firstError?.code).toBe('LATITUDE_OUT_OF_BOUNDS');
        expect(northExterior.errors.some(e => e.code === 'LATITUDE_OUT_OF_BOUNDS')).toBe(true);
      }
    });
  });

   /* ------------------------------------------------------------------------ */
  /* 5. Longitude Normalization & Boundary Checks                             */
  /* ------------------------------------------------------------------------ */
  test.describe('5. Canonical Longitude Normalization & Endpoints', () => {
    test('normalizes supported endpoints into half-open interval [-180.0, +180.0)', () => {
      expect(normalizeLongitude180(-180.0)).toBe(-180.0);
      expect(normalizeLongitude180(180.0)).toBe(-180.0); // +180 maps to -180
      expect(normalizeLongitude180(0.0)).toBe(0.0);
      expect(normalizeLongitude180(360.0)).toBe(0.0); // 360 maps to 0
      expect(normalizeLongitude180(270.0)).toBe(-90.0); // unsigned 270 maps to -90
      expect(normalizeLongitude180(190.0)).toBe(-170.0);
    });

    test('rejects longitudes outside supported input ranges [-180, +180] and [0, 360]', () => {
      const outOfBoundsLons = [-180.0001, -190.0, -360.0, 360.0001, 540.0];
      for (const lon of outOfBoundsLons) {
        expect(Number.isNaN(normalizeLongitude180(lon))).toBe(true);

        const result = validateLunarObserver({
          latitudeDeg: 0,
          longitudeDeg: lon,
          heightMeters: 0,
          heightDatum: 'reference_sphere',
          heightInterpretation: 'reference_surface_zero',
        });
        expect(result.success).toBe(false);
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.errors.some(e => e.code === 'LONGITUDE_OUT_OF_BOUNDS')).toBe(true);
        }
      }
    });

    test('accepts signed +180° input and normalizes it to canonical -180° in complete observer', () => {
      const result = validateLunarObserver({
        latitudeDeg: 0,
        longitudeDeg: 180.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe('complete');
      if (result.status === 'complete') {
        expect(result.observer.longitudeDeg).toBe(-180.0);
      }
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 6. Exact-Pole Policy & Azimuth Definition                                 */
  /* ------------------------------------------------------------------------ */
  test.describe('6. Exact-Pole Azimuth Singularity Policy', () => {
    test('flags exact South Pole (-90°) as undefined_at_pole azimuth', () => {
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
        const azimuth = result.observer.azimuth;
        expect(azimuth.status).toBe('undefined_at_pole');
        if (azimuth.status === 'undefined_at_pole') {
          expect(azimuth.reason).toContain('all directions point north');
        }
      }
    });

    test('flags exact North Pole (+90°) as undefined_at_pole azimuth', () => {
      const result = validateLunarObserver({
        latitudeDeg: 90.0,
        longitudeDeg: 45.0,
        heightMeters: 0,
        heightDatum: 'reference_sphere',
        heightInterpretation: 'reference_surface_zero',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('complete');
      if (result.status === 'complete') {
        expect(result.observer.poleStatus).toBe('north_pole');
        const azimuth = result.observer.azimuth;
        expect(azimuth.status).toBe('undefined_at_pole');
        if (azimuth.status === 'undefined_at_pole') {
          expect(azimuth.reason).toContain('all directions point south');
        }
      }
    });

    test('marks non-polar locations as defined azimuth', () => {
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
  /* 7. Unverified Frame & Provider Compatibility Path                         */
  /* ------------------------------------------------------------------------ */
  test.describe('7. Frame & Provider Compatibility Path', () => {
    test('exposes frameCompatibility and providerCompatibility as unavailable', () => {
      const result = validateLunarObserver({
        latitudeDeg: -85.99,
        longitudeDeg: 2.93,
        heightMeters: 5040,
        heightDatum: 'terrain_surface',
        heightInterpretation: 'measured_terrain_elevation',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('complete');
      if (result.status === 'complete') {
        // Must be unavailable: no false provider readiness claimed
        expect(result.observer.frameCompatibility.status).toBe('unavailable');
        expect(result.observer.frameCompatibility.sourceFrame).toBe('MOON_TREK_MAP');
        expect(result.observer.frameCompatibility.targetFrame).toBe('MOON_ME');

        expect(result.observer.providerCompatibility.status).toBe('unavailable');
        expect(result.observer.providerCompatibility.provider).toBe('JPL_HORIZONS');
      }
    });
  });

});
