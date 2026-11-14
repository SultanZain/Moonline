# MOONLINE — System Architecture

## 1. Project Overview

MOONLINE is a web-based lunar mission-planning platform for evaluating and comparing potential lunar landing regions based on solar illumination and Earth visibility.

The platform helps users understand how the Sun and Earth appear relative to a selected lunar location over a chosen time period.

The system must prioritize scientific correctness, transparent calculations, traceable data sources, and clear visualization.

### Core capabilities

- Explore the lunar surface using an interactive map.
- Select predefined candidate regions or enter custom coordinates.
- Select a date and analysis time range.
- Calculate the Sun's and Earth's apparent positions relative to a lunar observer.
- Identify geometric visibility periods.
- Visualize solar and Earth visibility over time.
- Compare multiple candidate locations using consistent calculation settings.
- Explain data sources, assumptions, calculation methods, and limitations.

### Explicit scope boundaries

MOONLINE is not a certified landing-site selection or mission-safety system.

The following concepts must remain separate:

1. **Astronomical position:** Calculated apparent position of the Sun or Earth relative to the selected lunar observer.
2. **Geometric visibility:** Whether an object is above the ideal local geometric horizon.
3. **Terrain-adjusted visibility:** Whether local lunar terrain obstructs the line of sight.
4. **Operational suitability:** Whether a location meets actual mission requirements.

A positive geometric visibility result does not establish terrain clearance, sufficient power generation, communication-link availability, or landing safety.

---

## 2. Technology Stack

Use one Next.js application for the frontend and lightweight backend functionality.

| Area | Technology |
|---|---|
| Framework | Next.js App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI components | shadcn/ui |
| Component primitives | Radix UI |
| Icons | Lucide React |
| Lunar map | OpenLayers |
| Scientific charts | Apache ECharts |
| Validation | Zod |
| Date utilities | date-fns |
| Hosting | Vercel |
| Package manager | pnpm |

### Technology rules

- Use `pnpm` exclusively. Do not use npm or yarn.
- Use strict TypeScript.
- Use shadcn/ui components where appropriate.
- Keep scientific calculations independent of UI components.
- Do not introduce additional libraries without a concrete requirement.
- Do not add Redux or another global state library by default.
- Do not introduce a database, authentication system, Python service, queue, or separate backend for the initial MVP.
- Do not introduce 3D rendering until the core 2D map, scientific calculations, timelines, and comparison workflow are functional.

---

## 3. System Architecture

MOONLINE uses a single Next.js application deployed to Vercel.

The application has three logical layers:

### A. Presentation layer

Responsible for:

- Application layout and navigation.
- Lunar map rendering.
- User input and site selection.
- Date and time controls.
- Scientific charts and comparison views.
- Loading, empty, and error states.

The presentation layer must not contain provider-specific API logic or complex scientific calculations.

### B. Application and API layer

Responsible for:

- Validating requests.
- Calling external scientific data providers.
- Normalizing provider responses.
- Coordinating scientific calculations.
- Applying caching and resource limits.
- Returning consistent typed responses.

Use Next.js Route Handlers for server-side integrations when required.

### C. Scientific domain layer

Responsible for:

- Coordinate handling.
- Time handling.
- Astronomical data normalization.
- Geometric visibility calculations.
- Time-series generation.
- Site comparison.
- Provenance and calculation metadata.

This layer must remain independent of React and Next.js wherever practical.

### System flow

```text
                  USER
                   |
                   v
           NEXT.JS APPLICATION
                   |
          ---------------------
          |                   |
          v                   v
     PRESENTATION        APPLICATION API
          |                   |
          |              VALIDATION
          |                   |
          |              PROVIDERS
          |                   |
          |          -------------------
          |          |                 |
          |          v                 v
          |     JPL HORIZONS       NASA MOON TREK
          |          |                 |
          |          v                 v
          |      NORMALIZATION / DATA PROCESSING
          |                   |
          |                   v
          |            SCIENTIFIC DOMAIN
          |                   |
          ---------------------
                   |
                   v
             VISUALIZATION
```

The diagram represents logical responsibilities, not separate deployed services.

---

## 4. Project Structure

Keep the project structure simple and feature-oriented.

```text
moonline/
│
├── public/
│
├── docs/
│
├── src/
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   │
│   │   ├── explorer/
│   │   │   └── page.tsx
│   │   │
│   │   ├── analysis/
│   │   │   └── page.tsx
│   │   │
│   │   ├── comparison/
│   │   │   └── page.tsx
│   │   │
│   │   ├── methodology/
│   │   │   └── page.tsx
│   │   │
│   │   └── api/
│   │       ├── sites/
│   │       │   └── route.ts
│   │       │
│   │       ├── ephemeris/
│   │       │   └── route.ts
│   │       │
│   │       ├── analysis/
│   │       │   └── route.ts
│   │       │
│   │       └── comparison/
│   │           └── route.ts
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── explorer/
│   │   ├── analysis/
│   │   ├── comparison/
│   │   └── shared/
│   │
│   ├── lib/
│   │   ├── api/
│   │   ├── astronomy/
│   │   ├── science/
│   │   ├── dates/
│   │   ├── validation/
│   │   └── utils/
│   │
│   ├── hooks/
│   ├── types/
│   └── config/
│
├── AGENTS.md
├── architecture.md
├── design.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── next.config.ts
```

This is the intended logical organization, not a requirement to create empty folders or files in advance.

Create files when actual implementation requires them.

### Responsibility boundaries

- `app/`: Pages, layouts, and Route Handlers.
- `components/ui/`: shadcn/ui primitives.
- `components/layout/`: Application shell and navigation.
- `components/explorer/`: Map and site exploration components.
- `components/analysis/`: Analysis-specific components.
- `components/comparison/`: Comparison-specific components.
- `components/shared/`: Reusable product-level components.
- `lib/api/`: Provider clients and API utilities.
- `lib/astronomy/`: Astronomical calculations and coordinate handling.
- `lib/science/`: Visibility analysis and scientific processing.
- `lib/dates/`: Time and date utilities.
- `lib/validation/`: Zod schemas.
- `config/`: Application configuration and static configuration.

Pages should primarily compose components and coordinate page-level state. Do not put large scientific calculations or provider integrations inside page components.

---

## 5. External Scientific Data Sources

### 5.1 NASA JPL Horizons

Documentation: https://ssd-api.jpl.nasa.gov/doc/horizons.html

https://ssd.jpl.nasa.gov/api/horizons.api

Use JPL Horizons as the primary source for astronomical ephemeris data.

Relevant target identifiers:

| Object | Horizons target |
|---|---|
| Sun | `10` |
| Earth | `399` |

The integration must calculate the apparent position of the selected target relative to a correctly configured lunar observer.

Important: Do not assume that a standard Earth-based observer configuration produces valid lunar surface observations.

Before implementing calculations, verify:

- Observer location configuration.
- Lunar coordinate system.
- Longitude convention.
- Reference frame.
- Reference plane.
- Time scale.
- Output format.
- Angular units.
- Whether returned coordinates are appropriate for the intended horizon calculations.

Do not silently substitute a different coordinate system or calculation method.

Provider-specific parameters should be isolated inside the Horizons integration.

### 5.2 NASA Moon Trek

Website:

https://trek.nasa.gov/moon/

Tile API documentation:

https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon

Use Moon Trek for lunar map imagery and available scientific map layers.

Before implementing the map:

- Inspect the available WMTS services.
- Inspect `GetCapabilities`.
- Identify supported projections.
- Identify tile matrix sets.
- Identify available layers and styles.
- Verify tile access and browser CORS behavior.

Do not assume that all Moon Trek layers use Web Mercator.

Use OpenLayers because it supports custom projections and tile services more flexibly than a basic web map implementation.

### 5.3 Lunar terrain data

Potential source:

https://ode.rsl.wustl.edu/moon/

LOLA-derived elevation data can support future terrain-adjusted visibility calculations.

Terrain analysis is optional for the initial MVP.

Do not claim terrain-adjusted visibility unless an actual elevation dataset and local horizon calculation have been implemented and validated.

### 5.4 NAIF SPICE

Documentation:

https://naif.jpl.nasa.gov/naif/

SPICE can support more advanced coordinate transformations and ephemeris calculations.

It is not a mandatory MVP dependency.

Consider it only if the selected Horizons workflow cannot reliably provide the required observer-relative geometry or if more advanced validation becomes necessary.

---

## 6. Scientific Calculation Architecture

Scientific calculations must be independent of the interface.

Do not calculate scientific values directly inside React components.

### 6.1 Astronomical position

For a selected lunar location and time:

1. Resolve the lunar observer location.
2. Resolve the requested time or time interval.
3. Request the required astronomical data.
4. Normalize the returned data.
5. Convert to the required local coordinate representation.
6. Produce a typed result with source and calculation metadata.

The exact transformation must be verified against the selected coordinate conventions.

### 6.2 Local horizon coordinates

The application needs an appropriate local horizontal coordinate system for the lunar observer.

At minimum, calculations should produce:

- Azimuth.
- Elevation.

The implementation must document:

- Azimuth origin.
- Azimuth direction.
- Elevation reference.
- Reference frame.
- Coordinate transformations.
- Any assumptions about the local observer orientation.

Do not assume a coordinate conversion is correct merely because the resulting values look plausible.

### 6.3 Geometric visibility

For an ideal geometric horizon:

```text
elevation > 0 degrees  => geometrically above horizon
elevation <= 0 degrees => geometrically at or below horizon
```

This is a simplified geometric test.

If apparent angular radius, refraction, or other corrections are not implemented, state that clearly.

Do not label this result as terrain-adjusted visibility.

### 6.4 Terrain-adjusted visibility

This is a separate calculation.

It requires:

1. An elevation dataset.
2. A defined observer position and height.
3. A local horizon profile.
4. A line-of-sight comparison.
5. Documented terrain resolution and limitations.

If the required data is unavailable, return an unavailable result rather than assuming unobstructed visibility.

### 6.5 Operational suitability

Operational suitability is outside the initial scope.

Geometric Sun visibility does not establish sufficient solar power.

Geometric Earth visibility does not establish a functioning communication link.

A site must never be described as safe or mission-ready based only on the calculations in this application.

---

## 7. API Design

Use Next.js Route Handlers for server-side data integrations.

Keep API contracts typed and validate external inputs with Zod.

Proposed endpoints:

### `GET /api/sites`

Returns predefined candidate sites.

Example:

```json
{
  "sites": [
    {
      "id": "shackleton-region",
      "name": "Shackleton Region",
      "latitude": -89.9,
      "longitude": 0
    }
  ]
}
```

The example is illustrative. Actual site coordinates must be researched and verified before inclusion.

### `POST /api/ephemeris`

Requests astronomical position data for a lunar observer.

Example request:

```json
{
  "observer": {
    "latitude": -89.9,
    "longitude": 0
  },
  "targets": ["sun", "earth"],
  "startTime": "2026-11-13T00:00:00Z",
  "endTime": "2026-11-14T00:00:00Z",
  "stepMinutes": 10
}
```

The request schema must explicitly define coordinate conventions and time interpretation. Do not rely on undocumented defaults.

### `POST /api/analysis`

Processes ephemeris data into visibility results and analysis time series.

Example request:

```json
{
  "observer": {
    "latitude": -89.9,
    "longitude": 0
  },
  "startTime": "2026-11-13T00:00:00Z",
  "endTime": "2026-11-14T00:00:00Z",
  "stepMinutes": 10
}
```

### `POST /api/comparison`

Compares multiple sites using identical analysis settings.

Example request:

```json
{
  "sites": [
    {
      "id": "site-a",
      "latitude": -89.9,
      "longitude": 0
    },
    {
      "id": "site-b",
      "latitude": -89.5,
      "longitude": 15
    }
  ],
  "startTime": "2026-11-13T00:00:00Z",
  "endTime": "2026-11-14T00:00:00Z",
  "stepMinutes": 10
}
```

### API response principles

- Use consistent response envelopes.
- Validate incoming requests.
- Normalize external provider responses.
- Return meaningful errors.
- Preserve missing values as missing.
- Include calculation and source metadata.
- Do not expose provider credentials or secrets.
- Do not return fabricated fallback data.

The exact response schemas should be defined alongside their implementations using TypeScript and Zod.

---

## 8. Data Models

Use explicit types for scientific data.

Avoid loosely structured objects and untyped provider responses.

The following are conceptual shapes, not mandatory database schemas.

### Observer location

```ts
interface LunarObserver {
  latitude: number;
  longitude: number;
  coordinateSystem: string;
  longitudeConvention: string;
}
```

### Astronomical position

```ts
interface CelestialPosition {
  target: "sun" | "earth";
  timestamp: string;
  azimuthDeg: number;
  elevationDeg: number;
}
```

### Visibility result

```ts
interface VisibilityResult {
  target: "sun" | "earth";
  timestamp: string;
  geometricallyVisible: boolean | null;
  elevationDeg: number | null;
  visibilityMethod: "geometric" | "terrain-adjusted";
}
```

A `null` visibility result means the result is unknown or unavailable. It must not be interpreted as invisible.

### Analysis metadata

```ts
interface AnalysisMetadata {
  source: string;
  sourceVersion?: string;
  referenceFrame: string;
  timeScale: string;
  coordinateSystem: string;
  calculationMethod: string;
  calculationVersion: string;
  sampleIntervalMinutes: number;
  generatedAt: string;
}
```

Extend these models only when an actual feature requires additional fields.

---

## 9. Application Pages

### 9.1 Mission Explorer

Primary entry point.

Responsibilities:

- Render the lunar map.
- Display candidate site markers.
- Allow site selection.
- Allow manual coordinate entry.
- Display map layers where supported.
- Provide date and time controls.
- Show selected observer information.

The map must not be the only way to select a location.

### 9.2 Site Analysis

Responsibilities:

- Show selected site information.
- Display Sun azimuth and elevation.
- Display Earth azimuth and elevation.
- Show geometric visibility states.
- Visualize visibility over time.
- Show analysis metadata and limitations.

### 9.3 Site Comparison

Responsibilities:

- Compare two or three selected sites.
- Use identical time intervals.
- Use identical sampling intervals.
- Use identical coordinate and calculation conventions.
- Display comparable time series.
- Clearly distinguish missing or unavailable results.

Do not introduce an arbitrary overall site score.

### 9.4 Methodology

Explain:

- Scientific data sources.
- Coordinate conventions.
- Reference frames.
- Time scales.
- Calculation methods.
- Visibility definitions.
- Data limitations.
- Terrain-analysis status.

Users should be able to understand what each displayed metric means and what it does not establish.

---

## 10. Map Architecture

Use OpenLayers for lunar map rendering.

Keep map-specific implementation inside the explorer feature.

Responsibilities include:

- Map initialization.
- Projection configuration.
- Tile layer configuration.
- Candidate site markers.
- Coordinate selection.
- Viewport state.
- Layer visibility controls.

Do not assume a standard Earth map projection.

The exact projection and tile configuration must be based on the Moon Trek service capabilities.

Keep map interaction state separate from scientific analysis logic.

The Phase 2 Explorer consumes nine NASA WMTS sources through `src/config/moon-trek.ts` and a browser-only OpenLayers engine: global and polar WAC imagery and LOLA relief, plus five polar overlays. Each source has its own format and maximum zoom. Global tiles use an equirectangular Moon 2000 map; polar tiles use spherical south-polar stereographic coordinates with a radius of 1,737,400 metres. The published `default028mm` matrix sizes are `2^(z+1)` columns by `2^z` rows. No square extent, half-column cut-off, latitude-band mask or inferred layer-footprint clipping is applied. Polar source resolutions come from the published scale denominator, and global resolutions from the published angular tile span.

Tiles are fetched directly with verified CORS, a 15-second per-request deadline, six concurrent loads, image/HTTP failure handling, and cancellation on source replacement or unmount. Error status follows failures in the current viewport; retry retains selection and the view. An enabled higher-resolution overlay can raise the view's zoom limit without issuing requests beyond another source's published maximum. Only the NAC layers with a documented zero nodata value receive the black-pixel transparency mask; zero shot counts are not treated as missing elevations. Blank imagery is distinguished from a request failure and does not establish absence of coverage at every longitude.

Map-coordinate conversions and validation live in the Explorer feature. Native projected nomenclature coordinates from NASA supply independent forward/inverse reference cases in `tests/fixtures/nasa-map-coordinate-references.json`. The map scale corrects for the projection and reports horizontal reference-sphere distance at the view center, rather than terrain-following distance. These map helpers do not define observer height, altitude datum, ephemeris frame or local astronomical axes; those remain in Rameen's scientific contract.

`/api/lunar-locations` queries a fixed NASA nomenclature service, validates its coordinate system and payload, and returns at most eight map locations. The client debounces name searches and cancels stale responses; manually entered coordinates work independently of search availability. Selection opens a contextual inspector with an explicit UTC mission-time input and up to three candidate sites. The JSON export identifies map coordinates, selection, view settings and uncalculated analysis; it is not a mission report.

Candidate fitting uses native map coordinates and the current source's published grid. It switches to the global view if a saved site cannot be projected or falls outside the polar tile grid, retaining selection, mission time and polar overlay preferences. Global fitting respects the nonwrapping raster. Saved sites keep their numbered pins when selected, and candidate removal updates the numbering. Clearing affects only the shortlist and has a transient undo until another candidate edit or confirmed import; undo is not serialized into links or files.

---

## 11. Chart Architecture

Use Apache ECharts for scientific visualizations.

Required chart capabilities:

- Sun elevation over time.
- Earth elevation over time.
- Geometric visibility periods.
- Multi-site comparison.
- Clear date and time axes.

Chart requirements:

- Display units.
- Use explicit time zones or time scales.
- Distinguish Sun and Earth consistently.
- Represent missing data as gaps.
- Avoid false precision.
- Avoid misleading interpolation.
- Provide accessible labels and legends.
- Provide a textual or tabular alternative for important results.

Charts must use actual calculated data. Never populate them with illustrative values presented as scientific results.

Sultan authorized an independent UI preview at `/comparison-preview` before Phase 5 integration. It uses source-owned, explicitly synthetic fixtures in `components/comparison/preview-data.ts`, a modular Apache ECharts SVG radar loaded only on that route, and a textual comparison without an HTML table. This preview does not define the scientific contract. All five proposed axes use a shared 0–100% display range and scheduled-sample denominator; missing axes omit the entire profile shape, while known values remain inspectable. No site coordinates, dates, ephemeris, terrain, ranking or operational recommendation are simulated. The real Phase 5 comparison still depends on Rameen's verified implementation and metadata.

---

## 12. State Management

Start with React local state and URL search parameters.

Use URL parameters for shareable or reload-persistent analysis settings where appropriate.

Explorer stores its map selection, up to three candidates, entered UTC mission time and camera/layer settings in a versioned `session` query parameter. Native history updates preserve Next.js history metadata. The engine captures settled camera positions, and URL writes are debounced by 500 ms so panning and opacity changes do not repeatedly update history. Navigation and confirmed imports flush pending state first. Continuous interaction replaces the current entry; a confirmed candidate import creates one history entry so Back can restore the previous exploration. Reloads and history navigation validate the input before restoring sources, camera and markers together. Fullscreen, open popups and raster load/error status are transient and are not serialized.

Shared state is bounded to 8,192 decoded characters. Candidate files are read locally, limited to 16,384 bytes and previewed before replacement; older Moonline candidate exports remain supported. The feature validates finite map coordinates, supported map conventions, unique sites, bounded labels, explicit minute-precision UTC/calendar values, known overlays, opacity and each source's published zoom limit. Polar camera coordinates are bounded to ±1 billion metres as an application input limit, without applying a coverage mask. Missing time remains null. Imported labels are user input, not newly verified NASA nomenclature, and no observer height/frame or scientific result is inferred.

Examples:

- Selected site.
- Selected map layer.
- Analysis start and end times.
- Sampling interval.
- Comparison site IDs.

Do not introduce Redux, Zustand, or another global state library unless the actual application complexity justifies it.

Keep server data, user interface state, and scientific calculation state conceptually separate.

---

## 13. External API and Runtime Rules

### Provider integrations

- Keep external API calls behind dedicated provider modules.
- Validate external responses before using them.
- Handle timeouts and provider errors.
- Handle rate limits.
- Avoid unnecessary repeated requests.
- Cache only when the caching behavior is scientifically appropriate.
- Do not expose secrets to browser code.

### Vercel runtime

The application must be compatible with request-driven serverless execution.

Do not rely on:

- Persistent in-memory state.
- Local disk persistence.
- Long-running processes.
- Background workers that are not configured.
- Unbounded computation.

Use the Node.js runtime for provider integrations unless a concrete reason supports another runtime.

Keep analysis requests bounded with limits on date ranges, sampling intervals, number of sites, and response size.

Do not introduce background processing for the MVP.

### CORS and map tiles

Check whether Moon Trek tile services support browser access.

Use direct browser tile access where possible.

Only introduce a tile proxy if an actual CORS, security, or service limitation requires it.

---

## 14. Data Integrity and Scientific Provenance

Every scientific result must be traceable.

Where applicable, preserve:

- Observer coordinates.
- Coordinate system.
- Longitude convention.
- Reference frame.
- Time scale.
- Analysis interval.
- Sampling interval.
- Data source.
- Source version or retrieval details.
- Calculation method.
- Calculation version.
- Data retrieval or calculation timestamp.
- Terrain dataset and resolution, if applicable.

Never:

- Replace missing values with zero.
- Treat unavailable data as false.
- Invent coordinates.
- Invent scientific rankings.
- Present estimated values as measured or calculated values.
- Hide assumptions that materially affect results.
- Compare sites using different calculation settings without disclosure.

For comparisons, use consistent settings across every selected site.

---

## 15. Error Handling

Errors should be explicit and distinguishable.

Handle at least:

- Invalid coordinates.
- Invalid date ranges.
- Unsupported coordinate systems.
- Provider timeout.
- Provider rate limit.
- Provider unavailable.
- Malformed provider response.
- Insufficient data.
- Unsupported map layer.
- Calculation failure.

Do not silently display stale or fabricated data when a request fails.

Preserve the user's selected site and analysis settings when displaying errors.

Use clear loading, empty, and error states.

---

## 16. Security

- Keep provider credentials server-side.
- Never commit API keys or secrets.
- Validate all API inputs.
- Restrict request ranges and computational workload.
- Avoid trusting external provider payloads.
- Do not expose internal errors or secrets to users.
- Do not add authentication unless the product scope requires it.
- Keep dependencies limited and maintained.

---

## 17. Testing and Validation

Testing must cover both application behavior and scientific correctness.

### Application tests

- Coordinate input validation.
- Date and time validation.
- API request validation.
- Provider response normalization.
- Error handling.
- Site selection.
- Comparison behavior.

### Scientific tests

- Coordinate conversion.
- Azimuth and elevation calculations.
- Geometric visibility boundaries.
- Time-series sampling.
- Consistency between sites.
- Known reference cases where available.

Do not consider plausible-looking charts sufficient validation.

Scientific calculations should be checked against trusted reference data or independently verified calculations.

### Build verification

Before considering implementation complete, run the available project checks:

- TypeScript type checking.
- Linting.
- Tests.
- Production build.

Report the actual results. Never claim a check passed unless it was executed successfully.

---

## 18. Implementation Order

Build the product in the following order.

### Phase 1 — Foundation

- Initialize Next.js.
- Configure TypeScript and Tailwind.
- Install shadcn/ui with Radix primitives.
- Establish the application shell.
- Configure basic navigation and design tokens.

The foundation uses this directory as the single Next.js application root. `/` redirects to `/explorer`; `/methodology` documents the current implementation scope and planned scientific requirements. `/comparison-preview` is a clearly labelled synthetic UI demonstration. Only implemented destinations appear in navigation. Explorer supports NASA imagery and map-location selection; scientific observer validation, ephemeris integration, visibility calculations and scientific site comparison remain unimplemented.

`pnpm verify` runs type checking, lint, a production build, and Playwright browser tests against the production server. DM Sans is hosted locally through `@fontsource/dm-sans`. Source-owned Button and Sheet components use Radix Slot and Dialog. OpenLayers is loaded only by Explorer; no unused UI primitives or later-phase libraries are installed.

Next.js automatic agent-file generation is disabled with `agentRules: false` so `AGENTS.md` remains source-owned. The responsive Explorer context is implemented independently of scientific data through feature components and the shared Radix Sheet; no map projection or scientific convention is assumed by this layout work.

### Phase 2 — Lunar map

- Integrate OpenLayers.
- Inspect Moon Trek capabilities.
- Configure the correct projection and tile source.
- Add candidate site markers.
- Implement manual coordinate selection.

### Phase 3 — Astronomical data

- Verify the JPL Horizons lunar observer configuration.
- Implement the provider integration.
- Validate and normalize responses.
- Confirm Sun and Earth position calculations.

### Phase 4 — Visibility analysis

- Implement local horizon coordinates.
- Implement geometric visibility.
- Generate time-series data.
- Add clear visibility timelines.

### Phase 5 — Site comparison

- Support multiple candidate sites.
- Apply identical calculation settings.
- Display comparative charts and results.
- Expose provenance and limitations.

### Phase 6 — Product polish

- Complete responsive layouts.
- Improve loading, empty, and error states.
- Add methodology explanations.
- Validate accessibility.
- Test the production build.
- Prepare the demo workflow.

### Optional extensions

Only after the core workflow works:

- Terrain-adjusted visibility.
- Additional lunar scientific layers.
- Advanced SPICE integration.
- 3D lunar visualization.
- Exportable mission analysis reports.

---

## 19. MVP Definition of Done

The MVP is functional when a user can:

1. Open the lunar map.
2. Select a candidate site or enter coordinates.
3. Choose a date and time interval.
4. Retrieve verified Sun and Earth position data.
5. View azimuth and elevation over time.
6. Identify ideal geometric visibility periods.
7. Compare multiple sites using consistent settings.
8. Inspect the calculation methodology, sources, and limitations.

The MVP must not imply terrain clearance, communication-link reliability, power sufficiency, or landing safety unless those capabilities have been separately implemented and validated.

**Primary engineering objective:** Build a scientifically defensible 2D lunar analysis platform first. Keep the architecture simple, the calculations verifiable, and the displayed results traceable.
