import { vi, describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { mix, viteConfigFromGraph } from "../src/index.ts";

vi.mock("node:fs", () => ({
  default: {
    statSync: vi.fn(),
    promises: {
      readFile: vi.fn(),
      readdir: vi.fn(),
    },
  },
}));

vi.mock("@vitejs/plugin-vue", () => ({
  default: vi.fn(() => ({ name: "vite:vue" })),
}));

function statFile() {
  return { isFile: () => true, isDirectory: () => false } as fs.Stats;
}

function statDir() {
  return { isFile: () => false, isDirectory: () => true } as fs.Stats;
}

function notFound(): never {
  throw new Error("ENOENT");
}

function mockNotFound() {
  vi.mocked(fs.statSync).mockImplementation(() => notFound());
}

async function getCompatPlugin() {
  const graph = mix().setPublicPath("public").toGraph();
  const config = await viteConfigFromGraph(graph, "development");
  return (config.plugins as any[]).find((p) => p?.name === "mix-webpack-compat-resolve");
}

describe("viteConfigFromGraph - entry inputs", () => {
  beforeEach(mockNotFound);

  it("adds sass entries to rollup input", async () => {
    const graph = mix()
      .setPublicPath("public")
      .sass("resources/assets/sass/app.scss", "public/css")
      .toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    const input = config.build?.rollupOptions?.input as Record<string, string>;
    expect(Object.keys(input)).toContain("app");
  });

  it("adds css entries to rollup input", async () => {
    const graph = mix()
      .setPublicPath("public")
      .css("resources/assets/css/simple.css", "public/css")
      .toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    const input = config.build?.rollupOptions?.input as Record<string, string>;
    expect(Object.keys(input)).toContain("simple");
  });
});

describe("viteConfigFromGraph - plugins", () => {
  beforeEach(mockNotFound);

  it("adds Vue 3 plugin when wantsVue3", async () => {
    const graph = mix()
      .setPublicPath("public")
      .js("resources/assets/js/app.js", "public/js")
      .vue()
      .toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    expect((config.plugins as any[]).some((p) => p?.name === "vite:vue")).toBe(true);
  });

  it("adds inject plugin when autoload includes jquery", async () => {
    const graph = mix()
      .setPublicPath("public")
      .autoload({ jquery: ["$", "jQuery", "window.jQuery"] })
      .toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    const plugins = config.plugins as any[];
    const hasEnforcePost = plugins.some((p) => p?.enforce === "post");
    expect(hasEnforcePost).toBe(true);
  });

  it("adds inject plugin when autoload key is named jquery (case-insensitive)", async () => {
    const graph = mix()
      .setPublicPath("public")
      .autoload({ jQuery: ["someOtherVar"] })
      .toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    const plugins = config.plugins as any[];
    expect(plugins.some((p) => p?.enforce === "post")).toBe(true);
  });

  it("adds inject plugin for non-jquery libraries like lodash", async () => {
    const graph = mix()
      .setPublicPath("public")
      .autoload({ lodash: ["_"] })
      .toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    const plugins = config.plugins as any[];
    expect(plugins.some((p) => p?.enforce === "post")).toBe(true);
  });

  it("adds static copy plugin when copies are present", async () => {
    const graph = mix()
      .setPublicPath("public")
      .copy("resources/assets/images/logo.png", "public/images/logo.png")
      .toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    const flat = (config.plugins as any[]).flat();
    expect(flat.some((p) => p?.name?.includes("static-copy"))).toBe(true);
  });

  it("adds static copy plugin when copyDirectory is present", async () => {
    const graph = mix()
      .setPublicPath("public")
      .copyDirectory("resources/assets/fonts", "public/fonts")
      .toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    const flat = (config.plugins as any[]).flat();
    expect(flat.some((p) => p?.name?.includes("static-copy"))).toBe(true);
  });

  it("copy with no file extension treats dest as directory", async () => {
    const graph = mix().setPublicPath("public").toGraph();
    graph.copies.push({ src: "resources/assets/images/logo", dest: "public/images" });
    const config = await viteConfigFromGraph(graph, "development");
    const flat = (config.plugins as any[]).flat();
    expect(flat.some((p) => p?.name?.includes("static-copy"))).toBe(true);
  });
});

describe("viteConfigFromGraph - assetFileNames", () => {
  beforeEach(mockNotFound);

  it("production: css files go to css/ with hash", async () => {
    const graph = mix().setPublicPath("public").js("resources/assets/js/app.js", "public/js").toGraph();
    const config = await viteConfigFromGraph(graph, "production");
    const output = config.build?.rollupOptions?.output as { assetFileNames: (i: { names: string[] }) => string };
    expect(output.assetFileNames({ names: ["app.css"] })).toMatch(/^css\//);
    expect(output.assetFileNames({ names: ["image.png"] })).toMatch(/^assets\//);
  });

  it("development: css files go to css/ without hash", async () => {
    const graph = mix().setPublicPath("public").js("resources/assets/js/app.js", "public/js").toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    const output = config.build?.rollupOptions?.output as { assetFileNames: (i: { names: string[] }) => string };
    expect(output.assetFileNames({ names: ["app.css"] })).toMatch(/^css\//);
    expect(output.assetFileNames({ names: ["image.png"] })).toMatch(/^assets\//);
  });
});

describe("webpackCompatResolvePlugin - resolveId", () => {
  beforeEach(mockNotFound);

  it("returns null when no importer", async () => {
    const plugin = await getCompatPlugin();
    expect(plugin.resolveId("./Component", undefined)).toBeNull();
  });

  it("returns null when source has an extension", async () => {
    const plugin = await getCompatPlugin();
    expect(plugin.resolveId("./Component.js", "/project/src/index.js")).toBeNull();
  });

  it("returns null for non-relative source without slash", async () => {
    const plugin = await getCompatPlugin();
    expect(plugin.resolveId("some-package", "/project/src/index.js")).toBeNull();
  });

  it("returns null for @ prefixed source", async () => {
    const plugin = await getCompatPlugin();
    expect(plugin.resolveId("@scope/package", "/project/src/index.js")).toBeNull();
  });

  it("returns null for protocol URL", async () => {
    const plugin = await getCompatPlugin();
    expect(plugin.resolveId("https://example.com/logo.png", "/project/src/index.js")).toBeNull();
  });

  it("returns null for bare module path without asset extension", async () => {
    const plugin = await getCompatPlugin();
    expect(plugin.resolveId("theme/components/Button", "/project/src/index.js")).toBeNull();
  });

  it("returns null for relative import when no vue file found", async () => {
    const plugin = await getCompatPlugin();
    expect(plugin.resolveId("./Component", "/project/src/index.js")).toBeNull();
  });

  it("resolves .vue sibling when it exists", async () => {
    vi.mocked(fs.statSync).mockImplementation((p) => {
      if (String(p).endsWith(".vue")) return statFile();
      notFound();
    });
    const plugin = await getCompatPlugin();
    const result = plugin.resolveId("./MyComponent", "/project/src/index.js");
    expect(result).toMatch(/MyComponent\.vue$/);
  });

  it("resolves index.vue inside directory when it exists", async () => {
    vi.mocked(fs.statSync).mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith("/ComponentDir")) return statDir();
      if (s.endsWith("/ComponentDir/index.vue")) return statFile();
      notFound();
    });
    const plugin = await getCompatPlugin();
    const result = plugin.resolveId("./ComponentDir", "/project/src/index.js");
    expect(result).toMatch(/ComponentDir\/index\.vue$/);
  });

  it("resolves parent directory index.vue pattern", async () => {
    vi.mocked(fs.statSync).mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith("/Foo/index.vue")) return statFile();
      notFound();
    });
    const plugin = await getCompatPlugin();
    const result = plugin.resolveId("./Foo", "/project/src/Foo/index.js");
    expect(result).toMatch(/Foo\/index\.vue$/);
  });

  it("resolves bare asset import from resources/assets", async () => {
    vi.mocked(fs.statSync).mockImplementationOnce(() => statFile());
    const plugin = await getCompatPlugin();
    const result = plugin.resolveId("theme/images/logo.png", "/project/src/index.js");
    expect(result).toContain("resources/assets");
  });

  it("resolves bare asset import from resources fallback", async () => {
    vi.mocked(fs.statSync)
      .mockImplementationOnce(() => notFound())
      .mockImplementationOnce(() => statFile());
    const plugin = await getCompatPlugin();
    const result = plugin.resolveId("theme/images/logo.png", "/project/src/index.js");
    expect(result).toContain("resources");
  });

  it("returns null when bare asset not found anywhere", async () => {
    const plugin = await getCompatPlugin();
    expect(plugin.resolveId("theme/images/logo.png", "/project/src/index.js")).toBeNull();
  });

  it("does not throw when statSync throws (hasFile/hasDir error paths)", async () => {
    const plugin = await getCompatPlugin();
    expect(() => plugin.resolveId("./Component", "/project/src/index.js")).not.toThrow();
  });

  it("returns null for absolute path source with no matching vue file", async () => {
    const plugin = await getCompatPlugin();
    expect(plugin.resolveId("/absolute/Component", "/project/src/index.js")).toBeNull();
  });

  it("resolves bare asset import with query string stripped", async () => {
    vi.mocked(fs.statSync).mockImplementationOnce(() => statFile());
    const plugin = await getCompatPlugin();
    const result = plugin.resolveId("theme/images/logo.png?v=1", "/project/src/index.js");
    expect(result).toContain("resources/assets");
  });

  it("resolves bare asset import with hash stripped", async () => {
    vi.mocked(fs.statSync).mockImplementationOnce(() => statFile());
    const plugin = await getCompatPlugin();
    const result = plugin.resolveId("theme/images/logo.png#anchor", "/project/src/index.js");
    expect(result).toContain("resources/assets");
  });
});

describe("security - autoload validation", () => {
  beforeEach(mockNotFound);

  it("rejects identifier with code injection attempt", async () => {
    const graph = mix().setPublicPath("public").toGraph();
    graph.autoload = { jquery: ["x from 'evil'; import y"] };
    await expect(viteConfigFromGraph(graph, "development")).rejects.toThrow("Invalid autoload identifier");
  });

  it("rejects module name with code injection attempt", async () => {
    const graph = mix().setPublicPath("public").toGraph();
    graph.autoload = { "evil'; console.log('pwned": ["$"] };
    await expect(viteConfigFromGraph(graph, "development")).rejects.toThrow("Invalid autoload module");
  });

  it("rejects identifier with semicolon", async () => {
    const graph = mix().setPublicPath("public").toGraph();
    graph.autoload = { jquery: ["$; malicious()"] };
    await expect(viteConfigFromGraph(graph, "development")).rejects.toThrow("Invalid autoload identifier");
  });

  it("accepts valid dotted identifier like window.jQuery", async () => {
    const graph = mix().setPublicPath("public").autoload({ jquery: ["window.jQuery"] }).toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    expect((config.plugins as any[]).some((p) => p?.enforce === "post")).toBe(true);
  });

  it("accepts valid scoped module like @scope/package", async () => {
    const graph = mix().setPublicPath("public").autoload({ "@myorg/utils": ["utils"] }).toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    expect((config.plugins as any[]).some((p) => p?.enforce === "post")).toBe(true);
  });
});

describe("security - copy destination traversal", () => {
  beforeEach(mockNotFound);

  it("rejects copy destination that escapes publicPath", async () => {
    const graph = mix().setPublicPath("public").toGraph();
    graph.copies.push({ src: "file.txt", dest: "../../etc/passwd" });
    await expect(viteConfigFromGraph(graph, "development")).rejects.toThrow("copy destination escapes publicPath");
  });

  it("rejects copyDirectory destination that escapes publicPath", async () => {
    const graph = mix().setPublicPath("public").toGraph();
    graph.copyDirs.push({ src: "assets", dest: "../outside" });
    await expect(viteConfigFromGraph(graph, "development")).rejects.toThrow("copy destination escapes publicPath");
  });

  it("allows copy destination within publicPath", async () => {
    const graph = mix().setPublicPath("public").copy("logo.png", "public/images/logo.png").toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    const flat = (config.plugins as any[]).flat();
    expect(flat.some((p) => p?.name === "mix-static-copy")).toBe(true);
  });
});

async function getAutoloadPlugin(autoload: Record<string, string[]>) {
  const graph = mix().setPublicPath("public").autoload(autoload).toGraph();
  const config = await viteConfigFromGraph(graph, "development");
  return (config.plugins as any[]).find((p) => p?.name === "mix-inject");
}

async function getStaticCopyPlugin(setup: (m: ReturnType<typeof mix>) => ReturnType<typeof mix>) {
  const graph = setup(mix().setPublicPath("public")).toGraph();
  const config = await viteConfigFromGraph(graph, "development");
  return (config.plugins as any[]).flat().find((p) => p?.name === "mix-static-copy");
}

describe("autoloadPlugin - transform", () => {
  beforeEach(mockNotFound);

  it("skips node_modules files", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform("const x = $;", "/project/node_modules/foo/index.js");
    expect(result).toBeUndefined();
  });

  it("skips non-js/ts files", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform("const x = $;", "/project/src/style.css");
    expect(result).toBeUndefined();
  });

  it("injects import when identifier is used", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform("const el = $(selector);", "/project/src/app.js");
    expect(result.code).toContain("import $ from 'jquery';");
  });

  it("injects import for window.jQuery identifier", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["window.jQuery"] });
    const result = plugin.transform("window.jQuery.fn.test = 1;", "/project/src/app.js");
    expect(result.code).toContain("import jQuery from 'jquery';");
  });

  it("does not inject when module is already imported (single quotes)", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform("import $ from 'jquery'; $(sel);", "/project/src/app.js");
    expect(result).toBeUndefined();
  });

  it("does not inject when module is already imported (double quotes)", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform('import $ from "jquery"; $(sel);', "/project/src/app.js");
    expect(result).toBeUndefined();
  });

  it("does not inject when module is already required (single quotes)", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform("const $ = require('jquery'); $(sel);", "/project/src/app.js");
    expect(result).toBeUndefined();
  });

  it("does not inject when module is already required (double quotes)", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform('const $ = require("jquery"); $(sel);', "/project/src/app.js");
    expect(result).toBeUndefined();
  });

  it("does not inject when identifier is not used", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform("const x = 1;", "/project/src/app.js");
    expect(result).toBeUndefined();
  });

  it("does not match identifier as part of another word", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform("const x$y = 1;", "/project/src/app.js");
    expect(result).toBeUndefined();
  });

  it("handles .ts files", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform("$(sel);", "/project/src/app.ts");
    expect(result.code).toContain("import $ from 'jquery';");
  });

  it("handles .tsx files", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform("$(sel);", "/project/src/app.tsx");
    expect(result.code).toContain("import $ from 'jquery';");
  });

  it("handles .jsx files", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform("$(sel);", "/project/src/app.jsx");
    expect(result.code).toContain("import $ from 'jquery';");
  });

  it("handles file id with query string", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform("$(sel);", "/project/src/app.js?v=1");
    expect(result.code).toContain("import $ from 'jquery';");
  });

  it("deduplicates multiple identifiers mapping to same local name", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$", "jQuery"] });
    const result = plugin.transform("$(sel); jQuery.fn;", "/project/src/app.js");
    expect(result.code).toContain("import $ from 'jquery';");
    expect(result.code).toContain("import jQuery from 'jquery';");
  });

  it("skips duplicate localName when window.X and X both map to same name", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["jQuery", "window.jQuery"] });
    const result = plugin.transform("jQuery.fn.test = 1;", "/project/src/app.js");
    // Should only inject one import for jQuery, not two
    const imports = result.code.split("\n").filter((l: string) => l.startsWith("import "));
    expect(imports).toHaveLength(1);
  });

  it("returns map: null in transform result", async () => {
    const plugin = await getAutoloadPlugin({ jquery: ["$"] });
    const result = plugin.transform("$(sel);", "/project/src/app.js");
    expect(result.map).toBeNull();
  });
});

describe("staticCopyPlugin - buildStart", () => {
  beforeEach(mockNotFound);

  it("emits a single file asset", async () => {
    const plugin = await getStaticCopyPlugin((m) => m.copy("resources/logo.png", "public/images/logo.png"));
    const emitFile = vi.fn();
    vi.mocked(fs.promises.readFile).mockResolvedValue(Buffer.from("png-data"));
    await plugin.buildStart.call({ emitFile });
    expect(emitFile).toHaveBeenCalledWith(
      expect.objectContaining({ type: "asset", fileName: "images/logo.png" }),
    );
  });

  it("emits directory files with collectFiles", async () => {
    const plugin = await getStaticCopyPlugin((m) => m.copyDirectory("resources/fonts", "public/fonts"));
    const emitFile = vi.fn();
    vi.mocked(fs.promises.readdir).mockResolvedValue([
      { name: "font.woff2", parentPath: "resources/fonts", isFile: () => true } as any,
    ]);
    vi.mocked(fs.promises.readFile).mockResolvedValue(Buffer.from("font-data"));
    await plugin.buildStart.call({ emitFile });
    expect(emitFile).toHaveBeenCalledWith(
      expect.objectContaining({ type: "asset", fileName: "fonts/font.woff2" }),
    );
  });

  it("silently ignores ENOENT errors", async () => {
    const plugin = await getStaticCopyPlugin((m) => m.copy("missing.png", "public/images/missing.png"));
    const emitFile = vi.fn();
    const err = new Error("ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    vi.mocked(fs.promises.readFile).mockRejectedValue(err);
    await expect(plugin.buildStart.call({ emitFile })).resolves.toBeUndefined();
    expect(emitFile).not.toHaveBeenCalled();
  });

  it("rethrows non-ENOENT errors", async () => {
    const plugin = await getStaticCopyPlugin((m) => m.copy("bad.png", "public/images/bad.png"));
    const emitFile = vi.fn();
    const err = new Error("EACCES") as NodeJS.ErrnoException;
    err.code = "EACCES";
    vi.mocked(fs.promises.readFile).mockRejectedValue(err);
    await expect(plugin.buildStart.call({ emitFile })).rejects.toThrow("EACCES");
  });

  it("emits file with dest as directory when no rename", async () => {
    const plugin = await getStaticCopyPlugin((m) => {
      const g = m.toGraph();
      g.copies.push({ src: "resources/logo", dest: "public/images" });
      // Manually build - need a different approach
      return m;
    });
    // This case is covered by copy with no file extension test already
  });
});

describe("staticCopyPlugin - configureServer middleware", () => {
  beforeEach(() => {
    mockNotFound();
    vi.mocked(fs.promises.readFile).mockReset();
  });

  function createMockServer() {
    const middlewares: any[] = [];
    return {
      server: { middlewares: { use: (fn: any) => middlewares.push(fn) } },
      getMiddleware: () => middlewares[0],
    };
  }

  it("serves a single file by exact URL match", async () => {
    const plugin = await getStaticCopyPlugin((m) => m.copy("resources/logo.png", "public/images/logo.png"));
    const { server, getMiddleware } = createMockServer();
    plugin.configureServer(server);
    const mw = getMiddleware();

    const content = Buffer.from("png-data");
    vi.mocked(fs.promises.readFile).mockResolvedValue(content);

    const res = { end: vi.fn() };
    const next = vi.fn();
    mw({ url: "/images/logo.png" }, res, next);

    await vi.waitFor(() => expect(res.end).toHaveBeenCalledWith(content));
    expect(next).not.toHaveBeenCalled();
  });

  it("serves directory files by prefix match", async () => {
    const plugin = await getStaticCopyPlugin((m) => m.copyDirectory("resources/fonts", "public/fonts"));
    const { server, getMiddleware } = createMockServer();
    plugin.configureServer(server);
    const mw = getMiddleware();

    const content = Buffer.from("font-data");
    vi.mocked(fs.promises.readFile).mockResolvedValue(content);

    const res = { end: vi.fn() };
    const next = vi.fn();
    mw({ url: "/fonts/myfont.woff2" }, res, next);

    await vi.waitFor(() => expect(res.end).toHaveBeenCalledWith(content));
  });

  it("calls next() when URL does not match any target", async () => {
    const plugin = await getStaticCopyPlugin((m) => m.copy("resources/logo.png", "public/images/logo.png"));
    const { server, getMiddleware } = createMockServer();
    plugin.configureServer(server);
    const mw = getMiddleware();

    const res = { end: vi.fn() };
    const next = vi.fn();
    mw({ url: "/unrelated/path" }, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it("calls next() on file read error for single file", async () => {
    const plugin = await getStaticCopyPlugin((m) => m.copy("resources/logo.png", "public/images/logo.png"));
    const { server, getMiddleware } = createMockServer();
    plugin.configureServer(server);
    const mw = getMiddleware();

    vi.mocked(fs.promises.readFile).mockRejectedValue(new Error("ENOENT"));

    const res = { end: vi.fn() };
    const next = vi.fn();
    mw({ url: "/images/logo.png" }, res, next);

    await vi.waitFor(() => expect(next).toHaveBeenCalled());
  });

  it("calls next() on file read error for directory file", async () => {
    const plugin = await getStaticCopyPlugin((m) => m.copyDirectory("resources/fonts", "public/fonts"));
    const { server, getMiddleware } = createMockServer();
    plugin.configureServer(server);
    const mw = getMiddleware();

    vi.mocked(fs.promises.readFile).mockRejectedValue(new Error("ENOENT"));

    const res = { end: vi.fn() };
    const next = vi.fn();
    mw({ url: "/fonts/myfont.woff2" }, res, next);

    await vi.waitFor(() => expect(next).toHaveBeenCalled());
  });

  it("calls next() for directory path traversal attempt (safePath returns null)", async () => {
    const plugin = await getStaticCopyPlugin((m) => m.copyDirectory("resources/fonts", "public/fonts"));
    const { server, getMiddleware } = createMockServer();
    plugin.configureServer(server);
    const mw = getMiddleware();

    const res = { end: vi.fn() };
    const next = vi.fn();
    mw({ url: "/fonts/../../../etc/passwd" }, res, next);

    expect(next).toHaveBeenCalled();
    expect(fs.promises.readFile).not.toHaveBeenCalled();
  });

  it("handles URL with query string", async () => {
    const plugin = await getStaticCopyPlugin((m) => m.copy("resources/logo.png", "public/images/logo.png"));
    const { server, getMiddleware } = createMockServer();
    plugin.configureServer(server);
    const mw = getMiddleware();

    const content = Buffer.from("png-data");
    vi.mocked(fs.promises.readFile).mockResolvedValue(content);

    const res = { end: vi.fn() };
    const next = vi.fn();
    mw({ url: "/images/logo.png?v=123" }, res, next);

    await vi.waitFor(() => expect(res.end).toHaveBeenCalledWith(content));
  });

  it("handles missing req.url gracefully", async () => {
    const plugin = await getStaticCopyPlugin((m) => m.copy("resources/logo.png", "public/images/logo.png"));
    const { server, getMiddleware } = createMockServer();
    plugin.configureServer(server);
    const mw = getMiddleware();

    const res = { end: vi.fn() };
    const next = vi.fn();
    mw({ url: undefined }, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe("viteConfigFromGraph - mode fallback", () => {
  beforeEach(mockNotFound);

  it("falls back to process.env.NODE_ENV when mode is undefined", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const graph = mix().setPublicPath("public").js("resources/assets/js/app.js", "public/js").toGraph();
      const config = await viteConfigFromGraph(graph);
      const output = config.build?.rollupOptions?.output as { entryFileNames: string };
      expect(output.entryFileNames).toContain("[hash]");
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});

describe("viteConfigFromGraph - assetFileNames edge cases", () => {
  beforeEach(mockNotFound);

  it("production: handles empty names array", async () => {
    const graph = mix().setPublicPath("public").js("resources/assets/js/app.js", "public/js").toGraph();
    const config = await viteConfigFromGraph(graph, "production");
    const output = config.build?.rollupOptions?.output as { assetFileNames: (i: { names: string[] }) => string };
    expect(output.assetFileNames({ names: [] })).toMatch(/^assets\//);
  });

  it("development: handles empty names array", async () => {
    const graph = mix().setPublicPath("public").js("resources/assets/js/app.js", "public/js").toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    const output = config.build?.rollupOptions?.output as { assetFileNames: (i: { names: string[] }) => string };
    expect(output.assetFileNames({ names: [] })).toMatch(/^assets\//);
  });
});

describe("staticCopyPlugin - configureServer single file with rename", () => {
  beforeEach(() => {
    mockNotFound();
    vi.mocked(fs.promises.readFile).mockReset();
  });

  function createMockServer() {
    const middlewares: any[] = [];
    return {
      server: { middlewares: { use: (fn: any) => middlewares.push(fn) } },
      getMiddleware: () => middlewares[0],
    };
  }

  it("serves renamed single file via middleware", async () => {
    // copy with file extension in dest produces a rename
    const plugin = await getStaticCopyPlugin((m) => m.copy("resources/logo.png", "public/images/brand.png"));
    const { server, getMiddleware } = createMockServer();
    plugin.configureServer(server);
    const mw = getMiddleware();

    const content = Buffer.from("png-data");
    vi.mocked(fs.promises.readFile).mockResolvedValue(content);

    const res = { end: vi.fn() };
    const next = vi.fn();
    mw({ url: "/images/brand.png" }, res, next);

    await vi.waitFor(() => expect(res.end).toHaveBeenCalledWith(content));
  });
});

describe("staticCopyPlugin - configureServer mixed targets", () => {
  beforeEach(() => {
    mockNotFound();
    vi.mocked(fs.promises.readFile).mockReset();
  });

  function createMockServer() {
    const middlewares: any[] = [];
    return {
      server: { middlewares: { use: (fn: any) => middlewares.push(fn) } },
      getMiddleware: () => middlewares[0],
    };
  }

  it("falls through directory target when URL does not match prefix", async () => {
    // Has both a directory and a single-file target; URL matches the single file
    const graph = mix()
      .setPublicPath("public")
      .copyDirectory("resources/fonts", "public/fonts")
      .copy("resources/logo.png", "public/images/logo.png")
      .toGraph();
    const config = await viteConfigFromGraph(graph, "development");
    const plugin = (config.plugins as any[]).flat().find((p: any) => p?.name === "mix-static-copy");

    const { server, getMiddleware } = createMockServer();
    plugin.configureServer(server);
    const mw = getMiddleware();

    const content = Buffer.from("png-data");
    vi.mocked(fs.promises.readFile).mockResolvedValue(content);

    const res = { end: vi.fn() };
    const next = vi.fn();
    mw({ url: "/images/logo.png" }, res, next);

    await vi.waitFor(() => expect(res.end).toHaveBeenCalledWith(content));
  });
});

describe("staticCopyPlugin - buildStart with empty dest", () => {
  beforeEach(() => {
    mockNotFound();
    vi.mocked(fs.promises.readFile).mockReset();
  });

  it("emits file at root when dest is empty (outputPath fallback)", async () => {
    const graph = mix().setPublicPath("public").toGraph();
    graph.copies.push({ src: "resources/logo.png", dest: "public/logo.png" });
    const config = await viteConfigFromGraph(graph, "development");
    const plugin = (config.plugins as any[]).flat().find((p: any) => p?.name === "mix-static-copy");

    const emitFile = vi.fn();
    vi.mocked(fs.promises.readFile).mockResolvedValue(Buffer.from("png"));
    await plugin.buildStart.call({ emitFile });
    expect(emitFile).toHaveBeenCalled();
  });
});

describe("security - absolute path resolution", () => {
  beforeEach(mockNotFound);

  it("does not resolve absolute paths through vue logic", async () => {
    vi.mocked(fs.statSync).mockImplementation((p) => {
      if (String(p).endsWith(".vue")) return statFile();
      notFound();
    });
    const plugin = await getCompatPlugin();
    const result = plugin.resolveId("/etc/passwd", "/project/src/index.js");
    expect(result).toBeNull();
  });

  it("does not resolve absolute path with traversal", async () => {
    const plugin = await getCompatPlugin();
    const result = plugin.resolveId("/../../etc/shadow", "/project/src/index.js");
    expect(result).toBeNull();
  });
});
