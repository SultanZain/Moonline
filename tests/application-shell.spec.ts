/**
 * Verify navigation, contextual mobile sheets and the map-first responsive application shell.
 * @author Sultan
 */
import { expect, test } from "@playwright/test";
import { mockMoonTrekTiles } from "./helpers/moon-trek";

test.beforeEach(async ({ page }) => { await mockMoonTrekTiles(page); });

test("root opens Explorer and navigation reaches methodology", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/");
  await expect(page).toHaveURL(/\/explorer$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mission Explorer");
  await expect(page.getByRole("link", { name: "Mission Explorer", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("region", { name: "Lunar imagery map" })).toBeVisible();
  await page.getByRole("link", { name: "Methodology", exact: true }).click();
  await expect(page).toHaveURL(/\/methodology$/); await expect(page.getByRole("heading", { level: 1 })).toHaveText("Methodology");
  await expect(page.getByText("Explorer and Site comparison use live Sun/Earth geometry", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Back to Explorer" }).click();
  await expect(page.getByRole("region", { name: "Lunar imagery map" })).toBeVisible();
});

test("skip link moves keyboard focus to the workspace", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/explorer");
  await page.keyboard.press("Tab"); await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter"); await expect(page.getByRole("main")).toBeFocused();
});

test("mobile navigation traps focus, restores it and closes after navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/explorer");
  const trigger = page.getByRole("button", { name: "Open navigation" }); await trigger.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Moonline navigation" }); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close navigation" })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(dialog.getByRole("link", { name: "Mission Explorer", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(dialog.getByRole("button", { name: "Close navigation" })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await trigger.click(); await dialog.getByRole("link", { name: "Methodology", exact: true }).click();
  await expect(dialog).not.toBeVisible(); await expect(page).toHaveURL(/\/methodology$/);
});

for (const width of [390, 600]) {
  test(`selected-site context becomes a bottom sheet at ${width}px and survives resizing`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.goto("/explorer");
    await page.getByRole("button", { name: "Go to coordinates", exact: true }).click();
    await page.locator("#map-latitude").fill("-85.81"); await page.locator("#map-longitude").fill("-3.6");
    await page.getByRole("button", { name: "Go to location", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Site inspector", exact: true }); await expect(dialog).toBeVisible();
    await expect(dialog.locator(".site-coordinates dd")).toHaveText(["-85.8100°", "-3.6000°"]);
    await dialog.locator("#mission-time").fill("2026-11-13T12:30");
    await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Open site inspector", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Open site inspector", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(dialog).not.toBeVisible();
    const context = page.getByRole("complementary", { name: "Site inspector", exact: true }); await expect(context).toBeVisible();
    await expect(context.locator("#mission-time")).toHaveValue("2026-11-13T12:30");
  });
}

for (const width of [390, 768, 1024, 1440]) {
  for (const route of ["/explorer", "/methodology"]) {
    test(`${route} fits ${width}px without browser errors`, async ({ page }, testInfo) => {
      const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 }); await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      if (route === "/explorer") await expect(page.getByRole("region", { name: "Lunar imagery map" })).toBeVisible();
      else await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible({ visible: width < 1024 });
      expect(errors).toEqual([]); await page.screenshot({ path: testInfo.outputPath("workspace.png"), fullPage: true });
    });
  }
}
