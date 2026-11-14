/** Verify live comparison inputs, shared mission behavior and Explorer transfers using test-only transport. @author Sultan */
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { emptyExplorerSession, explorerSessionLink, readExplorerSession } from "../src/components/explorer/explorer-session";
import { fulfillSyntheticMission, mockMissionAnalysis } from "./helpers/mission-analysis";
import { mockMoonTrekTiles } from "./helpers/moon-trek";

const utc = "2026-11-14T00:00:00.000Z";
const sites = [
  { latitude: -85, longitude: 20, name: "Test candidate A" },
  { latitude: -86, longitude: 30, name: "Test candidate B" },
  { latitude: -87, longitude: 40, name: "Test candidate C" },
];
const shortlist = (page: Page) => page.getByRole("region", { name: "Comparison sites", exact: true });
const analysis = (page: Page) => page.getByRole("region", { name: "Mission analysis", exact: true });
const timeline = (page: Page) => page.getByRole("region", { name: "Mission timeline", exact: true });
const values = (page: Page) => timeline(page).getByRole("list", { name: "Geometric comparison", exact: true });

async function addSite(page: Page, site: typeof sites[number]) {
  await shortlist(page).getByLabel("Site name", { exact: true }).fill(site.name);
  await shortlist(page).getByLabel("Latitude", { exact: true }).fill(String(site.latitude));
  await shortlist(page).getByLabel("Longitude", { exact: true }).fill(String(site.longitude));
  await shortlist(page).getByRole("button", { name: "Add site", exact: true }).click();
  await expect(shortlist(page).getByRole("listitem").filter({ hasText: site.name })).toBeVisible();
}

async function configure(page: Page) {
  await page.locator("#mission-time").fill(utc.slice(0, 16));
  await analysis(page).getByLabel("Window", { exact: true }).selectOption("1");
  await analysis(page).getByLabel("Sample step", { exact: true }).selectOption("60");
  await analysis(page).getByRole("button", { name: "Use 0 m", exact: true }).click();
  await analysis(page).getByRole("checkbox", { name: /Adopt mean-Earth coordinates/ }).check();
}

async function compare(page: Page, count = 2) {
  await analysis(page).getByRole("button", { name: `Compare ${count}`, exact: true }).click();
  await expect(timeline(page).getByRole("slider", { name: "Analysis time", exact: true })).toBeVisible();
  await expect(timeline(page).locator(".mission-elevation-chart svg")).toBeVisible();
}

async function downloadReport(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    timeline(page).getByRole("button", { name: "Download mission report", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^moonline-mission-.*\.md$/);
  const path = await download.path();
  if (!path) throw new Error("Missing comparison report download.");
  return readFileSync(path, "utf8");
}

test.use({ reducedMotion: "reduce", timezoneId: "Asia/Karachi" });
test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

test("Explorer navigation opens an empty comparison without example results or automatic analysis", async ({ page }) => {
  await mockMoonTrekTiles(page);
  const requests = await mockMissionAnalysis(page);
  await page.goto("/explorer");
  await expect(page.locator(".ol-viewport")).toHaveCount(1);
  await page.getByRole("link", { name: "Site comparison", exact: true }).click();
  await expect(page).toHaveURL(/\/comparison(?:\?|$)/);
  await expect(page.getByRole("link", { name: "Site comparison", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Site comparison", exact: true })).toBeVisible();
  await expect(shortlist(page).getByRole("listitem")).toHaveCount(0);
  await expect(analysis(page).getByRole("button", { name: "Compare sites", exact: true })).toBeDisabled();
  await expect(analysis(page).getByRole("button", { name: "Analyze", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Comparison results", exact: true })).toContainText("Add at least two sites");
  await expect(page.getByRole("heading", { name: "Illustrative UI preview" })).toHaveCount(0);
  await expect(page.getByText(/Synthetic profiles|Example site [AB]/)).toHaveCount(0);
  await expect(page.locator(".comparison-radar")).toHaveCount(0);
  await expect(timeline(page)).toHaveCount(0);
  expect(requests).toHaveLength(0);
  await page.getByRole("link", { name: "Back to Explorer", exact: true }).click();
  await expect(page).toHaveURL(/\/explorer(?:\?|$)/);
});

test("two entered sites require explicit observer choices and share UTC settings, samples and reports", async ({ page }) => {
  const requests = await mockMissionAnalysis(page);
  await page.goto("/comparison");
  await addSite(page, sites[0]!);
  await expect(analysis(page).getByRole("button", { name: "Compare sites", exact: true })).toBeDisabled();
  await addSite(page, sites[1]!);
  await page.locator("#mission-time").fill(utc.slice(0, 16));
  await analysis(page).getByLabel("Window", { exact: true }).selectOption("1");
  await analysis(page).getByLabel("Sample step", { exact: true }).selectOption("60");
  const run = analysis(page).getByRole("button", { name: "Compare 2", exact: true });
  await expect(run).toBeDisabled();
  await analysis(page).getByRole("button", { name: "Use 0 m", exact: true }).click();
  await expect(run).toBeDisabled();
  await analysis(page).getByRole("checkbox", { name: /Adopt mean-Earth coordinates/ }).check();
  await expect(run).toBeEnabled();
  expect(requests).toHaveLength(0);
  await compare(page);
  expect(requests).toHaveLength(2);
  expect(requests.map(input => input.observer)).toEqual(sites.slice(0, 2).map(site => ({
    latitude: site.latitude, longitude: site.longitude, heightMeters: 0, coordinateBasis: "adopted_mean_earth",
  })));
  for (const input of requests) {
    expect(input.startUtc).toBe(utc);
    expect(input.endUtc).toBe("2026-11-15T00:00:00.000Z");
    expect(input.stepMinutes).toBe(60);
  }
  await expect(values(page).getByRole("listitem")).toHaveCount(2);
  const first = values(page).getByRole("listitem").filter({ hasText: sites[0]!.name });
  await expect(first).toContainText("5.02\u00b0");
  await expect(timeline(page).getByLabel("Selected analysis time", { exact: true })).toHaveText("2026-11-14 00:00 UTC");
  await timeline(page).getByRole("button", { name: "Next sample", exact: true }).click();
  await expect(timeline(page).getByLabel("Selected analysis time", { exact: true })).toHaveText("2026-11-14 01:00 UTC");
  await timeline(page).getByRole("button", { name: "Earth", exact: true }).click();
  await expect(first).toContainText("-6.02\u00b0");
  await expect(first).toContainText("0.0 h above horizon");
  await timeline(page).getByRole("button", { name: "Sun", exact: true }).click();
  await timeline(page).getByText("Visibility windows", { exact: true }).click();
  await expect(timeline(page)).toContainText("2026-11-15");
  await expect(timeline(page)).toContainText("Open boundaries");
  const report = await downloadReport(page);
  expect(report).toContain(sites[0]!.name);
  expect(report).toContain(sites[1]!.name);
  expect(report).toContain(utc);
  expect(report).toContain("DE441");
  expect(report).toContain("No transformation");
  expect(report).toContain("Terrain obstruction");
});

test("failed sites remain explicit in results and reports, and removal invalidates the comparison", async ({ page }) => {
  await mockMissionAnalysis(page, async (route, input) => {
    if (input.observer.longitude === 30) await route.fulfill({
      status: 503, contentType: "application/json",
      body: JSON.stringify({ status: "error", message: "Synthetic comparison transport unavailable." }),
    });
    else await fulfillSyntheticMission(route, input);
  });
  await page.goto("/comparison");
  await addSite(page, sites[0]!); await addSite(page, sites[1]!); await configure(page); await compare(page);
  await expect(analysis(page).getByRole("region", { name: "Unavailable sites", exact: true })).toContainText(sites[1]!.name);
  await expect(values(page).getByRole("listitem").filter({ hasText: sites[1]!.name })).toContainText("Unavailable");
  const report = await downloadReport(page);
  expect(report).toContain(sites[0]!.name); expect(report).toContain(sites[1]!.name);
  expect(report).toContain("Synthetic comparison transport unavailable.");
  await shortlist(page).getByRole("button", { name: "Remove site 2", exact: true }).click();
  await expect(shortlist(page).getByRole("listitem")).toHaveCount(1);
  await expect(timeline(page)).toHaveCount(0);
  await expect(analysis(page).getByRole("region", { name: "Unavailable sites", exact: true })).toHaveCount(0);
  await expect(analysis(page).getByRole("button", { name: "Compare sites", exact: true })).toBeDisabled();
});

test("Explorer selection, candidates, UTC and map settings travel to comparison and back", async ({ page }) => {
  await mockMoonTrekTiles(page);
  const requests = await mockMissionAnalysis(page);
  const session = { ...emptyExplorerSession(), selected: sites[1]!, sites: sites.slice(0, 2), missionTimeUtc: utc };
  session.view = { ...session.view, basemap: "relief", center: [25, -85], zoom: 4 };
  const shared = new URL(explorerSessionLink(session, "https://moonline.example/explorer"));
  await page.goto(shared.pathname + shared.search);
  await expect(page.locator(".ol-viewport")).toHaveCount(1);
  await expect(page.locator("#mission-time")).toHaveValue(utc.slice(0, 16));
  await page.getByRole("link", { name: "Site comparison", exact: true }).click();
  await expect(shortlist(page).getByRole("listitem")).toHaveCount(2);
  await expect(shortlist(page).getByRole("button", { name: `Select site 2: ${sites[1]!.name}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#mission-time")).toHaveValue(utc.slice(0, 16));
  const transferred = readExplorerSession(new URL(page.url()).search);
  expect(transferred.status).toBe("ready");
  if (transferred.status !== "ready") throw new Error("Missing comparison session.");
  expect(transferred.session.view.mode).toBe(session.view.mode);
  expect(transferred.session.view.basemap).toBe(session.view.basemap);
  expect(transferred.session.view.zoom).toBe(session.view.zoom);
  await addSite(page, sites[2]!);
  await page.getByRole("link", { name: "Back to Explorer", exact: true }).click();
  await expect(page).toHaveURL(/\/explorer\?/);
  await expect(page.getByRole("region", { name: "Candidate locations", exact: true }).getByRole("listitem")).toHaveCount(3);
  await expect(page.locator("#mission-time")).toHaveValue(utc.slice(0, 16));
  const restored = readExplorerSession(new URL(page.url()).search);
  expect(restored.status).toBe("ready");
  if (restored.status !== "ready") throw new Error("Missing restored Explorer session.");
  expect(restored.session.sites).toEqual(sites);
  expect(restored.session.selected).toEqual(sites[2]);
  expect(restored.session.missionTimeUtc).toBe(utc);
  expect(restored.session.view).toEqual(transferred.session.view);
  await page.getByRole("link", { name: "Site comparison", exact: true }).click();
  await expect(shortlist(page).getByRole("listitem")).toHaveCount(3);
  await page.locator("#mission-time").fill("");
  await shortlist(page).getByRole("button", { name: "Remove site 3", exact: true }).click();
  await page.getByRole("link", { name: "Mission Explorer", exact: true }).click();
  await expect(page).toHaveURL(/\/explorer\?/);
  await expect(page.getByRole("region", { name: "Candidate locations", exact: true }).getByRole("listitem")).toHaveCount(2);
  await expect(page.locator("#mission-time")).toHaveValue("");
  const cleared = readExplorerSession(new URL(page.url()).search);
  expect(cleared.status).toBe("ready");
  if (cleared.status !== "ready") throw new Error("Missing cleared-time Explorer session.");
  expect(cleared.session.sites).toEqual(sites.slice(0, 2));
  expect(cleared.session.missionTimeUtc).toBeNull();
  expect(requests).toHaveLength(0);
});

test("legacy comparison links redirect to the canonical page with their entered inputs", async ({ page }) => {
  const requests = await mockMissionAnalysis(page);
  const session = { ...emptyExplorerSession(), selected: sites[1]!, sites: sites.slice(0, 2), missionTimeUtc: utc };
  const legacy = new URL(explorerSessionLink(session, "https://moonline.example/comparison-preview?source=saved-link"));
  await page.goto(legacy.pathname + legacy.search);
  await expect(page).toHaveURL(/\/comparison\?/);
  expect(new URL(page.url()).searchParams.get("source")).toBe("saved-link");
  await expect(page.getByRole("link", { name: "Site comparison", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(shortlist(page).getByRole("listitem")).toHaveCount(2);
  await expect(shortlist(page).getByRole("button", { name: `Select site 2: ${sites[1]!.name}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#mission-time")).toHaveValue(utc.slice(0, 16));
  const restored = readExplorerSession(new URL(page.url()).search);
  expect(restored.status).toBe("ready");
  if (restored.status !== "ready") throw new Error("Legacy comparison link lost its session.");
  expect(restored.session).toEqual(session);
  expect(requests).toHaveLength(0);
});

test("comparison edits survive a Methodology return while calculated results remain transient", async ({ page }) => {
  await mockMoonTrekTiles(page);
  await mockMissionAnalysis(page);
  await page.goto("/comparison");
  await addSite(page, sites[0]!); await addSite(page, sites[1]!);
  await addSite(page, sites[2]!);
  await configure(page);
  await page.locator("#mission-time").fill("2026-11-15T09:10");
  await compare(page, 3);
  await page.getByRole("link", { name: "Methodology", exact: true }).click();
  await expect(page).toHaveURL(/\/methodology$/);
  await page.getByRole("link", { name: "Back to Explorer", exact: true }).click();
  await expect(page).toHaveURL(/\/explorer(?:\?|$)/);
  await expect(page.getByRole("region", { name: "Candidate locations", exact: true }).getByRole("listitem")).toHaveCount(3);
  await expect(page.locator("#mission-time")).toHaveValue("2026-11-15T09:10");
  await expect.poll(() => readExplorerSession(new URL(page.url()).search).status).toBe("ready");
  const restored = readExplorerSession(new URL(page.url()).search);
  expect(restored.status).toBe("ready");
  if (restored.status !== "ready") throw new Error("Comparison edits were not restored in Explorer.");
  expect(restored.session.sites).toEqual(sites);
  expect(restored.session.selected).toEqual(sites[2]);
  expect(restored.session.missionTimeUtc).toBe("2026-11-15T09:10:00.000Z");
  await expect(page.getByRole("region", { name: "Analysis results", exact: true })).toHaveCount(0);
  await expect(timeline(page)).toHaveCount(0);
});

test("opening comparison from Methodology restores saved inputs and invalid links preserve that backup", async ({ page }) => {
  await mockMoonTrekTiles(page);
  const requests = await mockMissionAnalysis(page);
  const session = { ...emptyExplorerSession(), selected: sites[1]!, sites: sites.slice(0, 2), missionTimeUtc: utc };
  const shared = new URL(explorerSessionLink(session, "https://moonline.example/explorer"));
  await page.goto(shared.pathname + shared.search);
  await expect(page.getByRole("region", { name: "Candidate locations", exact: true }).getByRole("listitem")).toHaveCount(2);
  const navigation = page.getByRole("navigation", { name: "Main navigation", exact: true });
  await navigation.getByRole("link", { name: "Methodology", exact: true }).click();
  await expect(page).toHaveURL(/\/methodology$/);
  await navigation.getByRole("link", { name: "Site comparison", exact: true }).click();
  await expect(page).toHaveURL(/\/comparison(?:\?|$)/);
  await expect(shortlist(page).getByRole("listitem")).toHaveCount(2);
  await expect(page.locator("#mission-time")).toHaveValue(utc.slice(0, 16));
  await expect(shortlist(page).getByRole("button", { name: `Select site 2: ${sites[1]!.name}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  const saved = await page.evaluate(() => sessionStorage.getItem("moonline-exploration"));
  const backup = readExplorerSession(saved ?? "");
  expect(backup.status).toBe("ready");
  if (backup.status !== "ready") throw new Error("Missing saved comparison inputs.");
  expect(backup.session.sites).toEqual(session.sites);
  expect(backup.session.missionTimeUtc).toBe(utc);
  await page.goto("/comparison?session=%7B");
  await expect(page.getByRole("alert")).toContainText("comparison link was invalid");
  await expect(shortlist(page).getByRole("listitem")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("moonline-exploration"))).toBe(saved);
  await navigation.getByRole("link", { name: "Methodology", exact: true }).click();
  await expect(page).toHaveURL(/\/methodology$/);
  await navigation.getByRole("link", { name: "Site comparison", exact: true }).click();
  await expect(shortlist(page).getByRole("listitem")).toHaveCount(2);
  await expect(page.locator("#mission-time")).toHaveValue(utc.slice(0, 16));
  await page.getByRole("link", { name: "Back to Explorer", exact: true }).click();
  await expect(page.getByRole("region", { name: "Candidate locations", exact: true }).getByRole("listitem")).toHaveCount(2);
  await expect(page.locator("#mission-time")).toHaveValue(utc.slice(0, 16));
  const restored = readExplorerSession(new URL(page.url()).search);
  expect(restored.status).toBe("ready");
  if (restored.status !== "ready") throw new Error("Restored comparison lost its Explorer inputs.");
  expect(restored.session.sites).toEqual(session.sites);
  expect(restored.session.selected).toEqual(session.selected);
  expect(restored.session.missionTimeUtc).toBe(utc);
  expect(requests).toHaveLength(0);
});

for (const width of [390, 768, 1440]) {
  test(`empty and completed comparison remain usable at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await mockMissionAnalysis(page);
    await page.goto("/comparison");
    await expect(page.getByRole("heading", { name: "Site comparison", exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`comparison-empty-${width}.png`), fullPage: true });
    await addSite(page, sites[0]!); await addSite(page, sites[1]!); await configure(page); await compare(page);
    await expect(timeline(page)).toHaveCSS("position", "static");
    const chart = timeline(page).locator(".mission-elevation-chart svg");
    const bounds = await chart.boundingBox();
    if (!bounds) throw new Error("Comparison chart has no visible bounds.");
    expect(bounds.width).toBeGreaterThan(100);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    const slider = timeline(page).getByRole("slider", { name: "Analysis time", exact: true });
    await slider.scrollIntoViewIfNeeded(); await slider.focus(); await slider.press("ArrowRight");
    await expect(slider).toBeFocused();
    await expect(timeline(page).getByLabel("Selected analysis time", { exact: true })).toHaveText("2026-11-14 01:00 UTC");
    await timeline(page).getByRole("button", { name: "Earth", exact: true }).click();
    await expect(values(page)).toContainText("-6.02\u00b0");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await timeline(page).getByRole("button", { name: "Download mission report", exact: true }).scrollIntoViewIfNeeded();
    await expect(timeline(page).getByRole("button", { name: "Download mission report", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`comparison-completed-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
