/**
 * Present the first-run explorer with explicit availability and no simulated results.
 * @author Sultan
 */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContextSheet } from "@/components/explorer/context-sheet";
import { SiteContext } from "@/components/explorer/site-context";

export function ExplorerWorkspace() {
  return (
    <div className="space-y-6">
      <header className="page-header">
        <div><h1>Mission Explorer</h1><p className="mt-2 text-sm text-content-muted">Explore lunar locations. Understand Sun and Earth geometry.</p></div>
        <div className="flex flex-wrap items-center gap-4">
          <ContextSheet><SiteContext /></ContextSheet>
          <p className="text-xs text-content-subtle">Phase 1 · Foundation</p>
        </div>
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

        <aside className="hidden space-y-6 xl:block" aria-label="Site and analysis context">
          <SiteContext />
        </aside>
      </div>

      <section className="scope-note" aria-labelledby="scope-heading">
        <h2 id="scope-heading">What a visibility result means</h2>
        <p className="mt-2 text-sm leading-6 text-content-muted">An object above the ideal geometric horizon may still be obstructed by terrain. Sun visibility does not establish usable power; Earth visibility does not establish a communications link.</p>
      </section>
    </div>
  );
}
