/** Present observer assumptions, live geometry and the next planning actions. @author Sultan */
"use client";
import Link from "next/link";
import { Activity, Download, Earth, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MissionAnalysisControls } from "@/hooks/use-mission-analysis";
import type { TargetAnalysis } from "@/types/mission-analysis";

const angle = (value: number | null) => value === null ? "Unavailable" : `${value.toFixed(2)}°`;
function Geometry({ label, target, index, atPole }: { label: "Sun" | "Earth"; target: TargetAnalysis; index: number; atPole: boolean }) {
  if (target.status === "error") return <section className="mission-target" aria-label={`${label} geometry`}><h3>{label}</h3><p role="status" className="text-xs text-warning">{target.message}</p></section>;
  const sample = target.samples[index]; if (!sample) return null;
  const set = target.events.find(event => event.kind === "set" && Date.parse(event.timestamp) > Date.parse(sample.timestamp));
  const minutes = set ? Math.round((Date.parse(set.timestamp) - Date.parse(sample.timestamp)) / 60_000) : null;
  const interrupted = target.samples.slice(index + 1).some(next => next.elevationDeg === null && (!set || Date.parse(next.timestamp) <= Date.parse(set.timestamp)));
  const untilSet = sample.elevationDeg === null ? "Unknown" : sample.elevationDeg <= 0 ? "Below horizon" : interrupted ? "Unknown" : minutes === null ? "Beyond window" : `≈${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return <section className="mission-target" aria-label={`${label} geometry`}>
    <h3 className={label === "Sun" ? "text-sun" : "text-earth"}>{label === "Sun" ? <Sun aria-hidden="true" /> : <Earth aria-hidden="true" />} {label}</h3>
    <dl className="mission-angles"><div><dt>Elevation</dt><dd>{angle(sample.elevationDeg)}</dd></div><div><dt>Azimuth</dt><dd>{sample.azimuthDeg === null && atPole ? "Undefined at pole" : angle(sample.azimuthDeg)}</dd></div></dl>
    <div className="mission-assessment"><span>{sample.elevationDeg === null ? "Visibility unknown" : sample.elevationDeg > 0 ? "Above horizon" : "At / below horizon"}</span>
      <span title="Estimated target-center crossing from the sampled interval. Terrain is not included.">{label === "Sun" ? "Sunset" : "Earthset"} · {untilSet}</span></div>
  </section>;
}

export function MissionControls({ mission, candidateCount, onTimeline }: { mission: MissionAnalysisControls; candidateCount: number; onTimeline: () => void }) {
  const analysis = mission.activeSite?.analysis;
  const sample = analysis?.sun.status === "ready" ? analysis.sun.samples[mission.sampleIndex] : analysis?.earth.status === "ready" ? analysis.earth.samples[mission.sampleIndex] : null;
  return <section className="mission-controls" aria-label="Mission analysis">
    <div className="mission-settings">
      <div><label htmlFor="mission-window">Window</label><select id="mission-window" value={mission.days} onChange={event => mission.setDays(Number(event.target.value))}>
        {[1, 7, 14, 30].map(days => <option key={days} value={days}>{days} {days === 1 ? "day" : "days"}</option>)}</select></div>
      <div><label htmlFor="mission-step">Sample step</label><select id="mission-step" value={mission.stepMinutes} onChange={event => mission.setStepMinutes(Number(event.target.value))}>
        {[10, 30, 60, 180, 360].map(step => <option key={step} value={step}>{step < 60 ? `${step} min` : `${step / 60} h`}</option>)}</select></div>
    </div>
    <div><label htmlFor="observer-height" className="text-xs text-content-muted">Height · reference sphere (m)</label>
      <div className="mt-2 flex gap-2"><Input id="observer-height" type="number" step="any" min="-20000" max="20000" placeholder="Required" value={mission.height} onChange={event => mission.setHeight(event.target.value)} />
        <Button variant="outline" className="shrink-0 px-3" title="Explicitly choose zero height on the reference sphere; this is not measured terrain." onClick={() => mission.setHeight("0")}>Use 0 m</Button></div></div>
    <label className="mission-frame-choice"><input type="checkbox" aria-describedby="mission-frame-note" checked={mission.adoptFrame} onChange={event => mission.setAdoptFrame(event.target.checked)} />
      <span>Adopt mean-Earth coordinates <Link href="/methodology#observer-model" title="Map-to-ephemeris frame assumption" aria-label="Coordinate assumption details">?</Link></span></label>
    <p id="mission-frame-note" className="text-xs text-content-muted">Map-frame conversion is unverified.</p>
    <div className="flex gap-2"><Button className="flex-1" disabled={!mission.ready || mission.loading} onClick={() => void mission.run()}><Activity aria-hidden="true" /> Analyze</Button>
      {candidateCount >= 2 ? <Button variant="outline" className="flex-1" disabled={!mission.ready || mission.loading} onClick={() => void mission.run(true)}>Compare {candidateCount}</Button> : null}</div>
    {mission.loading ? <div className="flex items-center justify-between gap-2"><p role="status" className="text-xs text-content-muted">JPL Horizons · {mission.pending?.index}/{mission.pending?.total}</p><Button variant="ghost" className="px-2 text-xs" onClick={mission.cancel}>Cancel</Button></div> : null}
    {mission.error ? <p role="alert" className="text-xs text-warning">{mission.error}</p> : null}
    {mission.failures.length > 0 && (mission.sites.length > 0 || mission.failures.length > 1) ? <section aria-label="Unavailable sites" className="space-y-2 text-xs text-warning">
      {mission.failures.map(failure => <p key={`${failure.location.latitude}/${failure.location.longitude}`}>{failure.location.name ?? `${failure.location.latitude}°, ${failure.location.longitude}°`} · {failure.message}</p>)}
    </section> : null}
    {analysis ? <section className="mission-result" aria-label="Analysis results">
      <div><h3 className="text-sm font-medium">Geometric visibility</h3><p className="mt-1 text-xs text-content-muted">{sample?.timestamp.replace("T", " ").slice(0, 16)} UTC</p></div>
      <Geometry label="Sun" target={analysis.sun} index={mission.sampleIndex} atPole={Math.abs(analysis.input.observer.latitude) === 90} /><Geometry label="Earth" target={analysis.earth} index={mission.sampleIndex} atPole={Math.abs(analysis.input.observer.latitude) === 90} />
      <details className="mission-sources text-xs text-content-muted"><summary>Source details</summary>
        {([["Sun", analysis.sun], ["Earth", analysis.earth]] as const).map(([label, target]) => target.status === "ready" ? <div className="mt-3 space-y-1" key={label}>
          <p className="font-medium text-content">{label} · {target.provenance.source}</p>
          <p>{target.provenance.ephemeris} · {target.provenance.centerFrame}</p>
          <p>Retrieved {target.provenance.retrievedUtc.slice(0, 19).replace("T", " ")} UTC</p>
          <a className="source-link" href={target.provenance.queryUrl} target="_blank" rel="noreferrer">Source query</a>
        </div> : null)}
        <Link className="source-link mt-3" href="/methodology#observer-model">Method and assumptions</Link>
      </details>
      <p className="text-xs text-content-muted">Terrain visibility unavailable</p>
      <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={onTimeline}>Timeline</Button><Button variant="outline" className="flex-1" onClick={mission.downloadReport}><Download aria-hidden="true" /> Report</Button></div>
    </section> : mission.sites.length > 0 ? <Button variant="outline" onClick={onTimeline}>View comparison</Button> : null}
  </section>;
}
