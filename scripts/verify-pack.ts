import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ALLOWED_EXACT = new Set(["package.json", "README.md", "LICENSE"]);
const ALLOWED_PREFIX = ["dist/"];

function fail(message: string): never {
  console.error(`verify:pack failed: ${message}`);
  process.exit(1);
}

interface PackFile {
  path: string;
}

interface PackResult {
  files?: PackFile[];
}

function parsePackJson(raw: string): PackResult {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      fail("unexpected npm pack --json output.");
    }
    return (parsed as PackResult[])[0];
  } catch (error) {
    fail(`unable to parse npm pack output: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isAllowed(filePath: string): boolean {
  if (ALLOWED_EXACT.has(filePath)) return true;
  return ALLOWED_PREFIX.some((prefix) => filePath.startsWith(prefix));
}

const raw = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  env: (() => {
    const cacheDir = process.env.NPM_CONFIG_CACHE || path.join(os.tmpdir(), "npm-cache-vite-mix");
    mkdirSync(cacheDir, { recursive: true });
    return {
      ...process.env,
      NPM_CONFIG_CACHE: cacheDir,
      npm_config_cache: cacheDir,
      NPM_CONFIG_LOGLEVEL: "error",
      npm_config_loglevel: "error",
    };
  })(),
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

const packResult = parsePackJson(raw);
const files = (packResult.files ?? []).map((entry) => entry.path).filter(Boolean);

if (!files.length) fail("no files discovered in package tarball.");

const unexpected = files.filter((filePath) => !isAllowed(filePath));
if (unexpected.length > 0) {
  fail(`unexpected files in tarball: ${unexpected.join(", ")}`);
}

const hasDistFiles = files.some((filePath) => filePath.startsWith("dist/"));
if (!hasDistFiles) {
  fail("tarball does not include dist/ artifacts.");
}

console.log("verify:pack passed");
