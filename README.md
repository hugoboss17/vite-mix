# vite-mix

[![npm version](https://img.shields.io/npm/v/vite-mix)](https://www.npmjs.com/package/vite-mix)
[![npm downloads](https://img.shields.io/npm/dt/vite-mix)](https://www.npmjs.com/package/vite-mix)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue)](LICENSE)
[![CI](https://github.com/hugoboss17/vite-mix/actions/workflows/ci.yml/badge.svg)](https://github.com/hugoboss17/vite-mix/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/hugoboss17/vite-mix/graph/badge.svg)](https://codecov.io/gh/hugoboss17/vite-mix)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/hugoboss17/vite-mix/badge)](https://scorecard.dev/viewer/?uri=github.com/hugoboss17/vite-mix)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12098/badge)](https://www.bestpractices.dev/projects/12098)
[![SLSA Level 3](https://slsa.dev/images/gh-badge-level3.svg)](https://slsa.dev)
[![Socket Badge](https://socket.dev/api/badge/npm/package/vite-mix)](https://socket.dev/npm/package/vite-mix)

Use Vite with a Laravel Mix-like API.

## Purpose

Laravel Mix is no longer maintained. This package helps migrate legacy Mix-style build definitions to Vite with minimal frontend structure changes.

## Install

```bash
npm install vite-mix
```

Peer dependencies (install only what you need):

```bash
npm install --save-dev vite                  # required
npm install --save-dev sass                  # if using .scss/.sass
npm install --save-dev @vitejs/plugin-vue    # if using Vue 3
```

## Usage

Replace your `webpack.mix.js` with `vite.config.js` with a Mix-style definition:

```js
// vite.config.js
import { defineConfig } from "vite";
import { mix, viteConfigFromGraph } from "vite-mix";

const graph = mix()
  .setPublicPath("public")
  .js("resources/assets/js/app.js", "public/js")
  .vue()
  .sass("resources/assets/sass/app.scss", "public/css")
  .css("resources/assets/css/simple.css", "public/css")
  .copy("resources/assets/images/logo.png", "public/images/logo.png")
  .copyDirectory("resources/assets/fonts", "public/fonts")
  .autoload({ jquery: ["$", "jQuery", "window.jQuery"] })
  .toGraph();

export default defineConfig(
  async ({ mode }) => await viteConfigFromGraph(graph, mode),
);
```

If you need to set the mode manually (e.g. outside Vite):

```js
const mode =
  process.env.NODE_ENV === "production" ? "production" : "development";
await viteConfigFromGraph(graph, mode);
```

Add scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "watch": "vite build --watch"
  }
}
```

Then run:

```bash
npm run build    # production
npm run watch    # watch mode
npm run dev      # dev server
```

## Supported API

| Method                             | Description                                                       |
| ---------------------------------- | ----------------------------------------------------------------- |
| `mix()`                            | Create a new Mix instance                                         |
| `.setPublicPath(path)`             | Output directory (default: `"public"`)                            |
| `.js(src, dest)`                   | JavaScript/TypeScript entry point                                 |
| `.vue()`                           | Enable Vue 3                                                      |
| `.sass(src, dest)`                 | Sass/SCSS entry point                                             |
| `.css(src, dest)`                  | Plain CSS entry point                                             |
| `.copy(src, dest)`                 | Copy a file to the output directory                               |
| `.copyDirectory(src, dest)`        | Copy a directory to the output directory                          |
| `.autoload(map)`                   | Inject globals (e.g. jQuery, Lodash)                              |
| `.toGraph()`                       | Returns the build graph (pass to `viteConfigFromGraph`)           |
| `viteConfigFromGraph(graph, mode)` | Returns a Vite `InlineConfig` (`mode` from Vite's `defineConfig`) |

## Examples

### Basic JavaScript

```js
import { defineConfig } from "vite";
import { mix, viteConfigFromGraph } from "vite-mix";

const graph = mix()
  .setPublicPath("public")
  .js("resources/assets/js/app.js", "public/js")
  .toGraph();

export default defineConfig(
  async ({ mode }) => await viteConfigFromGraph(graph, mode),
);
```

### Sass / CSS

```js
mix()
  .setPublicPath("public")
  .sass("resources/assets/sass/app.scss", "public/css")
  .css("resources/assets/css/vendor.css", "public/css")
  .toGraph();
```

### Vue 3

```js
mix()
  .setPublicPath("public")
  .js("resources/assets/js/app.js", "public/js")
  .js("resources/assets/js/admin.js", "public/js")
  .vue()
  .toGraph();
```

only the second JS import uses Vue

### Autoloading

Works with any library, not just jQuery:

```js
mix()
  .setPublicPath("public")
  .autoload({
    jquery: ["$", "jQuery", "window.jQuery"],
    lodash: ["_"],
  })
  .toGraph();
```

### Static Assets

```js
mix()
  .setPublicPath("public")
  .copy("resources/assets/images/logo.png", "public/images/logo.png")
  .copyDirectory("resources/assets/fonts", "public/fonts")
  .toGraph();
```

### Full Example

```js
// vite.config.js
import { defineConfig } from "vite";
import { mix, viteConfigFromGraph } from "vite-mix";

const graph = mix()
  .setPublicPath("public")
  .js("resources/assets/js/app.js", "public/js")
  .vue()
  .sass("resources/assets/sass/app.scss", "public/css")
  .css("resources/assets/css/vendor.css", "public/css")
  .autoload({
    jquery: ["$", "jQuery", "window.jQuery"],
    lodash: ["_"],
  })
  .copy("resources/assets/images/logo.png", "public/images/logo.png")
  .copyDirectory("resources/assets/fonts", "public/fonts")
  .toGraph();

export default defineConfig(
  async ({ mode }) => await viteConfigFromGraph(graph, mode),
);
```

## Webpack compatibility handled

- Sass `~` imports — `@import "~bootstrap-sass/assets/stylesheets/bootstrap"`
- Extensionless Vue imports — `import Component from "../Component"`
- Directory Vue imports resolving to `index.vue`
- Legacy bare asset paths in templates resolving from `resources/assets`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
