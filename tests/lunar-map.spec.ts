/**
 * Check map navigation against NASA's native polar coordinates and exercise real workspace behavior.
 * Raster transport fixtures are synthetic; no ephemeris or mission result is simulated.
 * @author Sultan
 */
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { isMapLocation, projectMapLocation, unprojectMapLocation } from "../src/components/explorer/lunar-map-coordinates";
import { moonRadiusMetres, moonTrekGrid, moonTrekLayers } from "../src/config/moon-trek";
import { fulfillMoonTile, mockMoonTrekTiles, moonTrekTiles, syntheticNacNodata } from "./helpers/moon-trek";

const imageryStatus = (page: Page) => page.getByRole("status", { name: "Imagery status" });
const lunarMap = (page: Page) => page.getByRole("region", { name: "Lunar imagery map" });
const inspector = (page: Page) => page.getByRole("complementary", { name: "Site inspector" });

async function goTo(page: Page, latitude: string, longitude: string) {
  await page.getByRole("button", { name: "Go to coordinates", exact: true }).click();
  await page.locator("#map-latitude").fill(latitude);
  await page.locator("#map-longitude").fill(longitude);
  await page.getByRole("button", { name: "Go to location", exact: true }).click();
}

async function openLayers(page: Page) { await page.getByRole("button", { name: "Map layers", exact: true }).click(); }

async function expectLocation(page: Page, latitude: string, longitude: string) {
  await expect(inspector(page).locator(".site-coordinates dd")).toHaveText([`${latitude}°`, `${longitude}°`]);
}

test.use({ reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

test("navigation matches independent NASA native polar reference points and lunar ground scale", () => {
  const record: unknown = JSON.parse(readFileSync("tests/fixtures/nasa-map-coordinate-references.json", "utf8"));
  if (typeof record !== "object" || record === null || !("references" in record) || !Array.isArray(record.references)) throw new Error("Invalid reference fixture");
  expect(record.references.length).toBeGreaterThanOrEqual(5);
  for (const reference of record.references) {
    if (!isMapLocation(reference) || !("projected" in reference) || !Array.isArray(reference.projected) || reference.projected.length !== 2 ||
      !reference.projected.every(value => typeof value === "number" && Number.isFinite(value))) throw new Error("Invalid NASA reference");
    const projected = projectMapLocation(reference, "south");
    expect(projected).not.toBeNull();
    expect(projected?.[0]).toBeCloseTo(reference.projected[0], 5);
    expect(projected?.[1]).toBeCloseTo(reference.projected[1], 5);
    const restored = unprojectMapLocation(reference.projected, "south");
    expect(restored?.latitude).toBeCloseTo(reference.latitude, 8);
    expect(restored?.longitude).toBeCloseTo(reference.longitude, 8);
  }
  expect(projectMapLocation({ latitude: 91, longitude: 0 }, "south")).toBeNull();
  expect(projectMapLocation({ latitude: 90, longitude: 0 }, "south")).toBeNull();
  expect(unprojectMapLocation([0, 0], "south")).toEqual({ latitude: -90, longitude: 0 });
  expect(unprojectMapLocation([0, 91], "global")).toBeNull();
  expect(moonRadiusMetres).toBe(1_737_400);
});

test("the map fills the workspace and context stays hidden until useful", async ({ page }) => {
  await mockMoonTrekTiles(page); await page.goto("/explorer");
  await expect(imageryStatus(page)).toHaveText("Imagery loaded · coverage varies");
  const bounds = await lunarMap(page).boundingBox();
  expect(bounds?.height).toBe(900); expect(bounds?.width).toBeGreaterThan(1300);
  await expect(lunarMap(page).locator("canvas").first()).toBeVisible();
  await expect(inspector(page)).toHaveCount(0);
  await expect(page.getByText("Not calculated", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Open site inspector" }).click();
  await expect(inspector(page).getByText("Select a location.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze", exact: true })).toHaveCount(0);
});

test("manual coordinates select a site, center the map and use lunar distances", async ({ page }) => {
  await mockMoonTrekTiles(page); await page.goto("/explorer");
  await expect(imageryStatus(page)).toHaveText("Imagery loaded · coverage varies");
  await goTo(page, "-85.81", "-3.6");
  await expectLocation(page, "-85.8100", "-3.6000");
  await expect(page.getByRole("button", { name: "South pole", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Analysis not connected.")).toBeVisible();
  const scale = page.locator(".ol-scale-line-inner");
  await expect(scale).toBeVisible();
  const text = await scale.innerText();
  const match = /^(\d+(?:\.\d+)?)\s+(m|km)$/.exec(text);
  expect(match).not.toBeNull();
  if (!match) throw new Error("Missing scale units");
  const distance = Number(match[1]) * (match[2] === "km" ? 1000 : 1);
  const width = await scale.evaluate(element => {
    if (!(element instanceof HTMLElement)) throw new Error("Invalid scale element");
    return Number.parseFloat(element.style.width);
  });
  // Inverse polar scale factor at the map center, independent of the engine's x/y expression.
  const metresPerPixel = moonTrekGrid.baseScaleDenominator * moonTrekGrid.pixelSizeMetres / 64 * (1 - Math.sin(-85.81 * Math.PI / 180)) / 2;
  expect(distance / width).toBeCloseTo(metresPerPixel, 0);
});

test("empty and out-of-range coordinates never become a selected zero location", async ({ page }) => {
  await mockMoonTrekTiles(page); await page.goto("/explorer");
  await page.getByRole("button", { name: "Go to coordinates", exact: true }).click();
  await page.getByRole("button", { name: "Go to location", exact: true }).click();
  await expect(page.getByRole("region", { name: "Lunar exploration", exact: true }).getByRole("alert")).toHaveText("Latitude −90…90; longitude −180…180.");
  await expect(inspector(page)).toHaveCount(0);
  await page.locator("#map-latitude").fill("-91"); await page.locator("#map-longitude").fill("181");
  await page.getByRole("button", { name: "Go to location", exact: true }).click();
  await expect(page.locator("#map-latitude")).toHaveAttribute("aria-invalid", "true");
  await expect(inspector(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Close coordinates", exact: true }).click();
  await page.getByRole("combobox").fill("91, 0"); await page.getByRole("combobox").press("Enter");
  await expect(page.getByRole("region", { name: "Lunar exploration", exact: true }).getByRole("alert")).toHaveText("Use latitude −90…90 and longitude −180…180.");
});

test("numeric search bypasses nomenclature and normalizes equivalent longitude boundaries", async ({ page }) => {
  await mockMoonTrekTiles(page);
  const names: string[] = []; page.on("request", request => { if (request.url().includes("/api/lunar-locations")) names.push(request.url()); });
  await page.goto("/explorer");
  await page.getByRole("combobox").fill("0, 180"); await page.getByRole("combobox").press("Enter");
  await expectLocation(page, "0.0000", "-180.0000");
  await page.getByRole("button", { name: "Add candidate", exact: true }).click();
  await expect(page.getByRole("button", { name: "Locate candidate 1: 0.0000°, -180.0000°", exact: true })).toBeFocused();
  await goTo(page, "0", "-180");
  await expect(page.getByRole("button", { name: "Add candidate", exact: true })).toHaveCount(0);
  await expect(inspector(page).locator('[aria-current="location"] .candidate-index')).toHaveText("1");
  expect(names).toEqual([]);
});

test("name suggestions support keyboard selection and preserve NASA feature coordinates", async ({ page }) => {
  await mockMoonTrekTiles(page);
  await page.route("**/api/lunar-locations?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ results: [
    { id: 1074, name: "Malapert", latitude: -84.798043, longitude: 12.305737, featureType: "Crater, craters" },
    { id: 1075, name: "Malapert A", latitude: -80.194918, longitude: -3.46315 },
  ] }) }));
  await page.goto("/explorer"); await page.getByRole("combobox").fill("malapert");
  await expect(page.getByRole("option")).toHaveCount(2);
  await page.getByRole("combobox").press("ArrowDown"); await page.getByRole("combobox").press("Enter");
  await expect(inspector(page).getByText("Malapert", { exact: true })).toBeVisible();
  await expectLocation(page, "-84.7980", "12.3057");
  await expect(inspector(page).getByText("Crater, craters", { exact: true })).toBeVisible();
  await expect(page.getByRole("listbox")).toHaveCount(0);
});

test("failed or malformed name search preserves coordinate navigation", async ({ page }) => {
  await mockMoonTrekTiles(page);
  await page.route("**/api/lunar-locations?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ results: [{ id: 1, name: "Invalid", latitude: 91, longitude: 0 }] }) }));
  await page.goto("/explorer"); await page.getByRole("combobox").fill("invalid");
  await expect(page.getByText("Search unavailable. Enter coordinates or try again.")).toBeVisible();
  await page.getByRole("combobox").fill("-89.625776, 132.321845"); await page.getByRole("combobox").press("Enter");
  await expectLocation(page, "-89.6258", "132.3218");
});

test("a cancelled name response never replaces newer suggestions", async ({ page }) => {
  await mockMoonTrekTiles(page); let firstRequested = false;
  await page.route("**/api/lunar-locations?**", async route => {
    const term = new URL(route.request().url()).searchParams.get("q");
    if (term === "Mal") { firstRequested = true; await new Promise(resolve => setTimeout(resolve, 700)); }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ results: [term === "Mal" ?
      { id: 1, name: "Malapert", latitude: -84.798043, longitude: 12.305737 } :
      { id: 2, name: "Shackleton", latitude: -89.625776, longitude: 132.321845 }] }) }).catch(() => {});
  });
  await page.goto("/explorer"); await page.getByRole("combobox").fill("Mal");
  await expect.poll(() => firstRequested).toBe(true);
  await page.getByRole("combobox").fill("Shackleton");
  await expect(page.getByRole("option")).toHaveText(/Shackleton/);
  await page.getByRole("combobox").press("ArrowDown"); await page.getByRole("combobox").press("Enter");
  await expect(inspector(page).getByText("Shackleton", { exact: true })).toBeVisible();
});

test("click and Enter select the map while keyboard panning changes the viewport", async ({ page }) => {
  await mockMoonTrekTiles(page); const requests = new Set<string>();
  page.on("request", request => { if (request.url().includes("/tiles/Moon/")) requests.add(request.url()); });
  await page.goto("/explorer"); await expect(imageryStatus(page)).toHaveText("Imagery loaded · coverage varies");
  await lunarMap(page).click({ position: { x: 600, y: 350 } }); await expect(inspector(page)).toBeVisible();
  await page.getByRole("button", { name: "Reset map view", exact: true }).click();
  await lunarMap(page).focus(); await page.keyboard.press("Enter"); await expectLocation(page, "0.0000", "0.0000");
  const count = requests.size;
  for (let step = 0; step < 6; step++) await page.keyboard.press("ArrowRight");
  await expect.poll(() => requests.size).toBeGreaterThan(count);
  await page.keyboard.press("+"); await expect(page.getByLabel("Map zoom")).toHaveText("z3 / 8");
});

test("basemap and overlay changes retain selected coordinates and date input", async ({ page }) => {
  await mockMoonTrekTiles(page); await page.goto("/explorer");
  await goTo(page, "-85.81", "-3.6"); await page.locator("#mission-time").fill("2026-11-13T12:30");
  await openLayers(page); await page.getByRole("button", { name: "Imagery", exact: true }).click();
  await page.getByLabel("Malapert hillshade", { exact: true }).check();
  await page.getByRole("button", { name: "Close layers", exact: true }).click();
  await page.getByRole("button", { name: "Open site inspector", exact: true }).click();
  await expectLocation(page, "-85.8100", "-3.6000"); await expect(page.locator("#mission-time")).toHaveValue("2026-11-13T12:30");
  await page.getByRole("button", { name: "Global", exact: true }).click();
  await expectLocation(page, "-85.8100", "-3.6000");
});

test("each raster keeps its published maximum while higher-resolution overlays enable closer exploration", async ({ page }) => {
  await mockMoonTrekTiles(page); const requests: string[] = [];
  page.on("request", request => { if (request.url().includes("/tiles/Moon/")) requests.push(request.url()); });
  await page.goto("/explorer"); await openLayers(page);
  await page.getByRole("button", { name: "Zoom to Malapert NAC image", exact: true }).click();
  await page.getByRole("button", { name: "Close layers", exact: true }).click();
  await expect(page.getByLabel("Map zoom")).toHaveText("z8 / 12");
  for (let step = 0; step < 4; step++) await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByLabel("Map zoom")).toHaveText("z12 / 12"); await expect(page.getByRole("button", { name: "Zoom in", exact: true })).toBeDisabled();
  await expect(imageryStatus(page)).toHaveText("Imagery loaded · coverage varies");
  for (const url of requests) {
    const parsed = /\/([^/]+)\/1\.0\.0\/default\/default028mm\/(\d+)\/(\d+)\/(\d+)\.(?:png|jpg)$/.exec(url);
    if (!parsed) continue;
    const config = Object.values(moonTrekLayers).find(layer => layer.layer === parsed[1]);
    expect(config).toBeDefined(); expect(Number(parsed[2])).toBeLessThanOrEqual(config?.maxZoom ?? -1);
    expect(Number(parsed[3])).toBeLessThan(2 ** Number(parsed[2])); expect(Number(parsed[4])).toBeLessThan(2 ** (Number(parsed[2]) + 1));
  }
});

test("published polar columns 16 and 17 remain requestable outside the old square extent", async ({ page }) => {
  await mockMoonTrekTiles(page); const columns = new Set<number>();
  page.on("request", request => { const match = /LRO_LOLA_Count_SPole45_100mp_v04\/1\.0\.0\/default\/default028mm\/4\/7\/(\d+)\.png$/.exec(request.url()); if (match?.[1]) columns.add(Number(match[1])); });
  await page.goto("/explorer"); await openLayers(page); await page.getByLabel("LOLA shot count", { exact: true }).check();
  await page.getByRole("button", { name: "Close layers", exact: true }).click(); await goTo(page, "-50", "90");
  await expect(page.getByRole("button", { name: "South pole", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => columns.has(16) && columns.has(17)).toBe(true);
  await expectLocation(page, "-50.0000", "90.0000");
});

test("50 degrees south, 45 east is browsable without a blanket missing-latitude mask", async ({ page }) => {
  await mockMoonTrekTiles(page); let requested = false;
  page.on("request", request => { if (request.url().endsWith("/LRO_LOLA_Count_SPole45_100mp_v04/1.0.0/default/default028mm/4/1/14.png")) requested = true; });
  await page.goto("/explorer"); await openLayers(page); await page.getByLabel("LOLA shot count", { exact: true }).check();
  await page.getByRole("button", { name: "Close layers", exact: true }).click(); await goTo(page, "-50", "45");
  await expect.poll(() => requested).toBe(true); await expectLocation(page, "-50.0000", "45.0000");
});

test("source HTTP errors recover without resetting site or zoom", async ({ page }) => {
  let failing = true;
  await page.route(moonTrekTiles, route => failing ? route.fulfill({ status: 429, contentType: "application/json", body: '{"private":"raw provider error"}' }) : fulfillMoonTile(route));
  await page.goto("/explorer"); await expect(imageryStatus(page)).toHaveText("Some layers unavailable");
  await goTo(page, "-20", "12"); await expect(imageryStatus(page)).toHaveText("Some layers unavailable");
  failing = false; await page.getByRole("button", { name: "Retry imagery", exact: true }).click();
  await expect(imageryStatus(page)).toHaveText("Imagery loaded · coverage varies");
  await expectLocation(page, "-20.0000", "12.0000"); await expect(page.getByLabel("Map zoom")).toHaveText("z5 / 8");
  await expect(page.getByText("raw provider error", { exact: false })).toHaveCount(0);
});

test("a failed tile exposes retry while other requests are still pending", async ({ page }) => {
  let failed = false;
  let recovering = false;
  await page.route(moonTrekTiles, route => {
    if (recovering) return fulfillMoonTile(route);
    if (!failed && route.request().url().includes("/default028mm/2/")) {
      failed = true;
      return route.fulfill({ status: 503, body: "Unavailable" });
    }
  });
  await page.goto("/explorer");
  await expect(imageryStatus(page)).toHaveText("Some layers unavailable", { timeout: 5000 });
  await expect(page.getByRole("button", { name: "Retry imagery", exact: true })).toBeEnabled();
  await lunarMap(page).focus(); await page.keyboard.press("Enter");
  await expectLocation(page, "0.0000", "0.0000");
  recovering = true;
  await page.getByRole("button", { name: "Retry imagery", exact: true }).click();
  await expect(imageryStatus(page)).toHaveText("Imagery loaded · coverage varies");
  await expectLocation(page, "0.0000", "0.0000");
});

test("partial and malformed tiles are distinguishable from successfully loaded imagery", async ({ page }) => {
  let state: "partial" | "malformed" | "healthy" = "partial";
  await page.route(moonTrekTiles, route => {
    const match = /\/(\d+)\.(?:jpg|png)$/.exec(route.request().url());
    if (state === "partial" && Number(match?.[1]) % 2 === 1) return route.fulfill({ status: 503, body: "Unavailable" });
    if (state === "malformed") return route.fulfill({ status: 200, contentType: "image/jpeg", body: Buffer.from("invalid image") });
    return fulfillMoonTile(route);
  });
  await page.goto("/explorer"); await expect(imageryStatus(page)).toHaveText("Some layers unavailable");
  state = "malformed"; await page.getByRole("button", { name: "Retry imagery", exact: true }).click();
  await expect(imageryStatus(page)).toHaveText("Some layers unavailable");
  state = "healthy"; await page.getByRole("button", { name: "Retry imagery", exact: true }).click();
  await expect(imageryStatus(page)).toHaveText("Imagery loaded · coverage varies");
});

test("replacing stalled sources releases OpenLayers' loading queue", async ({ page }) => {
  await page.route(moonTrekTiles, route => { if (route.request().url().includes("LRO_WAC_Mosaic_Global")) return; return fulfillMoonTile(route); });
  await page.goto("/explorer"); await expect(imageryStatus(page)).toHaveText("Loading imagery");
  await openLayers(page); await page.getByRole("button", { name: "Relief", exact: true }).click();
  await expect(imageryStatus(page)).toHaveText("Imagery loaded · coverage varies", { timeout: 8000 });
});

test("stalled imagery times out while coordinates and navigation stay usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 }); await page.route(moonTrekTiles, () => {});
  await page.goto("/explorer"); await expect(imageryStatus(page)).toHaveText("Loading imagery");
  await expect(page.getByRole("button", { name: "Go to coordinates", exact: true })).toBeEnabled();
  await expect(imageryStatus(page)).toHaveText("Some layers unavailable", { timeout: 22000 });
  await expect(page.getByRole("button", { name: "Retry imagery", exact: true })).toBeEnabled();
});

test("verified NAC nodata becomes transparent without turning coverage gaps into terrain results", async ({ page }) => {
  await page.route(moonTrekTiles, route => route.request().url().includes("LRO_NAC_Shade") ? route.fulfill({ contentType: "image/png", body: syntheticNacNodata }) : fulfillMoonTile(route));
  await page.goto("/explorer"); await openLayers(page); await page.getByRole("button", { name: "Zoom to Malapert hillshade", exact: true }).click();
  await expect(page.getByText("No imagery at this view", { exact: true })).toBeVisible();
  await expect(imageryStatus(page)).toHaveText("Imagery loaded · coverage varies");
  const pixels = await lunarMap(page).locator("canvas").evaluateAll(elements => elements.map(element => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error("Invalid canvas");
    const context = element.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable");
    return Array.from(context.getImageData(Math.floor(element.width / 2), Math.floor(element.height / 2), 1, 1).data);
  }));
  expect(pixels.some(pixel => (pixel[3] ?? 0) > 0)).toBe(true);
  expect(pixels.every(pixel => pixel[3] === 0 || (pixel[0] ?? 0) + (pixel[1] ?? 0) + (pixel[2] ?? 0) > 0)).toBe(true);
  await expect(page.getByText("Terrain visible", { exact: true })).toHaveCount(0);
});

test("outside-grid panning has a real reset and never produces invalid tile indices", async ({ page }) => {
  await mockMoonTrekTiles(page); const urls: string[] = [];
  page.on("request", request => { if (request.url().includes("/SP/")) urls.push(request.url()); });
  await page.goto("/explorer"); await page.getByRole("button", { name: "South pole", exact: true }).click();
  for (let step = 0; step < 5; step++) await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await lunarMap(page).focus(); for (let step = 0; step < 16; step++) await page.keyboard.press("ArrowRight");
  await expect(imageryStatus(page)).toHaveText("Outside tile grid"); await page.getByRole("button", { name: "Reset map view", exact: true }).click();
  await expect(imageryStatus(page)).toHaveText("Imagery loaded · coverage varies");
  for (const url of urls) { const match = /\/(\d+)\/(\d+)\/(\d+)\.png$/.exec(url); if (!match) continue;
    expect(Number(match[2])).toBeGreaterThanOrEqual(0); expect(Number(match[2])).toBeLessThan(2 ** Number(match[1]));
    expect(Number(match[3])).toBeGreaterThanOrEqual(0); expect(Number(match[3])).toBeLessThan(2 ** (Number(match[1]) + 1)); }
});

test("three candidate sites and their explicit UTC plan can be exported without fabricated results", async ({ page }) => {
  await mockMoonTrekTiles(page); await page.goto("/explorer");
  const sites: [string, string][] = [["-85.81", "-3.6"], ["-89.625776", "132.321845"], ["-88.448714", "-90.447515"]];
  for (const [latitude, longitude] of sites) {
    await goTo(page, latitude, longitude); await page.getByRole("button", { name: "Add candidate", exact: true }).click();
  }
  await page.locator("#mission-time").fill("2026-11-13T12:30");
  await expect(page.getByRole("button", { name: "Add candidate", exact: true })).toHaveCount(0);
  await expect(inspector(page).locator('[aria-current="location"] .candidate-index')).toHaveText("3");
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "Export sites", exact: true }).click();
  const path = await (await downloadPromise).path(); if (!path) throw new Error("Download unavailable");
  const exported: unknown = JSON.parse(readFileSync(path, "utf8"));
  expect(exported).toMatchObject({ kind: "moonline-candidate-locations", longitudeDirection: "east", missionTimeUtc: "2026-11-13T12:30:00.000Z", analysis: { status: "not_calculated" }, sites: [
    { latitude: -85.81, longitude: -3.6 }, { latitude: -89.625776, longitude: 132.321845 }, { latitude: -88.448714, longitude: -90.447515 },
  ] });
  await page.getByRole("button", { name: "Remove candidate 2", exact: true }).click();
  await expect(page.getByRole("region", { name: "Candidate locations" }).getByRole("listitem")).toHaveCount(2);
});

test("native fullscreen keeps the map instance, traps focus and restores it on exit", async ({ page }) => {
  await mockMoonTrekTiles(page); await page.goto("/explorer"); await expect(imageryStatus(page)).toHaveText("Imagery loaded · coverage varies");
  const width = await lunarMap(page).evaluate(element => element.clientWidth);
  await page.getByRole("button", { name: "Fullscreen map", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  await expect(lunarMap(page)).toBeFocused(); await expect.poll(() => lunarMap(page).evaluate(element => element.clientWidth)).toBeGreaterThan(width);
  await expect(lunarMap(page).locator(".ol-viewport")).toHaveCount(1);
  await page.keyboard.press("Shift+Tab"); await expect(page.getByRole("link", { name: "NASA · LROC · LOLA", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Exit fullscreen map", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(page.getByRole("button", { name: "Fullscreen map", exact: true })).toBeFocused();
});

test("fullscreen fallback and the mobile inspector share a working focus scope", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => false }));
  await page.setViewportSize({ width: 390, height: 844 }); await mockMoonTrekTiles(page); await page.goto("/explorer");
  await page.getByRole("button", { name: "Fullscreen map", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Lunar exploration", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open site inspector", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Site inspector", exact: true }); await expect(sheet).toBeVisible();
  expect(await sheet.evaluate(element => document.querySelector(".lunar-map-expanded")?.contains(element))).toBe(true);
  await page.keyboard.press("Escape"); await expect(sheet).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Open site inspector", exact: true })).toBeFocused();
  await expect(page.locator(".lunar-map-expanded")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.locator(".lunar-map-expanded")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fullscreen map", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("rapid zoom clicks accumulate while motion is enabled", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" }); await mockMoonTrekTiles(page); await page.goto("/explorer");
  await openLayers(page); await page.getByRole("button", { name: "Zoom to Malapert NAC image", exact: true }).click();
  await page.getByRole("button", { name: "Close layers", exact: true }).click(); await expect(page.getByLabel("Map zoom")).toHaveText("z8 / 12");
  for (let step = 0; step < 3; step++) await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByLabel("Map zoom")).toHaveText("z11 / 12");
});
