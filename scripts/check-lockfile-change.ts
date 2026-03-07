import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

type DependencyFields = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
};

const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function fail(message: string): never {
  console.error(`check:lockfile failed: ${message}`);
  process.exit(1);
}

function normalizeDeps(pkg: Record<string, unknown>): DependencyFields {
  const normalized = {} as DependencyFields;
  for (const field of DEP_FIELDS) {
    normalized[field] = (pkg[field] ?? {}) as Record<string, string>;
  }
  return normalized;
}

function parseJson(raw: string, where: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    fail(`could not parse ${where}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const baseSha = process.env.GITHUB_BASE_SHA;
const headSha = process.env.GITHUB_SHA;

if (!baseSha || !headSha) {
  console.log("check:lockfile skipped (GITHUB_BASE_SHA/GITHUB_SHA not set).");
  process.exit(0);
}

const changedFilesRaw = run("git", ["diff", "--name-only", `${baseSha}...${headSha}`]);
const changedFiles = new Set(changedFilesRaw.split("\n").map((s) => s.trim()).filter(Boolean));

if (!changedFiles.has("package.json")) {
  console.log("check:lockfile skipped (package.json unchanged).");
  process.exit(0);
}

const basePackageRaw = run("git", ["show", `${baseSha}:package.json`]);
const basePackage = parseJson(basePackageRaw, "base package.json");
const headPackage = parseJson(readFileSync("package.json", "utf8"), "head package.json");

const baseDeps = normalizeDeps(basePackage);
const headDeps = normalizeDeps(headPackage);

const dependenciesChanged = JSON.stringify(baseDeps) !== JSON.stringify(headDeps);
if (!dependenciesChanged) {
  console.log("check:lockfile passed (dependency fields unchanged).");
  process.exit(0);
}

if (!changedFiles.has("package-lock.json")) {
  fail("dependency fields changed in package.json but package-lock.json was not updated.");
}

console.log("check:lockfile passed");
