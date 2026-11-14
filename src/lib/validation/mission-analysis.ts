/** Validate explicit observer assumptions and bounded UTC sampling requests. @author Sultan */
import type { MissionInputResult, MissionIssue } from "@/types/mission-analysis";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function utcMinute(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value && date.getUTCFullYear() >= 1972 && date.getUTCFullYear() <= 2099;
}

export function validateMissionInput(value: unknown): MissionInputResult {
  if (!isRecord(value) || !isRecord(value.observer)) return { success: false, issues: [{ field: "observer", message: "Provide an observer." }] };
  const { latitude, longitude, heightMeters, coordinateBasis } = value.observer;
  const { startUtc, endUtc, stepMinutes } = value;
  const issues: MissionIssue[] = [];
  if (!finite(latitude) || latitude < -90 || latitude > 90) issues.push({ field: "latitude", message: "Latitude must be −90…90°." });
  if (!finite(longitude) || longitude < -180 || longitude > 180) issues.push({ field: "longitude", message: "Longitude must be −180…180° east." });
  // Application bounds prevent accidental unit errors; they are not NASA terrain limits.
  if (!finite(heightMeters) || heightMeters < -20_000 || heightMeters > 20_000) issues.push({ field: "heightMeters", message: "Enter a height within ±20,000 m of the reference sphere." });
  if (coordinateBasis !== "adopted_mean_earth") issues.push({ field: "coordinateBasis", message: "Confirm the mean-Earth coordinate assumption." });
  if (!utcMinute(startUtc)) issues.push({ field: "startUtc", message: "Enter a UTC start time within 1972–2099." });
  if (!utcMinute(endUtc)) issues.push({ field: "endUtc", message: "Enter a UTC end time within 1972–2099." });
  if (!finite(stepMinutes) || ![10, 30, 60, 180, 360].includes(stepMinutes)) issues.push({ field: "stepMinutes", message: "Choose a supported sample step." });
  if (issues.length > 0 || !finite(latitude) || !finite(longitude) || !finite(heightMeters) || coordinateBasis !== "adopted_mean_earth" || !utcMinute(startUtc) || !utcMinute(endUtc) || !finite(stepMinutes)) return { success: false, issues };
  const span = Date.parse(endUtc) - Date.parse(startUtc);
  if (span <= 0 || span > 31 * 86_400_000) issues.push({ field: "endUtc", message: "Choose a window up to 31 days after the start." });
  else if (span % (stepMinutes * 60_000) !== 0) issues.push({ field: "endUtc", message: "Align the end time with the sample step." });
  else if (span / (stepMinutes * 60_000) + 1 > 1500) issues.push({ field: "stepMinutes", message: "Use a larger sample step." });
  if (issues.length > 0) return { success: false, issues };
  return { success: true, input: { observer: { latitude, longitude: longitude === 180 ? -180 : longitude, heightMeters, coordinateBasis }, startUtc, endUtc, stepMinutes } };
}
