/**
 * Render lunar basemaps, transparent regional overlays and map-coordinate selection.
 * Every source keeps NASA's published matrix; requests are bounded and cancelled safely.
 * @author Sultan
 */
import OlMap from "ol/Map.js";
import View from "ol/View.js";
import ImageTile from "ol/ImageTile.js";
import TileState from "ol/TileState.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import Style from "ol/style/Style.js";
import CircleStyle from "ol/style/Circle.js";
import Fill from "ol/style/Fill.js";
import Stroke from "ol/style/Stroke.js";
import Text from "ol/style/Text.js";
import WMTS from "ol/source/WMTS.js";
import WMTSTileGrid from "ol/tilegrid/WMTS.js";
import Projection from "ol/proj/Projection.js";
import ScaleLine from "ol/control/ScaleLine.js";
import DragPan from "ol/interaction/DragPan.js";
import PinchZoom from "ol/interaction/PinchZoom.js";
import MouseWheelZoom from "ol/interaction/MouseWheelZoom.js";
import DoubleClickZoom from "ol/interaction/DoubleClickZoom.js";
import KeyboardPan from "ol/interaction/KeyboardPan.js";
import KeyboardZoom from "ol/interaction/KeyboardZoom.js";
import Kinetic from "ol/Kinetic.js";
import { containsCoordinate, extend } from "ol/extent.js";
import { unByKey } from "ol/Observable.js";
import type { EventsKey } from "ol/events.js";
import {
  moonRadiusMetres, moonTrekGrid, moonTrekBasemaps, moonTrekLayers, moonTrekLayerUrl, moonTrekOverlayIds,
  type MoonTrekMode, type MoonTrekBasemap, type MoonTrekLayerId, type MoonTrekOverlayId,
} from "@/config/moon-trek";
import { isMapLocation, normalizeMapLongitude, projectMapLocation, unprojectMapLocation, type MapLocation } from "./lunar-map-coordinates";

export type LunarMapState = "loading" | "ready" | "partial" | "error" | "outside-grid" | "no-coverage" | "hidden";
export type LunarMapSnapshot = {
  mode: MoonTrekMode;
  basemap: MoonTrekBasemap;
  zoom: number;
  maxZoom: number;
  layers: { id: MoonTrekLayerId; state: LunarMapState; opacity: number; role: "base" | "overlay" }[];
};
export type LunarMapHandle = {
  setMode: (mode: MoonTrekMode) => void;
  setBasemap: (basemap: MoonTrekBasemap) => void;
  setOverlay: (id: MoonTrekOverlayId, enabled: boolean) => void;
  setOpacity: (id: MoonTrekOverlayId, opacity: number) => void;
  focusLayer: (id: MoonTrekOverlayId) => void;
  navigate: (location: MapLocation) => void;
  setCandidates: (locations: readonly MapLocation[]) => void;
  zoomBy: (delta: number) => void;
  resetView: () => void;
  retry: () => void;
  dispose: () => void;
};

type TileCoordinate = { zoom: number; column: number; row: number };
type SourceSlot = {
  id: MoonTrekLayerId;
  layer: TileLayer<WMTS>;
  grid: WMTSTileGrid;
  pending: Set<ImageTile>;
  loaded: Map<string, TileCoordinate & { hasData: boolean }>;
  failed: Map<string, TileCoordinate>;
  keys: EventsKey[];
  abort: () => void;
};

const tileTimeoutMs = 15_000;
const polarBaseResolution = moonTrekGrid.baseScaleDenominator * moonTrekGrid.pixelSizeMetres;
const globalBaseResolution = 360 / (2 * moonTrekGrid.tileSize);

function createGrid(id: MoonTrekLayerId) {
  const layer = moonTrekLayers[id];
  return new WMTSTileGrid({
    origin: layer.mode === "global" ? [-180, 90] : [...moonTrekGrid.origin],
    tileSize: moonTrekGrid.tileSize,
    matrixIds: Array.from({ length: layer.maxZoom + 1 }, (_, zoom) => String(zoom)),
    resolutions: Array.from({ length: layer.maxZoom + 1 }, (_, zoom) =>
      (layer.mode === "global" ? globalBaseResolution : polarBaseResolution) / 2 ** zoom),
    // The published grid is 2:1, including polar services. Do not clip its second half.
    sizes: Array.from({ length: layer.maxZoom + 1 }, (_, zoom) => [2 ** (zoom + 1), 2 ** zoom]),
  });
}

export function createLunarMap(
  element: HTMLDivElement,
  scaleElement: HTMLDivElement,
  onState: (snapshot: LunarMapSnapshot) => void,
  onCursor: (location: MapLocation | null) => void,
  onSelect: (location: MapLocation) => void,
): LunarMapHandle {
  const projections = {
    global: new Projection({
      code: "MOONLINE:MOON_EQ", units: "degrees", extent: [-180, -90, 180, 90],
      metersPerUnit: moonRadiusMetres * Math.PI / 180,
      getPointResolution: (resolution, point) => point[1] === undefined ? Number.NaN :
        resolution * Math.cos(point[1] * Math.PI / 180),
    }),
    south: new Projection({
      code: "MOONLINE:MOON_SP", units: "m",
      getPointResolution: (resolution, point) => point[0] === undefined || point[1] === undefined ? Number.NaN :
        resolution / (1 + (point[0] ** 2 + point[1] ** 2) / (4 * moonRadiusMetres ** 2)),
    }),
  };
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const duration = motion.matches ? 0 : 180;
  const views = {
    global: new View({ projection: projections.global, center: [0, 0], zoom: 2,
      maxResolution: globalBaseResolution, minZoom: 0, maxZoom: 8, constrainResolution: true,
      extent: [-180, -90, 180, 90], constrainOnlyCenter: true, enableRotation: false }),
    south: new View({ projection: projections.south, center: [0, 0], zoom: 5,
      maxResolution: polarBaseResolution, minZoom: 0, maxZoom: 6, constrainResolution: true, enableRotation: false }),
  };
  const marker = new Feature<Point>();
  const tokens = getComputedStyle(element);
  const markerColor = tokens.getPropertyValue("--accent").trim();
  const markerOutline = tokens.getPropertyValue("--background").trim();
  const candidateColor = tokens.getPropertyValue("--content").trim();
  const markerSource = new VectorSource({ features: [marker] });
  const markerLayer = new VectorLayer({ source: markerSource, zIndex: 20, style: new Style({
    image: new CircleStyle({ radius: 7, fill: new Fill({ color: markerColor }), stroke: new Stroke({ color: markerOutline, width: 3 }) }),
  }) });
  const candidateSource = new VectorSource<Feature<Point>>();
  const candidateLayer = new VectorLayer({ source: candidateSource, zIndex: 19 });
  const map = new OlMap({
    target: element, view: views.global, layers: [candidateLayer, markerLayer],
    controls: [new ScaleLine({ target: scaleElement, units: "metric", minWidth: 80 })],
    // Six requests match the browser's HTTP/1 connection limit for the NASA host.
    maxTilesLoading: 6,
    interactions: [
      new DragPan({ kinetic: motion.matches ? undefined : new Kinetic(-0.005, 0.05, 100) }),
      new PinchZoom({ duration }), new MouseWheelZoom({ duration }), new DoubleClickZoom({ duration }),
      new KeyboardPan({ duration: 0 }), new KeyboardZoom({ duration: 0 }),
    ],
  });
  let mode: MoonTrekMode = "global";
  let basemap: MoonTrekBasemap = "imagery";
  let view = views.global;
  let stopped = false;
  let base: SourceSlot;
  let selected: MapLocation | null = null;
  let candidates: readonly MapLocation[] = [];
  let zoomTarget: number | undefined;
  let lastSnapshot: string | undefined;
  const overlays = new Map<MoonTrekOverlayId, SourceSlot>();
  const enabled = new Set<MoonTrekOverlayId>();
  const opacity = new Map<MoonTrekOverlayId, number>();

  function sourceState(slot: SourceSlot): LunarMapState {
    if (slot.layer.getOpacity() === 0) return "hidden";
    const size = map.getSize();
    const resolution = view.getResolution();
    if (!size || resolution === undefined) return "loading";
    const zoom = slot.grid.getZForResolution(resolution);
    const visible = slot.grid.getTileRangeForExtentAndZ(view.calculateExtent(size), zoom);
    const full = slot.grid.getFullTileRange(zoom);
    if (!full || !visible.intersects(full)) return "outside-grid";
    const total = (Math.min(full.maxX, visible.maxX) - Math.max(full.minX, visible.minX) + 1) *
      (Math.min(full.maxY, visible.maxY) - Math.max(full.minY, visible.minY) + 1);
    const inView = (tile: TileCoordinate) => tile.zoom === zoom &&
      visible.containsXY(tile.column, tile.row) && full.containsXY(tile.column, tile.row);
    let loaded = 0, failed = 0, data = 0;
    for (const tile of slot.loaded.values()) if (inView(tile)) { loaded++; if (tile.hasData) data++; }
    for (const tile of slot.failed.values()) if (inView(tile)) failed++;
    if (failed === total) return "error";
    // An observed failure must expose recovery even while other tiles are still pending.
    if (failed > 0) return "partial";
    if (loaded + failed < total) return "loading";
    return data === 0 ? "no-coverage" : "ready";
  }

  function publish() {
    if (stopped || !base) return;
    const zoom = view.getZoom();
    if (zoom === undefined) return;
    const snapshot: LunarMapSnapshot = {
      mode, basemap, zoom: Math.round(zoom), maxZoom: view.getMaxZoom(),
      layers: [
        { id: base.id, state: sourceState(base), opacity: 1, role: "base" },
        ...moonTrekOverlayIds.flatMap(id => {
          const slot = overlays.get(id);
          return slot ? [{ id, state: sourceState(slot), opacity: slot.layer.getOpacity(), role: "overlay" as const }] : [];
        }),
      ],
    };
    const key = JSON.stringify(snapshot);
    if (key !== lastSnapshot) { lastSnapshot = key; onState(snapshot); }
  }

  function createSource(id: MoonTrekLayerId, zIndex: number): SourceSlot {
    const config = moonTrekLayers[id];
    const scope = new AbortController();
    const slot: SourceSlot = {
      id, layer: new TileLayer<WMTS>({ cacheSize: 128, zIndex, preload: 1 }), grid: createGrid(id),
      pending: new Set(), loaded: new Map(), failed: new Map(), keys: [],
      abort: () => {
        unByKey(slot.keys); scope.abort();
        // Cancelled LOADING tiles must reach a terminal state to free OpenLayers' queue.
        for (const tile of slot.pending) if (tile.getState() === TileState.LOADING) tile.setState(TileState.ERROR);
        slot.pending.clear(); map.removeLayer(slot.layer); slot.layer.dispose(); source.dispose();
      },
    };
    const record = (tile: ImageTile) => {
      const [zoom, column, row] = tile.getTileCoord();
      if (zoom === undefined || column === undefined || row === undefined) return null;
      return { key: tile.getTileCoord().join("/"), coordinate: { zoom, column, row } };
    };
    const source: WMTS = new WMTS({
      url: `${moonTrekLayerUrl(id)}/default/${moonTrekGrid.matrixSet}/{TileMatrix}/{TileRow}/{TileCol}.${config.format}`,
      layer: config.layer, style: "default", matrixSet: moonTrekGrid.matrixSet,
      format: config.format === "jpg" ? "image/jpeg" : "image/png", requestEncoding: "REST",
      projection: projections[config.mode], tileGrid: slot.grid, wrapX: false, crossOrigin: "anonymous", transition: 0,
      tileLoadFunction: (tile, url) => {
        if (!(tile instanceof ImageTile)) { tile.setState(TileState.ERROR); return; }
        slot.pending.add(tile);
        void (async () => {
          let bitmap: ImageBitmap | undefined;
          try {
            const response = await fetch(url, { credentials: "omit",
              signal: AbortSignal.any([scope.signal, AbortSignal.timeout(tileTimeoutMs)]) });
            const expected = config.format === "jpg" ? "image/jpeg" : "image/png";
            if (!response.ok || response.headers.get("content-type")?.split(";")[0]?.toLowerCase() !== expected) throw new Error("Tile unavailable");
            const blob = await response.blob();
            if (blob.size === 0 || blob.size > 2_000_000 || scope.signal.aborted) throw new Error("Tile unavailable");
            bitmap = await createImageBitmap(blob);
            if (scope.signal.aborted || bitmap.width !== 256 || bitmap.height !== 256) throw new Error("Invalid tile");
            const canvas = document.createElement("canvas");
            canvas.width = 256; canvas.height = 256;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Tile unavailable");
            context.drawImage(bitmap, 0, 0);
            const pixels = context.getImageData(0, 0, 256, 256);
            let hasData = false;
            for (let index = 0; index < pixels.data.length; index += 4) {
              // Only NAC datasets with a verified nodata value of 0 get this mask.
              if (config.zeroIsNoData && pixels.data[index] === 0 && pixels.data[index + 1] === 0 && pixels.data[index + 2] === 0) pixels.data[index + 3] = 0;
              const alpha = pixels.data[index + 3];
              if (alpha !== undefined && alpha > 0) hasData = true;
            }
            if (config.zeroIsNoData) context.putImageData(pixels, 0, 0);
            const entry = record(tile);
            if (entry) slot.loaded.set(entry.key, { ...entry.coordinate, hasData });
            tile.setImage(canvas);
          } catch { tile.setState(TileState.ERROR); }
          finally { bitmap?.close(); slot.pending.delete(tile); }
        })();
      },
    });
    slot.keys = [
      source.on("tileloadstart", event => {
        if (event.tile instanceof ImageTile) {
          const entry = record(event.tile);
          if (entry) { slot.loaded.delete(entry.key); slot.failed.delete(entry.key); }
        }
        publish();
      }),
      source.on("tileloadend", event => {
        if (event.tile instanceof ImageTile) {
          const entry = record(event.tile);
          if (entry) slot.failed.delete(entry.key);
        }
        publish();
      }),
      source.on("tileloaderror", event => {
        if (event.tile instanceof ImageTile) {
          const entry = record(event.tile);
          if (entry) { slot.loaded.delete(entry.key); slot.failed.set(entry.key, entry.coordinate); }
        }
        publish();
      }),
    ];
    slot.layer.setSource(source); map.addLayer(slot.layer);
    return slot;
  }

  function updateMaxZoom() {
    view.setMaxZoom(Math.max(moonTrekLayers[base.id].maxZoom,
      ...[...overlays.values()].map(slot => moonTrekLayers[slot.id].maxZoom)));
    zoomTarget = undefined; publish();
  }

  function updateMarker() {
    const coordinate = selected ? projectMapLocation(selected, mode) : null;
    marker.setGeometry(coordinate ? new Point(coordinate) : undefined);
  }

  function updateCandidates() {
    candidateSource.clear();
    candidates.forEach((location, index) => {
      const coordinate = projectMapLocation(location, mode);
      if (!coordinate) return;
      const feature = new Feature({ geometry: new Point(coordinate), location });
      feature.setStyle(new Style({
        image: new CircleStyle({ radius: 12, fill: new Fill({ color: markerOutline }), stroke: new Stroke({ color: candidateColor, width: 2 }) }),
        text: new Text({ text: String(index + 1), fill: new Fill({ color: candidateColor }), font: "500 12px DM Sans, sans-serif" }),
      }));
      candidateSource.addFeature(feature);
    });
  }

  function setMode(next: MoonTrekMode) {
    if (next === mode) return;
    view.cancelAnimations(); base.abort();
    for (const slot of overlays.values()) slot.abort();
    overlays.clear(); mode = next; basemap = next === "global" ? "imagery" : "relief";
    view = views[next]; map.setView(view);
    base = createSource(moonTrekBasemaps[mode][basemap], 0);
    if (mode === "south") for (const id of enabled) {
      const slot = createSource(id, moonTrekOverlayIds.indexOf(id) + 1);
      slot.layer.setOpacity(opacity.get(id) ?? 1); overlays.set(id, slot);
    }
    updateMarker(); updateCandidates(); updateMaxZoom(); onCursor(null);
  }

  function setOverlay(id: MoonTrekOverlayId, show: boolean) {
    if (show && mode !== "south") setMode("south");
    if (show) {
      enabled.add(id);
      if (!overlays.has(id)) {
        const slot = createSource(id, moonTrekOverlayIds.indexOf(id) + 1);
        slot.layer.setOpacity(opacity.get(id) ?? 1); overlays.set(id, slot);
      }
    } else { enabled.delete(id); overlays.get(id)?.abort(); overlays.delete(id); }
    updateMaxZoom();
  }

  function setLocation(location: MapLocation) {
    selected = location; updateMarker(); onSelect(location);
  }

  const keys = [
    map.on("postrender", publish), map.on("moveend", () => { zoomTarget = undefined; publish(); }),
    map.on("pointermove", event => { if (!event.dragging) onCursor(unprojectMapLocation(event.coordinate, mode)); }),
    map.on("singleclick", event => {
      const candidate = map.forEachFeatureAtPixel(event.pixel, feature => feature.get("location"), { layerFilter: layer => layer === candidateLayer, hitTolerance: 8 });
      const location = isMapLocation(candidate) ? candidate : unprojectMapLocation(event.coordinate, mode);
      if (location) { element.focus(); setLocation(location); }
    }),
  ];
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && event.target === element) {
      const center = view.getCenter();
      const location = center ? unprojectMapLocation(center, mode) : null;
      if (location) { event.preventDefault(); setLocation(location); }
    }
  };
  element.addEventListener("keydown", onKeyDown);
  base = createSource("global-imagery", 0); publish();

  return {
    setMode,
    setCandidates: locations => { candidates = locations.filter(isMapLocation).slice(0, 3); updateCandidates(); },
    setBasemap: next => {
      if (next === basemap) return;
      base.abort(); basemap = next;
      base = createSource(moonTrekBasemaps[mode][basemap], 0); updateMaxZoom();
    },
    setOverlay,
    setOpacity: (id, value) => {
      const safe = Math.max(0, Math.min(1, value));
      opacity.set(id, safe); overlays.get(id)?.layer.setOpacity(safe); publish();
    },
    focusLayer: id => {
      setOverlay(id, true);
      const home = moonTrekLayers[id].home;
      zoomTarget = undefined; view.cancelAnimations();
      view.animate({ center: [...home.center], zoom: home.zoom, duration: motion.matches ? 0 : 180 });
    },
    navigate: location => {
      if (!isMapLocation(location)) return;
      const destination = { ...location, longitude: Math.abs(location.latitude) === 90 ? 0 : normalizeMapLongitude(location.longitude) };
      if (mode === "global" && destination.latitude <= -75) setMode("south");
      let coordinate = projectMapLocation(destination, mode);
      if (mode === "south") {
        const range = base.grid.getFullTileRange(0);
        const extent = range ? base.grid.getTileCoordExtent([0, range.minX, range.minY]) : null;
        if (extent && range) extend(extent, base.grid.getTileCoordExtent([0, range.maxX, range.maxY]));
        if (!coordinate || !extent || !containsCoordinate(extent, coordinate)) {
          setMode("global"); coordinate = projectMapLocation(destination, mode);
        }
      }
      if (!coordinate) return;
      zoomTarget = undefined; view.cancelAnimations();
      view.animate({ center: coordinate, zoom: Math.min(mode === "south" ? 7 : 5, view.getMaxZoom()), duration: motion.matches ? 0 : 180 });
      setLocation(destination);
    },
    zoomBy: delta => {
      const zoom = view.getZoom();
      if (zoom === undefined) return;
      const start = view.getAnimating() && zoomTarget !== undefined ? zoomTarget : Math.round(zoom);
      zoomTarget = Math.max(0, Math.min(view.getMaxZoom(), start + delta));
      view.cancelAnimations(); view.animate({ zoom: zoomTarget, duration: motion.matches ? 0 : 180 });
    },
    resetView: () => {
      zoomTarget = undefined; view.cancelAnimations();
      view.animate({ center: [0, 0], zoom: mode === "global" ? 2 : Math.min(5, view.getMaxZoom()), duration: motion.matches ? 0 : 180 });
    },
    retry: () => {
      if (sourceState(base) === "error" || sourceState(base) === "partial") {
        base.abort(); base = createSource(moonTrekBasemaps[mode][basemap], 0);
      }
      for (const [id, slot] of overlays) if (sourceState(slot) === "error" || sourceState(slot) === "partial") {
        slot.abort();
        const replacement = createSource(id, moonTrekOverlayIds.indexOf(id) + 1);
        replacement.layer.setOpacity(opacity.get(id) ?? 1); overlays.set(id, replacement);
      }
      publish();
    },
    dispose: () => {
      stopped = true; unByKey(keys); element.removeEventListener("keydown", onKeyDown);
      base.abort(); for (const slot of overlays.values()) slot.abort(); map.dispose();
    },
  };
}
