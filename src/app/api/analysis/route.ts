/** Present a bounded lunar geometry endpoint with stable, recoverable failures. @author Sultan */
import { NextResponse } from "next/server";
import { analyzeMission, HorizonsFailure } from "@/lib/api/lunar-horizons";
import { validateMissionInput } from "@/lib/validation/mission-analysis";

export const maxDuration = 60;
const responseHeaders = { "Cache-Control": "no-store" };

function failure(message: string, status: number) {
  return NextResponse.json({ status: "error", message }, { status, headers: responseHeaders });
}

async function boundedBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > 8192) return null;
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      bytes += chunk.value.byteLength;
      if (bytes > 8192) { await reader.cancel(); return null; }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}

export async function POST(request: Request) {
  let value: unknown;
  try {
    const body = await boundedBody(request);
    if (body === null) return failure("Request is too large.", 413);
    value = JSON.parse(body);
  } catch { return failure("Provide a valid analysis request.", 400); }
  const validation = validateMissionInput(value);
  if (!validation.success) return NextResponse.json({ status: "error", message: validation.issues[0]?.message ?? "Invalid analysis inputs.", issues: validation.issues }, { status: 400, headers: responseHeaders });
  try {
    const analysis = await analyzeMission(validation.input, request.signal);
    return NextResponse.json({ status: "ready", analysis }, { headers: responseHeaders });
  } catch (error) {
    const message = error instanceof HorizonsFailure ? error.message : "Analysis could not be completed. Retry shortly.";
    return failure(message, error instanceof HorizonsFailure && error.code === "busy" ? 503 : 502);
  }
}
