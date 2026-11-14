/**
 * Verify contributor boundaries, rename paths and untrusted PR metadata.
 * @author Sultan
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { checkOwnership, readPullRequest } from "./pr-ownership.ts";

test("Sultan owns application and shared configuration", () => {
  assert.equal(checkOwnership("SultanZain", "sultan/pr-workflow", ["src/app/page.tsx", "package.json", "CONTRIBUTING.md"]).ok, true);
});

test("Rameen owns data, science and their provenance records", () => {
  assert.equal(checkOwnership("Mumei-Nocturnal", "rameen/p2-data-verify-nasa-sources", [
    "src/lib/api/moon-trek.ts", "src/lib/astronomy/observer.ts", "src/lib/science/visibility.ts",
    "src/lib/dates/utc.ts", "src/lib/validation/observer.ts", "src/types/observer.ts",
    "tests/science/reference.test.ts", "docs/science/sources.md",
  ]).ok, true);
});

test("reject cross-owner paths and misleading prefix matches", () => {
  for (const file of ["src/components/explorer/map.tsx", "package.json", "src/lib/api-fake/client.ts", "AGENTS.md"]) {
    assert.equal(checkOwnership("Mumei-Nocturnal", "rameen/p2-data", [file]).ok, false);
  }
  assert.equal(checkOwnership("SultanZain", "sultan/p2-explorer", ["src/lib/science/visibility.ts"]).ok, false);
});

const missionWorkflowFiles = [
  "src/lib/api/lunar-horizons.ts",
  "src/lib/science/mission-analysis.ts",
  "src/lib/validation/mission-analysis.ts",
  "src/types/mission-analysis.ts",
  "tests/science/mission-analysis.spec.ts",
  "tests/science/fixtures/horizons-sun.json",
  "tests/science/fixtures/horizons-earth.json",
];

test("assigned mission branch permits its exact scientific files with application changes", () => {
  assert.equal(checkOwnership("SultanZain", "sultan/mission-workflow-local-analysis", [
    ...missionWorkflowFiles, "src/app/api/analysis/route.ts", "src/components/explorer/mission-controls.tsx",
  ]).ok, true);
});

test("mission scientific files remain restricted on other Sultan branches", () => {
  for (const branch of ["sultan/task", "sultan/mission-workflow-local-analysis-extra", "sultan/mission-workflow-local-analy"]) {
    for (const file of missionWorkflowFiles) assert.equal(checkOwnership("SultanZain", branch, [file]).ok, false);
  }
  assert.equal(checkOwnership("Mumei-Nocturnal", "sultan/mission-workflow-local-analysis", missionWorkflowFiles).ok, false);
});

test("mission assignment rejects neighboring files and mixed out-of-scope changes", () => {
  for (const file of [
    "src/lib/api/lunar-horizons.ts.old", "src/lib/api/lunar-horizons.ts/child",
    "src/types/lunar-observer.ts", "tests/science/lunar-observer.spec.ts",
    "tests/science/fixtures/horizons-mars.json", "tests/science/fixtures/horizons-sun.json.old",
    "docs/science/lunar-coordinates.md", "src/lib/science/visibility.ts",
  ]) {
    assert.equal(checkOwnership("SultanZain", "sultan/mission-workflow-local-analysis", [missionWorkflowFiles[0], file]).ok, false);
  }
});

test("Rameen's observer contract keeps its original branch and path permissions", () => {
  assert.equal(checkOwnership("Mumei-Nocturnal", "rameen/p2-coordinates", [
    "src/lib/validation/lunar-observer.ts", "src/types/lunar-observer.ts",
    "tests/science/lunar-observer.spec.ts", "docs/science/lunar-coordinates.md",
  ]).ok, true);
});

test("reject unknown identities, main and another contributor's branch", () => {
  for (const [author, branch] of [["unknown", "sultan/task"], ["SultanZain", "main"], ["Mumei-Nocturnal", "sultan/task"], ["SultanZain", "sultan/"]]) {
    assert.equal(checkOwnership(author, branch, []).ok, false);
  }
});

test("validate PR target, number and commit IDs before passing them to Git", () => {
  const event = { number: 1, pull_request: { user: { login: "SultanZain" }, head: { ref: "sultan/task", sha: "a".repeat(40) }, base: { ref: "main", sha: "b".repeat(40) } } };
  assert.equal(readPullRequest(event).number, 1);
  for (const invalid of [null, {}, { ...event, number: -1 }, { ...event, number: "1" },
    { ...event, pull_request: { ...event.pull_request, head: { sha: "--help" } } },
    { ...event, pull_request: { ...event.pull_request, base: { ref: "dev", sha: "b".repeat(40) } } }]) {
    assert.throws(() => readPullRequest(invalid));
  }
});

test("renaming a shared file into a scientific path still checks the deleted path", () => {
  const temporaryRoot = resolve(tmpdir());
  const directory = resolve(mkdtempSync(join(temporaryRoot, "moonline-ownership-")));
  assert.equal(dirname(directory), temporaryRoot);
  const git = args => execFileSync("git", args, { cwd: directory, encoding: "utf8" });
  try {
    git(["init", "-b", "main"]);
    writeFileSync(join(directory, "shared.txt"), "shared implementation\n");
    git(["add", "shared.txt"]);
    git(["-c", "user.name=Ownership Test", "-c", "user.email=ownership@example.invalid", "commit", "-m", "initial"]);
    const base = git(["rev-parse", "HEAD"]).trim();
    mkdirSync(join(directory, "docs", "science"), { recursive: true });
    git(["mv", "shared.txt", "docs/science/source.txt"]);
    git(["-c", "user.name=Ownership Test", "-c", "user.email=ownership@example.invalid", "commit", "-m", "move"]);
    const head = git(["rev-parse", "HEAD"]).trim();
    const paths = git(["diff", "--name-only", "--no-renames", "-z", `${base}...${head}`]).split("\0").filter(Boolean);
    assert.deepEqual(paths.sort(), ["docs/science/source.txt", "shared.txt"]);
    assert.equal(checkOwnership("Mumei-Nocturnal", "rameen/task", paths).ok, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
