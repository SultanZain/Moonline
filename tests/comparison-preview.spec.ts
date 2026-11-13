/**
 * Verify the illustrative radar preview, keyboard interaction and truthful missing values.
 * @author Sultan
 */
import { expect, test } from "@playwright/test";

test("preview navigation, synthetic labels and keyboard profile controls work", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/explorer");
  await page.getByRole("link", { name: "Comparison preview", exact: true }).click();
  await expect(page).toHaveURL(/\/comparison-preview$/);
  await expect(page.getByRole("link", { name: "Comparison preview", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Illustrative UI preview" })).toBeVisible();
  await expect(page.getByText("Synthetic profiles, not real lunar sites.", { exact: false })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  const chart = page.locator(".comparison-radar");
  await expect(chart.locator("svg")).toBeVisible();
  const completePaths = await chart.locator("path").count();
  const profiles = page.getByRole("group", { name: "Visible radar profiles" });
  const first = profiles.getByRole("button", { name: "Example site A" });
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("status")).toHaveText("Example site B shown.");
  await expect.poll(() => chart.locator("path").count()).toBeLessThan(completePaths);
  await profiles.getByRole("button", { name: "Example site B" }).click();
  await expect(page.getByRole("status")).toContainText("Both profiles are hidden");
  await first.click();
  await expect(page.getByRole("status")).toHaveText("Example site A shown.");
  await page.getByRole("link", { name: "Back to Explorer" }).click();
  await expect(page).toHaveURL(/\/explorer$/);
});

test("missing axis is not plotted as zero and known values remain inspectable", async ({ page }) => {
  await page.goto("/comparison-preview");
  const chart = page.locator(".comparison-radar");
  await expect(chart.locator("svg")).toBeVisible();
  const completePaths = await chart.locator("path").count();
  await page.getByRole("button", { name: "Missing data" }).click();
  await expect(page.getByRole("status")).toContainText("Example site B has an unavailable axis; its entire shape is omitted.");
  await expect.poll(() => chart.locator("path").count()).toBeLessThan(completePaths);
  const axis = page.getByRole("button", { name: "Both above horizon", exact: true });
  await axis.focus();
  await page.keyboard.press("Enter");
  await expect(axis).toBeFocused();
  const detail = page.getByRole("region", { name: "Read an axis" });
  await expect(detail.getByText("42%", { exact: true })).toBeVisible();
  await expect(detail.getByText("Unavailable", { exact: true })).toBeVisible();
  await expect(detail.getByText("Difference unavailable.", { exact: false })).toBeVisible();
  await expect(detail.getByText("0%", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Earth above horizon", exact: true }).click();
  await expect(detail.getByText("82%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Complete data" }).click();
  await expect.poll(() => chart.locator("path").count()).toBe(completePaths);
  await page.getByRole("button", { name: "Both above horizon", exact: true }).click();
  await expect(detail.getByText("48%", { exact: true })).toBeVisible();
});

for (const width of [390, 768, 1024, 1440]) {
  test(`preview fits ${width}px in complete and missing states`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/comparison-preview");
    const chart = page.locator(".comparison-radar svg");
    await expect(chart).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const initialWidth = await chart.getAttribute("width");
    for (const scenario of ["Complete data", "Missing data"]) {
      await page.getByRole("button", { name: scenario, exact: true }).click();
      await page.getByRole("button", { name: "Both above horizon", exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const clippedLabels = await chart.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll("text")].filter(text => {
          const label = text.getBoundingClientRect();
          return label.left < bounds.left || label.right > bounds.right || label.top < bounds.top || label.bottom > bounds.bottom;
        }).map(text => text.textContent);
      });
      expect(clippedLabels).toEqual([]);
      await expect(page.getByRole("heading", { name: "Every axis, in detail" })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${scenario}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: width === 390 ? 768 : 390, height: 844 });
    await expect.poll(() => chart.getAttribute("width")).not.toBe(initialWidth);
    expect(errors).toEqual([]);
  });
}
