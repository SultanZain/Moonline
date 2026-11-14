/** Retrieve and verify airless observer tables from the fixed JPL Horizons endpoint. @author Sultan */
import type { HorizonsProvenance, MissionAnalysis, MissionInput, PositionSample, TargetAnalysis } from "@/types/mission-analysis";
import { deriveTargetAnalysis } from "@/lib/science/mission-analysis";
import { isRecord } from "@/lib/validation/mission-analysis";

const endpoint = "https://ssd.jpl.nasa.gov/api/horizons.api";
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export class HorizonsFailure extends Error {
  constructor(public readonly code: "busy" | "timeout" | "upstream" | "invalid_response", message: string) { super(message); }
}

export function horizonsQuery(input: MissionInput, target: "sun" | "earth"): URL {
  const url = new URL(endpoint);
  const { observer } = input;
  const parameters = { format: "json", COMMAND: `'${target === "sun" ? "10" : "399"}'`, MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'", CENTER: "'coord@301'", COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${observer.longitude},${observer.latitude},${observer.heightMeters / 1000}'`,
    START_TIME: `'${input.startUtc.slice(0, 16).replace("T", " ")}'`, STOP_TIME: `'${input.endUtc.slice(0, 16).replace("T", " ")}'`, STEP_SIZE: `'${input.stepMinutes} m'`,
    QUANTITIES: "'4'", CSV_FORMAT: "'YES'", ANG_FORMAT: "'DEG'", TIME_DIGITS: "'MINUTES'", TIME_TYPE: "'UT'", CAL_TYPE: "'GREGORIAN'", APPARENT: "'AIRLESS'", EXTRA_PREC: "'YES'", OBJ_DATA: "'YES'", ELEV_CUT: "'-90'", SKIP_DAYLT: "'NO'" };
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url;
}

function invalid(): never { throw new HorizonsFailure("invalid_response", "Horizons returned an unsupported observer table."); }
function number(value: string | undefined): number | null {
  if (value === undefined) return invalid();
  if (value.trim() === "n.a.") return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return invalid();
  const parsed = Number(value); return Number.isFinite(parsed) ? parsed : invalid();
}

export function parseHorizonsTable(payload: unknown, input: MissionInput, target: "sun" | "earth", queryUrl: string, retrievedUtc: string): TargetAnalysis {
  if (!isRecord(payload) || payload.error !== undefined || typeof payload.result !== "string" || !isRecord(payload.signature) || payload.signature.source !== "NASA/JPL Horizons API" || typeof payload.signature.version !== "string") return invalid();
  const text = payload.result;
  const first = text.indexOf("$$SOE"), last = text.indexOf("$$EOE");
  if (first < 0 || last <= first || text.indexOf("$$SOE", first + 5) !== -1) return invalid();
  const header = text.slice(0, first);
  const center = /^Center body name:\s*Moon \(301\)\s*\{source:\s*([^}]+)\}/m.exec(header);
  const name = target === "sun" ? "Sun \\(10\\)" : "Earth \\(399\\)";
  const targetMatch = new RegExp(`^Target body name:\\s*${name}\\s*\\{source:\\s*([^}]+)\\}`, "m").exec(header);
  const geodetic = /^Center geodetic\s*:\s*([^,]+),\s*([^,]+),\s*([^\s{]+)\s*\{E-lon\(deg\),Lat\(deg\),Alt\(km\)\}/m.exec(header);
  const radii = /^Center radii\s*:\s*([^,]+),\s*([^,]+),\s*([^\s]+)\s*km/m.exec(header);
  if (!center?.[1] || !targetMatch?.[1] || center[1] !== targetMatch[1] || !geodetic || !radii || !/^Center pole\/equ\s*:\s*MEAN_ME \(high precision\)\s*\{East-longitude positive\}/m.test(header) || !/^Atmos refraction:\s*NO \(AIRLESS\)/m.test(header)) return invalid();
  const longitude = number(geodetic[1]), latitude = number(geodetic[2]), heightKm = number(geodetic[3]);
  const requested = input.observer;
  if (longitude === null || latitude === null || heightKm === null || Math.abs(latitude - requested.latitude) > 0.000001 || Math.abs(heightKm - requested.heightMeters / 1000) > 0.000001 || Math.abs((((longitude - requested.longitude) % 360) + 540) % 360 - 180) > 0.000001) return invalid();
  if ([radii[1], radii[2], radii[3]].some(value => number(value) !== 1737.4)) return invalid();
  const columns = header.split(/\r?\n/).find(line => line.includes("Date__(UT)__HR:MN"))?.split(",").map(value => value.trim());
  if (!columns) return invalid();
  const azimuthColumn = columns.indexOf("Azimuth_(a-app)"), elevationColumn = columns.indexOf("Elevation_(a-app)");
  if (azimuthColumn < 0 || elevationColumn < 0) return invalid();
  const samples: PositionSample[] = [];
  for (const line of text.slice(first + 5, last).trim().split(/\r?\n/)) {
    const cells = line.split(",").map(value => value.trim());
    const date = /^(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(cells[0] ?? "");
    if (!date) return invalid();
    const month = months.indexOf(date[2] ?? "");
    if (month < 0) return invalid();
    const timestamp = `${date[1]}-${String(month + 1).padStart(2, "0")}-${date[3]}T${date[4]}:${date[5]}:00.000Z`;
    const expected = Date.parse(input.startUtc) + samples.length * input.stepMinutes * 60_000;
    if (Date.parse(timestamp) !== expected || new Date(timestamp).toISOString() !== timestamp) return invalid();
    const rawAzimuth = number(cells[azimuthColumn]), elevationDeg = number(cells[elevationColumn]);
    if (rawAzimuth !== null && (rawAzimuth < 0 || rawAzimuth > 360) || elevationDeg !== null && Math.abs(elevationDeg) > 90) return invalid();
    const azimuthDeg = Math.abs(requested.latitude) === 90 ? null : rawAzimuth === 360 ? 0 : rawAzimuth;
    samples.push({ timestamp, azimuthDeg, elevationDeg });
  }
  if (samples.length !== (Date.parse(input.endUtc) - Date.parse(input.startUtc)) / (input.stepMinutes * 60_000) + 1) return invalid();
  const provenance: HorizonsProvenance = { source: payload.signature.source, apiVersion: payload.signature.version, ephemeris: center[1].trim(), centerFrame: "MEAN_ME (high precision)", radiusKm: 1737.4, timeScale: "UTC", queryUrl, retrievedUtc };
  return deriveTargetAnalysis(samples, provenance);
}

let active = false;
export async function analyzeMission(input: MissionInput, signal?: AbortSignal): Promise<MissionAnalysis> {
  if (active) throw new HorizonsFailure("busy", "Horizons is busy. Retry shortly.");
  active = true;
  try {
    const results: TargetAnalysis[] = [];
    // Keep our provider requests sequential, including candidate comparisons.
    for (const target of ["sun", "earth"] as const) {
      const url = horizonsQuery(input, target);
      try {
        const timeout = AbortSignal.timeout(18_000);
        const response = await fetch(url, { cache: "no-store", signal: signal ? AbortSignal.any([timeout, signal]) : timeout, headers: { Accept: "application/json" } });
        if (!response.ok) throw new HorizonsFailure("upstream", "Horizons is unavailable. Retry shortly.");
        const body = await response.text();
        if (body.length > 2_000_000) return invalid();
        const payload: unknown = JSON.parse(body);
        results.push(parseHorizonsTable(payload, input, target, url.toString(), new Date().toISOString()));
      } catch (error) {
        if (signal?.aborted) throw error;
        const message = error instanceof HorizonsFailure ? error.message : error instanceof Error && error.name === "TimeoutError" ? "Horizons timed out. Retry shortly." : "Horizons could not supply this target.";
        results.push({ status: "error", message });
      }
    }
    const [sun, earth] = results;
    if (!sun || !earth) return invalid();
    if (sun.status === "error" && earth.status === "error") throw new HorizonsFailure("upstream", "Horizons could not supply Sun or Earth data. Retry shortly.");
    return { input, generatedUtc: new Date().toISOString(), sun, earth, terrainVisibility: "unavailable", method: "airless_target_center_tangent_horizon" };
  } finally { active = false; }
}
