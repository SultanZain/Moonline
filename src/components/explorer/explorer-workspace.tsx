/**
 * Present the first-run explorer with explicit availability and no simulated results.
 * @author Sultan
 */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExplorerWorkspace() {
  return (
    <div className="space-y-6">
      <header className="page-header">
        <div><h1>Mission Explorer</h1><p className="mt-2 text-sm text-content-muted">Explore lunar locations. Understand Sun and Earth geometry.</p></div>
        <p className="text-xs text-content-subtle">Phase 1 · Foundation</p>
      </header>

      <div className="explorer-grid">
        <section className="workspace-panel" aria-labelledby="surface-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="surface-heading">Lunar surface</h2>
            <span className="text-xs text-content-subtle">Map not connected</span>
          </div>
          <div className="map-empty">
            <div className="max-w-md">
              <h3 className="text-lg font-medium">The workspace starts here.</h3>
              <p className="mt-3 text-sm leading-6 text-content-muted">Lunar imagery and site selection will be available after the Moon Trek projection and tile service are verified.</p>
              <Button asChild className="mt-6"><Link href="/methodology">Read the methodology <ArrowUpRight aria-hidden="true" /></Link></Button>
            </div>
          </div>
          <p className="text-xs leading-5 text-content-subtle">Planned imagery source: NASA Moon Trek. No map layer or candidate-site data is loaded.</p>
        </section>

        <aside className="space-y-6" aria-label="Site and analysis context">
          <section className="workspace-panel" aria-labelledby="observer-heading">
            <h2 id="observer-heading">Lunar observer</h2>
            <p className="mt-4 text-sm text-content-muted">No location selected</p>
            <dl className="context-list mt-4">
              <div><dt>Latitude</dt><dd>Not selected</dd></div>
              <div><dt>Longitude</dt><dd>Not selected</dd></div>
              <div><dt>Analysis interval</dt><dd>Not set</dd></div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-content-subtle">Map selection and manual coordinates are the next implementation phase.</p>
          </section>
          <section className="workspace-panel" aria-labelledby="geometry-heading">
            <h2 id="geometry-heading">Visibility analysis</h2>
            <dl className="context-list mt-4">
              <div><dt className="text-sun">Sun position</dt><dd>Not calculated</dd></div>
              <div><dt className="text-earth">Earth position</dt><dd>Not calculated</dd></div>
              <div><dt>Geometric visibility</dt><dd>Not calculated</dd></div>
              <div><dt>Terrain visibility</dt><dd>Unavailable</dd></div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-content-subtle">No ephemeris or terrain data is connected. Unknown conditions are not assumed to be unobstructed.</p>
          </section>
        </aside>
      </div>

      <section className="scope-note" aria-labelledby="scope-heading">
        <h2 id="scope-heading">What a visibility result means</h2>
        <p className="mt-2 text-sm leading-6 text-content-muted">An object above the ideal geometric horizon may still be obstructed by terrain. Sun visibility does not establish usable power; Earth visibility does not establish a communications link.</p>
      </section>
    </div>
  );
}
