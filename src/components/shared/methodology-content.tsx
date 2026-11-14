/**
 * Explain the implemented scope and requirements for traceable lunar geometry.
 * @author Sultan
 */
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MethodologyContent() {
  return (
    <div className="space-y-6">
      <header className="page-header">
        <div><h1>Methodology</h1><p className="mt-2 text-sm text-content-muted">Sources, conventions, and the limits of geometric visibility.</p></div>
        <Button asChild variant="outline"><Link href="/explorer"><ArrowLeft aria-hidden="true" /> Back to Explorer</Link></Button>
      </header>
      <section className="scope-note" aria-labelledby="implementation-heading">
        <h2 id="implementation-heading">Current implementation</h2>
        <p className="mt-2 text-sm leading-6 text-content-muted">Explorer and Site comparison use live Sun/Earth geometry for up to three sites. Enter coordinates or bring Explorer candidates, choose common settings, inspect visibility timelines and download reports with inputs, sources and unavailable results.</p>
        <Link href="/comparison" className="source-link mt-3">Compare sites <ArrowUpRight aria-hidden="true" /></Link>
      </section>
      <div className="methodology-grid">
        <section className="workspace-panel" aria-labelledby="sources-heading">
          <h2 id="sources-heading">Scientific sources</h2>
          <div className="mt-4 space-y-5 text-sm leading-6">
            <div><a className="source-link" href="https://ssd-api.jpl.nasa.gov/doc/horizons.html">NASA JPL Horizons <ArrowUpRight aria-hidden="true" /></a><p className="mt-1 text-content-muted">Airless target-center azimuth and elevation for a lunar observer. Results retain the returned ephemeris, frame, API version, query and retrieval time.</p></div>
            <div><a className="source-link" href="https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon">NASA Moon Trek <ArrowUpRight aria-hidden="true" /></a><p className="mt-1 text-content-muted">Global and south-polar imagery, relief and independent overlays. Coverage and resolution vary by layer. Hillshade uses fixed lighting; it does not depict sunlight at the analysis time.</p></div>
            <div><a className="source-link" href="https://ode.rsl.wustl.edu/moon/">Lunar Orbital Data Explorer <ArrowUpRight aria-hidden="true" /></a><p className="mt-1 text-content-muted">Potential terrain source. Terrain obstruction is unavailable: raster images do not supply a numeric elevation model or terrain horizon.</p></div>
            <p className="text-content-muted">Moon Trek source research: Rameen.</p>
          </div>
        </section>
        <section id="observer-model" className="workspace-panel" aria-labelledby="conventions-heading">
          <h2 id="conventions-heading">Coordinates and time</h2>
          <p className="mt-4 text-sm leading-6 text-content-muted">Map coordinates use the Moon 2000 sphere, radius 1,737,400 m, with positive-east longitude. Analysis requires explicit adoption of those numeric coordinates as Horizons mean-Earth geodetic inputs. No map-to-ephemeris frame transformation is verified.</p>
          <p className="mt-4 text-sm leading-6 text-content-muted">Height is metres relative to that reference sphere. “Use 0 m” deliberately selects its surface; missing height stays missing. At either exact pole, astronomical azimuth is undefined.</p>
          <p className="mt-4 text-sm leading-6 text-content-muted">All times are UTC. Results retain timestamps and sampling intervals. Future UTC uses Horizons&apos; latest known leap-second correction.</p>
        </section>
        <section className="workspace-panel" aria-labelledby="visibility-heading">
          <h2 id="visibility-heading">Ideal geometric horizon</h2>
          <p className="mt-4 text-sm leading-6 text-content-muted">Target-center elevation greater than 0° is above the ideal local tangent horizon. Rise/set crossings are linearly interpolated; crossings between samples may be missed. Open boundaries mean a crossing was not observed, including at the requested range or a missing-data gap.</p>
          <p className="mt-4 text-sm leading-6 text-content-muted">Terrain, horizon dip, target-disc effects and atmospheric refraction are excluded. These results do not establish usable power, a communications link or landing safety.</p>
        </section>
        <section className="workspace-panel" aria-labelledby="availability-heading">
          <h2 id="availability-heading">Data availability</h2>
          <p className="mt-4 text-sm leading-6 text-content-muted">Per-target and per-site errors remain visible. Charts keep missing samples as gaps; missing elevations make total visible hours unknown. Time controls and text expose values without relying on the chart.</p>
          <p className="mt-4 text-sm leading-6 text-content-muted">Comparison uses the same UTC window, sample step, reference height and observer assumptions across sites. Failed sites remain identified in reports.</p>
        </section>
      </div>
    </div>
  );
}
