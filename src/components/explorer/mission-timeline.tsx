/** Make UTC sample navigation and fair site comparison contextual to the map. @author Sultan */
"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalyzedSite, MissionAnalysisControls } from "@/hooks/use-mission-analysis";
import { formatMapCoordinates, type MapLocation } from "./lunar-map-coordinates";
const ElevationChart = dynamic(() => import("./mission-elevation-chart").then(module => module.MissionElevationChart), { ssr: false, loading: () => <div className="mission-elevation-chart" role="status">Loading chart…</div> });

function VisibilityWindows({ sites, target }: { sites: AnalyzedSite[]; target: "sun" | "earth" }) {
  return <details className="mission-windows"><summary>Visibility windows</summary>
    {sites.map(site => {
      const name = site.location.name ?? formatMapCoordinates(site.location), series = site.analysis[target];
      return <section key={`${site.location.latitude}/${site.location.longitude}`} aria-label={`${name} ${target} visibility windows`}>
        <h3>{name} · {target === "sun" ? "Sun" : "Earth"}</h3>
        {series.status === "error" ? <p className="text-warning">{series.message}</p> : <>
          {series.missingSamples > 0 ? <p>{series.missingSamples} missing samples · total duration unknown</p> : null}
          {series.windows.length === 0 ? <p>No visibility found in these samples.</p> : <ul>{series.windows.map((window, index) => <li key={`${window.startUtc}/${index}`}>
            <time dateTime={window.startUtc}>{window.startUtc.slice(0, 16).replace("T", " ")}</time> — <time dateTime={window.endUtc}>{window.endUtc.slice(0, 16).replace("T", " ")}</time> UTC
            {window.openStart ? " · open start" : ""}{window.openEnd ? " · open end" : ""}
          </li>)}</ul>}
          {series.windows.some(window => window.openStart || window.openEnd) ? <p>Open boundaries are clipped by the window or missing samples.</p> : null}
        </>}
      </section>;
    })}
  </details>;
}

export function MissionTimeline({ mission, onLocate }: { mission: MissionAnalysisControls; onLocate: (location: MapLocation) => void }) {
  const [target, setTarget] = useState<"sun" | "earth">("sun");
  if (mission.sites.length === 0) return null;
  const first = mission.sites[0]?.analysis;
  const samples = first?.sun.status === "ready" ? first.sun.samples : first?.earth.status === "ready" ? first.earth.samples : [];
  const timestamp = samples[mission.sampleIndex]?.timestamp ?? null;
  return <section className={`mission-timeline map-surface${mission.timelineOpen ? " mission-timeline-expanded" : ""}`} aria-label="Mission timeline">
    <div className="mission-timeline-heading"><Button variant="ghost" className="justify-start px-3" aria-expanded={mission.timelineOpen} aria-controls="mission-timeline-content" onClick={() => mission.setTimelineOpen(!mission.timelineOpen)}>
      {mission.timelineOpen ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />} {mission.comparison ? "Comparison" : "Timeline"}</Button>
      <span className="text-xs text-content-muted">{first?.input.stepMinutes} min · UTC</span>
      <Button variant="ghost" size="icon" title="Download mission report" aria-label="Download mission report" onClick={mission.downloadReport}><Download aria-hidden="true" /></Button></div>
    {mission.timelineOpen ? <div id="mission-timeline-content" className="mission-timeline-content">
      <div className="mission-timeline-toolbar"><div className="flex gap-1" role="group" aria-label="Elevation target"><Button variant="ghost" className="px-3" aria-pressed={target === "sun"} onClick={() => setTarget("sun")}>Sun</Button><Button variant="ghost" className="px-3" aria-pressed={target === "earth"} onClick={() => setTarget("earth")}>Earth</Button></div>
        <output className="text-xs text-content-muted" aria-label="Selected analysis time">{timestamp?.replace("T", " ").slice(0, 16)} UTC</output></div>
      <ElevationChart sites={mission.sites} target={target} timestamp={timestamp} />
      <div className="mission-time-navigation"><Button variant="ghost" size="icon" title="Previous sample" aria-label="Previous sample" disabled={mission.sampleIndex === 0} onClick={() => mission.setSampleIndex(mission.sampleIndex - 1)}><ChevronLeft aria-hidden="true" /></Button>
        <input type="range" aria-label="Analysis time" aria-valuetext={timestamp ? `${timestamp.slice(0, 16).replace("T", " ")} UTC` : "Unavailable"} min="0" max={Math.max(0, mission.sampleCount - 1)} step="1" value={mission.sampleIndex} onChange={event => mission.setSampleIndex(Number(event.target.value))} />
        <Button variant="ghost" size="icon" title="Next sample" aria-label="Next sample" disabled={mission.sampleIndex >= mission.sampleCount - 1} onClick={() => mission.setSampleIndex(mission.sampleIndex + 1)}><ChevronRight aria-hidden="true" /></Button></div>
      <div className="mission-comparison-values" role="list" aria-label="Geometric comparison">
        {mission.sites.map(site => { const series = site.analysis[target]; const sample = series.status === "ready" ? series.samples[mission.sampleIndex] : null;
          return <div role="listitem" key={`${site.location.latitude}/${site.location.longitude}`}><Button variant="ghost" className="min-w-0 justify-start truncate px-2 text-xs" onClick={() => onLocate(site.location)}>{site.location.name ?? formatMapCoordinates(site.location)}</Button>
            <span>{sample?.elevationDeg === null || sample?.elevationDeg === undefined ? "Unavailable" : `${sample.elevationDeg.toFixed(2)}°`}</span>
            <span title="Estimated hours above the ideal tangent horizon over the requested window. Terrain and operations are not included.">{series.status !== "ready" || series.visibleHours === null ? "Hours unknown" : `${series.visibleHours.toFixed(1)} h above horizon`}</span></div>; })}
        {mission.failures.map(failure => <div role="listitem" key={`${failure.location.latitude}/${failure.location.longitude}`}><span>{failure.location.name ?? formatMapCoordinates(failure.location)}</span><span className="text-warning">Unavailable · {failure.message}</span></div>)}
      </div>
      <VisibilityWindows sites={mission.sites} target={target} />
      <p className="mission-timeline-note">Target centers · terrain excluded · crossings estimated</p>
    </div> : null}
  </section>;
}
