/**
 * Search NASA's lunar nomenclature for bounded map-navigation results.
 * This fixed provider supplies map locations, not validated astronomical observers.
 * @author Sultan
 */
import { moonTrekNomenclatureUrl } from "@/config/moon-trek";
import { normalizeMapLongitude, type MapLocation } from "@/components/explorer/lunar-map-coordinates";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 64 || !/^[\p{L}\p{N}\s.'’(),-]+$/u.test(query)) {
    return Response.json({ error: "Enter a lunar name of 2–64 characters." }, { status: 400 });
  }
  // LABEL is populated in this service; its advertised display field, name, is blank.
  // Escape the SQL string literal and reject user wildcards before adding the prefix match.
  const escaped = query.toUpperCase().replaceAll("'", "''");
  const url = new URL(`${moonTrekNomenclatureUrl}/query`);
  url.search = new URLSearchParams({ f: "json", where: `UPPER(LABEL) LIKE '${escaped}%'`,
    outFields: "FID,LABEL,type", returnGeometry: "true" }).toString();
  try {
    const response = await fetch(url, { credentials: "omit", cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]) });
    if (!response.ok) throw new Error("Search unavailable");
    const payload: unknown = await response.json();
    if (!isRecord(payload) || "error" in payload || payload.geometryType !== "esriGeometryPoint" ||
      !Array.isArray(payload.features) || !isRecord(payload.spatialReference)) throw new Error("Invalid search data");
    const wkt = payload.spatialReference.wkt;
    const compactWkt = typeof wkt === "string" ? wkt.replaceAll(/\s+/g, "") : "";
    if (!compactWkt.startsWith("GEOGCS[") || !compactWkt.includes('SPHEROID["Moon",1737400.0,0.0]') ||
      !compactWkt.includes('PRIMEM["Reference_Meridian",0.0]') || !compactWkt.includes('UNIT["Degree",0.0174532925199433]')) throw new Error("Unsupported map coordinates");
    const results: (MapLocation & { id: number })[] = [];
    let omitted = 0;
    for (const feature of payload.features) {
      if (!isRecord(feature) || !isRecord(feature.attributes) || !isRecord(feature.geometry)) throw new Error("Invalid search data");
      const { FID: id, LABEL: label, type } = feature.attributes;
      const { x, y } = feature.geometry;
      if (typeof id !== "number" || !Number.isInteger(id) || typeof label !== "string") throw new Error("Invalid search data");
      if (typeof x !== "number" || !Number.isFinite(x) || Math.abs(x) > 180 ||
        typeof y !== "number" || !Number.isFinite(y) || Math.abs(y) > 90 || !label.trim()) { omitted++; continue; }
      results.push({ id, name: label.trim().slice(0, 120), latitude: y, longitude: normalizeMapLongitude(x),
        ...(typeof type === "string" && type.trim() ? { featureType: type.trim().slice(0, 80) } : {}) });
    }
    if (payload.features.length > 0 && results.length === 0) throw new Error("Location coordinates unavailable");
    results.sort((a, b) => (a.name?.length ?? 0) - (b.name?.length ?? 0));
    return Response.json({ results: results.slice(0, 8), omitted,
      source: { label: "NASA Moon Trek nomenclature", url: moonTrekNomenclatureUrl }, retrievedAt: new Date().toISOString() });
  } catch {
    return Response.json({ error: "NASA location search is unavailable. Try again or enter coordinates." }, { status: 502 });
  }
}
