# Moonline

A lunar exploration and geometric visibility planning aid. This directory is the single application root.

The current milestone is Phase 1 from [architecture.md](architecture.md): Next.js App Router, strict TypeScript, Tailwind CSS, source-owned shadcn components with Radix primitives, and a responsive application shell.

Explorer and Methodology are working destinations. The map, site selection, provider integrations, scientific calculations, and comparison are not implemented yet. The interface states this explicitly and contains no invented scientific data.

## Local development

Use Node.js 22 or later and pnpm 12.11.2:

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. No environment variables are required for Phase 1. DM Sans is served locally from the installed font package.

## Verification

```sh
pnpm verify
```

This runs TypeScript checks, ESLint, contributor ownership tests, a production build, and browser tests against that build. Individual checks are available as `pnpm typecheck`, `pnpm lint`, `pnpm test:ownership`, `pnpm build`, and `pnpm test`. Build before running the browser tests independently.

Tests use the installed Microsoft Edge browser on Windows. On other platforms, install Playwright Chromium with `pnpm exec playwright install chromium` before running tests. Browser tests cover navigation, availability labels, skip-link focus, the mobile menu's focus trap and Escape behavior, and horizontal overflow at desktop, tablet, and mobile widths.

The initial foundation passed `pnpm verify` with 11 browser tests. Screenshots were reviewed at 390, 768, 1024, and 1440px. Token contrast checks passed; the local design skill's source lint passed. Its browser inspector timed out during CDP initialization, so its rendered-page measurements remain unavailable.

## Project guidance

- [AGENTS.md](AGENTS.md): operating rules and verification discipline.
- [architecture.md](architecture.md): stack, boundaries, scientific data flow, and implementation order.
- [design.md](design.md): tokens, interactions, responsive behavior, and accessibility.
- [CONTRIBUTING.md](CONTRIBUTING.md): Sultan/Rameen assignments, branch workflow, PR review, and repository protection setup.

Local skills in `.agents/skills` support relevant tasks; they are not application runtime dependencies.

The next milestone is Phase 2: inspect NASA Moon Trek service capabilities, verify its projection and tile access, and implement the OpenLayers map and manual coordinate selection. No terrain clearance, power availability, communications reliability, or landing-safety claim is supported by the current application.
