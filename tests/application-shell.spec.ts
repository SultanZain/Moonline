/**
 * Verify working routes, explicit availability, keyboard focus and viewport composition.
 * @author Sultan
 */
import { expect, test } from "@playwright/test";

test("root opens Explorer and navigation reaches methodology", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page).toHaveURL(/\/explorer$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mission Explorer");
  await expect(page.getByRole("link", { name: "Mission Explorer", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Map not connected", { exact: true })).toBeVisible();
  await expect(page.getByText("Not calculated", { exact: true })).toHaveCount(3);
  await page.getByRole("link", { name: "Read the methodology" }).click();
  await expect(page).toHaveURL(/\/methodology$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Methodology");
  await expect(page.getByRole("link", { name: "Methodology", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("There are no scientific results in this workspace", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Back to Explorer" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mission Explorer");
});

test("skip link moves keyboard focus to the workspace", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/explorer");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("mobile sheet traps focus, restores it on Escape and closes after navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explorer");
  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Moonline navigation" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close navigation" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("link", { name: "Mission Explorer", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Close navigation" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("link", { name: "Mission Explorer", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("link", { name: "Methodology", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/methodology$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Methodology");
});

for (const width of [390, 768, 1024]) {
  test(`site context is keyboard accessible at ${width}px and closes when desktop context appears`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/explorer");
    const trigger = page.getByRole("button", { name: "Site context", exact: true });
    const desktop = page.getByRole("complementary", { name: "Site and analysis context" });
    await expect(desktop).not.toBeVisible();
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Site context", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("No location selected", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Not calculated", { exact: true })).toHaveCount(3);
    await expect(dialog.getByText("Unavailable", { exact: true })).toBeVisible();
    const close = dialog.getByRole("button", { name: "Close site context" });
    await expect(close).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("context.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(dialog).not.toBeVisible();
    await expect(desktop).toBeVisible();
    await expect(page.getByRole("main")).toBeFocused();
    await expect(trigger).not.toBeVisible();
  });
}

for (const width of [390, 768, 1024, 1440]) {
  for (const route of ["/explorer", "/methodology"]) {
    test(`${route} fits ${width}px and has no browser errors`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible({ visible: width < 1024 });
      expect(errors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath("workspace.png"), fullPage: true });
    });
  }
}
