/** Coordinate real mission requests and retain recoverable per-site results. @author Sultan */
"use client";
import { useEffect, useRef, useState } from "react";
import { missionTimeToUtc } from "@/components/explorer/explorer-session";
import { formatMapCoordinates, type MapLocation } from "@/components/explorer/lunar-map-coordinates";
import { isRecord, validateMissionInput } from "@/lib/validation/mission-analysis";
import { isMissionAnalysis, missionReport } from "@/lib/science/mission-analysis";
import type { MissionAnalysis } from "@/types/mission-analysis";

export type AnalyzedSite = { location: MapLocation; analysis: MissionAnalysis };
type FailedSite = { location: MapLocation; message: string };
const noSites: AnalyzedSite[] = [];
const noFailures: FailedSite[] = [];
export function useMissionAnalysis(selected: MapLocation | null, candidates: MapLocation[], missionTime: string) {
  const [height, setHeight] = useState("");
  const [days, setDays] = useState(7);
  const [stepMinutes, setStepMinutes] = useState(60);
  const [adoptFrame, setAdoptFrame] = useState(false);
  const [pending, setPending] = useState<{ key: string; index: number; total: number } | null>(null);
  const [stored, setStored] = useState<{ key: string; shortlist: string | null; sites: AnalyzedSite[]; failures: FailedSite[] } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);
  const request = useRef<{ key: string; controller: AbortController } | null>(null);
  const settingsKey = JSON.stringify([missionTime, height, days, stepMinutes, adoptFrame]);
  const shortlistKey = JSON.stringify(candidates.map(location => [location.latitude, location.longitude, location.name ?? null]));
  const contextKey = `${settingsKey}/${selected?.latitude}/${selected?.longitude}/${shortlistKey}`;
  useEffect(() => () => {
    if (request.current?.key === contextKey) request.current.controller.abort();
  }, [contextKey]);
  const current = stored?.key === settingsKey && (stored.shortlist === null || stored.shortlist === shortlistKey) ? stored : null;
  const sites = current?.sites ?? noSites;
  const failures = current?.failures ?? noFailures;
  const activeSite = sites.find(site => site.location.latitude === selected?.latitude && site.location.longitude === selected.longitude) ?? null;
  const first = sites[0]?.analysis;
  const sampleCount = first?.sun.status === "ready" ? first.sun.samples.length : first?.earth.status === "ready" ? first.earth.samples.length : 0;
  const index = Math.max(0, Math.min(sampleIndex, sampleCount - 1));
  const ready = selected !== null && missionTimeToUtc(missionTime) !== null && height.trim() !== "" && Number.isFinite(Number(height)) && adoptFrame;
  const loading = pending?.key === contextKey;

  async function run(compare = false) {
    const locations = compare ? candidates : selected ? [selected] : [];
    if (locations.length === 0 || compare && locations.length < 2) return;
    const startUtc = missionTimeToUtc(missionTime);
    if (!startUtc) { setError({ key: contextKey, message: "Choose a UTC mission time." }); return; }
    const endUtc = new Date(Date.parse(startUtc) + days * 86_400_000).toISOString();
    const inputs = locations.map(location => validateMissionInput({ observer: { latitude: location.latitude, longitude: location.longitude,
      heightMeters: height.trim() === "" ? null : Number(height), coordinateBasis: adoptFrame ? "adopted_mean_earth" : null }, startUtc, endUtc, stepMinutes }));
    const invalid = inputs.find(input => !input.success);
    if (invalid && !invalid.success) { setError({ key: contextKey, message: invalid.issues[0]?.message ?? "Check the analysis inputs." }); return; }
    request.current?.controller.abort();
    const controller = new AbortController(); request.current = { key: contextKey, controller };
    setError(null); setPending({ key: contextKey, index: 1, total: locations.length });
    const nextSites: AnalyzedSite[] = [], nextFailures: FailedSite[] = [];
    try {
      for (const [item, validation] of inputs.entries()) {
        const location = locations[item];
        if (!location || !validation.success) continue;
        if (controller.signal.aborted) return;
        setPending({ key: contextKey, index: item + 1, total: locations.length });
        try {
          const response = await fetch("/api/analysis", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validation.input), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65_000)]) });
          const value: unknown = await response.json();
          if (!response.ok || !isRecord(value) || value.status !== "ready" || !isMissionAnalysis(value.analysis)) {
            throw new Error(isRecord(value) && typeof value.message === "string" && value.message.length <= 250 ? value.message : "Analysis returned an invalid response.");
          }
          // Reject a stale or mismatched response even if its own values are well formed.
          if (JSON.stringify(value.analysis.input) !== JSON.stringify(validation.input)) throw new Error("Analysis inputs did not match the request.");
          nextSites.push({ location, analysis: value.analysis });
        } catch (failure) {
          if (controller.signal.aborted) return;
          nextFailures.push({ location, message: failure instanceof Error && failure.name === "TimeoutError" ? "Analysis timed out. Retry shortly." : failure instanceof Error ? failure.message : "Analysis unavailable." });
        }
      }
      if (controller.signal.aborted) return;
      setStored({ key: settingsKey, shortlist: compare ? shortlistKey : null, sites: nextSites, failures: nextFailures }); setSampleIndex(0);
      if (nextSites.length === 0) setError({ key: contextKey, message: nextFailures.length > 1 ? "No site analysis could be completed." : nextFailures[0]?.message ?? "Analysis unavailable." });
    } finally { if (request.current?.controller === controller) { request.current = null; setPending(null); } }
  }

  function downloadReport() {
    if (sites.length === 0) return;
    const report = missionReport(sites.map(site => ({ name: site.location.name ?? formatMapCoordinates(site.location), analysis: site.analysis })),
      failures.map(failure => ({ name: failure.location.name ?? formatMapCoordinates(failure.location), message: failure.message })));
    const url = URL.createObjectURL(new Blob([report], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `moonline-mission-${sites[0]?.analysis.input.startUtc.slice(0, 10)}.md`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { height, setHeight, days, setDays, stepMinutes, setStepMinutes, adoptFrame, setAdoptFrame, sites, failures, activeSite, sampleCount, sampleIndex: index, setSampleIndex,
    ready, loading, pending, error: error?.key === contextKey ? error.message : null, comparison: current?.shortlist !== null && current !== null,
    run, cancel: () => request.current?.controller.abort(), timelineOpen, setTimelineOpen, downloadReport };
}
export type MissionAnalysisControls = ReturnType<typeof useMissionAnalysis>;
