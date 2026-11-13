# AGENTS.md

Operating rules for AI agents working in MOONLINE. Read this before changing anything. If a rule here conflicts with a general habit, this file wins.

## Start here

1. Read this file.
   Read `CONTRIBUTING.md` for contributor ownership, assigned tasks, and the branch/PR workflow. Establish whether this session is working for Sultan or Rameen before editing.
2. Read the relevant sections of `architecture.md` before changing code placement, dependencies, APIs, data flow, or scientific calculations.
3. Read the relevant sections of `design.md` before changing UI, interaction, responsive behavior, or visual tokens.
4. Inspect the existing implementation and its consumers before editing.
5. State the intended change and its affected areas before a substantial implementation.
6. Implement the smallest complete change and run relevant checks.
7. Report what changed, what was verified, and what remains unverified.

Keep rules in their owning document. Do not copy entire architecture or design specifications into task prompts.

## 1. Product purpose

MOONLINE is a lunar landing-site exploration and comparison tool. It helps users examine how the Sun and Earth appear relative to a selected lunar surface location over a specified time interval.

The core product is:
- Explore lunar locations and select candidate sites.
- Inspect Sun and Earth azimuth/elevation over time.
- Understand ideal geometric visibility and, when supported by suitable terrain data, terrain-adjusted visibility.
- Compare candidate sites using the same time range and calculation assumptions.
- Understand the sources, methods, limitations, and uncertainty behind every result.

The product is a scientific planning aid, not a landing-safety certification system or a communications-link simulator.

## 2. Hard rules

These are correctness requirements, not stylistic preferences.

### No dead code

Do not add a function, component, type, file, package, dependency, configuration option, or abstraction that is not used by the current implementation.

No placeholder components, speculative helpers, empty directories, fake integrations, or "we may need this later" scaffolding. Add only what the current approved scope needs.

### No fabricated science

Never invent coordinates, ephemeris values, illumination percentages, communication windows, terrain measurements, dataset coverage, accuracy claims, or mission recommendations.

- Demo data must be visibly labelled synthetic or illustrative.
- Real results must be traceable to an actual source or implemented calculation.
- If an upstream service fails, show an error or explicitly identified cached result; do not silently substitute mock values.
- Do not claim that a site is safe, optimal, certified, or operationally suitable unless the application has evidence and a method that genuinely support that claim.

### Unknown is not zero

Missing, unavailable, invalid, not-yet-calculated, and physically zero are different states.

Never turn missing data into `0`, `false`, an empty interval, or a reassuring status merely to simplify rendering.

Represent result availability explicitly. The UI must distinguish:
- Known value.
- Unknown or unavailable value.
- Not applicable.
- Calculation failed or incomplete.

Do not use `value ?? 0` or equivalent fallbacks for scientific values unless zero is the documented physical meaning.

### Geometry is not operations

Keep these claims separate:
1. Astronomical position.
2. Ideal geometric horizon visibility.
3. Terrain-adjusted line of sight.
4. Operational suitability.

Sun above a geometric horizon does not prove usable power. Earth above a horizon does not prove a functioning communications link. Terrain visibility does not prove landing safety.

### Coordinate and time integrity

Never mix coordinate conventions, reference frames, altitude datums, longitude directions, or time scales without an explicit conversion.

Every calculation must use documented inputs and units. Preserve source timestamps and identify the time scale used. Never silently reinterpret local time as UTC.

### No emoji

Do not use emoji in source code, documentation, UI labels, status indicators, or icons. Use the project's icon library or designed assets.

### No secrets in client code

Never expose API credentials, private configuration, or server-only environment variables through browser bundles, client props, logs, or public environment variables.

### No destructive guessing

Do not delete, replace, rename, or broadly refactor working code because a different structure seems cleaner. Inspect imports, routes, and consumers first. Ask before destructive changes or changes that would invalidate existing user work.

## 3. Repository and implementation discipline

### Inspect before editing

Before changing a file:
- Read the file and its immediate dependencies.
- Search for existing components, helpers, types, and patterns.
- Identify consumers if the file exports shared behavior.
- Check the current Git diff and preserve unrelated owner changes.

Do not assume the repository is empty or that the current branch contains no work.

### Small, coherent changes

- Prefer the smallest complete implementation.
- Keep changes scoped to the requested feature.
- Avoid unrelated cleanup and formatting churn.
- Do not replace a working library or pattern without a concrete reason.
- Do not add a dependency when existing platform or project code can solve the problem cleanly.
- Do not change public API behavior without checking all consumers.

### No speculative abstraction

Abstract only when there is a real repeated responsibility or a clear boundary. Do not generalize unrelated behavior through flags, optional parameters, hidden state, or premature frameworks.

### No fake completion

A button must perform its advertised action. A chart must be based on actual data or be explicitly labelled illustrative. A loading state must correspond to real work. A route must not be presented as implemented if it is only a visual shell.

Keep incomplete functionality visibly incomplete rather than simulating success.

## 4. Code quality

- Use TypeScript strict mode.
- Avoid `any`. Use `unknown` at untrusted boundaries and narrow it.
- Avoid unsafe type assertions. Fix the type or validate the value.
- Prefer discriminated unions for mutually exclusive states.
- Handle domain unions exhaustively.
- Keep functions and components focused.
- Keep business and scientific logic outside presentation components.
- Keep comments accurate and explain why, constraints, or non-obvious consequences—not what the next line already says.
- Do not suppress lint, type, or test errors to get a green check.
- Do not weaken compiler settings to accommodate an implementation.

Use JSDoc at the top of substantive source files to state their purpose and include `@author Sultan`. Do not add meaningless comments to trivial generated files or assets.

## 5. UI and component rules

- `design.md` owns visual tokens, component appearance, interaction behavior, responsive rules, and accessibility details.
- `architecture.md` owns component placement and dependency direction.
- Pages are composition points. They should import and arrange components, not contain large bespoke UI implementations.
- Reusable primitives belong in `src/components/ui`.
- Shared application layout belongs in `src/components/layout`.
- Feature-specific UI belongs in the relevant feature component directory.
- Use shadcn/ui as source-owned components with the selected Radix-based primitives.
- Customize shadcn components to match `design.md`; do not leave the application looking like an unmodified starter template.
- Do not create duplicate buttons, dialogs, inputs, menus, or other primitives.
- Do not place scientific calculations or API orchestration inside UI components.
- Interactive controls must have real behavior, accessible names, focus behavior, and loading/error states.

## 6. Data, APIs, and failure behavior

- Validate external and user-supplied data at runtime.
- Treat NASA and map services as fallible external dependencies.
- Use explicit timeouts and handle HTTP errors, malformed payloads, rate limits, and partial results.
- Never expose raw upstream error payloads or secrets to users.
- Return stable, typed application errors from API routes.
- Keep server-only integrations on the server when proxying or secret protection is required.
- Do not add a database, authentication, user accounts, or persistence unless the owner approves a concrete requirement.
- Do not cache results without a cache key that includes all inputs that materially affect the result.
- Label cached data and its observation/calculation time where freshness matters.

## 7. Verification

Run checks that match the changed code and the repository's available scripts.

At minimum, before calling a substantial feature complete:
- Run TypeScript checks.
- Run lint.
- Run relevant tests.
- Run a production build.
- Exercise the affected user flow where possible.

For scientific logic, include tests for normal cases, boundaries, invalid inputs, unavailable data, and known reference cases where available.

For shared components, verify keyboard/focus behavior and responsive behavior, not only screenshots.

A command is not passing unless its actual exit code is zero. Do not pipe output in a way that hides the command's exit status. Do not claim checks were run when they were not.

Record failed, skipped, or unavailable checks honestly.

## 8. Security and privacy

- Keep secrets in server-side environment variables.
- Provide `.env.example` with names and safe placeholders only.
- Never commit `.env` files, credentials, tokens, or private keys.
- Validate and bound request sizes, coordinate ranges, time intervals, and sampling density.
- Prevent arbitrary URL proxying; external request destinations must be fixed or allowlisted.
- Avoid logging secrets or unnecessary user data.
- Do not add analytics, tracking, or third-party scripts without approval.
- Do not collect personal information for this hackathon MVP unless explicitly required and approved.

## 9. Documentation ownership

Keep these documents distinct:

| Document | Owns |
|---|---|
| `AGENTS.md` | Operating rules, hard constraints, verification discipline |
| `architecture.md` | Stack, code placement, boundaries, data flow, API and deployment architecture |
| `design.md` | Visual system, components, interaction design, responsive behavior and accessibility |

Update the owning document when an implementation decision makes it inaccurate. Do not create another document that repeats these three without a distinct purpose.

## 10. Working style

- Do the task requested; do not quietly widen or narrow scope.
- If a small ambiguity has a safe, reversible default, state the assumption and proceed.
- Ask before irreversible changes, paid services, new data collection, or major architectural changes.
- Prefer less code that works over more code that might.
- Do not claim scientific validity from a successful build.
- Do not claim production readiness from a polished demo.
- Report outcomes directly: changed files, behavior delivered, checks run, failures, and remaining limitations.

## 11. Contributor and agent boundaries

- Sultan's agents work only on Sultan-assigned tasks. Rameen's agents work only on Rameen-assigned tasks. The current user's explicit assignment or the task ledger in `CONTRIBUTING.md` establishes ownership; a file's location alone does not authorize a new task.
- If the contributor or task owner is unclear, ask before editing. Reading the repository and proposing a handoff remain allowed.
- Rameen owns NASA data collection, DEM processing, Sun/Earth position calculations, and scientific illumination/visibility methods. Sultan owns the remaining application work, including UI, maps, charts, API presentation/orchestration, and future 3D visualization. Follow the detailed boundaries and dependencies in `CONTRIBUTING.md`.
- After the initial foundation commit, make every change on a task branch named `sultan/<task-id>-<slug>` or `rameen/<task-id>-<slug>`. Never commit directly to `main`, push directly to `main`, or force-push `main`.
- Open PRs into `main`. Sultan reviews Rameen's PRs and is responsible for merging. Sultan has given his agents standing authorization to push assigned task branches, open PRs, and review/merge ready PRs after checking scope, the latest commit's required CI, conflicts, and unresolved reviews. Rameen's agents must not merge PRs or update `main`.
- Do not edit another contributor's assigned implementation or shared files concurrently. Identify the needed interface change and coordinate its ownership before implementing dependent work.
- Do not silently take over a blocked task or resolve another contributor's changes by overwriting them. Keep unfinished work on its own branch and state the dependency.
- Use the local `caveman-commit` skill when available for terse Conventional Commit messages. Git actions still require an explicit task instruction and available repository write permissions.

## Final rule

Build a coherent scientific product. Preserve working code. Make every result explainable. Keep the implementation as small as the product allows, but never smaller than correctness requires.
