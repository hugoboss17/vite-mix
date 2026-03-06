import path from "node:path";

export type VueOptions = { version: 2 | 3 };
export type MixOptions = { processCssUrls?: boolean };

export type CopyTarget = { src: string; dest: string; rename?: string };
export type CopyDirTarget = { src: string; dest: string };

export type CombineTarget = { sources: string[]; dest: string };

export type CssEntry = { src: string; destDir: string };
export type JsEntry = { src: string; destDirOrFile: string; vue?: VueOptions };

export type MixGraph = {
  publicPath: string;
  js: JsEntry[];
  css: CssEntry[];
  sass: Array<{ src: string; destDir: string }>;
  copies: CopyTarget[];
  copyDirs: CopyDirTarget[];
  combines: CombineTarget[];
  autoload: Record<string, string[]>;
  define: Record<string, any>;
  options: MixOptions;
  versioning: boolean;
  rawWebpackConfigFn?: (webpack: any) => any; // for compat capture
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
      combines: [],
      autoload: {},
      define: {},
      options: {},
      versioning: false,
    };
  }

  setPublicPath(p: string) {
    this.graph.publicPath = normalizePublicPath(p);
    return this;
  }

  options(opts: MixOptions) {
    this.graph.options = { ...this.graph.options, ...opts };
    return this;
  }

  js(src: string, dest: string) {
    this.graph.js.push({ src, destDirOrFile: dest });
    return this;
  }

  vue(opts: VueOptions) {
    // apply to the last js() call, like Mix
    const last = this.graph.js[this.graph.js.length - 1];
    if (last) last.vue = opts;
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
    // dest can be folder or file; keep as-is and resolve later
    this.graph.copies.push({ src, dest });
    return this;
  }

  copyDirectory(src: string, dest: string) {
    this.graph.copyDirs.push({ src, dest });
    return this;
  }

  combine(sources: string[], dest: string) {
    this.graph.combines.push({ sources, dest });
    return this;
  }

  autoload(map: Record<string, string[]>) {
    this.graph.autoload = { ...this.graph.autoload, ...map };
    return this;
  }

  webpackConfig(fn: (webpack: any) => any) {
    // We *capture* it, then the Vite driver translates what it can.
    this.graph.rawWebpackConfigFn = fn;
    return this;
  }

  version() {
    this.graph.versioning = true;
    return this;
  }

  inProduction() {
    return process.env.NODE_ENV === "production";
  }

  // what drivers consume
  toGraph(): MixGraph {
    return {
      publicPath: this.graph.publicPath,
      js: this.graph.js.map((entry) => ({ ...entry })),
      css: this.graph.css.map((entry) => ({ ...entry })),
      sass: this.graph.sass.map((entry) => ({ ...entry })),
      copies: this.graph.copies.map((entry) => ({ ...entry })),
      copyDirs: this.graph.copyDirs.map((entry) => ({ ...entry })),
      combines: this.graph.combines.map((entry) => ({
        ...entry,
        sources: [...entry.sources],
      })),
      autoload: Object.fromEntries(Object.entries(this.graph.autoload).map(([key, values]) => [key, [...values]])),
      define: { ...this.graph.define },
      options: { ...this.graph.options },
      versioning: this.graph.versioning,
      rawWebpackConfigFn: this.graph.rawWebpackConfigFn,
    };
  }
}

export function mix() {
  return new Mix();
}

// Helpers for path decisions
export function isFilePath(p: string) {
  return /\.[a-z0-9]+$/i.test(path.basename(p));
}
