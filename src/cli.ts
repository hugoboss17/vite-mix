#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { mix, type MixGraph } from "./index.js";
import { runViteBuild, runViteDev, viteConfigFromGraph } from "./driver-vite.js";
import { build as viteBuild } from "vite";

function usage() {
  console.log(`
Usage:
  mix --development [--config mix.config.mjs]
  mix --production [--config mix.config.mjs]

Default config file: mix.config.mjs
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const configIdx = args.indexOf("--config");
  const configPath = configIdx !== -1 ? args[configIdx + 1] : "mix.config.mjs";
  return { cmd, configPath };
}

async function loadUserConfig(configPath: string): Promise<MixGraph> {
  const abs = path.resolve(configPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Config not found: ${abs}`);
  }

  const mod = await import(pathToFileURL(abs).toString());
  const factory = mod.default ?? mod.mixConfig;
  if (typeof factory !== "function") {
    throw new Error(`Config must export default function (mix) => mix`);
  }

  const m = mix();
  factory(m);
  return m.toGraph();
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function generateCombineEntries(graph: MixGraph) {
  if (!graph.combines.length) return;

  const tmpDir = path.resolve(".mix-tmp/_bundles");
  ensureDir(tmpDir);

  for (const combo of graph.combines) {
    const destBase = path.basename(combo.dest).replace(/\.css$/i, "");
    const entryName = `${destBase}.entry.css`;
    const entryPath = path.join(tmpDir, entryName);

    const lines = combo.sources.map((src) => {
      const abs = path.resolve(src);
      return `@import "${abs.replace(/\\/g, "/")}";`;
    });

    fs.writeFileSync(entryPath, lines.join("\n") + "\n", "utf8");
  }
}

async function addCombineEntriesToViteInput(graph: MixGraph, mode: "development" | "production") {
  const cfg: any = viteConfigFromGraph(graph, mode);
  const tmpGlob = fs.existsSync(".mix-tmp") ? ".mix-tmp/_bundles/*.entry.css" : null;
  if (tmpGlob) {
    const entries = (await import("fast-glob")).default.sync(tmpGlob);
    for (const file of entries) {
      const key = `_bundles/${path.basename(file).replace(/\.entry\.css$/, "")}`;
      cfg.build.rollupOptions.input[key] = path.resolve(file);
    }
  }
  return cfg;
}

async function main() {
  const { cmd, configPath } = parseArgs();
  if (!cmd || !["--development", "--production"].includes(cmd)) {
    usage();
    process.exit(1);
  }

  const graph = await loadUserConfig(configPath);
  generateCombineEntries(graph);

  if (cmd === "--development") {
    const { runViteDev } = await import("./driver-vite.js");
    await runViteDev(graph);
    return;
  }

  const cfg = await addCombineEntriesToViteInput(graph, "production");
  await viteBuild(cfg);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});