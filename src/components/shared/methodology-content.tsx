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
        <p className="mt-2 text-sm leading-6 text-content-muted">The application foundation and navigation are implemented. Map imagery, site selection, ephemeris retrieval, visibility calculations, and comparison are not yet implemented. There are no scientific results or synthetic datasets in this workspace.</p>
      </section>
      <div className="methodology-grid">
        <section className="workspace-panel" aria-labelledby="sources-heading">
          <h2 id="sources-heading">Scientific sources</h2>
          <div className="mt-4 space-y-5 text-sm leading-6">
            <div><a className="source-link" href="https://ssd-api.jpl.nasa.gov/doc/horizons.html">NASA JPL Horizons <ArrowUpRight aria-hidden="true" /></a><p className="mt-1 text-content-muted">Planned source for Sun and Earth ephemeris data. The lunar surface observer configuration must be verified before results are displayed.</p></div>
            <div><a className="source-link" href="https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon">NASA Moon Trek <ArrowUpRight aria-hidden="true" /></a><p className="mt-1 text-content-muted">Planned lunar imagery source. Layer coverage, projection, tile matrices, and browser access must be checked against service capabilities.</p></div>
            <div><a className="source-link" href="https://ode.rsl.wustl.edu/moon/">Lunar Orbital Data Explorer <ArrowUpRight aria-hidden="true" /></a><p className="mt-1 text-content-muted">Potential source for future terrain analysis. No elevation dataset or local terrain horizon is currently implemented.</p></div>
          </div>
        </section>
        <section className="workspace-panel" aria-labelledby="conventions-heading">
          <h2 id="conventions-heading">Coordinates and time</h2>
          <p className="mt-4 text-sm leading-6 text-content-muted">A result must identify the lunar coordinate system, latitude convention, longitude direction, observer height and datum, reference frame, and time scale used.</p>
          <p className="mt-4 text-sm leading-6 text-content-muted">These conventions have not yet been verified against the provider workflow. No coordinate transformation or local horizon calculation is claimed.</p>
          <p className="mt-4 text-sm leading-6 text-content-muted">Analysis times must be explicit. Local time must never be silently treated as UTC. Sampling interval, retrieval time, and calculation method will accompany every result.</p>
        </section>
        <section className="workspace-panel" aria-labelledby="visibility-heading">
          <h2 id="visibility-heading">Ideal geometric horizon</h2>
          <p className="mt-4 text-sm leading-6 text-content-muted">The planned geometric test considers the target center above the ideal local horizon when elevation is greater than 0°. At or below 0°, the target center is not above that horizon.</p>
          <p className="mt-4 text-sm leading-6 text-content-muted">This test does not include local terrain obstruction, apparent angular radius, or refraction corrections. It does not establish solar power, communications reliability, or landing safety.</p>
        </section>
        <section className="workspace-panel" aria-labelledby="availability-heading">
          <h2 id="availability-heading">Data availability</h2>
          <p className="mt-4 text-sm leading-6 text-content-muted">Not selected, not calculated, unavailable, and failed are distinct states. Missing elevations must remain missing, and missing visibility must remain unknown.</p>
          <p className="mt-4 text-sm leading-6 text-content-muted">Provider failures will be shown as errors. Future charts must show gaps for missing samples and include units, a time scale, and a textual or tabular alternative.</p>
        </section>
      </div>
    </div>
  );
}
