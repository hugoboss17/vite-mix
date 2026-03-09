import { vi, describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { mix, viteConfigFromGraph } from "../src/index.ts";

vi.mock("node:fs", () => ({
  default: { statSync: vi.fn() },
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
