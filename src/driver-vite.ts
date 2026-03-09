import path from "node:path";
import fs from "node:fs";
import { type InlineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import type { MixGraph } from "./index.js";

function relKeyFromResources(file: string) {
  return file
    .replace(/^resources\/assets\/(js|css|sass)\//, "")
    .replace(/\.(js|css|scss|sass)$/, "");
}

function ensurePosix(p: string) {
  return p.split(path.sep).join("/");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasFile(p: string) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function hasDir(p: string) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isBareAssetImport(source: string) {
  if (source.startsWith(".") || source.startsWith("/") || source.startsWith("@")) return false;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(source)) return false;
  const sourcePath = source.split("?")[0].split("#")[0];
  if (!sourcePath.includes("/")) return false;
  return /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|tiff|woff2?|eot|ttf|otf)$/i.test(sourcePath);
}

function webpackCompatResolvePlugin() {
  return {
    name: "mix-webpack-compat-resolve",
    enforce: "pre" as const,
    resolveId(source: string, importer?: string) {
      if (!importer) return null;
      const isRelativeOrAbsolute = source.startsWith(".") || source.startsWith("/");

      if (isRelativeOrAbsolute && !path.extname(source)) {
        const importerPath = importer.split("?")[0];
        const baseDir = path.dirname(importerPath);
        const abs = path.resolve(baseDir, source);

        const vueSibling = `${abs}.vue`;
        if (hasFile(vueSibling)) return vueSibling;

        if (hasDir(abs)) {
          const vueIndex = path.join(abs, "index.vue");
          if (hasFile(vueIndex)) return vueIndex;
        }

        const parentDir = path.dirname(abs);
        if (path.basename(abs) === path.basename(parentDir)) {
          const parentIndexVue = path.join(parentDir, "index.vue");
          if (hasFile(parentIndexVue)) return parentIndexVue;
        }
      }

      if (isBareAssetImport(source)) {
        const sourcePath = source.split("?")[0].split("#")[0];
        const candidates = [path.resolve(process.cwd(), "resources/assets", sourcePath), path.resolve(process.cwd(), "resources", sourcePath)];
        for (const candidate of candidates) {
          if (hasFile(candidate)) return candidate;
        }
      }

      return null;
    },
  };
}

function autoloadPlugin(identMap: Record<string, string>): Plugin {
  const patterns = Object.entries(identMap).map(([ident, module]) => ({
    ident,
    module,
    localName: ident.startsWith("window.") ? ident.slice(7) : ident,
    isWindow: ident.startsWith("window."),
    regex: ident.startsWith("window.") ? null : new RegExp(`(?<![.\\w$])${escapeRegExp(ident)}(?![\\w$])`),
  }));

  return {
    name: "mix-inject",
    enforce: "post" as const,
    transform(code, id) {
      if (id.includes("node_modules")) return;
      if (!/\.[jt]sx?$/.test(id.split("?")[0])) return;

      const toAdd: string[] = [];
      const seen = new Set<string>();

      for (const { ident, module, localName, isWindow, regex } of patterns) {
        if (seen.has(localName)) continue;

        if (
          code.includes(`from '${module}'`) ||
          code.includes(`from "${module}"`) ||
          code.includes(`require('${module}')`) ||
          code.includes(`require("${module}")`)
        )
          continue;

        const used = isWindow ? code.includes(ident) : regex!.test(code);

        if (used) {
          toAdd.push(`import ${localName} from '${module}';`);
          seen.add(localName);
        }
      }

      if (!toAdd.length) return;
      return { code: toAdd.join("\n") + "\n" + code, map: null };
    },
  };
}

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
};

function mimeType(file: string): string {
  return MIME_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

async function collectFiles(dir: string): Promise<Array<{ abs: string; rel: string }>> {
  const out: Array<{ abs: string; rel: string }> = [];
  for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const f of await collectFiles(abs)) {
        out.push({ abs: f.abs, rel: path.join(entry.name, f.rel) });
      }
    } else {
      out.push({ abs, rel: entry.name });
    }
  }
  return out;
}

function outputPath(dest: string, filename: string): string {
  return dest && dest !== "." ? `${dest}/${filename}` : filename;
}

function staticCopyPlugin(targets: Array<{ src: string; dest: string; rename?: string }>): Plugin {
  return {
    name: "mix-static-copy",
    async buildStart() {
      for (const { src, dest, rename } of targets) {
        try {
          if (src.endsWith("/**/*")) {
            const srcDir = src.slice(0, -5);
            for (const { abs, rel } of await collectFiles(srcDir)) {
              this.emitFile({ type: "asset", fileName: outputPath(dest, rel), source: await fs.promises.readFile(abs) });
            }
          } else {
            const filename = rename ?? path.basename(src);
            this.emitFile({ type: "asset", fileName: outputPath(dest, filename), source: await fs.promises.readFile(src) });
          }
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        }
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        for (const { src, dest, rename } of targets) {
          if (src.endsWith("/**/*")) {
            const prefix = `/${dest}/`;
            if (url.startsWith(prefix)) {
              fs.promises.readFile(path.join(src.slice(0, -5), url.slice(prefix.length)))
                .then((content) => { res.setHeader("Content-Type", mimeType(url)); res.end(content); })
                .catch(() => next());
              return;
            }
          } else {
            const filename = rename ?? path.basename(src);
            if (url === `/${outputPath(dest, filename)}`) {
              fs.promises.readFile(src)
                .then((content) => { res.setHeader("Content-Type", mimeType(src)); res.end(content); })
                .catch(() => next());
              return;
            }
          }
        }
        next();
      });
    },
  };
}

export async function viteConfigFromGraph(graph: MixGraph, mode: "development" | "production"): Promise<InlineConfig> {
  const isProd = mode === "production";

  const input: Record<string, string> = {};

  for (const e of graph.js) {
    input[relKeyFromResources(e.src)] = path.resolve(e.src);
  }
  for (const e of graph.sass) {
    input[relKeyFromResources(e.src)] = path.resolve(e.src);
  }
  for (const e of graph.css) {
    input[relKeyFromResources(e.src)] = path.resolve(e.src);
  }

  const staticTargets: Array<{ src: string; dest: string; rename?: string }> = [];

  const resolvedPublic = path.resolve(graph.publicPath);

  function guardDest(dest: string) {
    const resolved = path.resolve(graph.publicPath, dest);
    if (resolved !== resolvedPublic && !resolved.startsWith(resolvedPublic + path.sep)) {
      throw new Error(`copy destination escapes publicPath: ${dest}`);
    }
  }

  for (const c of graph.copies) {
    const normalizedDest = ensurePosix(c.dest).replace(new RegExp(`^${escapeRegExp(ensurePosix(graph.publicPath))}/?`), "");
    guardDest(normalizedDest);
    const destDir = path.posix.dirname(normalizedDest);
    const base = path.posix.basename(normalizedDest);

    const hasExt = /\.[a-z0-9]+$/i.test(base);
    staticTargets.push({
      src: ensurePosix(c.src),
      dest: hasExt ? destDir : normalizedDest,
      ...(hasExt ? { rename: base } : {}),
    });
  }

  for (const cd of graph.copyDirs) {
    const normalizedDest = ensurePosix(cd.dest).replace(new RegExp(`^${escapeRegExp(ensurePosix(graph.publicPath))}/?`), "");
    guardDest(normalizedDest);
    staticTargets.push({
      src: ensurePosix(cd.src) + "/**/*",
      dest: normalizedDest,
    });
  }

  const wantsJquery =
    Object.values(graph.autoload).some((arr) => arr.includes("$") || arr.includes("jQuery") || arr.includes("window.jQuery")) ||
    Object.keys(graph.autoload).some((k) => k.toLowerCase() === "jquery");

  const plugins: Plugin[] = [webpackCompatResolvePlugin()];

  if (graph.js.some((e) => !!e.vue)) {
    plugins.push(vue());
  }

  if (wantsJquery) {
    plugins.push(
      autoloadPlugin({
        $: "jquery",
        jQuery: "jquery",
        "window.jQuery": "jquery",
      })
    );
  }

  if (staticTargets.length) {
    plugins.push(staticCopyPlugin(staticTargets));
  }

  return {
    resolve: {
      extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json", ".vue"],
      alias: [{ find: /^~(.*)$/, replacement: "$1" }],
    },
    plugins,
    build: {
      manifest: true,
      outDir: graph.publicPath,
      emptyOutDir: false,
      assetsDir: "",
      rollupOptions: {
        input,
        output: isProd
          ? {
              entryFileNames: `js/[name]-[hash].js`,
              assetFileNames: (assetInfo) => {
                const name = assetInfo.names[0] || "";
                if (name.endsWith(".css")) return `css/[name]-[hash][extname]`;
                return `assets/[name]-[hash][extname]`;
              },
            }
          : {
              entryFileNames: `js/[name].js`,
              assetFileNames: (assetInfo) => {
                const name = assetInfo.names[0] || "";
                if (name.endsWith(".css")) return `css/${name}`;
                return `assets/${name}`;
              },
            },
      },
    },
    server: {
      strictPort: true,
    },
  };
}
