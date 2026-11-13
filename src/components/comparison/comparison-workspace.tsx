/**
 * Let users explore a radar comparison, inspect axes and exercise missing-data behavior.
 * All values on this independent UI route are visibly synthetic.
 * @author Sultan
 */
"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { completePreview, missingPreview, previewAxes, previewValueLabel, type PreviewAxisId } from "@/components/comparison/preview-data";

const ComparisonRadar = dynamic(() => import("@/components/comparison/comparison-radar").then(module => module.ComparisonRadar), {
  ssr: false, loading: () => <p className="comparison-chart-loading" role="status">Loading radar chart…</p>,
});

export function ComparisonWorkspace() {
  const [missing, setMissing] = useState(false);
  const [hidden, setHidden] = useState<readonly string[]>([]);
  const [selectedAxis, setSelectedAxis] = useState<PreviewAxisId>("sun");
  const profiles = missing ? missingPreview : completePreview;
  const visible = useMemo(() => profiles.filter(profile => !hidden.includes(profile.id)), [profiles, hidden]);
  const axis = previewAxes.find(item => item.id === selectedAxis) ?? previewAxes[0];
  const [first, second] = profiles.map(profile => profile.values[axis.id]);
  const difference = first?.state === "known" && second?.state === "known" ? Math.abs(first.percent - second.percent) : null;
  const incomplete = visible.filter(profile => previewAxes.some(item => profile.values[item.id].state === "unavailable"));

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div><h1>Site comparison</h1><p className="mt-2 text-sm text-content-muted">See the tradeoffs. Look closer at what matters.</p></div>
        <Button asChild variant="outline"><Link href="/explorer"><ArrowLeft aria-hidden="true" /> Back to Explorer</Link></Button>
      </header>

      <section className="comparison-preview-note" aria-labelledby="preview-heading">
        <div><h2 id="preview-heading">Illustrative UI preview</h2><p className="mt-1 text-sm leading-6 text-content-muted">Synthetic profiles, not real lunar sites. These percentages are design examples, not NASA results.</p></div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Preview data scenario">
          <Button variant={missing ? "ghost" : "outline"} aria-pressed={!missing} onClick={() => setMissing(false)}>Complete data</Button>
          <Button variant={missing ? "outline" : "ghost"} aria-pressed={missing} onClick={() => setMissing(true)}>Missing data</Button>
        </div>
      </section>

      <div className="comparison-overview">
        <section className="workspace-panel" aria-labelledby="radar-heading">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 id="radar-heading">A shared view</h2><p className="mt-1 text-xs text-content-subtle">0–100% on every axis · each ring is 25%</p></div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Visible radar profiles">
              {profiles.map(profile => <Button key={profile.id} variant="ghost" aria-pressed={!hidden.includes(profile.id)}
                className={cn("px-2", hidden.includes(profile.id) && "opacity-60")}
                onClick={() => setHidden(current => current.includes(profile.id) ? current.filter(id => id !== profile.id) : [...current, profile.id])}>
                <span aria-hidden="true" className={`comparison-swatch comparison-swatch-${profile.id}`} />{profile.label}
              </Button>)}
            </div>
          </header>
          <figure className="comparison-figure" aria-labelledby="radar-heading" aria-describedby="radar-caption">
            <ComparisonRadar profiles={visible} />
            <figcaption id="radar-caption" className="text-xs leading-5 text-content-subtle">Synthetic percentages of scheduled samples. Solid circles: site A. Dashed diamonds: site B. Read exact values below; polygon area is not a suitability score.</figcaption>
          </figure>
          <p className="mt-3 text-sm text-content-muted" role="status">
            {visible.length === 0 ? "Both profiles are hidden. Show a site above to restore its shape."
              : incomplete.length > 0 ? `${incomplete.map(profile => profile.label).join(", ")} has an unavailable axis; its entire shape is omitted.`
              : `${visible.map(profile => profile.label).join(" and ")} shown.`}
          </p>
        </section>

        <section className="workspace-panel comparison-axis-detail" aria-labelledby="axis-heading" aria-live="polite" aria-atomic="true">
          <h2 id="axis-heading">Read an axis</h2>
          <h3 className="mt-6 text-xl font-medium">{axis.label}</h3>
          <p className="mt-3 text-sm leading-6 text-content-muted">{axis.description}</p>
          <dl className="comparison-axis-values">
            {profiles.map(profile => <div key={profile.id}><dt className="text-sm text-content-muted">{profile.label}</dt>
              <dd data-state={profile.values[axis.id].state} className={`comparison-value comparison-value-${profile.id}`}>{previewValueLabel(profile.values[axis.id])}</dd></div>)}
          </dl>
          <p className="mt-5 text-sm text-content-muted">{difference === null ? "Difference unavailable. An unknown value cannot be compared." : `${difference} percentage points apart in this example.`}</p>
          <p className="mt-5 text-xs leading-5 text-content-subtle">Select an axis below to inspect it. More coverage means more complete data; more geometric visibility does not establish usable power or a working communications link.</p>
        </section>
      </div>

      <section className="workspace-panel" aria-labelledby="values-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="values-heading">Every axis, in detail</h2><p className="text-xs text-content-subtle">Illustrative percentages · shared denominator</p></div>
        <div className="comparison-metrics mt-4">
          {previewAxes.map(item => <div key={item.id} className={cn("comparison-metric", selectedAxis === item.id && "comparison-metric-selected")}>
            <Button variant="ghost" aria-pressed={selectedAxis === item.id} className="justify-start px-3 text-left" onClick={() => setSelectedAxis(item.id)}>{item.label}</Button>
            <dl className="comparison-metric-values">{profiles.map(profile => <div key={profile.id}><dt className="text-xs text-content-subtle">{profile.label}</dt>
              <dd className={`text-sm font-medium comparison-value-${profile.id}`}>{previewValueLabel(profile.values[item.id])}</dd></div>)}</dl>
          </div>)}
        </div>
      </section>

      <footer className="comparison-footer text-sm leading-6 text-content-muted">
        <p>Real comparison will use the same interval, sampling and verified conventions for every site. Time windows, elevations and terrain limitations will remain inspectable alongside the overview.</p>
        <a className="source-link" href="https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=details">NASA Space Apps challenge <ArrowUpRight aria-hidden="true" /></a>
      </footer>
    </div>
  );
}
