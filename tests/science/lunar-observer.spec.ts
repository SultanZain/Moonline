
import { expect, test } from "@playwright/test";

import {
  isLunarCoordinate,
  isLunarObserver,
  isValidLongitude,
  normalizeLongitude,
} from "../../src/lib/validation/lunar-observer";

test.describe("Lunar coordinate validation", () => {
  test("accepts valid ME coordinates", () => {
    expect(
      isLunarCoordinate({
        latitude: -89.5,
        longitude: 45,
        referenceFrame: "ME",
        longitudeConvention: "signed-east",
      }),
    ).toBe(true);
  });

  test("rejects latitude outside the valid range", () => {
    expect(
      isLunarCoordinate({
        latitude: 91,
        longitude: 45,
        referenceFrame: "ME",
        longitudeConvention: "signed-east",
      }),
    ).toBe(false);
  });

  test("rejects NaN latitude", () => {
    expect(
      isLunarCoordinate({
        latitude: Number.NaN,
        longitude: 45,
        referenceFrame: "ME",
        longitudeConvention: "signed-east",
      }),
    ).toBe(false);
  });

  test("rejects infinite longitude", () => {
    expect(
      isLunarCoordinate({
        latitude: 0,
        longitude: Number.POSITIVE_INFINITY,
        referenceFrame: "ME",
        longitudeConvention: "signed-east",
      }),
    ).toBe(false);
  });

  test("rejects an unsupported reference frame", () => {
    expect(
      isLunarCoordinate({
        latitude: 0,
        longitude: 45,
        referenceFrame: "PA",
        longitudeConvention: "signed-east",
      }),
    ).toBe(false);
  });
});

test.describe("Longitude validation and normalization", () => {
  test("accepts positive-east longitude", () => {
    expect(isValidLongitude(270, "positive-east-360")).toBe(true);
  });

  test("rejects 360 degrees in positive-east representation", () => {
    expect(isValidLongitude(360, "positive-east-360")).toBe(false);
  });

  test("normalizes 270 degrees to -90 degrees", () => {
    expect(normalizeLongitude(270)).toBe(-90);
  });

  test("normalizes -190 degrees to 170 degrees", () => {
    expect(normalizeLongitude(-190)).toBe(170);
  });

  test("normalizes both antimeridian values to -180 degrees", () => {
    expect(normalizeLongitude(180)).toBe(-180);
    expect(normalizeLongitude(-180)).toBe(-180);
  });

  test("throws for non-finite longitude", () => {
    expect(() => normalizeLongitude(Number.NaN)).toThrow(RangeError);
  });
});

test.describe("Lunar observer validation", () => {
  test("accepts an observer with known elevation", () => {
    expect(
      isLunarObserver({
        latitude: -85,
        longitude: 20,
        referenceFrame: "ME",
        longitudeConvention: "signed-east",
        elevationMeters: 150,
      }),
    ).toBe(true);
  });

  test("accepts unknown elevation as null", () => {
    expect(
      isLunarObserver({
        latitude: -85,
        longitude: 20,
        referenceFrame: "ME",
        longitudeConvention: "signed-east",
        elevationMeters: null,
      }),
    ).toBe(true);
  });

  test("rejects NaN elevation", () => {
    expect(
      isLunarObserver({
        latitude: -85,
        longitude: 20,
        referenceFrame: "ME",
        longitudeConvention: "signed-east",
        elevationMeters: Number.NaN,
      }),
    ).toBe(false);
  });

  test("rejects missing elevation", () => {
    expect(
      isLunarObserver({
        latitude: -85,
        longitude: 20,
        referenceFrame: "ME",
        longitudeConvention: "signed-east",
      }),
    ).toBe(false);
  });
});
