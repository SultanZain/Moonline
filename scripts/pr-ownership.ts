/**
 * Check contributor branch and file ownership using trusted base-branch code.
 * @author Sultan
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Contributor = "sultan" | "rameen";
type OwnershipResult =
  | { ok: true; contributor: Contributor }
  | { ok: false; message: string };

const scientificAreas = [
  "src/lib/api/", "src/lib/astronomy/", "src/lib/science/",
  "src/lib/dates/", "src/lib/validation/", "src/types/",
  "tests/science/", "docs/science/",
];

// Keep this coordinated integration assignment limited to its branch and exact files.
const missionWorkflowBranch = "sultan/mission-workflow-local-analysis";
const missionWorkflowFiles = new Set([
  "src/lib/api/lunar-horizons.ts",
  "src/lib/science/mission-analysis.ts",
  "src/lib/validation/mission-analysis.ts",
  "src/types/mission-analysis.ts",
  "tests/science/mission-analysis.spec.ts",
  "tests/science/fixtures/horizons-sun.json",
  "tests/science/fixtures/horizons-earth.json",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function checkOwnership(author: unknown, branch: unknown, files: readonly string[]): OwnershipResult {
  const contributor = author === "SultanZain" ? "sultan" : author === "Mumei-Nocturnal" ? "rameen" : undefined;
  if (!contributor) return { ok: false, message: "PR author has no Moonline task assignment." };
  if (typeof branch !== "string" || !branch.startsWith(`${contributor}/`) || branch.length <= contributor.length + 1) {
    return { ok: false, message: `Use a ${contributor}/<task-id>-<slug> branch for this contributor.` };
  }
  for (const file of files) {
    if (contributor === "sultan" && branch === missionWorkflowBranch && missionWorkflowFiles.has(file)) continue;
    const scientific = scientificAreas.some(area => file.startsWith(area));
    if ((contributor === "rameen") !== scientific) {
      return { ok: false, message: `${contributor} cannot change ${JSON.stringify(file)} without a coordinated ownership transfer.` };
    }
  }
  return { ok: true, contributor };
}

export function readPullRequest(event: unknown) {
  if (!isRecord(event) || !isRecord(event.pull_request)) throw new Error("Missing pull request metadata.");
  const pull = event.pull_request;
  if (!isRecord(pull.user) || !isRecord(pull.head) || !isRecord(pull.base)) throw new Error("Invalid pull request metadata.");
  const baseSha = pull.base.sha;
  const headSha = pull.head.sha;
  const number = event.number;
  if (typeof baseSha !== "string" || !/^[a-f0-9]{40}$/.test(baseSha) ||
      typeof headSha !== "string" || !/^[a-f0-9]{40}$/.test(headSha) ||
      typeof number !== "number" || !Number.isSafeInteger(number) || number <= 0 || pull.base.ref !== "main") {
    throw new Error("Expected a numbered PR into main with valid commit identifiers.");
  }
  return { author: pull.user.login, branch: pull.head.ref, baseSha, headSha, number };
}

function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required.");
  const pull = readPullRequest(JSON.parse(readFileSync(eventPath, "utf8")));
  // Fetch objects only. Never check out or execute the contributor's code in this job.
  execFileSync("git", ["fetch", "--no-tags", "origin", `refs/pull/${pull.number}/head`], { stdio: "pipe" });
  const files = execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", `${pull.baseSha}...${pull.headSha}`], { encoding: "utf8" })
    .split("\0").filter(Boolean);
  const result = checkOwnership(pull.author, pull.branch, files);
  if (!result.ok) throw new Error(result.message);
  console.log(`Ownership passed for ${result.contributor}: ${files.length} changed paths.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : "Ownership check failed.");
    process.exitCode = 1;
  }
}
