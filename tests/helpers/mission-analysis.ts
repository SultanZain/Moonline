/**
 * Supply synthetic API transport fixtures for browser interaction tests only.
 * These values do not represent NASA observations and never enter the application bundle.
 * @author Sultan
 */
import type { Page, Route } from "@playwright/test";
import { horizonsQuery } from "../../src/lib/api/lunar-horizons";
import { validateMissionInput } from "../../src/lib/validation/mission-analysis";
import type { MissionAnalysis, MissionInput, PositionSample, TargetAnalysis, VisibilityWindow } from "../../src/types/mission-analysis";

type SyntheticOptions = { earthUnavailable?: boolean; missingSunSample?: number };

function syntheticTarget(input: MissionInput, target: "sun" | "earth", missingIndex?: number): TargetAnalysis {
  const count = (Date.parse(input.endUtc) - Date.parse(input.startUtc)) / (input.stepMinutes * 60_000) + 1;
  const timestamp = (index: number) => new Date(Date.parse(input.startUtc) + index * input.stepMinutes * 60_000).toISOString();
  const samples: PositionSample[] = Array.from({ length: count }, (_, index) => ({
    timestamp: timestamp(index),
    azimuthDeg: Math.abs(input.observer.latitude) === 90 ? null : (target === "sun" ? 120 : 240) + index % 20,
    elevationDeg: index === missingIndex ? null : (target === "sun" ? 1 : -1) * (5 + index % 3 + Math.abs(input.observer.longitude) / 1000),
  }));
  const windows: VisibilityWindow[] = [];
  if (target === "sun") {
    if (missingIndex === undefined) windows.push({ startUtc: input.startUtc, endUtc: input.endUtc, openStart: true, openEnd: true });
    else {
      if (missingIndex > 0) windows.push({ startUtc: input.startUtc, endUtc: timestamp(missingIndex - 1), openStart: true, openEnd: true });
      if (missingIndex < count - 1) windows.push({ startUtc: timestamp(missingIndex + 1), endUtc: input.endUtc, openStart: true, openEnd: true });
    }
  }
  return {
    status: "ready", samples, events: [], windows,
    visibleHours: missingIndex === undefined ? target === "sun" ? (Date.parse(input.endUtc) - Date.parse(input.startUtc)) / 3_600_000 : 0 : null,
    missingSamples: missingIndex === undefined ? 0 : 1,
    provenance: {
      source: "NASA/JPL Horizons API", apiVersion: "1.2", ephemeris: "DE441",
      centerFrame: "MEAN_ME (high precision)", radiusKm: 1737.4, timeScale: "UTC",
      queryUrl: horizonsQuery(input, target).toString(), retrievedUtc: "2026-11-14T12:00:00.000Z",
    },
  };
}

export function syntheticMissionAnalysis(input: MissionInput, options: SyntheticOptions = {}): MissionAnalysis {
  return {
    input, generatedUtc: "2026-11-14T12:00:00.000Z",
    sun: syntheticTarget(input, "sun", options.missingSunSample),
    earth: options.earthUnavailable ? { status: "error", message: "Synthetic Earth transport unavailable." } : syntheticTarget(input, "earth"),
    terrainVisibility: "unavailable", method: "airless_target_center_tangent_horizon",
  };
}

export async function fulfillSyntheticMission(route: Route, input: MissionInput, options: SyntheticOptions = {}) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ready", analysis: syntheticMissionAnalysis(input, options) }) });
}

export async function mockMissionAnalysis(page: Page, handler: (route: Route, input: MissionInput, index: number) => Promise<void> = (route, input) => fulfillSyntheticMission(route, input)) {
  const requests: MissionInput[] = [];
  await page.route("**/api/analysis", async route => {
    const raw: unknown = route.request().postDataJSON();
    const result = validateMissionInput(raw);
    if (!result.success) throw new Error("Browser issued an invalid mission request.");
    requests.push(result.input);
    await handler(route, result.input, requests.length - 1);
  });
  return requests;
}
