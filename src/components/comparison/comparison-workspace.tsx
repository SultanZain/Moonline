/** Compare user-selected lunar sites with shared live mission inputs and reports. @author Sultan */
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MissionControls } from "@/components/explorer/mission-controls";
import { MissionTimeline } from "@/components/explorer/mission-timeline";
import { explorerSessionLink, missionTimeToUtc, saveLastExplorerSession, type ExplorerSession } from "@/components/explorer/explorer-session";
import { formatMapCoordinates, isMapLocation, normalizeMapLongitude, type MapLocation } from "@/components/explorer/lunar-map-coordinates";
import { useMissionAnalysis } from "@/hooks/use-mission-analysis";

export function ComparisonWorkspace({ initialSession, initialTime, invalidSession }: { initialSession: ExplorerSession; initialTime: string; invalidSession: boolean }) {
  const [sites, setSites] = useState(initialSession.sites);
  const [selected, setSelected] = useState(initialSession.selected ?? initialSession.sites[0] ?? null);
  const [missionTime, setMissionTime] = useState(initialTime);
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const mission = useMissionAnalysis(selected, sites, missionTime);
  const missionTimeUtc = missionTimeToUtc(missionTime);
  const session: ExplorerSession = { ...initialSession, selected, sites, missionTimeUtc };
  const explorerUrl = new URL(explorerSessionLink(session, "https://moonline.invalid/explorer"));
  const explorerHref = explorerUrl.pathname + explorerUrl.search;

  useEffect(() => {
    if (missionTime !== "" && !missionTimeUtc) return;
    const currentSession: ExplorerSession = { ...initialSession, selected, sites, missionTimeUtc };
    saveLastExplorerSession(currentSession);
    const href = explorerSessionLink(currentSession, window.location.href);
    if (href !== window.location.href) window.history.replaceState(window.history.state, "", href);
  }, [initialSession, selected, sites, missionTime, missionTimeUtc]);

  function addSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const location = latitude.trim() && longitude.trim() ? { latitude: Number(latitude), longitude: Number(longitude) } : null;
    if (!isMapLocation(location)) { setInputError("Enter latitude −90…90 and longitude −180…180."); return; }
    const next: MapLocation = { ...location, longitude: Math.abs(location.latitude) === 90 ? 0 : normalizeMapLongitude(location.longitude), ...(name.trim() ? { name: name.trim() } : {}) };
    if (sites.some(site => site.latitude === next.latitude && (Math.abs(next.latitude) === 90 || normalizeMapLongitude(site.longitude) === next.longitude))) { setInputError("This site is already in the comparison."); return; }
    if (sites.length >= 3) { setInputError("Compare up to three sites."); return; }
    setSites([...sites, next]); setSelected(next); setName(""); setLatitude(""); setLongitude(""); setInputError(null);
  }

  function removeSite(index: number) {
    const remaining = sites.filter((_, item) => item !== index);
    setSites(remaining); setInputError(null);
    if (selected?.latitude === sites[index]?.latitude && selected?.longitude === sites[index]?.longitude) setSelected(remaining[0] ?? null);
  }

  return <div className="comparison-workspace space-y-6">
    <header className="page-header">
      <div><h1>Site comparison</h1><p className="mt-2 text-sm text-content-muted">Compare Sun and Earth visibility across up to three lunar sites.</p></div>
      <Button asChild variant="outline"><Link href={explorerHref}><ArrowLeft aria-hidden="true" /> Back to Explorer</Link></Button>
    </header>
    {invalidSession ? <p role="alert" className="text-sm text-warning">The comparison link was invalid. Add sites to start a new comparison.</p> : null}
    <section className="workspace-panel" aria-label="Comparison sites">
      <div className="flex items-center justify-between gap-3"><h2>Sites</h2><span className="text-xs text-content-muted">{sites.length} / 3</span></div>
      {sites.length > 0 ? <ol className="comparison-site-list">
        {sites.map((site, index) => <li key={`${site.latitude}/${site.longitude}`}>
          <Button variant="ghost" className="min-w-0 flex-1 justify-start px-3 text-left" aria-label={`Select site ${index + 1}: ${site.name ?? formatMapCoordinates(site)}`}
            aria-pressed={selected?.latitude === site.latitude && selected?.longitude === site.longitude} onClick={() => setSelected(site)}>
            <span className="candidate-index" aria-hidden="true">{index + 1}</span><span className="min-w-0"><span className="block truncate text-sm">{site.name ?? "Lunar site"}</span><span className="block text-xs text-content-muted">{formatMapCoordinates(site)}</span></span>
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Remove site ${index + 1}`} onClick={() => removeSite(index)}><X aria-hidden="true" /></Button>
        </li>)}
      </ol> : <p className="mt-3 text-sm text-content-muted">Add two sites below, or select candidates in Explorer.</p>}
      {sites.length < 3 ? <form className="comparison-add-site" onSubmit={addSite}>
        <div><label htmlFor="comparison-name">Site name</label><Input id="comparison-name" placeholder="Optional" maxLength={120} value={name} onChange={event => setName(event.target.value)} /></div>
        <div><label htmlFor="comparison-latitude">Latitude</label><Input id="comparison-latitude" type="number" min="-90" max="90" step="any" required placeholder="−90 to 90" value={latitude} onChange={event => setLatitude(event.target.value)} /></div>
        <div><label htmlFor="comparison-longitude">Longitude</label><Input id="comparison-longitude" type="number" min="-180" max="180" step="any" required placeholder="East · −180 to 180" value={longitude} onChange={event => setLongitude(event.target.value)} /></div>
        <Button variant="outline" type="submit"><Plus aria-hidden="true" /> Add site</Button>
      </form> : null}
      {inputError ? <p role="alert" className="mt-3 text-sm text-warning">{inputError}</p> : null}
    </section>
    <div className="comparison-analysis">
      <section className="workspace-panel" aria-labelledby="comparison-settings-heading">
        <h2 id="comparison-settings-heading">Shared settings</h2><p className="mt-2 text-xs text-content-muted">Every site uses the same time, height and sample step.</p>
        <div className="my-5"><label htmlFor="mission-time" className="text-xs text-content-muted">Mission time · UTC</label>
          <Input id="mission-time" className="mt-2" type="datetime-local" step="60" value={missionTime} aria-invalid={missionTime !== "" && !missionTimeUtc} onChange={event => setMissionTime(event.target.value)} />
        </div>
        <MissionControls mission={mission} candidateCount={sites.length} comparisonOnly onTimeline={() => mission.setTimelineOpen(true)} />
      </section>
      <div className="min-w-0">
        {mission.sites.length > 0 ? <MissionTimeline mission={mission} onLocate={setSelected} /> : <section className="workspace-panel comparison-empty" aria-label="Comparison results">
          <h2>Sun and Earth, side by side</h2><p className="mt-3 text-sm text-content-muted">Add at least two sites, choose the shared settings, then compare to load live NASA/JPL results.</p>
        </section>}
      </div>
    </div>
    <p className="text-xs text-content-muted">Geometric visibility · terrain excluded. <Link href="/methodology#observer-model" className="underline underline-offset-4">Method and assumptions</Link></p>
  </div>;
}
