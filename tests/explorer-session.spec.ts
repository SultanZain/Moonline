/**
 * Check portable exploration state, calendar integrity and confirmed import workflows.
 * Candidate inputs are test fixtures; intercepted raster tiles remain visibly synthetic assets.
 * @author Sultan
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  explorerSessionLink, missionTimeToUtc, readCandidateFile, readExplorerSession,
} from "../src/components/explorer/explorer-session";
import { mockMoonTrekTiles } from "./helpers/moon-trek";

const legacyFile = {
  kind: "moonline-candidate-locations", coordinateSystem: "Moon 2000 spherical map",
  latitudeUnit: "degrees", longitudeUnit: "degrees", longitudeDirection: "east",
  missionTimeUtc: "2024-02-29T12:30:00.000Z",
  sites: [{ latitude: -20, longitude: 12, name: "Imported label" }],
  analysis: { status: "not_calculated" },
};
const rawSession = {
  version: 1, selected: { latitude: -20, longitude: 12 }, sites: [{ latitude: -20, longitude: 12 }],
  missionTimeUtc: "2024-02-29T12:30:00.000Z",
  view: { mode: "south", basemap: "relief", center: [1_100_000, 0], zoom: 12, overlays: [{ id: "mosaic", opacity: 0 }] },
};

test("UI UTC times preserve explicit minutes and reject calendar rollover", () => {
  expect(missionTimeToUtc("2024-02-29T12:30")).toBe("2024-02-29T12:30:00.000Z");
  expect(missionTimeToUtc("2000-02-29T00:00")).toBe("2000-02-29T00:00:00.000Z");
  for (const invalid of ["", "2026-02-29T12:30", "1900-02-29T12:30", "2024-04-31T12:30", "2024-01-01T24:00",
    "2024-01-01T12:60", "2024-01-01T12:30Z", "2024-01-01T12:30:01", "0000-01-01T00:00"]) expect(missionTimeToUtc(invalid)).toBeNull();
});

test("legacy candidate files remain loadable without inventing missing view or time data", () => {
  expect(readCandidateFile(JSON.stringify(legacyFile))).toEqual({ selected: legacyFile.sites[0], sites: legacyFile.sites,
    missionTimeUtc: "2024-02-29T12:30:00.000Z", view: null });
  expect(readCandidateFile(JSON.stringify({ ...legacyFile, missionTimeUtc: null }))?.missionTimeUtc).toBeNull();
  for (const invalidTime of ["2026-02-29T12:30:00.000Z", "2024-02-29T12:30:00+05:00", "2024-02-29T12:30", 0, ""]) {
    expect(readCandidateFile(JSON.stringify({ ...legacyFile, missionTimeUtc: invalidTime }))).toBeNull();
  }
});

test("candidate imports reject unsupported conventions, fabricated results and duplicate physical points", () => {
  const invalid = [
    { ...legacyFile, coordinateSystem: "WGS84" }, { ...legacyFile, longitudeDirection: "west" }, { ...legacyFile, version: 2 },
    { ...legacyFile, analysis: { status: "calculated", sunElevation: 40 } }, { ...legacyFile, sites: [] },
    { ...legacyFile, sites: Array.from({ length: 4 }, (_, latitude) => ({ latitude, longitude: 0 })) },
    { ...legacyFile, sites: [{ latitude: "0", longitude: 0 }] }, { ...legacyFile, sites: [{ latitude: 91, longitude: 0 }] },
    { ...legacyFile, sites: [{ latitude: null, longitude: 0 }] },
    { ...legacyFile, sites: [{ latitude: 0, longitude: 180 }, { latitude: 0, longitude: -180 }] },
    { ...legacyFile, sites: [{ latitude: -90, longitude: 40 }, { latitude: -90, longitude: -40 }] },
    { ...legacyFile, sites: [{ latitude: 0, longitude: 0, name: "x".repeat(121) }] },
  ];
  for (const file of invalid) expect(readCandidateFile(JSON.stringify(file))).toBeNull();
  expect(readCandidateFile('{"sites":')).toBeNull();
});

test("shared polar views keep rectangular-grid coordinates, source zoom limits and zero opacity", () => {
  const search = new URLSearchParams({ session: JSON.stringify(rawSession) }).toString();
  expect(readExplorerSession(search)).toEqual({ status: "ready", session: rawSession });
  const invalidViews = [
    { ...rawSession.view, zoom: 13 }, { ...rawSession.view, zoom: 12, overlays: [] },
    { ...rawSession.view, center: [1e100, 0] }, { ...rawSession.view, center: [null, 0] },
    { ...rawSession.view, overlays: [{ id: "fake-layer", opacity: 1 }] },
    { ...rawSession.view, overlays: [{ id: "mosaic", opacity: -1 }] },
    { ...rawSession.view, overlays: [{ id: "mosaic", opacity: 0 }, { id: "mosaic", opacity: 1 }] },
    { ...rawSession.view, mode: "global", center: [181, 0], zoom: 4 },
  ];
  for (const view of invalidViews) expect(readExplorerSession(new URLSearchParams({ session: JSON.stringify({ ...rawSession, view }) }).toString())).toEqual({ status: "invalid" });
});

test("malformed and oversized session links are rejected atomically", () => {
  expect(readExplorerSession("?q=Shackleton")).toEqual({ status: "empty" });
  expect(readExplorerSession("?session=null")).toEqual({ status: "invalid" });
  expect(readExplorerSession("?session={")).toEqual({ status: "invalid" });
  expect(readExplorerSession(`?session=${"x".repeat(8193)}`)).toEqual({ status: "invalid" });
  const valid = new URLSearchParams({ session: JSON.stringify(rawSession) });
  valid.append("session", JSON.stringify(rawSession));
  expect(readExplorerSession(valid.toString())).toEqual({ status: "invalid" });
});

test("sharing retains unrelated URL settings and the navigation fragment", () => {
  const read = readExplorerSession(new URLSearchParams({ session: JSON.stringify(rawSession) }).toString());
  expect(read.status).toBe("ready");
  if (read.status !== "ready") throw new Error("Invalid test input");
  const url = new URL(explorerSessionLink(read.session, "https://moonline.example/explorer?source=review#main-content"));
  expect(url.searchParams.get("source")).toBe("review"); expect(url.hash).toBe("#main-content");
  expect(JSON.parse(url.searchParams.get("session") ?? "null")).toMatchObject({ missionTimeUtc: "2024-02-29T12:30:00.000Z", sites: [{ latitude: -20, longitude: 12 }] });
});

const inspector = (page: Page) => page.getByRole("complementary", { name: "Site inspector", exact: true });
const candidates = (page: Page) => inspector(page).getByRole("region", { name: "Candidate locations", exact: true }).getByRole("listitem");
async function select(page: Page, latitude: string, longitude: string) {
  await page.getByRole("button", { name: "Go to coordinates", exact: true }).click();
  await page.locator("#map-latitude").fill(latitude); await page.locator("#map-longitude").fill(longitude);
  await page.getByRole("button", { name: "Go to location", exact: true }).click();
}

test.describe("portable Explorer workflow", () => {
  test.use({ reducedMotion: "reduce" });
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); await mockMoonTrekTiles(page); });

  test("shared links reopen candidates, UTC input, camera and overlays in one map", async ({ page }) => {
    await page.addInitScript(() => {
      let copied = "";
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: async (value: string) => { copied = value; }, readText: async () => copied,
      } });
    });
    await page.goto("/explorer"); await select(page, "0", "10");
    await inspector(page).getByRole("button", { name: "Add candidate", exact: true }).click();
    await select(page, "-85.81", "-3.6");
    await inspector(page).getByRole("button", { name: "Add candidate", exact: true }).click();
    await page.locator("#mission-time").fill("2024-02-29T12:30");
    await page.getByRole("button", { name: "Map layers", exact: true }).click();
    await page.getByLabel("Malapert NAC image", { exact: true }).check();
    await page.locator("#opacity-mosaic").press("Home");
    await expect(page.locator("#opacity-mosaic")).toHaveValue("0");
    await page.getByRole("button", { name: "Close layers", exact: true }).click();
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(page.getByLabel("Map zoom")).toHaveText("z7 / 12");
    await page.getByRole("button", { name: "Open site inspector", exact: true }).click();
    await inspector(page).getByRole("button", { name: "Copy exploration link", exact: true }).click();
    await expect(inspector(page).getByRole("button", { name: "Link copied", exact: true })).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain("session=");
    await page.goto(link);
    await expect(inspector(page).locator(".site-coordinates dd")).toHaveText(["-85.8100°", "-3.6000°"]);
    await expect(candidates(page)).toHaveCount(2); await expect(page.locator("#mission-time")).toHaveValue("2024-02-29T12:30");
    await expect(page.getByLabel("Map zoom")).toHaveText("z7 / 12");
    await expect(page.locator(".ol-viewport")).toHaveCount(1);
    await page.getByRole("button", { name: "Map layers", exact: true }).click();
    await expect(page.getByLabel("Malapert NAC image", { exact: true })).toBeChecked();
    await expect(page.locator("#opacity-mosaic")).toHaveValue("0"); await expect(page.getByText("Hidden", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Relief", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("reload and Methodology's Back to Explorer link restore the saved exploration", async ({ page }) => {
    await page.goto("/explorer"); await select(page, "-20", "12");
    await inspector(page).getByRole("button", { name: "Add candidate", exact: true }).click();
    await page.locator("#mission-time").fill("2026-11-14T09:10");
    await expect.poll(() => new URL(page.url()).searchParams.get("session")).toContain("2026-11-14T09:10:00.000Z");
    await page.reload();
    await expect(inspector(page).locator(".site-coordinates dd")).toHaveText(["-20.0000°", "12.0000°"]);
    await expect(candidates(page)).toHaveCount(1); await expect(page.locator("#mission-time")).toHaveValue("2026-11-14T09:10");
    await inspector(page).getByRole("link", { name: "Methodology", exact: true }).click();
    await expect(page).toHaveURL(/\/methodology$/);
    await page.getByRole("link", { name: "Back to Explorer", exact: true }).click();
    await expect(page).toHaveURL(/\/explorer(?:\?|$)/);
    await expect(candidates(page)).toHaveCount(1); await expect(page.locator("#mission-time")).toHaveValue("2026-11-14T09:10");
    await expect(inspector(page).locator(".site-coordinates dd")).toHaveText(["-20.0000\u00b0", "12.0000\u00b0"]);
    await page.locator("#mission-time").fill("");
    await inspector(page).getByRole("link", { name: "Methodology", exact: true }).click();
    await expect(page).toHaveURL(/\/methodology$/);
    await page.getByRole("link", { name: "Back to Explorer", exact: true }).click();
    await expect(candidates(page)).toHaveCount(1);
    await expect(page.locator("#mission-time")).toHaveValue("");
    await expect(page.getByRole("region", { name: "Analysis results", exact: true })).toHaveCount(0);
  });

  test("import previews and cancellation preserve work; confirmed imports can be undone through Back", async ({ page }) => {
    await page.goto("/explorer"); await select(page, "0", "10");
    await inspector(page).getByRole("button", { name: "Add candidate", exact: true }).click();
    await page.locator("#mission-time").fill("2026-11-14T09:10");
    const upload = { name: "candidates.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(legacyFile)) };
    await page.getByLabel("Candidate file", { exact: true }).setInputFiles(upload);
    await expect(page.getByRole("region", { name: "Import preview", exact: true })).toBeVisible();
    await expect(page.getByText("Replaces the current sites and mission time.", { exact: true })).toBeVisible();
    await expect(inspector(page).locator(".site-coordinates dd")).toHaveText(["0.0000°", "10.0000°"]);
    await expect(page.locator("#mission-time")).toHaveValue("2026-11-14T09:10");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(inspector(page).getByRole("button", { name: "Import sites", exact: true })).toBeFocused();
    await page.getByLabel("Candidate file", { exact: true }).setInputFiles(upload);
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(inspector(page).locator(".site-coordinates dd")).toHaveText(["-20.0000°", "12.0000°"]);
    await expect(page.locator("#mission-time")).toHaveValue("2024-02-29T12:30");
    await expect(candidates(page)).toHaveCount(1);
    await page.goBack();
    await expect(inspector(page).locator(".site-coordinates dd")).toHaveText(["0.0000°", "10.0000°"]);
    await expect(page.locator("#mission-time")).toHaveValue("2026-11-14T09:10");
    await expect(candidates(page)).toHaveCount(1);
  });

  test("invalid and oversized files leave the selected location and time untouched", async ({ page }) => {
    await page.goto("/explorer"); await select(page, "0", "10"); await page.locator("#mission-time").fill("2026-11-14T09:10");
    await page.getByLabel("Candidate file", { exact: true }).setInputFiles({ name: "wrong.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ ...legacyFile, coordinateSystem: "WGS84" })) });
    await expect(inspector(page).getByRole("alert")).toContainText("Invalid candidate file");
    await expect(inspector(page).locator(".site-coordinates dd")).toHaveText(["0.0000°", "10.0000°"]);
    await expect(page.locator("#mission-time")).toHaveValue("2026-11-14T09:10");
    await page.getByLabel("Candidate file", { exact: true }).setInputFiles({ name: "large.json", mimeType: "application/json", buffer: Buffer.alloc(16_385, 32) });
    await expect(inspector(page).getByRole("alert")).toContainText("File is too large");
    await expect(page.locator("#mission-time")).toHaveValue("2026-11-14T09:10");
  });

  test("clipboard failure supplies a selectable exploration link", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true,
      value: { writeText: async () => { throw new Error("Clipboard denied"); } } }));
    await page.goto("/explorer"); await select(page, "0", "10");
    await inspector(page).getByRole("button", { name: "Copy exploration link", exact: true }).click();
    await expect(inspector(page).getByRole("status")).toHaveText("Copy unavailable. Select the link below.");
    const field = page.getByRole("textbox", { name: "Exploration link", exact: true });
    await expect(field).toBeVisible(); await expect(field).toHaveValue(/session=/); await field.focus();
    expect(await field.evaluate(element => element instanceof HTMLInputElement && element.selectionStart === 0 && element.selectionEnd === element.value.length)).toBe(true);
  });

  test("invalid shared state opens a working default map with an explicit error", async ({ page }) => {
    await page.addInitScript(saved => sessionStorage.setItem("moonline-exploration", saved),
      `?${new URLSearchParams({ session: JSON.stringify(rawSession) })}`);
    const query = new URLSearchParams({ session: JSON.stringify({ ...rawSession, view: { ...rawSession.view, zoom: 13 } }) });
    await page.goto(`/explorer?${query}`);
    const exploration = page.getByRole("region", { name: "Lunar exploration", exact: true });
    await expect(exploration.getByRole("alert")).toHaveText("Invalid exploration link. The map opened at its default view.");
    await expect(page.getByRole("status", { name: "Imagery status", exact: true })).toHaveText("Imagery loaded · coverage varies");
    await expect(page.getByLabel("Map zoom")).toHaveText("z2 / 8"); await expect(inspector(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Dismiss link error", exact: true }).click(); await expect(exploration.getByRole("alert")).toHaveCount(0);
    await select(page, "0", "10"); await expect(inspector(page).locator(".site-coordinates dd")).toHaveText(["0.0000°", "10.0000°"]);
  });

  test("a valid shared URL takes priority over an older saved exploration", async ({ page }) => {
    await page.addInitScript(saved => sessionStorage.setItem("moonline-exploration", saved),
      `?${new URLSearchParams({ session: JSON.stringify(rawSession) })}`);
    const explicit = {
      version: 1, selected: { latitude: 0, longitude: 10, name: "Shared location" },
      sites: [{ latitude: 0, longitude: 10, name: "Shared location" }], missionTimeUtc: "2026-11-15T09:10:00.000Z",
      view: { mode: "global", basemap: "imagery", center: [10, 0], zoom: 3, overlays: [] },
    };
    await page.goto(`/explorer?${new URLSearchParams({ session: JSON.stringify(explicit) })}`);
    await expect(candidates(page)).toHaveCount(1);
    await expect(candidates(page)).toContainText("Shared location");
    await expect(inspector(page).locator(".site-coordinates dd")).toHaveText(["0.0000\u00b0", "10.0000\u00b0"]);
    await expect(page.locator("#mission-time")).toHaveValue("2026-11-15T09:10");
    await expect(page.getByLabel("Map zoom")).toHaveText("z3 / 8");
    const restored = readExplorerSession(new URL(page.url()).search);
    expect(restored.status).toBe("ready");
    if (restored.status !== "ready") throw new Error("Valid shared exploration was not restored.");
    expect(restored.session.sites).toEqual(explicit.sites);
    expect(restored.session.selected).toEqual(explicit.selected);
    expect(restored.session.missionTimeUtc).toBe(explicit.missionTimeUtc);
  });

  test("invalid saved exploration is ignored when the Explorer URL has no session", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("moonline-exploration", "?session={"));
    await page.goto("/explorer");
    await expect(page.locator(".ol-viewport")).toHaveCount(1);
    await expect(page.getByLabel("Map zoom")).toHaveText("z2 / 8");
    await expect(inspector(page)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Lunar exploration", exact: true }).getByRole("alert")).toHaveCount(0);
    await select(page, "0", "10");
    await expect(inspector(page).locator(".site-coordinates dd")).toHaveText(["0.0000\u00b0", "10.0000\u00b0"]);
  });

  test("mobile imports remain usable in the fullscreen sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => false }));
    await page.goto("/explorer"); await page.getByRole("button", { name: "Fullscreen map", exact: true }).click();
    await page.getByRole("button", { name: "Open site inspector", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Site inspector", exact: true });
    const longLabels = { ...legacyFile, sites: [{ latitude: -20, longitude: 12, name: "X".repeat(120), featureType: "Y".repeat(80) }] };
    await sheet.getByLabel("Candidate file", { exact: true }).setInputFiles({ name: "sites.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(longLabels)) });
    await expect(sheet.getByRole("region", { name: "Import preview", exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Import", exact: true }).click();
    await expect(sheet.locator(".site-coordinates dd")).toHaveText(["-20.0000°", "12.0000°"]);
    await expect(sheet.locator("#mission-time")).toHaveValue("2024-02-29T12:30");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    expect(await sheet.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.keyboard.press("Escape"); await expect(sheet).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Open site inspector", exact: true })).toBeFocused();
    await expect(page.getByRole("dialog", { name: "Lunar exploration", exact: true })).toBeVisible();
  });

  test("new candidate exports restore their selected site and map settings", async ({ page }) => {
    await page.goto("/explorer"); await select(page, "-85.81", "-3.6");
    await inspector(page).getByRole("button", { name: "Add candidate", exact: true }).click();
    await page.locator("#mission-time").fill("2026-11-14T09:10");
    await page.getByRole("button", { name: "Map layers", exact: true }).click();
    await page.getByRole("button", { name: "Zoom to Malapert NAC image", exact: true }).click();
    await expect(page.getByLabel("Map zoom")).toHaveText("z8 / 12");
    await page.getByRole("button", { name: "Close layers", exact: true }).click();
    await page.getByRole("button", { name: "Open site inspector", exact: true }).click();
    const downloading = page.waitForEvent("download");
    await inspector(page).getByRole("button", { name: "Export sites", exact: true }).click();
    const download = await downloading;
    const path = await download.path(); if (!path) throw new Error("Missing candidate export");
    const contents = readFileSync(path, "utf8");
    expect(JSON.parse(contents)).toMatchObject({
      version: 1, missionTimeUtc: "2026-11-14T09:10:00.000Z", analysis: { status: "not_calculated" },
      selected: { latitude: -85.81, longitude: -3.6 },
      view: { mode: "south", basemap: "relief", zoom: 8, center: [-11_329.5, 123_592.5], overlays: [{ id: "mosaic", opacity: 1 }] },
    });
    await page.goto("/explorer");
    await expect(inspector(page)).toBeVisible();
    await page.getByLabel("Candidate file", { exact: true }).setInputFiles({ name: "moonline-candidates.json", mimeType: "application/json", buffer: Buffer.from(contents) });
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(inspector(page).locator(".site-coordinates dd")).toHaveText(["-85.8100°", "-3.6000°"]);
    await expect(page.locator("#mission-time")).toHaveValue("2026-11-14T09:10");
    await expect(page.getByLabel("Map zoom")).toHaveText("z8 / 12");
    await expect(candidates(page)).toHaveCount(1);
  });

  test("panning avoids repeated history writes until the view settles", async ({ page }) => {
    await page.addInitScript(() => {
      let writes = 0;
      const replace = window.history.replaceState.bind(window.history);
      window.history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => { writes++; replace(data, unused, url); };
      Object.defineProperty(window, "explorationHistoryWrites", { get: () => writes });
    });
    await page.goto("/explorer");
    await expect(page.getByRole("status", { name: "Imagery status", exact: true })).toHaveText("Imagery loaded · coverage varies");
    const baseline = await page.evaluate(() => Number(Reflect.get(window, "explorationHistoryWrites")));
    const box = await page.getByRole("region", { name: "Lunar imagery map", exact: true }).boundingBox();
    if (!box) throw new Error("Map is unavailable");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 200, y + 20, { steps: 40 });
    expect(await page.evaluate(() => Number(Reflect.get(window, "explorationHistoryWrites")))).toBeLessThanOrEqual(baseline + 1);
    await page.mouse.up();
    await expect.poll(() => new URL(page.url()).searchParams.has("session")).toBe(true);
    expect(await page.evaluate(() => Number(Reflect.get(window, "explorationHistoryWrites")))).toBeLessThanOrEqual(baseline + 2);
  });
});
