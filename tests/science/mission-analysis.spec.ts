/** Verify actual JPL reference tables, input integrity and independent horizon cases. @author Sultan */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { horizonsQuery, parseHorizonsTable } from "../../src/lib/api/lunar-horizons";
import { deriveTargetAnalysis, isMissionAnalysis, missionReport } from "../../src/lib/science/mission-analysis";
import { isRecord, validateMissionInput } from "../../src/lib/validation/mission-analysis";
import type { HorizonsProvenance, MissionInput, PositionSample } from "../../src/types/mission-analysis";

const input: MissionInput = { observer: { latitude: -85, longitude: 20, heightMeters: 0, coordinateBasis: "adopted_mean_earth" }, startUtc: "2026-11-14T00:00:00.000Z", endUtc: "2026-11-15T00:00:00.000Z", stepMinutes: 60 };
function fixture(target: "sun" | "earth") {
  const record: unknown = JSON.parse(readFileSync(`tests/science/fixtures/horizons-${target}.json`, "utf8"));
  if (!isRecord(record) || typeof record.url !== "string" || typeof record.retrievedAt !== "string") throw new Error("Invalid JPL reference record");
  return { payload: record.payload, url: record.url, retrievedAt: record.retrievedAt };
}
function reference(target: "sun" | "earth") {
  const source = fixture(target);
  const parsed = parseHorizonsTable(source.payload, input, target, source.url, source.retrievedAt);
  if (parsed.status !== "ready") throw new Error("Reference unavailable");
  return parsed;
}

test("observed JPL Sun and Earth tables retain independent angles, dates and source metadata", () => {
  const sun = reference("sun"), earth = reference("earth");
  expect(sun.samples).toHaveLength(25); expect(earth.samples).toHaveLength(25);
  // Expected values transcribed from the archived NASA/JPL responses, retrieved 2026-11-14.
  expect(sun.samples[0]).toEqual({ timestamp: input.startUtc, azimuthDeg: 106.687784312, elevationDeg: 0.122927239 });
  expect(earth.samples[0]).toEqual({ timestamp: input.startUtc, azimuthDeg: 338.838104663, elevationDeg: 0.013102219 });
  expect(sun.provenance.ephemeris).toBe("DE441"); expect(earth.provenance.centerFrame).toBe("MEAN_ME (high precision)");
  expect(sun.provenance.radiusKm).toBe(1737.4); expect(sun.provenance.timeScale).toBe("UTC");
  expect(sun.visibleHours).toBe(24); expect(earth.visibleHours).toBe(24);
});

test("provider setup uses lunar topocentric geometry, airless angles and explicit metre conversion", () => {
  const query = horizonsQuery({ ...input, observer: { ...input.observer, heightMeters: 1500 } }, "earth");
  expect(query.origin).toBe("https://ssd.jpl.nasa.gov");
  expect(query.searchParams.get("COMMAND")).toBe("'399'"); expect(query.searchParams.get("CENTER")).toBe("'coord@301'");
  expect(query.searchParams.get("SITE_COORD")).toBe("'20,-85,1.5'"); expect(query.searchParams.get("APPARENT")).toBe("'AIRLESS'");
  expect(query.searchParams.get("TIME_TYPE")).toBe("'UT'"); expect(query.searchParams.get("QUANTITIES")).toBe("'4'");
});

test("missing height and undeclared frame assumptions never become successful observers", () => {
  const badObservers: unknown[] = [{ ...input.observer, heightMeters: null }, { ...input.observer, heightMeters: "0" }, { ...input.observer, coordinateBasis: "IAU_MOON" }, Object.assign([], input.observer)];
  for (const observer of badObservers) expect(validateMissionInput({ ...input, observer }).success).toBe(false);
  expect(validateMissionInput(input).success).toBe(true);
});

test("coordinate limits, UTC rollover, both infinities and sampling bounds are enforced", () => {
  for (const value of [NaN, Infinity, -Infinity, "", null]) {
    for (const field of ["latitude", "longitude", "heightMeters"]) expect(validateMissionInput({ ...input, observer: { ...input.observer, [field]: value } }).success).toBe(false);
  }
  for (const latitude of [-90, 90]) expect(validateMissionInput({ ...input, observer: { ...input.observer, latitude } }).success).toBe(true);
  for (const latitude of [-90.0001, 90.0001]) expect(validateMissionInput({ ...input, observer: { ...input.observer, latitude } }).success).toBe(false);
  expect(validateMissionInput({ ...input, startUtc: "2026-02-30T00:00:00.000Z" }).success).toBe(false);
  expect(validateMissionInput({ ...input, startUtc: "2026-11-14T05:00:00+05:00" }).success).toBe(false);
  expect(validateMissionInput({ ...input, endUtc: "2026-12-15T00:00:00.000Z", stepMinutes: 10 }).success).toBe(false);
});

test("wrong center, atmosphere, reference figure, frame and malformed numeric tables are rejected", () => {
  const source = fixture("sun");
  if (!isRecord(source.payload) || typeof source.payload.result !== "string") throw new Error("Invalid fixture");
  for (const [before, after] of [["Moon (301)", "Earth (399)"], ["NO (AIRLESS)", "YES (REFRACTED)"], ["MEAN_ME (high precision)", "IAU_MOON"], ["Center radii    : 1737.4", "Center radii    : 1738.4"], ["106.687784312", "NaN"], ["2026-Nov-14 01:00", "2026-Nov-14 02:00"]] as const) {
    const changed = { ...source.payload, result: source.payload.result.replace(before, after) };
    expect(() => parseHorizonsTable(changed, input, "sun", source.url, source.retrievedAt)).toThrow();
  }
});

// Deliberately synthetic elevations isolate the interpolation method, not a real lunar site.
const syntheticProvenance: HorizonsProvenance = { source: "Synthetic horizon test", apiVersion: "test", ephemeris: "test", centerFrame: "test", radiusKm: 1737.4, timeScale: "UTC", queryUrl: "https://example.test/", retrievedUtc: input.startUtc };
const sample = (hour: number, elevationDeg: number | null): PositionSample => ({ timestamp: `2026-11-14T${String(hour).padStart(2, "0")}:00:00.000Z`, azimuthDeg: 0, elevationDeg });

test("independent rise/set crossings interpolate to 11:00/15:00 and four visible hours", () => {
  const result = deriveTargetAnalysis([sample(10, -1), sample(12, 1), sample(14, 1), sample(16, -1)], syntheticProvenance);
  expect(result.status).toBe("ready"); if (result.status !== "ready") throw new Error("No result");
  expect(result.events).toEqual([{ timestamp: "2026-11-14T11:00:00.000Z", kind: "rise" }, { timestamp: "2026-11-14T15:00:00.000Z", kind: "set" }]);
  expect(result.visibleHours).toBe(4); expect(result.windows[0]?.openStart).toBe(false);
});

test("missing samples break intervals and preserve unknown duration; zero is below threshold", () => {
  const result = deriveTargetAnalysis([sample(0, 1), sample(1, null), sample(2, -1), sample(3, 0)], syntheticProvenance);
  if (result.status !== "ready") throw new Error("No result");
  expect(result.visibleHours).toBeNull(); expect(result.events).toEqual([]); expect(result.missingSamples).toBe(1);
  const zero = deriveTargetAnalysis([sample(0, 0), sample(1, 0)], syntheticProvenance);
  if (zero.status !== "ready") throw new Error("No result"); expect(zero.visibleHours).toBe(0);
});

test("reports preserve the real inputs, sources and limitations rather than claim mission suitability", () => {
  const analysis = { input, generatedUtc: input.startUtc, sun: reference("sun"), earth: reference("earth"), terrainVisibility: "unavailable", method: "airless_target_center_tangent_horizon" };
  expect(isMissionAnalysis(analysis)).toBe(true);
  if (!isMissionAnalysis(analysis)) throw new Error("Invalid analysis");
  const report = missionReport([{ name: "Reference observer", analysis }]);
  expect(report).toContain("DE441"); expect(report).toContain("1,737,400 m reference sphere"); expect(report).toContain("No transformation"); expect(report).toContain("Terrain obstruction");
});
