/**
 * Inspect map locations and collect candidates without claiming scientific analysis.
 * Mission times are explicit UTC inputs; ephemeris and terrain results await integration.
 * @author Sultan
 */
"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, LocateFixed, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMapCoordinates, type MapLocation } from "./lunar-map-coordinates";
import { missionTimeToUtc } from "./explorer-session";

type SiteContextProps = {
  location: MapLocation | null;
  candidates: MapLocation[];
  missionTime: string;
  onTimeChange: (time: string) => void;
  onNavigate: (location: MapLocation) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  children: ReactNode;
};

export function SiteContext({ location, candidates, missionTime, onTimeChange, onNavigate, onAdd, onRemove, children }: SiteContextProps) {
  const [copyState, setCopyState] = useState<{ coordinates: string; status: "copied" | "error" } | null>(null);
  const clipboardText = location ? `${location.latitude}, ${location.longitude}` : null;
  const copied = clipboardText !== null && copyState?.coordinates === clipboardText && copyState.status === "copied";
  const copyFailed = clipboardText !== null && copyState?.coordinates === clipboardText && copyState.status === "error";
  const saved = location !== null && candidates.some(site => site.latitude === location.latitude && site.longitude === location.longitude);
  const timeInvalid = missionTime !== "" && missionTimeToUtc(missionTime) === null;

  async function copyCoordinates() {
    if (clipboardText === null) return;
    try { await navigator.clipboard.writeText(clipboardText); setCopyState({ coordinates: clipboardText, status: "copied" }); }
    catch { setCopyState({ coordinates: clipboardText, status: "error" }); }
  }

  return (
    <div className="site-context">
      {location ? (
        <>
          <div>
            <p className="[overflow-wrap:anywhere] text-lg font-medium text-content">{location.name ?? "Selected location"}</p>
            {location.featureType ? <p className="[overflow-wrap:anywhere] mt-1 text-xs text-content-muted">{location.featureType}</p> : null}
          </div>
          <dl className="site-coordinates">
            <div><dt>Latitude</dt><dd>{location.latitude.toFixed(4)}°</dd></div>
            <div><dt>Longitude · east</dt><dd>{location.longitude.toFixed(4)}°</dd></div>
          </dl>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 px-3" onClick={() => onNavigate(location)}><LocateFixed aria-hidden="true" /> Locate</Button>
            <Button variant="outline" className="flex-1 px-3" onClick={() => void copyCoordinates()}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} Copy
            </Button>
          </div>
          {copyFailed ? <p role="status" className="text-xs text-warning">Clipboard unavailable. Select the coordinates to copy.</p> : null}
          <div className="space-y-2">
            <label htmlFor="mission-time" className="text-xs text-content-muted">Mission time · UTC</label>
            <Input id="mission-time" type="datetime-local" step="60" value={missionTime} aria-invalid={timeInvalid}
              aria-describedby={timeInvalid ? "mission-time-error" : undefined} onChange={event => onTimeChange(event.target.value)} />
            {timeInvalid ? <p id="mission-time-error" role="alert" className="text-xs text-warning">Enter a valid UTC date and time, to the minute.</p> : null}
          </div>
          <Button onClick={onAdd} disabled={saved || candidates.length >= 3}>
            {saved ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {saved ? "Candidate added" : candidates.length >= 3 ? "Three candidates selected" : "Add candidate"}
          </Button>
          <p className="text-xs leading-5 text-content-muted">Sun and Earth analysis is not connected.</p>
        </>
      ) : <p className="text-sm leading-6 text-content-muted">Select a location on the map or search for coordinates.</p>}

      {children}

      {candidates.length > 0 ? (
        <section aria-label="Candidate locations" className="candidate-section">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">Candidates</h3><span className="text-xs text-content-muted">{candidates.length} / 3</span></div>
          <ol className="mt-2 space-y-1">
            {candidates.map((site, index) => (
              <li key={`${site.latitude}/${site.longitude}`} className="candidate-row">
                <Button variant="ghost" className="min-w-0 flex-1 justify-start gap-3 px-2 py-2 text-left" onClick={() => onNavigate(site)}
                  aria-label={`Locate candidate ${index + 1}: ${site.name ?? formatMapCoordinates(site)}`}>
                  <span className="candidate-index" aria-hidden="true">{index + 1}</span>
                  <span className="min-w-0"><span className="block truncate text-xs text-content">{site.name ?? `Candidate ${index + 1}`}</span><span className="block text-xs text-content-muted">{formatMapCoordinates(site)}</span></span>
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Remove candidate ${index + 1}`} title={`Remove candidate ${index + 1}`} onClick={() => onRemove(index)}><X aria-hidden="true" /></Button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <Link href="/methodology" className="inline-flex min-h-11 items-center gap-2 text-xs text-content-muted underline underline-offset-4">Methodology <ArrowUpRight aria-hidden="true" /></Link>
    </div>
  );
}
