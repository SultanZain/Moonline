# Moonline

A lunar exploration and geometric visibility planning aid. This directory is the single application root.

The current milestone is Phase 2 from [architecture.md](architecture.md): an interactive OpenLayers lunar workspace with NASA Moon Trek imagery.

Explorer occupies the available screen with global and south-polar WAC imagery, LOLA relief, and five independent polar overlays: terrain detail, Malapert NAC hillshade and imagery, slope classes, and shot counts. Search NASA lunar names or enter coordinates, select a location on the map, save up to three candidates, and export their coordinates with an entered UTC mission time. Floating controls provide layers, opacity, zoom, reset and fullscreen. Each raster keeps its published tile matrix and zoom limit, including valid columns beyond the old square bounds.

Exploration links preserve the selected location, candidates, UTC time and view/layer settings across reloads. The inspector can load a Moonline candidate export after showing a preview; Back restores the previous exploration after a confirmed import. Files are read locally and bounded to 16 KB. Older exports remain loadable. Imported coordinates and labels are user inputs and do not constitute verified observers or scientific results.

Map navigation uses conversions checked against NASA's native polar nomenclature coordinates. It does not define an astronomical observer. Ephemeris retrieval, visibility timelines, scientific comparison and mission reports still require verified science contracts and calculations. Raster imagery does not supply terrain heights or show illumination at a mission date. The radar comparison remains a clearly labelled synthetic UI preview.

## Local development

Use Node.js 22 or later and pnpm 12.11.2:

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. No environment variables are required. DM Sans is served locally from the installed font package; live imagery requires browser access to NASA Moon Trek.

## Verification

```sh
pnpm verify
```

This runs TypeScript checks, ESLint, contributor ownership tests, a production build, and browser tests against that build. Individual checks are available as `pnpm typecheck`, `pnpm lint`, `pnpm test:ownership`, `pnpm build`, and `pnpm test`. Build before running the browser tests independently.

Tests use the installed Microsoft Edge browser with one worker on Windows to bound local memory use. On other platforms, install Playwright Chromium with `pnpm exec playwright install chromium` before running tests. Browser tests cover coordinate reference cases, search and cancellation, selection, layer changes, keyboard controls, focus, fullscreen, responsive layout, published tile bounds, the 50°S/45°E coverage counterexample, failed/malformed/stalled tiles, and dataset-specific nodata. Synthetic PNG/JPEG fixtures are used only through intercepted test requests; the application never imports them or substitutes imagery after a provider failure.

Session tests cover valid/invalid calendar dates, strict UTC inputs, shared state and source limits, legacy exports, import previews/cancellation, oversized or incompatible files, reload/history restoration, clipboard fallback, the mobile fullscreen flow and bounded history writes during panning.

The reference fixture records the NASA source URL, retrieval time, source coordinate system and native projected coordinates. Transport fixtures verify application behavior; they do not establish live imagery coverage or scientific accuracy. The column-16/17 and 50°S/45°E counterexamples were independently checked against nonblank NASA PNGs.

## Project guidance

- [AGENTS.md](AGENTS.md): operating rules and verification discipline.
- [architecture.md](architecture.md): stack, boundaries, scientific data flow, and implementation order.
- [design.md](design.md): tokens, interactions, responsive behavior, and accessibility.
- [CONTRIBUTING.md](CONTRIBUTING.md): Sultan/Rameen assignments, branch workflow, PR review, and repository protection setup.

Local skills in `.agents/skills` support relevant tasks; they are not application runtime dependencies.

The next scientific dependency is `p2-coordinates`: an exported observer-coordinate contract, runtime validation, and reference/boundary tests. Rameen's contract must establish the frame and height/datum conventions before map selections become ephemeris inputs. No terrain clearance, power availability, communications reliability, or landing-safety claim is supported by the current application.
