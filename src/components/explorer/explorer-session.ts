/**
 * Transfer map locations, an entered UTC time and view settings without scientific results.
 * Validate shared links and candidate files before changing the exploration workspace.
 * @author Sultan
 */
import {
  moonTrekBasemaps, moonTrekLayers, moonTrekOverlayIds,
  type MoonTrekBasemap, type MoonTrekMode, type MoonTrekOverlayId,
} from "@/config/moon-trek";
import { isMapLocation, normalizeMapLongitude, type MapLocation } from "./lunar-map-coordinates";

export type ExplorerView = {
  mode: MoonTrekMode;
  basemap: MoonTrekBasemap;
  // Native map units: degrees in the global view, projected metres in the polar view.
  center: [number, number];
  zoom: number;
  overlays: { id: MoonTrekOverlayId; opacity: number }[];
};
export type ExplorerSession = {
  version: 1;
  selected: MapLocation | null;
  sites: MapLocation[];
  missionTimeUtc: string | null;
  view: ExplorerView;
};
export type CandidateImport = Omit<ExplorerSession, "version" | "view"> & { view: ExplorerView | null };
export type SessionRead =
  | { status: "empty" }
  | { status: "ready"; session: ExplorerSession }
  | { status: "invalid" };

export const candidateFileLimitBytes = 16_384;
const sessionParameter = "session";
const sessionCharacterLimit = 8_192;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readLocation(value: unknown): MapLocation | null {
  if (!isMapLocation(value)) return null;
  if (value.name !== undefined && (value.name.length > 120 || /[\u0000-\u001f]/.test(value.name))) return null;
  if (value.featureType !== undefined && (value.featureType.length > 80 || /[\u0000-\u001f]/.test(value.featureType))) return null;
  return {
    latitude: value.latitude,
    longitude: Math.abs(value.latitude) === 90 ? 0 : normalizeMapLongitude(value.longitude),
    ...(value.name?.trim() ? { name: value.name.trim() } : {}),
    ...(value.featureType?.trim() ? { featureType: value.featureType.trim() } : {}),
  };
}

function readSites(value: unknown): MapLocation[] | null {
  if (!Array.isArray(value) || value.length > 3) return null;
  const sites: MapLocation[] = [];
  for (const item of value) {
    const site = readLocation(item);
    if (!site || sites.some(existing => existing.latitude === site.latitude && existing.longitude === site.longitude)) return null;
    sites.push(site);
  }
  return sites;
}

/** Validate the minute-precision UTC input used by the UI, including calendar rollover. */
export function missionTimeToUtc(input: string): string | null {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) return null;
  const utc = `${input}:00.000Z`;
  const date = new Date(utc);
  return Number.isFinite(date.getTime()) && date.toISOString() === utc ? utc : null;
}

function isMissionTimeUtc(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  const canonical = missionTimeToUtc(value.slice(0, 16));
  return canonical !== null && (value === canonical || value === canonical.replace(".000Z", "Z"));
}

function readView(value: unknown): ExplorerView | null {
  if (!isRecord(value) || (value.mode !== "global" && value.mode !== "south") ||
    (value.basemap !== "imagery" && value.basemap !== "relief") || !Array.isArray(value.center) || value.center.length !== 2 ||
    !value.center.every(item => typeof item === "number" && Number.isFinite(item)) || !Array.isArray(value.overlays)) return null;
  const [x, y]: unknown[] = value.center;
  if (typeof x !== "number" || typeof y !== "number") return null;
  // Bound imported camera coordinates; this is an application limit, not a coverage mask.
  if (value.mode === "global" ? Math.abs(x) > 180 || Math.abs(y) > 90 : Math.abs(x) > 1_000_000_000 || Math.abs(y) > 1_000_000_000) return null;
  const overlays: ExplorerView["overlays"] = [];
  if (value.overlays.length > moonTrekOverlayIds.length) return null;
  for (const item of value.overlays) {
    if (!isRecord(item)) return null;
    const id = moonTrekOverlayIds.find(candidate => candidate === item.id);
    if (!id || overlays.some(overlay => overlay.id === id) || typeof item.opacity !== "number" ||
      !Number.isFinite(item.opacity) || item.opacity < 0 || item.opacity > 1) return null;
    overlays.push({ id, opacity: item.opacity });
  }
  const maxZoom = Math.max(moonTrekLayers[moonTrekBasemaps[value.mode][value.basemap]].maxZoom,
    ...(value.mode === "south" ? overlays.map(overlay => moonTrekLayers[overlay.id].maxZoom) : []));
  if (typeof value.zoom !== "number" || !Number.isInteger(value.zoom) || value.zoom < 0 || value.zoom > maxZoom) return null;
  return { mode: value.mode, basemap: value.basemap, center: [x, y], zoom: value.zoom, overlays };
}

function readSession(value: unknown): ExplorerSession | null {
  if (!isRecord(value) || value.version !== 1 || !isMissionTimeUtc(value.missionTimeUtc)) return null;
  const selected = value.selected === null ? null : readLocation(value.selected);
  if (value.selected !== null && !selected) return null;
  const sites = readSites(value.sites);
  const view = readView(value.view);
  return sites && view ? { version: 1, selected, sites, missionTimeUtc: value.missionTimeUtc, view } : null;
}

export function emptyExplorerSession(): ExplorerSession {
  return { version: 1, selected: null, sites: [], missionTimeUtc: null,
    view: { mode: "global", basemap: "imagery", center: [0, 0], zoom: 2, overlays: [] } };
}

export function readExplorerSession(search: string): SessionRead {
  const values = new URLSearchParams(search).getAll(sessionParameter);
  if (values.length === 0) return { status: "empty" };
  const encoded = values[0];
  if (values.length !== 1 || !encoded || encoded.length > sessionCharacterLimit) return { status: "invalid" };
  try {
    const value: unknown = JSON.parse(encoded);
    const session = readSession(value);
    return session ? { status: "ready", session } : { status: "invalid" };
  } catch { return { status: "invalid" }; }
}

export function explorerSessionLink(session: ExplorerSession, href: string): string {
  const url = new URL(href);
  if (JSON.stringify(session) === JSON.stringify(emptyExplorerSession())) url.searchParams.delete(sessionParameter);
  else url.searchParams.set(sessionParameter, JSON.stringify(session));
  return url.toString();
}

/** Retain only validated exploration inputs in this browser tab. */
export function saveLastExplorerSession(session: ExplorerSession): void {
  try {
    const search = new URL(explorerSessionLink(session, "https://moonline.invalid/explorer")).search;
    if (readExplorerSession(search).status === "invalid") return;
    if (window.sessionStorage.getItem("moonline-exploration") !== search) window.sessionStorage.setItem("moonline-exploration", search);
  } catch { /* URL persistence continues when browser storage is unavailable. */ }
}

export function readLastExplorerSession(): SessionRead {
  try { return readExplorerSession(window.sessionStorage.getItem("moonline-exploration") ?? ""); }
  catch { return { status: "empty" }; }
}

export function candidateFileContents(session: ExplorerSession): string {
  return JSON.stringify({
    kind: "moonline-candidate-locations", version: 1, coordinateSystem: "Moon 2000 spherical map",
    latitudeUnit: "degrees", longitudeUnit: "degrees", longitudeDirection: "east",
    selected: session.selected, sites: session.sites, missionTimeUtc: session.missionTimeUtc,
    view: session.view, analysis: { status: "not_calculated" },
  }, null, 2);
}

export function readCandidateFile(contents: string): CandidateImport | null {
  try {
    const value: unknown = JSON.parse(contents);
    if (!isRecord(value) || value.kind !== "moonline-candidate-locations" || (value.version !== undefined && value.version !== 1) ||
      value.coordinateSystem !== "Moon 2000 spherical map" || value.latitudeUnit !== "degrees" || value.longitudeUnit !== "degrees" ||
      value.longitudeDirection !== "east" || !isMissionTimeUtc(value.missionTimeUtc) || !isRecord(value.analysis) ||
      value.analysis.status !== "not_calculated") return null;
    const sites = readSites(value.sites);
    if (!sites || sites.length === 0) return null;
    const selected = value.selected === undefined ? sites[0] ?? null : value.selected === null ? null : readLocation(value.selected);
    if (value.selected !== null && !selected) return null;
    const view = value.view === undefined ? null : readView(value.view);
    if (value.view !== undefined && !view) return null;
    return { selected, sites, missionTimeUtc: value.missionTimeUtc, view };
  } catch { return null; }
}
