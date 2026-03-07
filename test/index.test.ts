import assert from "node:assert/strict";
import test from "node:test";
import { isFilePath, mix, viteConfigFromGraph } from "../dist/index.js";

test("isFilePath detects file-like paths", () => {
  assert.equal(isFilePath("resources/assets/js/app.js"), true);
  assert.equal(isFilePath("/tmp/archive.TAR.GZ"), true);
  assert.equal(isFilePath("public/css/app.css"), true);
  assert.equal(isFilePath("resources/assets/js"), false);
  assert.equal(isFilePath("public/fonts"), false);
});

test("mix() returns a Mix instance with fluent chaining", () => {
  const m = mix()
    .setPublicPath("public")
    .js("resources/assets/js/app.js", "public/js")
    .sass("resources/assets/sass/app.scss", "public/css")
    .css("resources/assets/css/simple.css", "public/css")
    .copy("resources/assets/images/logo.png", "public/images/logo.png")
    .copyDirectory("resources/assets/fonts", "public/fonts")
    .autoload({ jquery: ["$", "jQuery", "window.jQuery"] })
    .version();

  const graph = m.toGraph();
  assert.equal(graph.publicPath, "public");
  assert.equal(graph.js.length, 1);
  assert.equal(graph.sass.length, 1);
  assert.equal(graph.css.length, 1);
  assert.equal(graph.copies.length, 1);
  assert.equal(graph.copyDirs.length, 1);
  assert.deepEqual(graph.autoload.jquery, ["$", "jQuery", "window.jQuery"]);
  assert.equal(graph.versioning, true);
});

test("setPublicPath strips trailing slashes", () => {
  const graph = mix().setPublicPath("public///").toGraph();
  assert.equal(graph.publicPath, "public");
});

test("setPublicPath throws on path traversal", () => {
  assert.throws(
    () => mix().setPublicPath("../outside"),
    /publicPath must be within the project directory/
  );
});

test("options() merges into existing options", () => {
  const graph = mix().options({ processCssUrls: false }).toGraph();
  assert.equal(graph.options.processCssUrls, false);
});

test("js() adds entry and vue() attaches to last entry", () => {
  const graph = mix()
    .js("resources/assets/js/app.js", "public/js")
    .js("resources/assets/js/second.js", "public/js")
    .vue({ version: 3 })
    .toGraph();

  assert.equal(graph.js.length, 2);
  assert.deepEqual(graph.js[1].vue, { version: 3 });
});

test("autoload() merges multiple calls", () => {
  const graph = mix()
    .autoload({ jquery: ["$"] })
    .autoload({ lodash: ["_"] })
    .toGraph();

  assert.deepEqual(graph.autoload.jquery, ["$"]);
  assert.deepEqual(graph.autoload.lodash, ["_"]);
});

test("version() sets versioning flag", () => {
  assert.equal(mix().toGraph().versioning, false);
  assert.equal(mix().version().toGraph().versioning, true);
});

test("inProduction() reflects NODE_ENV", () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  assert.equal(mix().inProduction(), true);
  process.env.NODE_ENV = "development";
  assert.equal(mix().inProduction(), false);
  process.env.NODE_ENV = original;
});

test("toGraph() returns a defensive copy", () => {
  const builder = mix()
    .setPublicPath("public/")
    .js("resources/assets/js/app.js", "js")
    .autoload({ jquery: ["$", "jQuery"] });

  const first = builder.toGraph();
  first.publicPath = "changed";
  first.js[0].src = "mutated.js";
  first.autoload.jquery.push("window.jQuery");

  const second = builder.toGraph();
  assert.equal(second.publicPath, "public");
  assert.equal(second.js[0].src, "resources/assets/js/app.js");
  assert.deepEqual(second.autoload.jquery, ["$", "jQuery"]);
});

test("viteConfigFromGraph returns a valid Vite config shape", async () => {
  const graph = mix()
    .setPublicPath("public")
    .js("resources/assets/js/app.js", "public/js")
    .sass("resources/assets/sass/app.scss", "public/css")
    .toGraph();

  const config = await viteConfigFromGraph(graph, "production");

  assert.ok(config.build, "config.build should exist");
  assert.equal(config.build?.outDir, "public");
  assert.equal(config.build?.manifest, true);
  assert.equal(config.build?.emptyOutDir, false);
  assert.ok(config.resolve, "config.resolve should exist");
  assert.ok(Array.isArray(config.plugins), "config.plugins should be an array");
});

test("viteConfigFromGraph production uses hashed filenames", async () => {
  const graph = mix()
    .setPublicPath("public")
    .js("resources/assets/js/app.js", "public/js")
    .toGraph();

  const config = await viteConfigFromGraph(graph, "production");
  const output = config.build?.rollupOptions?.output as { entryFileNames: string };

  assert.ok(output.entryFileNames.includes("[hash]"), "production entry should include hash");
});

test("viteConfigFromGraph development uses plain filenames", async () => {
  const graph = mix()
    .setPublicPath("public")
    .js("resources/assets/js/app.js", "public/js")
    .toGraph();

  const config = await viteConfigFromGraph(graph, "development");
  const output = config.build?.rollupOptions?.output as { entryFileNames: string };

  assert.ok(!output.entryFileNames.includes("[hash]"), "development entry should not include hash");
});

test("viteConfigFromGraph copy destination escaping throws", async () => {
  const graph = mix()
    .setPublicPath("public")
    .toGraph();

  graph.copies.push({ src: "src/file.txt", dest: "../outside/file.txt" });

  await assert.rejects(
    () => viteConfigFromGraph(graph, "development"),
    /copy destination escapes publicPath/
  );
});
