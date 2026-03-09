import { describe, it, expect } from "vitest";
import { mix, viteConfigFromGraph } from "../src/index.ts";

describe("mix() builder", () => {
  it("returns a Mix instance with fluent chaining", () => {
    const graph = mix()
      .setPublicPath("public")
      .js("resources/assets/js/app.js", "public/js")
      .sass("resources/assets/sass/app.scss", "public/css")
      .css("resources/assets/css/simple.css", "public/css")
      .copy("resources/assets/images/logo.png", "public/images/logo.png")
      .copyDirectory("resources/assets/fonts", "public/fonts")
      .autoload({ jquery: ["$", "jQuery", "window.jQuery"] })
      .toGraph();

    expect(graph.publicPath).toBe("public");
    expect(graph.js).toHaveLength(1);
    expect(graph.sass).toHaveLength(1);
    expect(graph.css).toHaveLength(1);
    expect(graph.copies).toHaveLength(1);
    expect(graph.copyDirs).toHaveLength(1);
    expect(graph.autoload.jquery).toEqual(["$", "jQuery", "window.jQuery"]);
  });

  it("setPublicPath strips trailing slashes", () => {
    const graph = mix().setPublicPath("public///").toGraph();
    expect(graph.publicPath).toBe("public");
  });

  it("setPublicPath throws on path traversal", () => {
    expect(() => mix().setPublicPath("../outside")).toThrow(
      "publicPath must be within the project directory"
    );
  });

  it("vue() enables Vue plugin", () => {
    expect(mix().toGraph().vue).toBe(false);
    expect(mix().vue().toGraph().vue).toBe(true);
  });

  it("autoload() merges multiple calls", () => {
    const graph = mix()
      .autoload({ jquery: ["$"] })
      .autoload({ lodash: ["_"] })
      .toGraph();

    expect(graph.autoload.jquery).toEqual(["$"]);
    expect(graph.autoload.lodash).toEqual(["_"]);
  });
});

describe("toGraph()", () => {
  it("returns a defensive copy", () => {
    const builder = mix()
      .setPublicPath("public/")
      .js("resources/assets/js/app.js", "js")
      .autoload({ jquery: ["$", "jQuery"] });

    const first = builder.toGraph();
    first.publicPath = "changed";
    first.js[0].src = "mutated.js";
    first.autoload.jquery.push("window.jQuery");

    const second = builder.toGraph();
    expect(second.publicPath).toBe("public");
    expect(second.js[0].src).toBe("resources/assets/js/app.js");
    expect(second.autoload.jquery).toEqual(["$", "jQuery"]);
  });
});

describe("viteConfigFromGraph()", () => {
  it("returns a valid Vite config shape", async () => {
    const graph = mix()
      .setPublicPath("public")
      .js("resources/assets/js/app.js", "public/js")
      .sass("resources/assets/sass/app.scss", "public/css")
      .toGraph();

    const config = await viteConfigFromGraph(graph, "production");

    expect(config.build).toBeDefined();
    expect(config.build?.outDir).toBe("public");
    expect(config.build?.manifest).toBe(true);
    expect(config.build?.emptyOutDir).toBe(false);
    expect(config.resolve).toBeDefined();
    expect(Array.isArray(config.plugins)).toBe(true);
  });

  it("production uses hashed filenames", async () => {
    const graph = mix()
      .setPublicPath("public")
      .js("resources/assets/js/app.js", "public/js")
      .toGraph();

    const config = await viteConfigFromGraph(graph, "production");
    const output = config.build?.rollupOptions?.output as { entryFileNames: string };

    expect(output.entryFileNames).toContain("[hash]");
  });

  it("development uses plain filenames", async () => {
    const graph = mix()
      .setPublicPath("public")
      .js("resources/assets/js/app.js", "public/js")
      .toGraph();

    const config = await viteConfigFromGraph(graph, "development");
    const output = config.build?.rollupOptions?.output as { entryFileNames: string };

    expect(output.entryFileNames).not.toContain("[hash]");
  });

  it("throws when copy destination escapes publicPath", async () => {
    const graph = mix().setPublicPath("public").toGraph();
    graph.copies.push({ src: "src/file.txt", dest: "../outside/file.txt" });

    await expect(viteConfigFromGraph(graph, "development")).rejects.toThrow(
      "copy destination escapes publicPath"
    );
  });
});
