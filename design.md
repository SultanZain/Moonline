# Design System & UX — MOONLINE

This document owns visual identity, design tokens, component appearance, interaction behavior, responsive behavior, motion, and accessibility.

`AGENTS.md` owns implementation discipline. `architecture.md` owns code placement and technical boundaries.

## 1. Product experience

MOONLINE should feel like a focused lunar mission-planning instrument: precise, calm, modern, and scientifically credible.

It is not a generic SaaS dashboard and not a decorative space website.

The central user workflow is:

1. Explore the lunar surface.
2. Select a candidate site.
3. Choose a mission time interval.
4. Inspect Sun and Earth geometry.
5. Understand visibility windows and limitations.
6. Compare candidate locations.
7. Inspect the data sources and methodology.

The map is the primary workspace. Analysis should be close to the selected location and time context.

## 2. Visual direction

Use a **modern aerospace / mission-control hybrid**:
- A restrained dark interface.
- Neutral lunar imagery.
- Clear typography and compact but readable data presentation.
- Warm amber for the Sun.
- Cyan for Earth.
- Citron/lime for selected-site emphasis.
- Neutral grays for secondary information.
- Minimal decorative effects.

Avoid:
- Generic purple/blue space gradients.
- Excessive neon or glow.
- Unnecessary glassmorphism.
- Random gradients and decorative stars.
- Over-rounded cards everywhere.
- Excessive borders and nested containers.
- Dense data without hierarchy.
- Color used as the only way to convey meaning.

The interface should feel engineered, not themed.

## 3. Design tokens

Define tokens centrally using CSS variables and Tailwind theme integration. Do not scatter raw color values throughout components.

Use semantic roles rather than hard-coded palette names.

### Color roles

| Token role | Intended use |
|---|---|
| `background` | Main application canvas |
| `surface` | Primary panels |
| `surface-raised` | Dialogs, popovers and elevated panels |
| `surface-muted` | Secondary sections and subtle controls |
| `border` | Structural separation |
| `content` | Primary text |
| `content-muted` | Secondary text |
| `content-subtle` | Metadata and tertiary text |
| `accent` | Primary action and selected state |
| `sun` | Sun-related data and chart series |
| `earth` | Earth-related data and chart series |
| `success` | Verified successful operation |
| `warning` | Caution or degraded data |
| `danger` | Errors and destructive actions |
| `focus` | Visible keyboard focus |

The intended visual roles are charcoal/near-black surfaces, soft white text, muted neutral secondary text, amber Sun, cyan Earth, and citron/lime selection. Choose actual color values during implementation and verify contrast; do not invent a new palette per component.

Sun and Earth colors must remain consistent across cards, map markers, legends, and charts.

### Foundation token implementation

The central tokens are implemented in `src/app/globals.css`. The initial canvas is `#0b0b0b`, panels are `#151515`, and raised surfaces are `#242424`. Text uses `#f5f5f3`, `#b4b4b4`, and `#949494`. Selected-site/focus emphasis is `#d4e56a`; Sun is `#f2b544`; Earth is `#68cadd`. Primary buttons use inverted neutral text/surface colors. Control borders use `#737373` to distinguish interactive edges from structural borders.

DM Sans weights 400, 500, and 600 are served locally. Controls have a 6px radius and a minimum 44px target. The labelled 224px desktop sidebar folds into a Radix navigation sheet below 1024px; Explorer uses a 64px desktop rail. Explorer context opens in a nonmodal map inspector at 768px and wider, and in a Radix bottom sheet below 768px. Selection and mission-time inputs survive this transition; dismissing the inspector restores focus to its map trigger.

## 4. Typography

Use DM Sans as the primary interface typeface if it can be loaded reliably; otherwise use a close system sans-serif fallback.

Typography should prioritize:
- Clear hierarchy.
- Readable scientific values.
- Distinct labels and units.
- Consistent numeric alignment.
- Compact metadata without making it tiny.

Use tabular numerals for coordinates, timestamps, measurements, and metric values where supported.

Avoid oversized marketing-style headings inside the working explorer.

## 5. Spacing, sizing and shape

Use a consistent spacing scale based on a 4px unit. Prefer named spacing tokens and repeated patterns over arbitrary per-element values.

- Align panel edges and control groups deliberately.
- Use consistent gaps within repeated groups.
- Keep chart labels and controls aligned to the same layout grid.
- Avoid one-off margins that make repeated cards drift.
- Use a restrained radius scale: controls, cards, and large panels should have intentional, consistent corner treatments.
- Borders should clarify hierarchy, not outline every nested element.

Do not claim spacing is uniform merely because several elements use the same nominal gap. Verify actual rendered spacing, including icons, labels, padding, and responsive states.

## 6. Application shell

### Desktop

Recommended workspace:
- Compact left navigation.
- Main map/workspace area.
- Contextual analysis or site-details panel.
- Clear top-level mission/time controls.

Keep the map visually dominant. The analysis panel must not obscure essential map controls.

Use resizable panels only if they improve the real workflow and remain usable at common desktop widths.

### Tablet

- Allow the details panel to collapse or move below/over the map.
- Preserve access to site and time controls.
- Avoid squeezing the map into an unusable strip.

### Mobile

- Use a simplified navigation pattern.
- Keep the map usable and provide coordinate entry as an alternative.
- Move detailed analysis into a sheet or stacked sections.
- Keep primary actions reachable without covering map interaction.
- Avoid requiring hover.
- Ensure charts can be read or accessed through summaries/tables.

Do not merely scale down the desktop layout.

## 7. Core screens

### 7.1 Mission Explorer

Purpose: discover and select candidate lunar locations.

Layout:
- Main lunar map.
- Compact map controls and layer selection.
- Candidate-site markers.
- Selected-site details.
- Coordinate display and manual coordinate entry.
- Mission date/time controls.
- Clear action to analyze the selected site.

Interaction:
- Selecting a marker updates the selected site and details.
- Manual coordinate entry validates latitude/longitude and makes the selected location explicit.
- Map movement must not accidentally activate unrelated controls.
- Selected, hovered, focused, and disabled states must be visually distinct.
- If imagery fails, preserve the rest of the application and show a useful map error state.

The Phase 2 Explorer map fills the available viewport. Desktop navigation becomes a compact rail; smaller screens retain the application menu. Search and coordinate entry sit at the top left, and projection, basemap and overlay controls at the top right. Zoom, reset and fullscreen sit at the lower right; cursor coordinates, lunar scale and projection information sit at the lower left. Controls use opaque neutral surfaces, accessible names, tooltips and touch targets of at least 44px. Keyboard arrows and +/− operate the focused map; Enter selects its center.

Selecting a map location or search result opens a dismissible, nonmodal desktop inspector; mobile uses the existing Radix bottom sheet. The inspector contains coordinates, available nomenclature, an explicit UTC mission-time input and candidate actions. Up to three numbered candidate markers remain on the map. Fullscreen preserves the same map instance, controls and inspector; an expanded view provides a keyboard-accessible fallback when the native Fullscreen API is unavailable. Detailed source limitations, metadata and the published slope legend are disclosed in the layer panel. Tile loading, missing coverage and failures remain distinct, and retries preserve the view. Analysis requires explicit reference-sphere height and coordinate-model adoption.

The inspector provides candidate import/export and a copyable exploration link. Imports show coordinates and UTC time in a compact preview before replacing existing inputs; cancellation preserves the workspace, and Back restores the previous confirmed import. Copy failures reveal a selectable link. Shared links and reloads restore selection, candidates, time, camera and layers, while invalid shared state opens the default map with a dismissible error. Transfer controls also remain accessible in the mobile fullscreen sheet.

The shortlist precedes transfer actions. Its active row and numbered map pin use the selected-site accent. “Add candidate” appears for unsaved locations while a slot is available; adding moves focus to the saved row. “Show all” frames saved sites and closes the inspector; a fit control also appears over the map for multiple candidates. “Clear” offers an inline undo and preserves the selected location and mission time. Removal moves keyboard focus to a remaining site or the add action. Mobile controls and the site trigger remain separate when the fit control is visible.

### 7.2 Site Analysis

Purpose: understand conditions at one site over a selected interval.

Organize information into:
- Site and interval context.
- Sun position and visibility.
- Earth position and visibility.
- Time-series charts.
- Visibility-window summaries.
- Source, method, and limitations.

Each metric must include units and a clear definition. Avoid presenting a number without explaining what it measures.

The implemented inspector offers reference-sphere height with a deliberate “Use 0 m” action, mean-Earth adoption linked to Methodology, UTC window/sample controls, Analyze and Cancel. Sun/Earth results expose elevation, azimuth, sampled sunset/Earthset estimates and unavailable terrain status. The expandable timeline provides keyboard sample navigation, a chart, textual values and visibility windows with open boundaries. Reports retain sources and unavailable results. Loading and errors preserve the user's inputs.

### 7.3 Site Comparison

Purpose: compare two or three candidate locations fairly.

- Show all compared sites and their coordinates.
- Use identical time ranges and sampling assumptions.
- Keep series labels and colors consistent.
- Make differences easy to inspect without implying a universal winner.
- State when a site has missing or incomplete samples.
- Do not rank sites using an invented aggregate score.

Explorer compares two or three saved sites under the same UTC range, sample step, reference height and observer assumptions. Sun/Earth series use their semantic colors and distinguish sites with line patterns. Exact sample values and estimated visible hours remain available as text. Missing values stay unknown, per-site failures remain visible, and reports include failed sites alongside available results.

The standalone `/comparison-preview` is labelled Site comparison. It accepts up to three manual latitude/positive-east longitude pairs and shows saved candidates transferred from Explorer. Users can add or remove sites, set common UTC, height and sampling inputs, run or cancel live analysis, inspect the mission timeline and download a Markdown report. Links to and from Explorer preserve the shortlist and UTC time. Keep the entry form, common settings and results clear on narrow screens; source details and observer assumptions remain available through Methodology.

The product is being built for the [2026 NASA Space Apps Lunar Landing Site Navigator challenge](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=details). Its emphasis on rapid site/date comparison guides this view. Sun/Earth angles, estimated crossings and visibility windows remain inspectable as charts and text with source details.

### 7.4 Methodology

Purpose: make the science inspectable.

Explain:
- Data sources.
- Coordinate conventions and reference frames.
- Time scale.
- Calculation definitions.
- Sampling interval.
- Terrain data and resolution, if used.
- Known limitations and uncertainty.

Do not hide important limitations in a tooltip or footer.

## 8. Component system

Use shadcn/ui as the source-owned component foundation, with the chosen Radix-based primitives.

Customize component styling through the central tokens and variants. Do not leave default shadcn styling unchanged if it conflicts with this design system.

### Generic primitives

Use shadcn/ui components for common interaction patterns:
- Button.
- Input.
- Select.
- Dialog.
- Popover.
- Tabs.
- Tooltip.
- Dropdown menu.
- Checkbox and switch where needed.
- Slider.
- Sheet.
- Table.
- Skeleton.
- Command.
- Resizable panels where useful.

Add only components used by the current application.

### Product components

Build product-specific components from those primitives:
- Site marker and selected-site indicator.
- Coordinate input.
- Mission time-range control.
- Sun/Earth metric display.
- Visibility timeline.
- Chart legend.
- Data provenance display.
- Candidate comparison row/card.
- Map layer selector.

Do not put product-specific science logic into generic UI primitives.

### Component states

Every interactive component should consider:
- Default.
- Hover.
- Focus-visible.
- Active/selected.
- Disabled.
- Loading.
- Error.
- Empty, where relevant.

Avoid inconsistent state styling between components.

## 9. Data visualization rules

Charts are scientific interfaces, not decoration.

- Label axes and units.
- Use consistent Sun and Earth colors.
- Include a readable legend.
- Make time ranges and sampling clear.
- Distinguish missing samples from zero.
- Do not draw continuous lines across missing intervals unless the interpolation is intentional and disclosed.
- Avoid 3D charts and unnecessary chart effects.
- Use restrained gridlines.
- Use tooltips for exact values, but do not make tooltips the only way to access important data.
- Provide a table or textual summary for key values.
- Do not use color alone to distinguish series; combine color with labels, line patterns, markers, or other cues where practical.

A chart must never imply greater precision or continuity than the underlying samples support.

## 10. Scientific language in the UI

Use the fewest words that remain clear. Do not repeat visible state, explain obvious controls, or add descriptions by default. Describe verified dataset limits in Methodology and source details; show a concise status where a limit affects the current map or result.

Use precise labels.

Prefer:
- "Geometric visibility"
- "Terrain-adjusted visibility" only when terrain obstruction is actually calculated.
- "Sun elevation"
- "Earth elevation"
- "Calculated interval"
- "Data unavailable"
- "Incomplete samples"

Avoid unsupported terms:
- "Safe landing site"
- "Guaranteed communication"
- "Optimal landing location"
- "Power available"
- "Mission-ready"

Explain that geometric visibility is not equivalent to operational feasibility.

Do not show unknown values as zero, and do not use a green success state to disguise incomplete analysis.

## 11. Loading, empty and error states

Keep the interface stable while data loads.

- Preserve navigation and existing context during requests.
- Use skeletons that resemble the content being loaded.
- Avoid full-screen loading overlays for small requests.
- Show which data source is loading when it helps explain delay.
- Provide a retry action for retryable failures.
- Preserve user inputs after an API failure.
- Distinguish no data, not yet calculated, unavailable source, and failed request.
- Never silently show sample data as if it were live.

A map tile failure should not erase the selected coordinates or unrelated analysis state.

## 12. Interaction and feedback

Every action must have an observable result.

- Buttons need clear action labels.
- Destructive actions require confirmation when loss is meaningful.
- Controls must have disabled states when their action is genuinely unavailable.
- Avoid fake disabled controls for features that are simply not implemented.
- Use toast notifications for brief confirmations, not for essential scientific explanations.
- Keep validation messages close to the relevant input.
- Preserve entered values after recoverable errors.
- Avoid hover-only functionality.
- Make selection state persistent enough to be understood.

Use animation sparingly. Respect reduced-motion preferences.

## 13. Accessibility (AX)

Target WCAG 2.2 AA.

### Semantics and keyboard

- Use semantic HTML.
- Maintain a logical heading structure.
- Label every input.
- Give icon-only controls accessible names.
- Ensure all functionality is keyboard accessible.
- Provide visible focus indicators.
- Use expected keyboard behavior for dialogs, menus, tabs, and popovers.
- Do not use clickable `div` elements in place of buttons.

### Contrast and non-color cues

- Normal text contrast target: at least 4.5:1.
- Large text contrast target: at least 3:1.
- Important graphical controls and boundaries: at least 3:1 where applicable.
- Never use color as the only status indicator.
- Ensure chart series remain distinguishable beyond color alone.

### Map accessibility

A map cannot be the only way to select or inspect a site.

Provide:
- Manual latitude/longitude entry.
- A keyboard-accessible candidate-site list.
- Readable selected-site coordinates.
- A textual summary of relevant map state.
- A non-map route to the core analysis workflow.

### Screen readers

- Associate labels and descriptions with controls.
- Announce important asynchronous status changes.
- Use live regions selectively.
- Avoid excessive announcements from map movement or chart pointer events.
- Ensure dialogs have accessible titles and descriptions.

### Motion

Respect `prefers-reduced-motion`. Do not use animation as the only indication of state or progress.

## 14. Responsive and touch behavior

- Test common desktop, tablet, and mobile widths.
- Prevent accidental horizontal overflow.
- Keep touch targets comfortably usable; aim for at least 44×44 CSS pixels for primary touch controls.
- Ensure map controls do not overlap critical navigation or selected-site details.
- Make sheets and dialogs fit within the visible viewport.
- Keep charts legible and provide alternate summaries when they cannot be comfortably read.

## 15. Quality bar

Before calling a screen complete, verify:
- Visual hierarchy is clear.
- Spacing and alignment are consistent.
- Repeated components have consistent dimensions.
- All visible controls work.
- Loading, empty, and error states exist where needed.
- Keyboard navigation and focus are correct.
- Mobile behavior is intentionally designed.
- Scientific labels and units are accurate.
- Unknown values remain unknown.
- The screen follows this document and the architecture boundaries.

A polished screenshot is not proof of a complete workflow. The interface must work with real data, real failures, keyboard input, and small screens.
