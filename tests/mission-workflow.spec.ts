/** Verify the complete planning flow, failures and stale-state boundaries with synthetic transport only. @author Sultan */
import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mockMoonTrekTiles } from "./helpers/moon-trek";
import { fulfillSyntheticMission, mockMissionAnalysis, syntheticMissionAnalysis } from "./helpers/mission-analysis";

const utc = "2026-11-14T00:00:00.000Z";
const sites = [
  { latitude: -85, longitude: 20, name: "Test candidate A" },
  { latitude: -86, longitude: 30, name: "Test candidate B" },
];
const inspector = (page: Page) => page.getByRole("complementary", { name: "Site inspector", exact: true }).or(page.getByRole("dialog", { name: "Site inspector", exact: true }));
const analysis = (page: Page) => inspector(page).getByRole("region", { name: "Mission analysis", exact: true });
const timeline = (page: Page) => page.getByRole("region", { name: "Mission timeline", exact: true });

async function selectSite(page: Page) {
  await page.goto("/explorer");
  await expect(page.locator(".ol-viewport")).toHaveCount(1);
  await page.getByRole("button", { name: "Go to coordinates", exact: true }).click();
  await page.locator("#map-latitude").fill("-85"); await page.locator("#map-longitude").fill("20");
  await page.getByRole("button", { name: "Go to location", exact: true }).click();
}

async function importSites(page: Page, incoming = sites) {
  await expect(page.locator(".ol-viewport")).toHaveCount(1);
  if (!await inspector(page).isVisible()) await page.getByRole("button", { name: "Open site inspector", exact: true }).click();
  await inspector(page).getByLabel("Candidate file", { exact: true }).setInputFiles({
    name: "synthetic-candidate-inputs.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({
      kind: "moonline-candidate-locations", coordinateSystem: "Moon 2000 spherical map",
      latitudeUnit: "degrees", longitudeUnit: "degrees", longitudeDirection: "east", missionTimeUtc: utc,
      sites: incoming, analysis: { status: "not_calculated" },
    })),
  });
  await inspector(page).getByRole("button", { name: "Import", exact: true }).click();
  await expect(inspector(page).getByRole("region", { name: "Candidate locations", exact: true }).getByRole("listitem")).toHaveCount(incoming.length);
}

async function configure(page: Page) {
  await inspector(page).locator("#mission-time").fill(utc.slice(0, 16));
  await analysis(page).getByLabel("Window", { exact: true }).selectOption("1");
  await analysis(page).getByRole("button", { name: "Use 0 m", exact: true }).click();
  await analysis(page).getByRole("checkbox", { name: /Adopt mean-Earth coordinates/ }).check();
}

async function openTimeline(page: Page) {
  await analysis(page).getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(timeline(page).getByRole("slider", { name: "Analysis time", exact: true })).toBeVisible();
}

async function report(page: Page, button: Locator) {
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  expect(download.suggestedFilename()).toMatch(/^moonline-mission-.*\.md$/);
  const path = await download.path(); if (!path) throw new Error("Missing report download.");
  return readFileSync(path, "utf8");
}

test.use({ reducedMotion: "reduce", timezoneId: "Asia/Karachi" });
test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); await mockMoonTrekTiles(page); });

test("explicit observer choices unlock analysis and timeline navigation remains UTC", async ({ page }) => {
  const requests = await mockMissionAnalysis(page);
  await selectSite(page); await inspector(page).locator("#mission-time").fill(utc.slice(0, 16));
  const analyze = analysis(page).getByRole("button", { name: "Analyze", exact: true });
  await expect(analyze).toBeDisabled();
  await analysis(page).getByRole("button", { name: "Use 0 m", exact: true }).click(); await expect(analyze).toBeDisabled();
  await analysis(page).getByRole("checkbox", { name: /Adopt mean-Earth coordinates/ }).check();
  await analysis(page).getByLabel("Window", { exact: true }).selectOption("1"); await analyze.click();
  await expect(analysis(page).getByRole("region", { name: "Analysis results", exact: true })).toBeVisible();
  expect(requests).toHaveLength(1); expect(requests[0]?.observer).toEqual({ latitude: -85, longitude: 20, heightMeters: 0, coordinateBasis: "adopted_mean_earth" });
  expect(requests[0]?.startUtc).toBe(utc);
  await openTimeline(page);
  await expect(timeline(page).getByLabel("Selected analysis time", { exact: true })).toHaveText("2026-11-14 00:00 UTC");
  await expect(timeline(page).getByRole("listitem")).toContainText("5.02°");
  await timeline(page).getByRole("button", { name: "Next sample", exact: true }).click();
  await expect(timeline(page).getByLabel("Selected analysis time", { exact: true })).toHaveText("2026-11-14 01:00 UTC");
  await timeline(page).getByRole("slider", { name: "Analysis time", exact: true }).press("ArrowRight");
  await expect(timeline(page).getByLabel("Selected analysis time", { exact: true })).toHaveText("2026-11-14 02:00 UTC");
  await timeline(page).getByRole("button", { name: "Earth", exact: true }).click();
  await expect(timeline(page).getByRole("listitem")).toContainText("-7.02°");
  await expect(timeline(page).getByRole("listitem")).toContainText("0.0 h above horizon");
  await timeline(page).getByRole("button", { name: "Sun", exact: true }).click();
  await timeline(page).getByText("Visibility windows", { exact: true }).click();
  await expect(timeline(page)).toContainText("2026-11-15");
});

test("candidate comparison uses identical settings and exports every compared site", async ({ page }) => {
  const requests = await mockMissionAnalysis(page);
  await page.goto("/explorer"); await importSites(page); await configure(page);
  await analysis(page).getByRole("button", { name: "Compare 2", exact: true }).click();
  await expect(analysis(page).getByRole("region", { name: "Analysis results", exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  const settings = requests.map(({ observer, ...input }) => ({ ...input, heightMeters: observer.heightMeters, coordinateBasis: observer.coordinateBasis }));
  expect(settings[0]).toEqual(settings[1]); expect(requests.map(input => input.observer.longitude)).toEqual([20, 30]);
  await openTimeline(page); await expect(timeline(page).getByRole("listitem")).toHaveCount(2);
  await expect(timeline(page)).toContainText("Test candidate A"); await expect(timeline(page)).toContainText("Test candidate B");
  const text = await report(page, timeline(page).getByRole("button", { name: "Download mission report", exact: true }));
  expect(text).toContain("Test candidate A"); expect(text).toContain("Test candidate B"); expect(text).toContain("DE441");
  expect(text).toContain("No transformation"); expect(text).toContain("Terrain obstruction"); expect(text).toContain(utc);
});

test("a failed candidate stays explicit in the comparison and downloaded report", async ({ page }) => {
  await mockMissionAnalysis(page, async (route, input) => {
    if (input.observer.longitude === 30) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ status: "error", message: "Synthetic candidate transport failure." }) });
    else await fulfillSyntheticMission(route, input);
  });
  await page.goto("/explorer"); await importSites(page); await configure(page);
  await analysis(page).getByRole("button", { name: "Compare 2", exact: true }).click();
  await expect(analysis(page).getByRole("region", { name: "Analysis results", exact: true })).toBeVisible(); await openTimeline(page);
  await expect(timeline(page).getByRole("listitem")).toHaveCount(2);
  await expect(timeline(page).getByRole("listitem").filter({ hasText: "Test candidate B" })).toContainText("Unavailable");
  const text = await report(page, timeline(page).getByRole("button", { name: "Download mission report", exact: true }));
  expect(text).toContain("Test candidate A"); expect(text).toContain("Test candidate B"); expect(text).toContain("Synthetic candidate transport failure.");
});

test("partial target data preserves usable geometry without inventing Earth values", async ({ page }) => {
  await mockMissionAnalysis(page, (route, input) => fulfillSyntheticMission(route, input, { earthUnavailable: true }));
  await selectSite(page); await configure(page); await analysis(page).getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(analysis(page).getByRole("region", { name: "Sun geometry", exact: true })).toContainText("5.02°");
  await expect(analysis(page).getByRole("region", { name: "Earth geometry", exact: true })).toContainText("Synthetic Earth transport unavailable.");
  await openTimeline(page); await timeline(page).getByRole("button", { name: "Earth", exact: true }).click();
  await expect(timeline(page).getByRole("listitem")).toContainText("Unavailable"); await expect(timeline(page).getByRole("listitem")).toContainText("Hours unknown");
  const text = await report(page, timeline(page).getByRole("button", { name: "Download mission report", exact: true }));
  expect(text).toContain("Synthetic Earth transport unavailable."); expect(text).toContain("DE441");
});

test("missing samples preserve unknown time-to-set, visibility duration and chart gaps", async ({ page }) => {
  await mockMissionAnalysis(page, (route, input) => fulfillSyntheticMission(route, input, { missingSunSample: 6 }));
  await selectSite(page); await configure(page); await analysis(page).getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(analysis(page).getByRole("region", { name: "Sun geometry", exact: true })).toContainText("Unknown");
  await openTimeline(page); const slider = timeline(page).getByRole("slider", { name: "Analysis time", exact: true });
  await slider.press("Home"); for (let index = 0; index < 6; index++) await slider.press("ArrowRight");
  await expect(timeline(page).getByLabel("Selected analysis time", { exact: true })).toHaveText("2026-11-14 06:00 UTC");
  await expect(timeline(page).getByRole("listitem")).toContainText("Unavailable"); await expect(timeline(page).getByRole("listitem")).toContainText("Hours unknown");
  const text = await report(page, timeline(page).getByRole("button", { name: "Download mission report", exact: true }));
  expect(text).toContain("Missing samples: 1"); expect(text).toContain("Unknown (missing samples)");
});

test("a cancelled response cannot populate results and the next request still works", async ({ page }) => {
  let release: () => void = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  const requests = await mockMissionAnalysis(page, async (route, input, index) => {
    if (index === 0) {
      await gate;
      try { await fulfillSyntheticMission(route, input); } catch (error) { if (!route.request().failure()) throw error; }
    } else await fulfillSyntheticMission(route, input);
  });
  await selectSite(page); await configure(page); await analysis(page).getByRole("button", { name: "Analyze", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1); await analysis(page).getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(analysis(page).getByRole("button", { name: "Analyze", exact: true })).toBeEnabled(); release();
  await expect(analysis(page).getByRole("region", { name: "Analysis results", exact: true })).toHaveCount(0);
  await analysis(page).getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(analysis(page).getByRole("region", { name: "Analysis results", exact: true })).toBeVisible(); expect(requests).toHaveLength(2);
});

test("settings and shortlist changes invalidate displayed comparison results", async ({ page }) => {
  const requests = await mockMissionAnalysis(page);
  await page.goto("/explorer"); await importSites(page); await configure(page);
  await analysis(page).getByRole("button", { name: "Compare 2", exact: true }).click();
  await expect(analysis(page).getByRole("region", { name: "Analysis results", exact: true })).toBeVisible();
  await analysis(page).getByLabel("Window", { exact: true }).selectOption("7");
  await expect(timeline(page)).toHaveCount(0); await expect(analysis(page).getByRole("region", { name: "Analysis results", exact: true })).toHaveCount(0);
  await analysis(page).getByRole("button", { name: "Compare 2", exact: true }).click();
  await expect(analysis(page).getByRole("region", { name: "Analysis results", exact: true })).toBeVisible(); expect(requests).toHaveLength(4);
  await inspector(page).getByRole("button", { name: "Remove candidate 2", exact: true }).click();
  await expect(timeline(page)).toHaveCount(0); await expect(analysis(page).getByRole("region", { name: "Analysis results", exact: true })).toHaveCount(0);
  await importSites(page, [{ latitude: -87, longitude: 40, name: "Replacement test candidate" }]);
  await expect(timeline(page)).toHaveCount(0); await expect(analysis(page).getByRole("region", { name: "Analysis results", exact: true })).toHaveCount(0);
});

test("clearing the shortlist during a comparison cancels the old candidate batch", async ({ page }) => {
  let release: () => void = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  const requests = await mockMissionAnalysis(page, async (route, input) => {
    await gate; try { await fulfillSyntheticMission(route, input); } catch (error) { if (!route.request().failure()) throw error; }
  });
  await page.goto("/explorer"); await importSites(page); await configure(page);
  await analysis(page).getByRole("button", { name: "Compare 2", exact: true }).click(); await expect.poll(() => requests.length).toBe(1);
  await inspector(page).getByRole("button", { name: "Clear candidates", exact: true }).click(); release();
  await expect(analysis(page).getByRole("button", { name: "Analyze", exact: true })).toBeEnabled();
  await expect(timeline(page)).toHaveCount(0); await expect(analysis(page).getByRole("region", { name: "Analysis results", exact: true })).toHaveCount(0);
  expect(requests).toHaveLength(1);
});

test("malformed and mismatched response data is rejected without a result", async ({ page }) => {
  await mockMissionAnalysis(page, async (route, input, index) => {
    const result = syntheticMissionAnalysis(input);
    if (index === 0) result.input = { ...input, observer: { ...input.observer, longitude: 99 } };
    else result.generatedUtc = "invalid timestamp";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ready", analysis: result }) });
  });
  await selectSite(page); await configure(page);
  for (let index = 0; index < 2; index++) {
    await analysis(page).getByRole("button", { name: "Analyze", exact: true }).click();
    await expect(analysis(page).getByRole("alert")).toBeVisible();
    await expect(analysis(page).getByRole("region", { name: "Analysis results", exact: true })).toHaveCount(0); await expect(timeline(page)).toHaveCount(0);
  }
});

test("short mobile timeline, report and fullscreen remain reachable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => false }));
  await mockMissionAnalysis(page); await page.goto("/explorer"); await importSites(page); await configure(page);
  await analysis(page).getByRole("button", { name: "Compare 2", exact: true }).click();
  await expect(analysis(page).getByRole("region", { name: "Analysis results", exact: true })).toBeVisible(); await openTimeline(page);
  await expect(page.getByRole("dialog", { name: "Site inspector", exact: true })).toHaveCount(0);
  const map = await page.getByRole("region", { name: "Lunar imagery map", exact: true }).boundingBox();
  const trigger = await page.getByRole("button", { name: "Open site inspector", exact: true }).boundingBox();
  const controls = await page.getByRole("group", { name: "Map viewport", exact: true }).boundingBox();
  if (!map || !trigger || !controls) throw new Error("Missing mobile planning controls.");
  for (const control of [trigger, controls]) { expect(control.y).toBeGreaterThanOrEqual(map.y); expect(control.y + control.height).toBeLessThanOrEqual(map.y + map.height); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Fullscreen map", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Lunar exploration", exact: true })).toBeVisible(); await expect(page.locator(".ol-viewport")).toHaveCount(1);
  await timeline(page).getByRole("button", { name: "Next sample", exact: true }).click();
  await expect(timeline(page).getByLabel("Selected analysis time", { exact: true })).toHaveText("2026-11-14 01:00 UTC");
  const text = await report(page, timeline(page).getByRole("button", { name: "Download mission report", exact: true })); expect(text).toContain("Test candidate B");
  await page.screenshot({ path: testInfo.outputPath("mission-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Exit fullscreen map", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fullscreen map", exact: true })).toBeFocused();
});
