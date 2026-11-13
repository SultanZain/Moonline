/**
 * Configure NASA Moon Trek basemaps, polar overlays and their published tile matrices.
 * Map coordinates describe the lunar map; they do not define an astronomical observer.
 * @author Sultan
 */
export type MoonTrekMode = "global" | "south";
export type MoonTrekBasemap = "imagery" | "relief";
export type MoonTrekOverlayId = "polar-detail" | "hillshade" | "mosaic" | "polar-slope" | "count";
export type MoonTrekLayerId = MoonTrekOverlayId | "global-imagery" | "global-relief" | "polar-imagery" | "polar-relief";

export const moonRadiusMetres = 1_737_400;
export const moonTrekOverlayIds: readonly MoonTrekOverlayId[] = ["polar-detail", "hillshade", "mosaic", "polar-slope", "count"];
export const moonTrekNomenclatureUrl = "https://trek.nasa.gov/moon/trekarcgis/rest/services/CombinedNomenclature/MapServer/0";

export const moonTrekGrid = {
  origin: [-1_095_930, 1_095_930],
  // Polar grids use metres. Global grids use 360° / (2 × 256) = 0.703125° per pixel.
  baseScaleDenominator: 30_578_404.017857101,
  pixelSizeMetres: 0.00028,
  tileSize: 256,
  matrixSet: "default028mm",
} as const;

type MoonTrekLayer = {
  layer: string;
  mode: MoonTrekMode;
  format: "png" | "jpg";
  label: string;
  notice: string;
  description: string;
  coverage: string;
  maxZoom: number;
  home: { center: [number, number]; zoom: number };
  zeroIsNoData: boolean;
};

export const moonTrekBasemaps: Record<MoonTrekMode, Record<MoonTrekBasemap, MoonTrekLayerId>> = {
  global: { imagery: "global-imagery", relief: "global-relief" },
  south: { imagery: "polar-imagery", relief: "polar-relief" },
};

// Basemap names come from NASA's basemapList.json; matrix bounds come from each WMTS XML.
// The Malapert centre is the projected reference verified in PR #6.
export const moonTrekLayers: Record<MoonTrekLayerId, MoonTrekLayer> = {
  "global-imagery": {
    layer: "LRO_WAC_Mosaic_Global_303ppd_v02", mode: "global", format: "jpg",
    label: "LROC WAC imagery", maxZoom: 8, home: { center: [0, 0], zoom: 1 }, zeroIsNoData: false,
    coverage: "Global lunar coverage",
    notice: "Captured imagery · not mission-time illumination",
    description: "NASA's global LROC Wide Angle Camera mosaic. Its JPEG tile matrix covers −180° to 180° longitude and −90° to 90° latitude. Image lighting comes from the source observations.",
  },
  "global-relief": {
    layer: "LRO_LOLA_ClrShade_Global_256ppd_v06", mode: "global", format: "png",
    label: "LOLA global relief", maxZoom: 6, home: { center: [0, 0], zoom: 1 }, zeroIsNoData: false,
    coverage: "Global lunar coverage",
    notice: "Fixed hillshade · not mission-time illumination",
    description: "Colorized shaded relief derived from LOLA topography. The visual tiles are not numeric elevations and cannot supply a terrain horizon.",
  },
  "polar-imagery": {
    layer: "LRO_WAC_Mosaic_SPole60_100mp", mode: "south", format: "png",
    label: "LROC WAC polar imagery", maxZoom: 4, home: { center: [0, 0], zoom: 4 }, zeroIsNoData: false,
    coverage: "South-polar coverage to 60°S",
    notice: "Captured imagery · coverage includes gaps",
    description: "NASA's south-polar WAC basemap. Its published tile pyramid ends at zoom 4; higher-resolution overlays retain their own zoom limits.",
  },
  "polar-relief": {
    layer: "LRO_LOLA_Shade_SPole75_30mp_v04", mode: "south", format: "png",
    label: "LOLA polar relief", maxZoom: 6, home: { center: [0, 0], zoom: 5 }, zeroIsNoData: false,
    coverage: "South-polar coverage to 75°S",
    notice: "Fixed hillshade · not mission-time illumination",
    description: "Broad south-polar shaded relief from LOLA. This is a visual topography layer; the numeric DEM and a terrain-horizon calculation are separate scientific inputs.",
  },
  "polar-detail": {
    layer: "LRO_LOLA_Shade_SPole875_5mp_v04", mode: "south", format: "png",
    label: "Polar terrain detail", maxZoom: 9, home: { center: [0, 0], zoom: 7 }, zeroIsNoData: false,
    coverage: "87.5–90°S",
    notice: "Fixed hillshade · not mission-time illumination",
    description: "Detailed LOLA hillshade near the south pole. The source uses fixed lighting; it does not show shadows at the selected mission time.",
  },
  hillshade: {
    layer: "LRO_NAC_Shade_86S356E_3mp",
    mode: "south", format: "png", zeroIsNoData: true,
    label: "Malapert hillshade",
    notice: "Fixed lighting · not mission-time illumination",
    description: "A shaded image of a DEM with fixed lighting. It does not show the Sun at a mission date or provide terrain heights.",
    coverage: "Regional coverage around Malapert",
    maxZoom: 9,
    home: { center: [-11_329.5, 123_592.5], zoom: 8 },
  },
  mosaic: {
    layer: "LRO_NAC_Mosaic_86S356E_50cmp",
    mode: "south", format: "png", zeroIsNoData: true,
    label: "Malapert NAC image",
    notice: "Regional imagery · coverage includes gaps",
    description: "A regional lunar image mosaic. Blank areas can be outside the published imagery coverage.",
    coverage: "Regional coverage around Malapert",
    maxZoom: 12,
    home: { center: [-11_329.5, 123_592.5], zoom: 8 },
  },
  "polar-slope": {
    layer: "ColorSlope_LRO_LOLA_DEM_SPole875_5mp_v04", mode: "south", format: "png",
    label: "Polar slopes", maxZoom: 10, home: { center: [0, 0], zoom: 7 }, zeroIsNoData: false,
    coverage: "87.5–90°S",
    notice: "Source slope classes · not a landing-safety assessment",
    description: "NASA's colorized LOLA slope layer. The published legend gives slope classes in degrees. Colors do not supply an exact point measurement or establish a safe landing site.",
  },
  count: {
    layer: "LRO_LOLA_Count_SPole45_100mp_v04",
    mode: "south", format: "png", zeroIsNoData: false,
    label: "LOLA shot count",
    notice: "Shot counts · no terrain-height measurements",
    description: "A visual layer of laser shots per pixel. Coverage varies by longitude; this layer does not provide terrain heights.",
    coverage: "Published coverage between 45°S and 90°S",
    maxZoom: 4,
    home: { center: [0, 0], zoom: 1 },
  },
};

export function moonTrekLayerUrl(id: MoonTrekLayerId) {
  const layer = moonTrekLayers[id];
  return `https://trek.nasa.gov/tiles/Moon/${layer.mode === "global" ? "EQ" : "SP"}/${layer.layer}/1.0.0`;
}

export function moonTrekMetadataUrl(id: MoonTrekLayerId) {
  return `https://trek.nasa.gov/moon/TrekWS/rest/cat/metadata/fgdc/html?label=${moonTrekLayers[id].layer}`;
}

export const moonTrekSlopeLegendUrl = "https://trek.nasa.gov/moon/TrekWS/rest/cat/legend/stream?label=ColorSlope_LRO_LOLA_DEM_SPole875_5mp_v04";
