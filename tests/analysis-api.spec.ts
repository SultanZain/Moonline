/** Verify analysis request boundaries through the production HTTP handler. @author Sultan */
import { request as httpRequest } from "node:http";
import { expect, test } from "@playwright/test";

const input = {
  observer: { latitude: -85, longitude: 20, heightMeters: 0, coordinateBasis: "adopted_mean_earth" },
  startUtc: "2026-11-14T00:00:00.000Z", endUtc: "2026-11-15T00:00:00.000Z", stepMinutes: 60,
};

async function rawPost(baseURL: string, chunks: (string | Buffer)[]): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(new URL("/api/analysis", baseURL), { method: "POST", headers: { "Content-Type": "application/json" } }, response => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { text += chunk; });
      response.on("end", () => {
        try { const body: unknown = JSON.parse(text); resolve({ status: response.statusCode ?? 0, body }); }
        catch (error) { reject(error); }
      });
      response.on("error", reject);
    });
    request.on("error", reject);
    for (const chunk of chunks) request.write(chunk);
    request.end();
  });
}

test("invalid observer, UTC and sampling inputs fail before requesting provider data", async ({ request }) => {
  for (const value of [
    [], {}, { ...input, observer: { ...input.observer, heightMeters: null } },
    { ...input, observer: { ...input.observer, coordinateBasis: "IAU_MOON" } },
    { ...input, observer: { ...input.observer, latitude: 90.0001 } },
    { ...input, startUtc: "2026-02-30T00:00:00.000Z" },
    { ...input, startUtc: "2026-11-14T05:00:00+05:00" },
    { ...input, endUtc: "2026-12-14T00:00:00.000Z", stepMinutes: 10 },
  ]) {
    const response = await request.post("/api/analysis", { data: value });
    expect(response.status()).toBe(400);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.json()).toMatchObject({ status: "error", message: expect.any(String) });
  }
});

test("malformed JSON, invalid UTF-8 and oversized bodies have bounded stable errors", async ({ request, baseURL }) => {
  if (!baseURL) throw new Error("Missing production server URL");
  for (const data of ["{", Buffer.from([0xff])]) {
    const response = await rawPost(baseURL, [data]);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ status: "error", message: "Provide a valid analysis request." });
  }
  const response = await request.post("/api/analysis", { data: "x".repeat(8193), headers: { "Content-Type": "application/json" } });
  expect(response.status()).toBe(413);
  expect(await response.json()).toEqual({ status: "error", message: "Request is too large." });
});

test("chunked UTF-8 bodies are bounded by bytes even without Content-Length", async ({ baseURL }) => {
  if (!baseURL) throw new Error("Missing production server URL");
  const response = await rawPost(baseURL, ["界".repeat(1400), "界".repeat(1400)]);
  expect(response.status).toBe(413);
  expect(response.body).toEqual({ status: "error", message: "Request is too large." });
});
