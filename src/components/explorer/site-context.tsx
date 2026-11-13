/**
 * Present observer and visibility availability without inventing scientific results.
 * @author Sultan
 */
export function SiteContext() {
  return (
    <>
      <section className="workspace-panel" aria-label="Lunar observer">
        <h2>Lunar observer</h2>
        <p className="mt-4 text-sm text-content-muted">No location selected</p>
        <dl className="context-list mt-4">
          <div><dt>Latitude</dt><dd>Not selected</dd></div>
          <div><dt>Longitude</dt><dd>Not selected</dd></div>
          <div><dt>Analysis interval</dt><dd>Not set</dd></div>
        </dl>
        <p className="mt-4 text-xs leading-5 text-content-subtle">Map selection and manual coordinates are the next implementation phase.</p>
      </section>
      <section className="workspace-panel" aria-label="Visibility analysis">
        <h2>Visibility analysis</h2>
        <dl className="context-list mt-4">
          <div><dt className="text-sun">Sun position</dt><dd>Not calculated</dd></div>
          <div><dt className="text-earth">Earth position</dt><dd>Not calculated</dd></div>
          <div><dt>Geometric visibility</dt><dd>Not calculated</dd></div>
          <div><dt>Terrain visibility</dt><dd>Unavailable</dd></div>
        </dl>
        <p className="mt-4 text-xs leading-5 text-content-subtle">No ephemeris or terrain data is connected. Unknown conditions are not assumed to be unobstructed.</p>
      </section>
    </>
  );
}
