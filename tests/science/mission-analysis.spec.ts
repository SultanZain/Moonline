/** Verify actual JPL reference tables, input integrity and independent horizon cases. @author Sultan */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { horizonsQuery, parseHorizonsTable } from "../../src/lib/api/lunar-horizons";
import { deriveTargetAnalysis, isMissionAnalysis, missionReport } from "../../src/lib/science/mission-analysis";
import { isRecord, validateMissionInput } from "../../src/lib/validation/mission-analysis";
import type { HorizonsProvenance, MissionAnalysis, MissionInput, PositionSample } from "../../src/types/mission-analysis";

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

function referenceAnalysis(): MissionAnalysis {
  return { input, generatedUtc: input.startUtc, sun: reference("sun"), earth: reference("earth"), terrainVisibility: "unavailable", method: "airless_target_center_tangent_horizon" };
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
  const analysis = referenceAnalysis();
  expect(isMissionAnalysis(analysis)).toBe(true);
  if (!isMissionAnalysis(analysis)) throw new Error("Invalid analysis");
  const report = missionReport([{ name: "Reference observer", analysis }]);
  expect(report).toContain("DE441"); expect(report).toContain("1,737,400 m reference sphere"); expect(report).toContain("No transformation"); expect(report).toContain("Terrain obstruction");
});

test("response validation rejects missing, duplicated, reordered and non-UTC sample times", () => {
  const analysis = referenceAnalysis(), sun = reference("sun");
  const first = sun.samples[0];
  if (!first) throw new Error("Missing reference sample");
  const malformed = [
    sun.samples.slice(1),
    sun.samples.toReversed(),
    [first, first, ...sun.samples.slice(2)],
    [{ ...first, timestamp: "2026-11-14T05:00:00.000+05:00" }, ...sun.samples.slice(1)],
    [...sun.samples.slice(0, -1), { ...first, timestamp: "2026-11-15T01:00:00.000Z" }],
  ];
  for (const samples of malformed) expect(isMissionAnalysis({ ...analysis, sun: { ...sun, samples } })).toBe(false);
  expect(isMissionAnalysis(analysis)).toBe(true);
});

test("response validation rejects invented duration, events, windows and missing counts", () => {
  const analysis = referenceAnalysis(), sun = reference("sun");
  const mutations = [
    { ...sun, missingSamples: 9999 },
    { ...sun, visibleHours: 25 },
    { ...sun, events: [{ timestamp: input.startUtc, kind: "rise" }] },
    { ...sun, windows: [{ startUtc: input.endUtc, endUtc: input.startUtc, openStart: true, openEnd: true }] },
    { ...sun, windows: sun.windows.map(window => ({ ...window, openStart: false })) },
  ];
  for (const target of mutations) expect(isMissionAnalysis({ ...analysis, sun: target })).toBe(false);
});

test("missing elevation responses require unknown duration and accurately derived windows", () => {
  const analysis = referenceAnalysis(), sun = reference("sun");
  // Transport mutations exercise unavailable data; they are not new lunar reference measurements.
  const allMissing = deriveTargetAnalysis(sun.samples.map(position => ({ ...position, elevationDeg: null })), sun.provenance);
  expect(isMissionAnalysis({ ...analysis, sun: allMissing })).toBe(true);
  expect(isMissionAnalysis({ ...analysis, sun: { ...allMissing, visibleHours: 0 } })).toBe(false);
  const partial = deriveTargetAnalysis(sun.samples.map((position, index) => index === 1 ? { ...position, elevationDeg: null } : position), sun.provenance);
  expect(isMissionAnalysis({ ...analysis, sun: partial })).toBe(true);
  expect(isMissionAnalysis({ ...analysis, sun: { ...partial, missingSamples: 0 } })).toBe(false);
});

test("response validation requires actual provider metadata and the matching observer query", () => {
  const analysis = referenceAnalysis(), sun = reference("sun");
  const wrongSite = new URL(sun.provenance.queryUrl); wrongSite.searchParams.set("SITE_COORD", "'30,-85,0'");
  const duplicateCenter = new URL(sun.provenance.queryUrl); duplicateCenter.searchParams.append("CENTER", "'coord@399'");
  const badMetadata = [
    { ...sun.provenance, source: "Synthetic horizon test" },
    { ...sun.provenance, centerFrame: "IAU_MOON" },
    { ...sun.provenance, radiusKm: 6378.1 },
    { ...sun.provenance, timeScale: "TT" },
    { ...sun.provenance, apiVersion: "test", ephemeris: "test" },
    { ...sun.provenance, retrievedUtc: "2026-02-30T00:00:00.000Z" },
    { ...sun.provenance, queryUrl: "https://ssd.jpl.nasa.gov.example.test/api/horizons.api" },
    { ...sun.provenance, queryUrl: "javascript:alert(1)" },
    { ...sun.provenance, queryUrl: reference("earth").provenance.queryUrl },
    { ...sun.provenance, queryUrl: wrongSite.toString() },
    { ...sun.provenance, queryUrl: duplicateCenter.toString() },
  ];
  for (const provenance of badMetadata) expect(isMissionAnalysis({ ...analysis, sun: { ...sun, provenance } })).toBe(false);
  expect(isMissionAnalysis({ ...analysis, generatedUtc: "2026-11-14T05:00:00.000+05:00" })).toBe(false);
});

test("partial results and reports preserve unavailable targets and failed candidate sites", () => {
  const analysis: MissionAnalysis = { ...referenceAnalysis(), earth: { status: "error", message: "Earth data unavailable." } };
  expect(isMissionAnalysis(analysis)).toBe(true);
  expect(isMissionAnalysis({ ...analysis, sun: { status: "error", message: "Sun data unavailable." } })).toBe(false);
  const report = missionReport([{ name: "Reference observer", analysis }], [{ name: "Second | candidate", message: "Horizons timed out.\nRetry shortly." }]);
  expect(report).toContain("### Earth\n\nUnavailable: Earth data unavailable.");
  expect(report).toContain("| Start (UTC) | End (UTC) | Start boundary | End boundary |");
  expect(report).toContain(`| ${input.startUtc} | ${input.endUtc} | Open | Open |`);
  expect(report).toContain("Open boundaries mark observation limits or adjacent missing samples");
  expect(report).toContain("## Unavailable sites");
  expect(report).toContain("| Second \\| candidate | Horizons timed out. Retry shortly. |");
  expect(missionReport([], [{ name: "Failed candidate", message: "Data unavailable." }])).toContain("| Failed candidate | Data unavailable. |");
});

test("reports distinguish missing intervals from known absence of visibility", () => {
  const analysis = referenceAnalysis(), sun = reference("sun");
  const missing = deriveTargetAnalysis(sun.samples.map(position => ({ ...position, elevationDeg: null })), sun.provenance);
  const missingReport = missionReport([{ name: "Unavailable transport fixture", analysis: { ...analysis, sun: missing } }]);
  expect(missingReport).toContain("Estimated geometric visibility: Unknown (missing samples)");
  expect(missingReport).toContain("| — | — | Unknown; missing elevations | — |");
  const below = deriveTargetAnalysis(sun.samples.map(position => ({ ...position, elevationDeg: -1 })), sun.provenance);
  const belowReport = missionReport([{ name: "Below-horizon transport fixture", analysis: { ...analysis, sun: below } }]);
  expect(belowReport).toContain("Estimated geometric visibility: 0.00 hours");
  expect(belowReport).toContain("| — | — | No above-horizon interval found | — |");
});
