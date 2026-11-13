# Working together on Moonline

Sultan owns application engineering and merging. Rameen owns data and science. Agents inherit the contributor's assigned task, not permission to work across the whole project.

This document owns collaboration and the task ledger. `AGENTS.md` owns operating constraints, `architecture.md` owns implementation boundaries and phase order, and `design.md` owns the visual system.

## Contributor identities

| Contributor | GitHub account | Responsibility |
|---|---|---|
| Sultan | [@SultanZain](https://github.com/SultanZain) | Application engineering, shared configuration, PR review and merging |
| Rameen | [@Mumei-Nocturnal](https://github.com/Mumei-Nocturnal) | NASA data collection, DEM processing, Sun/Earth calculations, illumination and visibility science |

Use these identities when assigning tasks and opening PRs. Rameen's agent sessions work for Rameen; Sultan's agent sessions work for Sultan. The GitHub account identifies the contributor and does not authorize work outside their assignment.

## Responsibilities

| Area | Implementation owner | Boundary |
|---|---|---|
| NASA data collection | Rameen | Source research, verified Moon Trek capabilities, ephemeris provider clients, payload normalization, provenance and availability |
| DEM processing | Rameen | Traceable elevation datasets, coordinate/datum handling, processing, and validated terrain horizons when that phase is authorized |
| Sun/Earth positions | Rameen | Lunar observer configuration, coordinate transformations, time conventions, azimuth/elevation, and reference-case tests |
| Solar illumination and communication visibility | Rameen | Scientific methods and domain results; distinguish geometric Sun/Earth visibility from terrain obstruction, usable power, and a functioning communications link |
| Map, manual input, UI and charts | Sultan | OpenLayers rendering, controls, accessible site/time selection, ECharts presentation, responsive flows, and textual result alternatives |
| Application routes and API orchestration | Sultan | Next.js pages/handlers, bounded requests, HTTP envelopes and user-facing failures; consume Rameen's verified schemas and domain/provider modules |
| Future 3D visualization | Sultan | Only after the documented core 2D workflow works; render verified data without changing scientific assumptions |
| Tooling, shared configuration, task ledger and merging | Sultan | Dependencies, CI, repository rules, shared file coordination, PR review and merge decisions |

Rameen's implementation areas are `src/lib/api`, `src/lib/astronomy`, `src/lib/science`, `src/lib/dates`, `src/lib/validation`, scientific types in `src/types`, scientific tests in `tests/science`, and source/processing records in `docs/science`. UI-only types stay with their Sultan-owned feature. These paths describe future responsibilities; create files only when a real assigned task uses them.

Sultan's implementation areas are `src/app`, `src/components`, `src/hooks`, application configuration in `src/config`, `src/lib/utils.ts`, application/browser tests, and repository tooling. Scientific calculations and provider-specific request parameters stay in Rameen's modules even when a Sultan-owned API route calls them.

Shared files include `package.json`, `pnpm-lock.yaml`, compiler/build/test configuration, CI, and the root documents. Sultan coordinates these changes. Rameen lists needed shared changes in her PR or an interface handoff; Sultan implements them on a separate task branch unless ownership of a specific file change is explicitly transferred. Neither contributor changes a shared file concurrently with another active task.

## Starting a task

1. Identify the contributor, task ID, allowed files, acceptance criteria, and dependencies. If identity or assignment is unclear, ask before editing.
2. Work only on a task assigned to that contributor. Follow the phase order in `architecture.md`; ownership of a future phase does not activate it.
3. Use a separate clone or worktree for each active task. Two agents must not edit the same working tree concurrently.
4. Start from current `main`, then create a task branch. After the initial bootstrap, `main` is for fetching, inspection, and merges through PRs.
5. Keep one coherent task per branch/PR. Report the task ID and branch before implementation. A draft PR identifies work in progress once the contributor publishes the branch.

After Sultan has pushed the initial repository, the normal sequence is:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c rameen/p2-data-verify-nasa-sources
```

Sultan uses the corresponding `sultan/<task-id>-<slug>` prefix. Do not switch branches over unrelated uncommitted work. Keep that work in its original worktree or ask its owner to handle it.

Sultan maintains this ledger. Rameen reports progress and dependencies in her PR description so both contributors do not edit the ledger at once. An explicit new assignment from Sultan can extend it. "Verified locally" means checks passed; "Done" means the implementation is committed and merged into `main`.

## Initial task ledger

| ID | Owner | Task | State / dependency |
|---|---|---|---|
| p1-foundation | Sultan | Next.js root, tokens, shell, navigation and browser verification | Done; bootstrap commit `f0f1f47` on `main` |
| collab-workflow | Sultan | Ownership rules, PR template, CI and review setup | Done; contributor follow-up `ed8997f` is published on `main` |
| pr-workflow | Sultan | Standing push/merge authorization and contributor branch/path checks | Active on `sultan/pr-workflow` |
| p2-data | Rameen | Inspect NASA Moon Trek capabilities, layer coverage, projection, tile matrices and access; document verified source conventions | Ready; branch from latest `main` |
| p2-coordinates | Rameen | Define verified lunar coordinate conventions and runtime validation used by site selection | Wait for p2-data |
| p2-explorer | Sultan | OpenLayers map, tile/error states and manual coordinate controls using verified data/validation | Wait for p2-data and p2-coordinates |
| p3-positions | Rameen | Verify Horizons lunar observer configuration; retrieve and normalize Sun/Earth positions with provenance and scientific tests | Wait for Phase 2 completion |
| p3-api | Sultan | Bounded Next.js ephemeris/API orchestration and accessible loading/error behavior | Wait for the p3-positions contract and implementation |
| p4-visibility | Rameen | Scientific time-series generation and ideal geometric visibility, including missing samples and horizon boundaries | Wait for verified positions |
| p4-analysis-ui | Sultan | Sun/Earth charts, time controls, result tables and provenance presentation | Wait for p4-visibility |
| p5-comparison-science | Rameen | Compare sites under identical input/convention/sampling assumptions without an invented aggregate score | Wait for Phase 4 completion |
| p5-comparison-ui | Sultan | Candidate comparison flow, charts and incomplete-data handling | Wait for p5-comparison-science |
| terrain-data | Rameen | DEM collection/processing and terrain-adjusted visibility with documented resolution and verified horizon methods | Deferred until the core 2D workflow works and a suitable dataset is verified |
| visualization-3d | Sultan | Optional 3D visualization of verified lunar data | Deferred until the core 2D workflow works |

## Interface handoffs

Before Sultan integrates scientific work, Rameen's PR must provide the actual exported schema/types, units, coordinate and time conventions, availability/error states, source metadata, limits, and reference tests. Do not fabricate a provider response to let UI work appear complete.

Prefer a small contract PR before dependent implementation when both contributors need the same types. Merge it before consuming those types. Scientific examples must be either verified references with provenance or visibly identified test fixtures. UI work can address layout/accessibility independently; it must not add fake charts, numbers, or successful integrations.

If a task needs another owner's file, request an explicit handoff in the PR or ask Sultan to assign it. The file owner handles the change on a separate owner branch by default. A limited ownership transfer must update the coordinated path policy before dependent work; do not bypass the ownership check. Do not implement the same responsibility twice to avoid a handoff.

## Commits and PRs

- Use terse Conventional Commits, preferably generated with the `caveman-commit` skill: `feat(science): verify lunar observer geometry` or `fix(explorer): preserve selection on tile failure`.
- Inspect `git status`, the diff, and staged files before committing. Stage only the task's files. Keep `.env` files, credentials, generated output and local skill bundles out of commits.
- Push the task branch when its owner is ready to publish it and open a PR targeting `main`. Sultan's agents have standing authorization for assigned branch pushes, PR creation, review and merging. Rameen's agents push her task branches and open PRs for Sultan's review.
- Use the PR template. Include task ownership, scope, sources/conventions for scientific changes, actual check results, and remaining limitations.
- Run `pnpm verify` for substantial application changes. Scientific changes also need their domain/reference tests. Documentation-only changes need diff/link/workflow checks rather than an unnecessary application rebuild.
- Rameen's PR requires Sultan's explicit review and approval before Sultan merges it. New commits after review require another look.
- Sultan's own implementation also uses a PR and passing checks. An author cannot approve their own GitHub PR; do not claim self-approval or configure an approval rule that makes the sole maintainer unable to merge.
- Only Sultan or an agent working for Sultan performs merges. Before merging, review the final diff, confirm task ownership, check CI against the current PR commit, and resolve conflicts/review requests. Do not merge drafts or PRs with failed/pending required checks, unresolved requested changes, or unclear scientific provenance.

To incorporate new main-branch work, fetch `origin` and merge `origin/main` into the task branch. Resolve only conflicts in the assigned scope. Coordinate conflicts involving another contributor's work; do not discard their changes. Avoid rewriting a published branch and never force-push `main`.

## GitHub setup after Sultan pushes

Repository: https://github.com/SultanZain/Moonline

The committed workflow runs `pnpm verify` for PRs and for pushes to `main`. `CODEOWNERS` requests Sultan's review; it does not prevent direct pushes or merges on its own.

The separate `ownership` check validates the PR author's `sultan/` or `rameen/` branch and every changed path, including deletions and both sides of renames. It runs trusted base-branch code with read-only repository permission, fetches PR objects only, and never checks out or executes the contributor's code. This automates file boundaries; Sultan still reviews scientific accuracy and task scope.

In GitHub Settings, configure rules for `main` before Rameen starts:

1. Require a pull request and the `verify` and `ownership` status checks once the ownership workflow is published on `main`. Require branches to be up to date before merging.
2. Block force pushes and branch deletion. Keep merge/update permission with Sultan; give Rameen contributor access, not repository administration.
3. Request Sultan's code-owner review on contributor PRs. Dismiss stale approvals after new commits and require conversation resolution.
4. Account for the sole-maintainer case: a blanket required code-owner approval also blocks Sultan-authored PRs. Use a narrowly scoped PR-only maintainer bypass for approval/update restrictions if supported, while keeping the PR and CI requirements in a separate rule without that bypass. Otherwise keep Sultan review as an explicit contributor policy until a second eligible reviewer is configured.
5. Confirm the rules in the repository UI; local documents and `CODEOWNERS` are not proof that server-side protections are enabled.

The bootstrap and contributor follow-up are published, and the initial GitHub verification runs passed. Sultan's agents now handle assigned branch pushes and PR review/merging under the checks above. No workflow guarantees zero merge conflicts; task ownership, small PRs, early interface handoffs and isolated branches reduce them.
