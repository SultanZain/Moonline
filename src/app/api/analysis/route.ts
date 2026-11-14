/** Present a bounded lunar geometry endpoint with stable, recoverable failures. @author Sultan */
import { NextResponse } from "next/server";
import { analyzeMission, HorizonsFailure } from "@/lib/api/lunar-horizons";
import { validateMissionInput } from "@/lib/validation/mission-analysis";

export const maxDuration = 60;
export async function POST(request: Request) {
  let value: unknown;
  try {
    if (Number(request.headers.get("content-length")) > 8192) return NextResponse.json({ status: "error", message: "Request is too large." }, { status: 413 });
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 8192) return NextResponse.json({ status: "error", message: "Request is too large." }, { status: 413 });
    value = JSON.parse(body);
  } catch { return NextResponse.json({ status: "error", message: "Provide a valid analysis request." }, { status: 400 }); }
  const validation = validateMissionInput(value);
  if (!validation.success) return NextResponse.json({ status: "error", message: validation.issues[0]?.message ?? "Invalid analysis inputs.", issues: validation.issues }, { status: 400 });
  try {
    const analysis = await analyzeMission(validation.input, request.signal);
    return NextResponse.json({ status: "ready", analysis }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof HorizonsFailure ? error.message : "Analysis could not be completed. Retry shortly.";
    return NextResponse.json({ status: "error", message }, { status: error instanceof HorizonsFailure && error.code === "busy" ? 503 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
