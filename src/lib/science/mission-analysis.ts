/** Derive sampled target-center visibility without inferring terrain or operational results. @author Sultan */
import type { HorizonEvent, HorizonsProvenance, MissionAnalysis, MissionInput, PositionSample, TargetAnalysis, VisibilityWindow } from "@/types/mission-analysis";
import { isRecord, validateMissionInput } from "@/lib/validation/mission-analysis";

export function deriveTargetAnalysis(samples: PositionSample[], provenance: HorizonsProvenance): TargetAnalysis {
  const events: HorizonEvent[] = [];
  const windows: VisibilityWindow[] = [];
  let opening: { time: string; bounded: boolean } | null = null;
  let previous: PositionSample | null = null;
  let missingSamples = 0;
  for (const sample of samples) {
    if (sample.elevationDeg === null) {
      missingSamples++;
      if (opening && previous) windows.push({ startUtc: opening.time, endUtc: previous.timestamp, openStart: opening.bounded, openEnd: true });
      opening = null; previous = null; continue;
    }
    const visible = sample.elevationDeg > 0;
    if (previous?.elevationDeg !== null && previous && (previous.elevationDeg > 0) !== visible) {
      const before = Date.parse(previous.timestamp), after = Date.parse(sample.timestamp);
      const fraction = -previous.elevationDeg / (sample.elevationDeg - previous.elevationDeg);
      const crossing = new Date(before + fraction * (after - before)).toISOString();
      events.push({ timestamp: crossing, kind: visible ? "rise" : "set" });
      if (visible) opening = { time: crossing, bounded: false };
      else if (opening) {
        windows.push({ startUtc: opening.time, endUtc: crossing, openStart: opening.bounded, openEnd: false }); opening = null;
      }
    } else if (!previous && visible) opening = { time: sample.timestamp, bounded: true };
    previous = sample;
  }
  if (opening && previous) windows.push({ startUtc: opening.time, endUtc: previous.timestamp, openStart: opening.bounded, openEnd: true });
  const visibleHours = missingSamples > 0 ? null : windows.reduce((hours, window) => hours + (Date.parse(window.endUtc) - Date.parse(window.startUtc)) / 3_600_000, 0);
  return { status: "ready", samples, events, windows, visibleHours, missingSamples, provenance };
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function isSample(value: unknown): value is PositionSample {
  return isRecord(value) && isUtcTimestamp(value.timestamp) &&
    (value.azimuthDeg === null || typeof value.azimuthDeg === "number" && Number.isFinite(value.azimuthDeg) && value.azimuthDeg >= 0 && value.azimuthDeg < 360) &&
    (value.elevationDeg === null || typeof value.elevationDeg === "number" && Number.isFinite(value.elevationDeg) && Math.abs(value.elevationDeg) <= 90);
}

function isProvenance(value: unknown, input: MissionInput, target: "sun" | "earth"): value is HorizonsProvenance {
  if (!isRecord(value) || value.source !== "NASA/JPL Horizons API" ||
    typeof value.apiVersion !== "string" || !/^\d+(?:\.\d+){1,2}$/.test(value.apiVersion) ||
    typeof value.ephemeris !== "string" || !/^DE\d+$/.test(value.ephemeris) ||
    value.centerFrame !== "MEAN_ME (high precision)" || value.radiusKm !== 1737.4 || value.timeScale !== "UTC" ||
    !isUtcTimestamp(value.retrievedUtc) || typeof value.queryUrl !== "string" || value.queryUrl.length > 4096) return false;
  let query: URL;
  try { query = new URL(value.queryUrl); } catch { return false; }
  if (query.origin !== "https://ssd.jpl.nasa.gov" || query.pathname !== "/api/horizons.api" ||
    query.username !== "" || query.password !== "" || query.hash !== "") return false;
  const expected = {
    format: "json", COMMAND: `'${target === "sun" ? "10" : "399"}'`, CENTER: "'coord@301'", COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${input.observer.longitude},${input.observer.latitude},${input.observer.heightMeters / 1000}'`,
    START_TIME: `'${input.startUtc.slice(0, 16).replace("T", " ")}'`, STOP_TIME: `'${input.endUtc.slice(0, 16).replace("T", " ")}'`,
    STEP_SIZE: `'${input.stepMinutes} m'`, EPHEM_TYPE: "'OBSERVER'", TIME_TYPE: "'UT'", APPARENT: "'AIRLESS'",
    QUANTITIES: "'4'", CSV_FORMAT: "'YES'", ANG_FORMAT: "'DEG'", TIME_DIGITS: "'MINUTES'",
  };
  return Object.entries(expected).every(([key, expectedValue]) => {
    const values = query.searchParams.getAll(key);
    return values.length === 1 && values[0] === expectedValue;
  });
}

function isEvent(value: unknown): value is HorizonEvent {
  return isRecord(value) && isUtcTimestamp(value.timestamp) && (value.kind === "rise" || value.kind === "set");
}

function isWindow(value: unknown): value is VisibilityWindow {
  return isRecord(value) && isUtcTimestamp(value.startUtc) && isUtcTimestamp(value.endUtc) &&
    typeof value.openStart === "boolean" && typeof value.openEnd === "boolean";
}

function isTarget(value: unknown, input: MissionInput, target: "sun" | "earth"): value is TargetAnalysis {
  if (!isRecord(value)) return false;
  if (value.status === "error") return typeof value.message === "string" && value.message.trim().length > 0 && value.message.length <= 250;
  const start = Date.parse(input.startUtc), step = input.stepMinutes * 60_000;
  const expectedCount = (Date.parse(input.endUtc) - start) / step + 1;
  if (value.status !== "ready" || !Array.isArray(value.samples) || value.samples.length !== expectedCount ||
    !Array.isArray(value.events) || !Array.isArray(value.windows) || !isProvenance(value.provenance, input, target)) return false;
  const samples: unknown[] = value.samples, events: unknown[] = value.events, windows: unknown[] = value.windows;
  if (!samples.every(isSample) || !events.every(isEvent) || !windows.every(isWindow) ||
    !samples.every((sample, index) => Date.parse(sample.timestamp) === start + index * step)) return false;
  // Validate the derived fields against the supplied samples; missing elevations must never become zero duration.
  const derived = deriveTargetAnalysis(samples, value.provenance);
  if (derived.status !== "ready") return false;
  return value.missingSamples === derived.missingSamples && value.visibleHours === derived.visibleHours &&
    events.length === derived.events.length && events.every((event, index) => {
      const expected = derived.events[index];
      return expected !== undefined && event.timestamp === expected.timestamp && event.kind === expected.kind;
    }) && windows.length === derived.windows.length && windows.every((window, index) => {
      const expected = derived.windows[index];
      return expected !== undefined && window.startUtc === expected.startUtc && window.endUtc === expected.endUtc &&
        window.openStart === expected.openStart && window.openEnd === expected.openEnd;
    });
}

export function isMissionAnalysis(value: unknown): value is MissionAnalysis {
  if (!isRecord(value) || !isUtcTimestamp(value.generatedUtc) || value.terrainVisibility !== "unavailable" ||
    value.method !== "airless_target_center_tangent_horizon") return false;
  const validation = validateMissionInput(value.input);
  return validation.success && isTarget(value.sun, validation.input, "sun") && isTarget(value.earth, validation.input, "earth") &&
    (value.sun.status === "ready" || value.earth.status === "ready");
}

export function missionReport(analyses: { name: string; analysis: MissionAnalysis }[], failures: { name: string; message: string }[] = []): string {
  const lines = ["# MOONLINE mission geometry report", "", `Generated: ${new Date().toISOString()}`, "", "Airless target-center geometry above the ideal local tangent horizon. Terrain obstruction, usable solar power and a communications link are not established.", "", "Coordinates are explicitly adopted as Horizons lunar mean-Earth coordinates. No transformation from the Moon Trek map frame is claimed. Heights refer to the 1,737,400 m reference sphere, not a measured terrain elevation."];
  for (const { name, analysis } of analyses) {
    const { observer, startUtc, endUtc, stepMinutes } = analysis.input;
    lines.push("", `## ${name.replace(/[\r\n]/g, " ")}`, "", `Location: ${observer.latitude}°, ${observer.longitude}° east`, `Reference-sphere height: ${observer.heightMeters} m`, `UTC window: ${startUtc} — ${endUtc}`, `Sample step: ${stepMinutes} minutes`, "");
    for (const [label, target] of [["Sun", analysis.sun], ["Earth", analysis.earth]] as const) {
      if (target.status === "error") { lines.push(`### ${label}`, "", `Unavailable: ${target.message}`, ""); continue; }
      lines.push(`### ${label}`, "", `Estimated geometric visibility: ${target.visibleHours === null ? "Unknown (missing samples)" : `${target.visibleHours.toFixed(2)} hours`}`, `Missing samples: ${target.missingSamples}`, `Source: ${target.provenance.source} v${target.provenance.apiVersion}`, `Ephemeris: ${target.provenance.ephemeris}`, `Observer frame: ${target.provenance.centerFrame}`, `Retrieved: ${target.provenance.retrievedUtc}`, `Query: ${target.provenance.queryUrl}`, "", "Events below are linearly interpolated between samples; additional crossings between samples may be missed.", "", "| Event | UTC estimate |", "|---|---|");
      for (const event of target.events) lines.push(`| ${event.kind} | ${event.timestamp} |`);
      if (target.events.length === 0) lines.push(`| — | ${target.missingSamples > 0 ? "No crossing established; elevations are missing" : "No crossing found in this sampled window"} |`);
      lines.push("", "Open boundaries mark observation limits or adjacent missing samples; a rise/set time was not established.", "");
      if (target.missingSamples > 0) lines.push("Visibility duration is unknown. Listed windows include only supported portions of the interval.", "");
      lines.push("| Start (UTC) | End (UTC) | Start boundary | End boundary |", "|---|---|---|---|");
      for (const window of target.windows) lines.push(`| ${window.startUtc} | ${window.endUtc} | ${window.openStart ? "Open" : "Rise"} | ${window.openEnd ? "Open" : "Set"} |`);
      if (target.windows.length === 0) lines.push(`| — | — | ${target.missingSamples > 0 ? "Unknown; missing elevations" : "No above-horizon interval found"} | — |`);
      lines.push("", "| UTC | Azimuth (° clockwise from north) | Elevation (°) |", "|---|---:|---:|");
      for (const sample of target.samples) lines.push(`| ${sample.timestamp} | ${sample.azimuthDeg ?? "Undefined/unavailable"} | ${sample.elevationDeg ?? "Unavailable"} |`);
    }
  }
  if (failures.length > 0) {
    const cell = (text: string) => text.replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|");
    lines.push("", "## Unavailable sites", "", "| Site | Reason |", "|---|---|");
    for (const failure of failures) lines.push(`| ${cell(failure.name)} | ${cell(failure.message)} |`);
  }
  lines.push("", "## Limitations", "", "Fixed hillshade is not mission-time illumination. Geometric visibility uses target centers and omits angular radius, terrain, horizon dip and operational requirements. Sampling controls event precision. Horizons uses the last known leap-second correction for future UTC; its returned ephemeris and frame metadata are preserved.", "", "Moon Trek source research: Rameen. Application integration and this report: Sultan.", "");
  return lines.join("\n");
}
