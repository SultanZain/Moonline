/**
 * Mock raster transport with clearly synthetic test tiles, including JPEG and verified NAC nodata.
 * The application never imports these fixtures or substitutes them for NASA imagery.
 * @author Sultan
 */
import { readFileSync } from "node:fs";
import type { Page, Route } from "@playwright/test";

export const moonTrekTiles = "https://trek.nasa.gov/tiles/Moon/**";
export const syntheticMoonTile = readFileSync("tests/fixtures/synthetic-moon-tile.png");
export const syntheticMoonJpeg = readFileSync("tests/fixtures/synthetic-moon-tile.jpg");
export const syntheticNacNodata = readFileSync("tests/fixtures/synthetic-nac-nodata.png");

export function fulfillMoonTile(route: Route) {
  const jpeg = route.request().url().endsWith(".jpg");
  return route.fulfill({ status: 200, contentType: jpeg ? "image/jpeg" : "image/png",
    body: jpeg ? syntheticMoonJpeg : syntheticMoonTile, headers: { "access-control-allow-origin": "*" } });
}

export async function mockMoonTrekTiles(page: Page) { await page.route(moonTrekTiles, fulfillMoonTile); }
