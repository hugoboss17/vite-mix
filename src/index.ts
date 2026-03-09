import path from "node:path";

export type CopyTarget = { src: string; dest: string; rename?: string };
export type CopyDirTarget = { src: string; dest: string };

export type CssEntry = { src: string; destDir: string };
export type JsEntry = { src: string; destDirOrFile: string };

export type MixGraph = {
  publicPath: string;
  js: JsEntry[];
  css: CssEntry[];
  sass: Array<{ src: string; destDir: string }>;
  copies: CopyTarget[];
  copyDirs: CopyDirTarget[];
  autoload: Record<string, string[]>;
  vue: boolean;
};

function normalizePublicPath(p: string) {
  let end = p.length;
  while (end > 0 && p[end - 1] === "/") end--;
  return p.slice(0, end);
}

export class Mix {
  private graph: MixGraph;

  constructor() {
    this.graph = {
      publicPath: "public",
      js: [],
      css: [],
      sass: [],
      copies: [],
      copyDirs: [],
      autoload: {},
      vue: false,
    };
  }

  setPublicPath(p: string) {
    const normalized = normalizePublicPath(p);
    const resolved = path.resolve(process.cwd(), normalized);
    if (resolved !== process.cwd() && !resolved.startsWith(process.cwd() + path.sep)) {
      throw new Error(`publicPath must be within the project directory: ${p}`);
    }
    this.graph.publicPath = normalized;
    return this;
  }

  js(src: string, dest: string) {
    this.graph.js.push({ src, destDirOrFile: dest });
    return this;
  }

  vue() {
    this.graph.vue = true;
    return this;
  }

  sass(src: string, dest: string) {
    this.graph.sass.push({ src, destDir: dest });
    return this;
  }

  css(src: string, destDir: string) {
    this.graph.css.push({ src, destDir });
    return this;
  }

  copy(src: string, dest: string) {
    this.graph.copies.push({ src, dest });
    return this;
  }

  copyDirectory(src: string, dest: string) {
    this.graph.copyDirs.push({ src, dest });
    return this;
  }

  autoload(map: Record<string, string[]>) {
    this.graph.autoload = { ...this.graph.autoload, ...map };
    return this;
  }

  toGraph(): MixGraph {
    return {
      publicPath: this.graph.publicPath,
      js: this.graph.js.map((entry) => ({ ...entry })),
      css: this.graph.css.map((entry) => ({ ...entry })),
      sass: this.graph.sass.map((entry) => ({ ...entry })),
      copies: this.graph.copies.map((entry) => ({ ...entry })),
      copyDirs: this.graph.copyDirs.map((entry) => ({ ...entry })),
      autoload: Object.fromEntries(Object.entries(this.graph.autoload).map(([key, values]) => [key, [...values]])),
      vue: this.graph.vue,
    };
  }
}

export function mix() {
  return new Mix();
}

export { viteConfigFromGraph } from "./driver-vite.js";
