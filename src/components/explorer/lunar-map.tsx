/**
 * Make NASA lunar imagery a map workspace with search, source controls and contextual selection.
 * Load OpenLayers in the browser; keep unavailable science and tile coverage explicit.
 * @author Sultan
 */
"use client";

import { useEffect, useEffectEvent, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Crosshair, Info, Layers, MapPin, Maximize2, Minimize2, Minus, Plus, RotateCcw, Scan, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContextSheet } from "./context-sheet";
import { SiteContext } from "./site-context";
import { ExplorerSessionActions } from "./explorer-session-actions";
import { emptyExplorerSession, explorerSessionLink, missionTimeToUtc, readExplorerSession, type CandidateImport, type ExplorerSession } from "./explorer-session";
import { formatMapCoordinates, isMapLocation, type MapLocation } from "./lunar-map-coordinates";
import {
  moonTrekBasemaps, moonTrekLayers, moonTrekLayerUrl, moonTrekMetadataUrl, moonTrekOverlayIds, moonTrekSlopeLegendUrl,
  type MoonTrekOverlayId,
} from "@/config/moon-trek";
import type { LunarMapHandle, LunarMapSnapshot, LunarMapState } from "./lunar-map-engine";
import { useLunarSearch, type LunarSearchResult } from "@/hooks/use-lunar-search";

type MapDisplay = "embedded" | "expanded" | "fullscreen";
type MapPopup = "coordinates" | "layers" | null;
const layerStateLabels: Record<LunarMapState, string> = {
  loading: "Loading", ready: "Loaded", partial: "Some tiles unavailable", error: "Tiles unavailable",
  "outside-grid": "Outside tile grid", "no-coverage": "No imagery at this view", hidden: "Hidden",
};

function parseCoordinates(value: string): MapLocation | null {
  const parts = value.trim().split(/[,\s]+/);
  if (parts.length !== 2 || !parts.every(part => /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(part))) return null;
  const location = { latitude: Number(parts[0]), longitude: Number(parts[1]) };
  return isMapLocation(location) ? location : null;
}

export function LunarMap() {
  const [rootElement, setRootElement] = useState<HTMLElement | null>(null);
  const target = useRef<HTMLDivElement>(null);
  const scale = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLOutputElement>(null);
  const controller = useRef<LunarMapHandle | null>(null);
  const fullscreenButton = useRef<HTMLButtonElement>(null);
  const inspectorButton = useRef<HTMLButtonElement>(null);
  const coordinatesButton = useRef<HTMLButtonElement>(null);
  const layersButton = useRef<HTMLButtonElement>(null);
  const searchControls = useRef<HTMLDivElement>(null);
  const layersControls = useRef<HTMLDivElement>(null);
  const nativeFullscreen = useRef(false);
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [snapshot, setSnapshot] = useState<LunarMapSnapshot | null>(null);
  const [display, setDisplay] = useState<MapDisplay>("embedded");
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [popup, setPopup] = useState<MapPopup>(null);
  const [selected, setSelected] = useState<MapLocation | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [candidates, setCandidates] = useState<MapLocation[]>([]);
  const [clearedCandidates, setClearedCandidates] = useState<MapLocation[] | null>(null);
  const [missionTime, setMissionTime] = useState("");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(-1);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [coordinateError, setCoordinateError] = useState<string | null>(null);
  const { state: searchState, search, reset: resetSearch } = useLunarSearch();
  const initialized = snapshot !== null;
  const expanded = display !== "embedded";
  const mode = snapshot?.mode ?? "global";
  const basemap = snapshot?.basemap ?? "imagery";
  const baseId = moonTrekBasemaps[mode][basemap];
  const baseLayer = moonTrekLayers[baseId];
  const activeLayers = snapshot?.layers ?? [];
  const failed = unavailable || activeLayers.some(layer => layer.state === "error" || layer.state === "partial");
  const loading = activeLayers.some(layer => layer.state === "loading");
  const outside = activeLayers.length > 0 && activeLayers.every(layer => layer.state === "outside-grid" || layer.state === "hidden");
  const status = unavailable ? "Map unavailable" : !initialized ? "Opening map" : failed ? "Some layers unavailable" :
    loading ? "Loading imagery" : outside ? "Outside tile grid" :
    activeLayers[0]?.state === "no-coverage" ? "No imagery at this view" : "Imagery loaded · coverage varies";
  const searchResults = searchState.status === "ready" ? searchState.results : [];
  const showResults = searchOpen && query.trim().length >= 2 && searchState.status !== "idle";
  const missionTimeUtc = missionTimeToUtc(missionTime);
  const session: ExplorerSession | null = snapshot && (!missionTime || missionTimeUtc) ?
    { version: 1, selected, sites: candidates, missionTimeUtc, view: snapshot.view } : null;

  function saveSessionUrl() {
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = null;
    if (!session || window.location.pathname !== "/explorer") return;
    const href = explorerSessionLink(session, window.location.href);
    if (href === window.location.href) return;
    try { window.history.replaceState(window.history.state, "", href); }
    catch { setSessionError("Browser could not save this view. Use Copy exploration link to preserve it."); }
  }
  const saveFromEffect = useEffectEvent(() => saveSessionUrl());

  function applySession(restored: ExplorerSession) {
    controller.current?.restoreSession(restored);
    setClearedCandidates(null);
    setSelected(restored.selected); setCandidates(restored.sites); setMissionTime(restored.missionTimeUtc?.slice(0, 16) ?? "");
    setLatitude(restored.selected ? String(restored.selected.latitude) : "");
    setLongitude(restored.selected ? String(restored.selected.longitude) : "");
    setInspectorOpen(restored.selected !== null || restored.sites.length > 0);
    setQuery(restored.selected?.name ?? ""); resetSearch(); setPopup(null); setSearchOpen(false);
    setSearchError(null); setCoordinateError(null);
  }

  const restoreFromHistory = useEffectEvent(() => {
    if (!controller.current) return;
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = null;
    const read = readExplorerSession(window.location.search);
    applySession(read.status === "ready" ? read.session : emptyExplorerSession());
    setSessionError(read.status === "invalid" ? "Invalid exploration link. The map opened at its default view." : null);
  });

  const onSelection = useEffectEvent((location: MapLocation) => {
    setSelected(location); setInspectorOpen(true); setPopup(null); setSearchOpen(false);
    setLatitude(String(location.latitude)); setLongitude(String(location.longitude));
  });

  useEffect(() => {
    let cancelled = false;
    let handle: LunarMapHandle | undefined;
    const element = target.current;
    const scaleElement = scale.current;
    if (!element || !scaleElement) return;
    void import("./lunar-map-engine").then(({ createLunarMap }) => {
      if (cancelled) return;
      handle = createLunarMap(element, scaleElement, setSnapshot, location => {
        if (cursor.current) cursor.current.textContent = location ? formatMapCoordinates(location) : "—, —";
      }, onSelection);
      controller.current = handle;
      restoreFromHistory();
    }).catch(() => { if (!cancelled) setUnavailable(true); });
    const onHistory = () => restoreFromHistory();
    window.addEventListener("popstate", onHistory);
    return () => { cancelled = true; window.removeEventListener("popstate", onHistory); handle?.dispose(); controller.current = null; };
  }, [attempt]);

  useEffect(() => { controller.current?.setCandidates(candidates); }, [candidates, initialized]);

  useEffect(() => {
    if (!snapshot || (missionTime && !missionTimeUtc)) return;
    const href = explorerSessionLink({ version: 1, selected, sites: candidates, missionTimeUtc, view: snapshot.view }, window.location.href);
    if (href === window.location.href) return;
    const timer = setTimeout(() => saveFromEffect(), 500);
    urlTimer.current = timer;
    return () => clearTimeout(timer);
  }, [snapshot, selected, candidates, missionTime, missionTimeUtc]);

  useEffect(() => {
    const onLink = (event: MouseEvent) => { if (event.target instanceof Element && event.target.closest("a[href]")) saveFromEffect(); };
    const onLeave = () => saveFromEffect();
    document.addEventListener("click", onLink, true);
    window.addEventListener("beforeunload", onLeave);
    return () => { document.removeEventListener("click", onLink, true); window.removeEventListener("beforeunload", onLeave); };
  }, []);

  function importCandidates(imported: CandidateImport) {
    // Keep the previous exploration reachable through Back after a confirmed import.
    setSessionError(null);
    setClearedCandidates(null);
    saveSessionUrl();
    try { window.history.pushState(window.history.state, "", window.location.href); }
    catch { setSessionError("Browser could not keep the previous view. Use Copy exploration link to preserve inputs."); }
    if (imported.view) applySession({ ...imported, version: 1, view: imported.view });
    else {
      setCandidates(imported.sites); setMissionTime(imported.missionTimeUtc?.slice(0, 16) ?? "");
      controller.current?.setCandidates(imported.sites);
      const location = imported.selected ?? imported.sites[0];
      if (location) navigate(location);
    }
  }

  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement === rootElement && rootElement) {
        nativeFullscreen.current = true; setDisplay("fullscreen"); target.current?.focus();
      } else if (nativeFullscreen.current) {
        nativeFullscreen.current = false; setDisplay("embedded"); setFullscreenError(null);
        if (!rootElement?.querySelector('[data-slot="sheet-content"][data-state="open"]')) fullscreenButton.current?.focus();
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [rootElement]);

  useEffect(() => {
    const fullscreenRoot = target.current?.parentElement;
    if (!expanded || !fullscreenRoot) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const outsideElements: { element: HTMLElement; inert: boolean }[] = [];
    let ancestor: HTMLElement = fullscreenRoot;
    while (ancestor.parentElement) {
      for (const sibling of ancestor.parentElement.children) if (sibling !== ancestor && sibling instanceof HTMLElement) {
        outsideElements.push({ element: sibling, inert: sibling.inert }); sibling.setAttribute("inert", "");
      }
      if (ancestor.parentElement === document.body) break;
      ancestor = ancestor.parentElement;
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || fullscreenRoot.querySelector('[data-slot="sheet-content"][data-state="open"]')) return;
      if (event.key === "Escape" && fullscreenRoot.querySelector("#map-layer-panel, #map-coordinate-form")) return;
      if (event.key === "Escape" && document.fullscreenElement !== fullscreenRoot) {
        event.preventDefault(); setDisplay("embedded"); setFullscreenError(null); fullscreenButton.current?.focus();
      } else if (event.key === "Tab") {
        const focusable = Array.from(fullscreenRoot.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], summary, [tabindex="0"]',
        )).filter(element => element.getClientRects().length > 0 && !element.closest("details:not([open]) > :not(summary)"));
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      for (const { element, inert } of outsideElements) element.toggleAttribute("inert", inert);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  useEffect(() => {
    if (!popup) return;
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      const controls = popup === "coordinates" ? searchControls.current : layersControls.current;
      if (!controls?.contains(event.target)) setPopup(null);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); setPopup(null);
      (popup === "coordinates" ? coordinatesButton : layersButton).current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKeyDown); };
  }, [popup]);

  async function toggleFullscreen() {
    if (!rootElement) return;
    setPopup(null); setSearchOpen(false); setFullscreenError(null);
    if (expanded) {
      if (document.fullscreenElement === rootElement) {
        try { await document.exitFullscreen(); }
        catch { setFullscreenError("Press Escape to leave fullscreen."); return; }
      }
      setDisplay("embedded"); fullscreenButton.current?.focus();
    } else {
      setDisplay("expanded");
      if (document.fullscreenEnabled && rootElement.requestFullscreen) {
        try { await rootElement.requestFullscreen(); }
        catch { setDisplay("expanded"); }
      }
      target.current?.focus();
    }
  }

  function retry() {
    if (controller.current) controller.current.retry();
    else { setUnavailable(false); setSnapshot(null); setAttempt(value => value + 1); }
  }

  function navigate(location: MapLocation) {
    controller.current?.navigate(location); resetSearch(); setSearchError(null); setCoordinateError(null);
    setPopup(null); setSearchOpen(false);
  }

  function fitCandidates() {
    if (!controller.current || candidates.length === 0) return;
    if (inspectorOpen) inspectorButton.current?.focus();
    setPopup(null); setSearchOpen(false); setInspectorOpen(false);
    controller.current.setCandidates(candidates);
    controller.current.fitCandidates();
  }

  function pickResult(result: LunarSearchResult) { setQuery(result.name ?? ""); setActiveResult(-1); navigate(result); }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const coordinate = parseCoordinates(query);
    if (coordinate) { navigate(coordinate); return; }
    if (/^[-+\d.\s,]+$/.test(query.trim())) { setSearchError("Use latitude −90…90 and longitude −180…180."); return; }
    const result = searchResults[activeResult >= 0 ? activeResult : 0];
    if (result) { pickResult(result); return; }
    search(query); setSearchOpen(true);
  }

  function searchKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { event.preventDefault(); setSearchOpen(false); resetSearch(); return; }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && searchResults.length > 0) {
      event.preventDefault(); setSearchOpen(true);
      setActiveResult(index => (index + (event.key === "ArrowDown" ? 1 : -1) + searchResults.length) % searchResults.length);
    }
  }

  function submitCoordinates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const location = latitude.trim() && longitude.trim() ? { latitude: Number(latitude), longitude: Number(longitude) } : null;
    if (!isMapLocation(location)) { setCoordinateError("Latitude −90…90; longitude −180…180."); return; }
    navigate(location);
  }

  function toggleOverlay(id: MoonTrekOverlayId, show: boolean) { controller.current?.setOverlay(id, show); }

  return (
    <section ref={setRootElement} className={`lunar-map-workspace${expanded ? " lunar-map-expanded" : ""}`} data-candidates={candidates.length > 1 ? "multiple" : undefined}
      role={expanded ? "dialog" : undefined} aria-modal={expanded ? true : undefined} aria-labelledby="lunar-map-heading">
      <h2 id="lunar-map-heading" className="sr-only">Lunar exploration</h2>
      <div ref={target} className="lunar-map-canvas" tabIndex={0} role="region" aria-label="Lunar imagery map" aria-describedby="map-keyboard-help"
        onPointerLeave={() => { if (cursor.current) cursor.current.textContent = "—, —"; }} />
      <p id="map-keyboard-help" className="sr-only">Drag to pan, scroll or use plus and minus to zoom. Arrow keys pan the focused map. Enter selects the map center. Coordinates use lunar degrees and positive east longitude.</p>

      <div ref={searchControls} className="map-search-controls">
        <div className="map-search-bar map-surface">
          <form onSubmit={submitSearch} className="map-search-form" onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
          }}>
            <Search size={18} className="ml-3 shrink-0 text-content-muted" aria-hidden="true" />
            <Input role="combobox" aria-label="Search lunar locations or coordinates" placeholder="Search Moon or lat, lon" maxLength={64}
              className="border-0 bg-transparent px-3" value={query} aria-autocomplete="list" aria-controls="lunar-search-results"
              aria-expanded={showResults && searchResults.length > 0} aria-activedescendant={showResults && activeResult >= 0 ? `lunar-result-${activeResult}` : undefined}
              aria-invalid={searchError !== null} aria-describedby={searchError ? "lunar-search-error" : undefined}
              disabled={!initialized} onFocus={() => { if (searchState.status !== "idle") setSearchOpen(true); }} onKeyDown={searchKeys}
              onChange={event => { setQuery(event.target.value); setActiveResult(-1); setSearchError(null); setSearchOpen(true); search(event.target.value); }} />
            {query ? <Button type="button" variant="ghost" size="icon" title="Clear search" aria-label="Clear search"
              onClick={() => { setQuery(""); resetSearch(); setSearchError(null); setSearchOpen(false); }}><X aria-hidden="true" /></Button> : null}
            <button type="submit" className="sr-only" tabIndex={-1}>Search</button>
          </form>
          <Button ref={coordinatesButton} variant="ghost" size="icon" className="border-l border-border rounded-l-none" title="Go to coordinates" aria-label="Go to coordinates"
            aria-expanded={popup === "coordinates"} aria-controls="map-coordinate-form" disabled={!initialized}
            onClick={() => { setSearchOpen(false); setPopup(value => value === "coordinates" ? null : "coordinates"); }}><Crosshair aria-hidden="true" /></Button>
        </div>
        {showResults ? (
          <div className="map-search-results map-surface">
            {searchState.status === "ready" && searchResults.length > 0 ? (
              <ul id="lunar-search-results" role="listbox" aria-label="Lunar location suggestions">
                {searchResults.map((result, index) => <li role="presentation" key={result.id}>
                  <Button type="button" role="option" tabIndex={-1} id={`lunar-result-${index}`} aria-selected={index === activeResult} variant="ghost"
                    className="search-result" onPointerDown={event => event.preventDefault()} onClick={() => pickResult(result)}>
                    <MapPin aria-hidden="true" /><span className="min-w-0 text-left"><span className="block truncate text-sm">{result.name}</span>
                      <span className="block text-xs text-content-muted">{formatMapCoordinates(result)}</span></span>
                  </Button>
                </li>)}
              </ul>
            ) : <p role="status" className="px-4 py-3 text-xs text-content-muted">{searchState.status === "loading" ? "Searching NASA locations…" : searchState.status === "error" ? "Search unavailable. Enter coordinates or try again." : "No matching lunar locations."}</p>}
            {searchState.status === "ready" ? <p className="px-4 pb-3 text-xs text-content-subtle">NASA Moon Trek nomenclature</p> : null}
          </div>
        ) : null}
        {searchError ? <p id="lunar-search-error" role="alert" className="map-input-error map-surface">{searchError}</p> : null}
        {sessionError ? <div className="map-input-error map-surface flex items-center gap-2"><p role="alert" className="flex-1">{sessionError}</p>
          <Button variant="ghost" size="icon" aria-label="Dismiss link error" title="Dismiss link error" onClick={() => setSessionError(null)}><X aria-hidden="true" /></Button></div> : null}
        {popup === "coordinates" ? (
          <form id="map-coordinate-form" onSubmit={submitCoordinates} noValidate className="map-coordinate-form map-surface" aria-label="Coordinate navigation">
            <div className="flex items-center justify-between"><h3 className="text-sm font-medium">Go to coordinates</h3>
              <Button type="button" variant="ghost" size="icon" className="-mr-2 -my-2" title="Close coordinates" aria-label="Close coordinates" onClick={() => { setPopup(null); coordinatesButton.current?.focus(); }}><X aria-hidden="true" /></Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="space-y-2"><label htmlFor="map-latitude" className="text-xs text-content-muted">Latitude · °</label><Input id="map-latitude" type="number" inputMode="decimal" step="any" min="-90" max="90" value={latitude}
                aria-invalid={coordinateError !== null} aria-describedby={coordinateError ? "map-coordinate-error" : undefined} onChange={event => { setLatitude(event.target.value); setCoordinateError(null); }} /></div>
              <div className="space-y-2"><label htmlFor="map-longitude" className="text-xs text-content-muted">Longitude · °E</label><Input id="map-longitude" type="number" inputMode="decimal" step="any" min="-180" max="180" value={longitude}
                aria-invalid={coordinateError !== null} aria-describedby={coordinateError ? "map-coordinate-error" : undefined} onChange={event => { setLongitude(event.target.value); setCoordinateError(null); }} /></div>
            </div>
            {coordinateError ? <p id="map-coordinate-error" role="alert" className="mt-3 text-xs text-warning">{coordinateError}</p> : null}
            <Button type="submit" className="mt-4 w-full"><Crosshair aria-hidden="true" /> Go to location</Button>
          </form>
        ) : null}
      </div>

      <div ref={layersControls} className="map-layer-controls">
        <div className="map-toolbar">
          <div className="map-projection-controls map-surface" role="group" aria-label="Map projection">
            <Button variant="ghost" className="px-3" aria-pressed={mode === "global"} disabled={!initialized} onClick={() => controller.current?.setMode("global")}>Global</Button>
            <Button variant="ghost" className="px-3" aria-pressed={mode === "south"} disabled={!initialized} onClick={() => controller.current?.setMode("south")}>South pole</Button>
          </div>
          <Button ref={layersButton} variant="outline" className="map-surface bg-surface px-3" title="Map layers" aria-label="Map layers" aria-expanded={popup === "layers"} aria-controls="map-layer-panel"
            disabled={!initialized} onClick={() => { setSearchOpen(false); setInspectorOpen(false); setPopup(value => value === "layers" ? null : "layers"); }}><Layers aria-hidden="true" /> Layers</Button>
        </div>
        {popup === "layers" ? (
          <div id="map-layer-panel" className="map-layer-panel map-surface" role="region" aria-label="Map layers">
            <div className="flex items-center justify-between"><h3 className="text-sm font-medium">Layers</h3>
              <Button variant="ghost" size="icon" className="-mr-2 -my-2" title="Close layers" aria-label="Close layers" onClick={() => { setPopup(null); layersButton.current?.focus(); }}><X aria-hidden="true" /></Button>
            </div>
            <div className="mt-4" role="group" aria-label="Basemap">
              <div className="flex gap-2">{(["imagery", "relief"] as const).map(option => <Button key={option} variant={option === basemap ? "default" : "outline"} className="flex-1 px-3" aria-pressed={option === basemap} onClick={() => controller.current?.setBasemap(option)}>{option === "imagery" ? "Imagery" : "Relief"}</Button>)}</div>
              <p className="mt-3 text-xs text-content-muted">{baseLayer.label}</p>
              <details className="map-source-info"><summary><Info aria-hidden="true" /> Source details</summary>
                <p>{baseLayer.description}</p>
                <a href={moonTrekMetadataUrl(baseId)} target="_blank" rel="noreferrer">NASA metadata <ArrowUpRight aria-hidden="true" /></a>
                <a href={`${moonTrekLayerUrl(baseId)}/WMTSCapabilities.xml`} target="_blank" rel="noreferrer">WMTS capabilities <ArrowUpRight aria-hidden="true" /></a>
              </details>
            </div>
            <div className="map-overlays">
              <h4 className="text-xs text-content-muted">South-polar overlays</h4>
              {moonTrekOverlayIds.map(id => {
                const layer = moonTrekLayers[id];
                const active = activeLayers.find(item => item.id === id);
                return <div key={id} className="map-overlay-row">
                  <div className="flex items-center gap-2">
                    <label className="map-layer-toggle" htmlFor={`overlay-${id}`}><input type="checkbox" id={`overlay-${id}`} checked={active !== undefined} onChange={event => toggleOverlay(id, event.target.checked)} /><span>{layer.label}</span></label>
                    <Button variant="ghost" size="icon" title={`Zoom to ${layer.label}`} aria-label={`Zoom to ${layer.label}`} onClick={() => controller.current?.focusLayer(id)}><Crosshair aria-hidden="true" /></Button>
                  </div>
                  {active ? <>
                    <p className={active.state === "error" || active.state === "partial" ? "text-xs text-warning" : "text-xs text-content-muted"}>{layerStateLabels[active.state]}</p>
                    <label className="map-opacity" htmlFor={`opacity-${id}`}><span>Opacity</span><input type="range" id={`opacity-${id}`} min="0" max="100" value={Math.round(active.opacity * 100)} onChange={event => controller.current?.setOpacity(id, Number(event.target.value) / 100)} /><output>{Math.round(active.opacity * 100)}%</output></label>
                    <details className="map-source-info"><summary><Info aria-hidden="true" /> Source details</summary><p>{layer.description}</p><p>{layer.coverage} · WMTS zoom 0–{layer.maxZoom}</p>
                      {id === "polar-slope" ? <><Image src="/maps/lola-polar-slope-legend.png" width={623} height={145} alt="NASA slope classes: 0–5, 5–10, 10–15, 15–30, 30–60 and 60–90 degrees." /><a href={moonTrekSlopeLegendUrl} target="_blank" rel="noreferrer">NASA slope legend <ArrowUpRight aria-hidden="true" /></a></> : null}
                      <a href={moonTrekMetadataUrl(id)} target="_blank" rel="noreferrer">NASA metadata <ArrowUpRight aria-hidden="true" /></a>
                    </details>
                  </> : <p className="text-xs text-content-subtle">{layer.coverage}</p>}
                </div>;
              })}
            </div>
            <Link href="/methodology" className="inline-flex min-h-11 items-center gap-2 text-xs text-content-muted underline underline-offset-4">Read the methodology <ArrowUpRight aria-hidden="true" /></Link>
          </div>
        ) : null}
      </div>

      <div className={`map-load-status map-surface${failed ? " text-warning" : " text-content-muted"}`}>
        <p role="status" aria-label="Imagery status" aria-live="polite">{status}</p>
        {failed ? <Button variant="ghost" className="px-3 text-xs" onClick={retry}>Retry imagery</Button> : outside ? <Button variant="ghost" className="px-3 text-xs" onClick={() => controller.current?.resetView()}>Reset view</Button> : null}
      </div>
      {unavailable ? <div className="map-start-error"><p>Map could not open.</p><Button variant="outline" onClick={retry}>Retry map</Button></div> : null}
      {fullscreenError ? <p role="alert" className="map-fullscreen-error map-surface">{fullscreenError}</p> : null}

      <ContextSheet open={inspectorOpen} onOpenChange={setInspectorOpen} container={rootElement} onReturnFocus={() => inspectorButton.current?.focus()}>
        <SiteContext location={selected} candidates={candidates} missionTime={missionTime} clearedCount={clearedCandidates?.length ?? 0} onFit={fitCandidates}
          onTimeChange={setMissionTime} onNavigate={navigate} onAdd={() => {
            if (selected && candidates.length < 3 && !candidates.some(site => site.latitude === selected.latitude && site.longitude === selected.longitude)) {
              setClearedCandidates(null); setCandidates(sites => [...sites, selected]);
            }
          }} onRemove={index => { setClearedCandidates(null); setCandidates(sites => sites.filter((_, item) => item !== index)); }}
          onClear={() => { if (candidates.length > 0) { setClearedCandidates(candidates); setCandidates([]); } }}
          onUndo={() => { if (clearedCandidates) { setCandidates(clearedCandidates); setClearedCandidates(null); } }}>
          <ExplorerSessionActions session={session} ready={initialized} hasCurrentWork={selected !== null || candidates.length > 0 || missionTime !== ""} onImport={importCandidates} />
        </SiteContext>
      </ContextSheet>

      <Button ref={inspectorButton} variant="outline" className="map-site-trigger map-surface bg-surface" title="Open site inspector" aria-label="Open site inspector" aria-expanded={inspectorOpen}
        onClick={() => { setPopup(null); setSearchOpen(false); setInspectorOpen(value => !value); }}><MapPin aria-hidden="true" /><span className="truncate">{selected ? selected.name ?? formatMapCoordinates(selected) : "Select a location"}</span>{candidates.length > 0 ? <span className="text-content-muted">· {candidates.length} / 3</span> : null}</Button>

      <div className="map-readout map-surface">
        <output ref={cursor} aria-label="Cursor coordinates" aria-live="off" className="block">—, —</output>
        <div ref={scale} className="lunar-map-scale" aria-label="Lunar map scale" />
        <p className="text-content-subtle">Moon 2000 · {mode === "global" ? "Equirectangular" : "South polar"}</p>
      </div>
      <div className="map-viewport-controls map-surface" role="group" aria-label="Map viewport">
        <Button variant="ghost" size="icon" title="Zoom in" aria-label="Zoom in" disabled={!initialized || snapshot.zoom >= snapshot.maxZoom} onClick={() => controller.current?.zoomBy(1)}><Plus aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" title="Zoom out" aria-label="Zoom out" disabled={!initialized || snapshot.zoom <= 0} onClick={() => controller.current?.zoomBy(-1)}><Minus aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" title="Reset map view" aria-label="Reset map view" disabled={!initialized} onClick={() => controller.current?.resetView()}><RotateCcw aria-hidden="true" /></Button>
        <Button ref={fullscreenButton} variant="ghost" size="icon" title={expanded ? "Exit fullscreen map" : "Fullscreen map"} aria-label={expanded ? "Exit fullscreen map" : "Fullscreen map"} aria-pressed={expanded} disabled={!initialized} onClick={() => void toggleFullscreen()}>
          {expanded ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
        </Button>
        {candidates.length > 1 ? <Button variant="ghost" size="icon" className="map-fit-candidates" title="Fit candidates" aria-label="Fit candidates" disabled={!initialized} onClick={fitCandidates}><Scan aria-hidden="true" /></Button> : null}
      </div>
      <p className="map-attribution"><a href="https://trek.nasa.gov/moon/" target="_blank" rel="noreferrer">NASA · LROC · LOLA</a><span aria-label="Map zoom">z{snapshot?.zoom ?? "—"} / {snapshot?.maxZoom ?? "—"}</span></p>
    </section>
  );
}
