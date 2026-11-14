# Moonline

A lunar exploration and geometric visibility planning aid. This directory is the single application root.

Explorer combines NASA Moon Trek imagery with live NASA JPL Horizons Sun/Earth geometry, sampled visibility, comparison and Markdown reports.

Explorer occupies the available screen with global and south-polar WAC imagery, LOLA relief, and five independent polar overlays: terrain detail, Malapert NAC hillshade and imagery, slope classes, and shot counts. Search NASA lunar names or enter coordinates, select a location on the map, save up to three candidates, and export their coordinates with an entered UTC mission time. Floating controls provide layers, opacity, zoom, reset and fullscreen. Each raster keeps its published tile matrix and zoom limit, including valid columns beyond the old square bounds.

Exploration links preserve the selected location, candidates, UTC time and view/layer settings across reloads. The inspector can load a Moonline candidate export after showing a preview; Back restores the previous exploration after a confirmed import. Files are read locally and bounded to 16 KB. Older exports remain loadable. Imported coordinates and labels are user inputs and do not constitute verified observers or scientific results.

Frame the saved candidates together with Show all or the map fit control. Selected sites retain their numbered pins. Clear and Undo affect only the shortlist; selection and mission time remain. Shortlist undo lasts until another candidate edit or confirmed import and is not saved in shared links or files.

To analyze a site, enter a UTC start time, choose a 1/7/14/30-day window and a 10/30/60/180/360-minute sample step, supply a reference-sphere height, and explicitly adopt the mean-Earth coordinate assumption. “Use 0 m” deliberately selects the mathematical reference surface; missing height is never zero. Analyze one site or compare two or three saved candidates under common settings. The timeline provides Sun/Earth charts, sample values and visibility windows; reports retain inputs, provenance, crossings, windows and failed-site results.

Map navigation uses conversions checked against NASA's native polar nomenclature coordinates. Analysis deliberately treats the supplied numbers as Horizons mean-Earth geodetic coordinates; a map-to-ephemeris frame transformation remains unverified. Heights refer to the 1,737,400 m sphere. Visibility means an airless target center above its ideal tangent horizon. Crossings are interpolated between samples, open boundaries remain marked, and missing samples make total visibility unknown. Terrain obstruction, horizon dip, target-disc effects, usable power, communications links and landing safety are excluded. Fixed hillshade does not show mission-time sunlight. The separate radar comparison preview remains clearly labelled synthetic.

The API accepts explicit minute-precision UTC inputs within 1972–2099, a window up to 31 days and at most 1,500 samples. Choose a compatible window/step combination. Future UTC uses Horizons' latest known leap-second correction. Source research for Moon Trek: Rameen; application integration: Sultan.

## Local development

Use Node.js 22 or later and pnpm 12.11.2:

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. No environment variables are required. DM Sans is served locally; imagery requires browser access to Moon Trek, and analysis requires server access to JPL Horizons.

## Verification

```sh
pnpm verify
```

This runs TypeScript checks, ESLint, contributor ownership tests, a production build, and science/browser tests against that build. Individual checks are available as `pnpm typecheck`, `pnpm lint`, `pnpm test:ownership`, `pnpm build`, and `pnpm test`. Build before running the browser tests independently.

Tests use the installed Microsoft Edge browser with one worker on Windows to bound local memory use. On other platforms, install Playwright Chromium with `pnpm exec playwright install chromium` before running tests. Browser tests cover coordinate reference cases, search and cancellation, selection, layer changes, keyboard controls, focus, fullscreen, responsive layout, published tile bounds, the 50°S/45°E coverage counterexample, failed/malformed/stalled tiles, and dataset-specific nodata. Synthetic PNG/JPEG fixtures are used only through intercepted test requests; the application never imports them or substitutes imagery after a provider failure.

Session tests cover valid/invalid calendar dates, strict UTC inputs, shared state and source limits, legacy exports, import previews/cancellation, oversized or incompatible files, reload/history restoration, clipboard fallback, the mobile fullscreen flow and bounded history writes during panning.

The reference fixture records the NASA source URL, retrieval time, source coordinate system and native projected coordinates. Transport fixtures verify application behavior; they do not establish live imagery coverage or scientific accuracy. The column-16/17 and 50°S/45°E counterexamples were independently checked against nonblank NASA PNGs.

Science reference fixtures in `tests/science/fixtures` archive actual Sun/Earth Horizons responses, request URLs and retrieval times. Tests check their angles and returned frame/figure metadata, bounded UTC inputs, malformed responses and missing-data behavior. Clearly synthetic horizon cases isolate crossing interpolation and open-window handling; they are not lunar-site observations. Provider failures remain visible rather than loading fixtures in the application.

## Project guidance

- [AGENTS.md](AGENTS.md): operating rules and verification discipline.
- [architecture.md](architecture.md): stack, boundaries, scientific data flow, and implementation order.
- [design.md](design.md): tokens, interactions, responsive behavior, and accessibility.
- [CONTRIBUTING.md](CONTRIBUTING.md): Sultan/Rameen assignments, branch workflow, PR review, and repository protection setup.

Local skills in `.agents/skills` support relevant tasks; they are not application runtime dependencies.

Rameen's `p2-coordinates` contract remains a separate route toward verified map-to-observer compatibility. The current workflow explains its adopted observer model at `/methodology#observer-model`; it does not claim that conversion is implemented.
