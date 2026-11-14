/** Derive sampled target-center visibility without inferring terrain or operational results. @author Sultan */
import type { HorizonEvent, HorizonsProvenance, MissionAnalysis, PositionSample, TargetAnalysis, VisibilityWindow } from "@/types/mission-analysis";
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

function isSample(value: unknown): value is PositionSample {
  return isRecord(value) && typeof value.timestamp === "string" && Number.isFinite(Date.parse(value.timestamp)) &&
    (value.azimuthDeg === null || typeof value.azimuthDeg === "number" && Number.isFinite(value.azimuthDeg) && value.azimuthDeg >= 0 && value.azimuthDeg < 360) &&
    (value.elevationDeg === null || typeof value.elevationDeg === "number" && Number.isFinite(value.elevationDeg) && Math.abs(value.elevationDeg) <= 90);
}

function isTarget(value: unknown): value is TargetAnalysis {
  if (!isRecord(value)) return false;
  if (value.status === "error") return typeof value.message === "string" && value.message.length <= 250;
  if (value.status !== "ready" || !Array.isArray(value.samples) || value.samples.length < 2 || value.samples.length > 1500 || !value.samples.every(isSample) ||
    !Array.isArray(value.events) || !Array.isArray(value.windows) || !isRecord(value.provenance)) return false;
  const { provenance } = value;
  return typeof value.missingSamples === "number" && Number.isInteger(value.missingSamples) && value.missingSamples >= 0 &&
    (value.visibleHours === null || typeof value.visibleHours === "number" && Number.isFinite(value.visibleHours) && value.visibleHours >= 0) &&
    value.events.every(event => isRecord(event) && typeof event.timestamp === "string" && Number.isFinite(Date.parse(event.timestamp)) && (event.kind === "rise" || event.kind === "set")) &&
    value.windows.every(window => isRecord(window) && typeof window.startUtc === "string" && typeof window.endUtc === "string" && Number.isFinite(Date.parse(window.startUtc)) && Number.isFinite(Date.parse(window.endUtc)) && typeof window.openStart === "boolean" && typeof window.openEnd === "boolean") &&
    [provenance.source, provenance.apiVersion, provenance.ephemeris, provenance.centerFrame, provenance.queryUrl, provenance.retrievedUtc].every(field => typeof field === "string") &&
    typeof provenance.radiusKm === "number" && Number.isFinite(provenance.radiusKm) && provenance.timeScale === "UTC";
}

export function isMissionAnalysis(value: unknown): value is MissionAnalysis {
  return isRecord(value) && validateMissionInput(value.input).success && typeof value.generatedUtc === "string" && Number.isFinite(Date.parse(value.generatedUtc)) &&
    value.terrainVisibility === "unavailable" && value.method === "airless_target_center_tangent_horizon" && isTarget(value.sun) && isTarget(value.earth);
}

export function missionReport(analyses: { name: string; analysis: MissionAnalysis }[]): string {
  const lines = ["# MOONLINE mission geometry report", "", `Generated: ${new Date().toISOString()}`, "", "Airless target-center geometry above the ideal local tangent horizon. Terrain obstruction, usable solar power and a communications link are not established.", "", "Coordinates are explicitly adopted as Horizons lunar mean-Earth coordinates. No transformation from the Moon Trek map frame is claimed. Heights refer to the 1,737,400 m reference sphere, not a measured terrain elevation."];
  for (const { name, analysis } of analyses) {
    const { observer, startUtc, endUtc, stepMinutes } = analysis.input;
    lines.push("", `## ${name.replace(/[\r\n]/g, " ")}`, "", `Location: ${observer.latitude}°, ${observer.longitude}° east`, `Reference-sphere height: ${observer.heightMeters} m`, `UTC window: ${startUtc} — ${endUtc}`, `Sample step: ${stepMinutes} minutes`, "");
    for (const [label, target] of [["Sun", analysis.sun], ["Earth", analysis.earth]] as const) {
      if (target.status === "error") { lines.push(`### ${label}`, "", `Unavailable: ${target.message}`, ""); continue; }
      lines.push(`### ${label}`, "", `Estimated geometric visibility: ${target.visibleHours === null ? "Unknown (missing samples)" : `${target.visibleHours.toFixed(2)} hours`}`, `Missing samples: ${target.missingSamples}`, `Source: ${target.provenance.source} v${target.provenance.apiVersion}`, `Ephemeris: ${target.provenance.ephemeris}`, `Observer frame: ${target.provenance.centerFrame}`, `Retrieved: ${target.provenance.retrievedUtc}`, `Query: ${target.provenance.queryUrl}`, "", "Events below are linearly interpolated between samples; additional crossings between samples may be missed.", "", "| Event | UTC estimate |", "|---|---|");
      for (const event of target.events) lines.push(`| ${event.kind} | ${event.timestamp} |`);
      if (target.events.length === 0) lines.push("| — | No crossing found in this sampled window | ");
      lines.push("", "| UTC | Azimuth (° clockwise from north) | Elevation (°) |", "|---|---:|---:|");
      for (const sample of target.samples) lines.push(`| ${sample.timestamp} | ${sample.azimuthDeg ?? "Undefined/unavailable"} | ${sample.elevationDeg ?? "Unavailable"} |`);
    }
  }
  lines.push("", "## Limitations", "", "Fixed hillshade is not mission-time illumination. Geometric visibility uses target centers and omits angular radius, terrain, horizon dip and operational requirements. Sampling controls event precision. Horizons uses the last known leap-second correction for future UTC; its returned ephemeris and frame metadata are preserved.", "", "Moon Trek source research: Rameen. Application integration and this report: Sultan.", "");
  return lines.join("\n");
}
