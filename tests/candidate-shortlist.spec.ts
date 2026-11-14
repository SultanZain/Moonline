/**
 * Exercise candidate fitting, selection, reversible clearing and accessible shortlist controls.
 * NASA native map references anchor pin locations; transport fixtures do not establish imagery coverage.
 * @author Sultan
 */
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { isMapLocation, type MapLocation } from "../src/components/explorer/lunar-map-coordinates";
import { readExplorerSession } from "../src/components/explorer/explorer-session";
import { moonTrekGrid } from "../src/config/moon-trek";
import { mockMoonTrekTiles } from "./helpers/moon-trek";

type MapReference = MapLocation & { projected: [number, number] };
const missionTimeUtc = "2026-11-14T12:30:00.000Z";

function reference(name: string): MapReference {
  const record: unknown = JSON.parse(readFileSync("tests/fixtures/nasa-map-coordinate-references.json", "utf8"));
  if (typeof record !== "object" || record === null || !("references" in record) || !Array.isArray(record.references)) throw new Error("Invalid NASA reference fixture");
  const item: unknown = record.references.find((value: unknown) => typeof value === "object" && value !== null && "name" in value && value.name === name);
  if (!isMapLocation(item) || !("projected" in item) || !Array.isArray(item.projected)) throw new Error(`Missing NASA reference: ${name}`);
  const x: unknown = item.projected[0], y: unknown = item.projected[1];
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Invalid native coordinates");
  return { latitude: item.latitude, longitude: item.longitude, name, projected: [x, y] };
}

const polarSites = [reference("Malapert Massif"), reference("Shackleton"), reference("Amundsen")];
const inspector = (page: Page) => page.getByRole("complementary", { name: "Site inspector", exact: true })
  .or(page.getByRole("dialog", { name: "Site inspector", exact: true }));
const shortlist = (page: Page) => inspector(page).getByRole("region", { name: "Candidate locations", exact: true });

function session(page: Page) {
  const read = readExplorerSession(new URL(page.url()).search);
  return read.status === "ready" ? read.session : null;
}

function candidateFile(sites: readonly MapLocation[], utc = missionTimeUtc) {
  return { name: "candidate-inputs.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({
    kind: "moonline-candidate-locations", coordinateSystem: "Moon 2000 spherical map",
    latitudeUnit: "degrees", longitudeUnit: "degrees", longitudeDirection: "east",
    missionTimeUtc: utc, sites: sites.map(site => ({ latitude: site.latitude, longitude: site.longitude, ...(site.name ? { name: site.name } : {}) })),
    analysis: { status: "not_calculated" },
  })) };
}

async function importSites(page: Page, sites: readonly MapLocation[], utc = missionTimeUtc) {
  await expect(page.locator(".ol-viewport")).toHaveCount(1);
  if (!await inspector(page).isVisible()) await page.getByRole("button", { name: "Open site inspector", exact: true }).click();
  await inspector(page).getByLabel("Candidate file", { exact: true }).setInputFiles(candidateFile(sites, utc));
  await inspector(page).getByRole("button", { name: "Import", exact: true }).click();
  await expect(shortlist(page).getByRole("listitem")).toHaveCount(sites.length);
  await expect.poll(() => session(page)?.sites.length).toBe(sites.length);
  await expect.poll(() => session(page)?.missionTimeUtc).toBe(utc);
}

async function pinPixel(page: Page, site: MapReference) {
  const box = await page.getByRole("region", { name: "Lunar imagery map", exact: true }).boundingBox();
  const state = session(page);
  if (!box || !state) throw new Error("Map view is unavailable");
  const [x, y] = state.view.mode === "south" ? site.projected : [site.longitude, site.latitude];
  if (x === undefined || y === undefined) throw new Error("Reference coordinates unavailable");
  const resolution = (state.view.mode === "south" ? moonTrekGrid.baseScaleDenominator * moonTrekGrid.pixelSizeMetres : 360 / 512) / 2 ** state.view.zoom;
  return { x: box.x + box.width / 2 + (x - state.view.center[0]) / resolution,
    y: box.y + box.height / 2 - (y - state.view.center[1]) / resolution, box };
}

test.use({ reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); await mockMoonTrekTiles(page); });

test("all reference candidates fit on the polar map and remain directly selectable", async ({ page }) => {
  await page.goto("/explorer"); await importSites(page, polarSites);
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await page.getByLabel("Malapert NAC image", { exact: true }).check();
  await page.getByRole("button", { name: "Close layers", exact: true }).click();
  await expect.poll(() => session(page)?.view.overlays.length).toBe(1);
  const before = session(page); if (!before) throw new Error("Missing initial view");
  await page.getByRole("button", { name: "Fit candidates", exact: true }).click();
  await expect(inspector(page)).toHaveCount(0);
  await expect.poll(() => session(page)?.view.center).not.toEqual(before.view.center);
  const fitted = session(page); if (!fitted) throw new Error("Missing fitted view");
  expect(fitted.view.mode).toBe("south"); expect(fitted.view.basemap).toBe(before.view.basemap);
  expect(fitted.view.overlays).toEqual(before.view.overlays); expect(fitted.selected).toEqual(before.selected);
  expect(fitted.missionTimeUtc).toBe(missionTimeUtc);
  for (const site of polarSites) {
    const pin = await pinPixel(page, site);
    expect(pin.x).toBeGreaterThan(pin.box.x + 24); expect(pin.x).toBeLessThan(pin.box.x + pin.box.width - 24);
    expect(pin.y).toBeGreaterThan(pin.box.y + 24); expect(pin.y).toBeLessThan(pin.box.y + pin.box.height - 24);
  }
  const target = polarSites[1]; if (!target) throw new Error("Missing reference site");
  const pin = await pinPixel(page, target);
  await page.mouse.move(pin.x, pin.y);
  await expect(page.getByRole("region", { name: "Lunar imagery map", exact: true })).toHaveCSS("cursor", "pointer");
  await page.mouse.click(pin.x, pin.y);
  await expect(inspector(page).locator(".site-coordinates dd")).toHaveText([`${target.latitude.toFixed(4)}°`, `${target.longitude.toFixed(4)}°`]);
  await expect(shortlist(page).getByRole("button", { name: "Locate candidate 2: Shackleton", exact: true })).toHaveAttribute("aria-current", "location");
});

test("fitting retains the published polar grid beyond the old half-column boundary", async ({ page }) => {
  await page.goto("/explorer"); await importSites(page, [{ latitude: -50, longitude: 90 }, { latitude: -50, longitude: 45 }]);
  await page.getByRole("button", { name: "South pole", exact: true }).click();
  await expect.poll(() => session(page)?.view.mode).toBe("south");
  const before = session(page); if (!before) throw new Error("Missing polar view");
  await page.getByRole("button", { name: "Fit candidates", exact: true }).click();
  await expect.poll(() => session(page)?.view.center).not.toEqual(before.view.center);
  expect(session(page)?.view.mode).toBe("south");
  await expect(page.getByRole("button", { name: "South pole", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status", { name: "Imagery status", exact: true })).toHaveText("Imagery loaded · coverage varies");
});

test("an unprojectable polar candidate switches fitting to the global view without losing inputs", async ({ page }) => {
  await page.goto("/explorer"); await importSites(page, [reference("Malapert Massif"), { latitude: 90, longitude: 0 }]);
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await page.getByLabel("Malapert NAC image", { exact: true }).check();
  await page.getByRole("button", { name: "Close layers", exact: true }).click();
  await expect.poll(() => session(page)?.view.overlays.length).toBe(1);
  const before = session(page); if (!before) throw new Error("Missing selected inputs");
  await page.getByRole("button", { name: "Fit candidates", exact: true }).click();
  await expect.poll(() => session(page)?.view.mode).toBe("global");
  const after = session(page); if (!after) throw new Error("Missing global view");
  expect(after.selected).toEqual(before.selected); expect(after.sites).toEqual(before.sites);
  expect(after.missionTimeUtc).toBe(before.missionTimeUtc); expect(after.view.overlays).toEqual(before.view.overlays);
  await page.getByRole("button", { name: "Open site inspector", exact: true }).click();
  await expect(inspector(page).locator(".site-coordinates dd")).toHaveText(["-85.8100°", "-3.6000°"]);
});

test("global antimeridian candidates fit the actual nonwrapping raster and survive reload", async ({ page }) => {
  await page.goto("/explorer"); await importSites(page, [{ latitude: 0, longitude: -179 }, { latitude: 0, longitude: 179 }]);
  await page.getByRole("button", { name: "Fit candidates", exact: true }).click();
  await expect.poll(() => session(page)?.view.center[0]).toBeCloseTo(0, 8);
  const state = session(page); if (!state) throw new Error("Missing global camera");
  expect(state.view.mode).toBe("global"); expect(state.view.zoom).toBeLessThanOrEqual(2);
  await page.reload();
  await expect.poll(() => session(page)?.view).toEqual(state.view);
  await expect(shortlist(page).getByRole("listitem")).toHaveCount(2);
  await expect(page.locator(".ol-viewport")).toHaveCount(1);
});

test("clearing and undo restore the exact shortlist without changing the selected site, time or view", async ({ page }) => {
  await page.goto("/explorer"); await importSites(page, polarSites);
  const before = session(page); if (!before) throw new Error("Missing shortlist");
  await shortlist(page).getByRole("button", { name: "Clear candidates", exact: true }).click();
  await expect(shortlist(page).getByRole("listitem")).toHaveCount(0);
  await expect(shortlist(page).getByRole("status")).toHaveText("3 candidates cleared");
  await expect(shortlist(page).getByRole("button", { name: "Undo clear candidates", exact: true })).toBeFocused();
  await expect.poll(() => session(page)?.sites.length).toBe(0);
  const cleared = session(page); if (!cleared) throw new Error("Missing cleared state");
  expect(cleared.selected).toEqual(before.selected); expect(cleared.missionTimeUtc).toBe(before.missionTimeUtc); expect(cleared.view).toEqual(before.view);
  await page.keyboard.press("Enter");
  await expect(shortlist(page).getByRole("listitem")).toHaveCount(3);
  await expect(shortlist(page).getByRole("button", { name: "Locate candidate 1: Malapert Massif", exact: true })).toBeFocused();
  await expect.poll(() => session(page)?.sites).toEqual(before.sites);
  expect(session(page)?.selected).toEqual(before.selected); expect(session(page)?.view).toEqual(before.view);
});

test("removal renumbers pins and retains keyboard focus on a remaining site or Add", async ({ page }) => {
  await page.goto("/explorer"); await importSites(page, polarSites);
  await shortlist(page).getByRole("button", { name: "Remove candidate 2", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(shortlist(page).getByRole("button", { name: "Locate candidate 2: Amundsen", exact: true })).toBeFocused();
  await expect(shortlist(page).locator(".candidate-index")).toHaveText(["1", "2"]);
  await shortlist(page).getByRole("button", { name: "Remove candidate 1", exact: true }).click();
  await expect(shortlist(page).getByRole("button", { name: "Locate candidate 1: Amundsen", exact: true })).toBeFocused();
  await expect(shortlist(page).locator('[aria-current="location"]')).toHaveCount(0);
  await shortlist(page).getByRole("button", { name: "Remove candidate 1", exact: true }).click();
  await expect(inspector(page).getByRole("button", { name: "Add candidate", exact: true })).toBeFocused();
  await expect(inspector(page).locator(".site-coordinates dd")).toHaveText(["-85.8100°", "-3.6000°"]);
  await expect(page.locator("#mission-time")).toHaveValue("2026-11-14T12:30");
});

test("new candidate edits and confirmed imports invalidate an older clear undo", async ({ page }) => {
  await page.goto("/explorer"); await importSites(page, polarSites);
  await shortlist(page).getByRole("button", { name: "Clear candidates", exact: true }).click();
  await inspector(page).getByRole("button", { name: "Add candidate", exact: true }).click();
  await expect(inspector(page).getByRole("button", { name: "Undo clear candidates", exact: true })).toHaveCount(0);
  await shortlist(page).getByRole("button", { name: "Clear candidates", exact: true }).click();
  await importSites(page, [{ latitude: 0, longitude: 10 }], "2026-11-15T09:10:00.000Z");
  await expect(inspector(page).getByRole("button", { name: "Undo clear candidates", exact: true })).toHaveCount(0);
  await expect(shortlist(page).getByRole("listitem")).toHaveCount(1);
  await expect(page.locator("#mission-time")).toHaveValue("2026-11-15T09:10");
});

test("mobile fullscreen exposes fit and undo without trapping the user or overlapping map controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => false }));
  await page.goto("/explorer");
  await page.getByRole("button", { name: "Fullscreen map", exact: true }).click();
  await importSites(page, polarSites.map(site => ({ ...site, name: "X".repeat(120) })));
  await shortlist(page).getByRole("button", { name: "Clear candidates", exact: true }).click();
  await expect(shortlist(page).getByRole("button", { name: "Undo clear candidates", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await shortlist(page).getByRole("button", { name: "Show all candidates", exact: true }).click();
  await expect(inspector(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open site inspector", exact: true })).toBeFocused();
  await expect(page.getByRole("dialog", { name: "Lunar exploration", exact: true })).toBeVisible();
  const trigger = await page.getByRole("button", { name: "Open site inspector", exact: true }).boundingBox();
  const controls = await page.getByRole("group", { name: "Map viewport", exact: true }).boundingBox();
  if (!trigger || !controls) throw new Error("Missing map controls");
  expect(trigger.y + trigger.height).toBeLessThanOrEqual(controls.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".ol-viewport")).toHaveCount(1);
  await page.getByRole("button", { name: "Exit fullscreen map", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fullscreen map", exact: true })).toBeFocused();
});
