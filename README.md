# laravel-vite-mix

[![npm version](https://img.shields.io/npm/v/laravel-vite-mix)](https://www.npmjs.com/package/laravel-vite-mix)
[![CI](https://github.com/hugoboss17/laravel-vite-mix/actions/workflows/ci.yml/badge.svg)](https://github.com/hugoboss17/laravel-vite-mix/actions/workflows/ci.yml)
[![npm downloads](https://img.shields.io/npm/dt/laravel-vite-mix)](https://www.npmjs.com/package/laravel-vite-mix)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue)](LICENSE)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/hugoboss17/laravel-vite-mix/badge)](https://scorecard.dev/viewer/?uri=github.com/hugoboss17/laravel-vite-mix)
[![SLSA Level 3](https://slsa.dev/images/gh-badge-level3.svg)](https://slsa.dev)
[![Socket Badge](https://socket.dev/api/badge/npm/package/laravel-vite-mix)](https://socket.dev/npm/package/laravel-vite-mix)
[![codecov](https://codecov.io/gh/hugoboss17/laravel-vite-mix/graph/badge.svg)](https://codecov.io/gh/hugoboss17/laravel-vite-mix)

Use Vite with a Laravel Mix-like API.

## Purpose

Laravel Mix is no longer maintained. This package helps migrate legacy Mix-style build definitions to Vite with minimal frontend structure changes.

## Install

```bash
npm install laravel-vite-mix
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
import { mix, viteConfigFromGraph } from "laravel-vite-mix";

const m = mix()
  .setPublicPath("public")
  .js("resources/assets/js/app.js", "public/js")
  .vue({ version: 3 })
  .sass("resources/assets/sass/app.scss", "public/css")
  .css("resources/assets/css/simple.css", "public/css")
  .copy("resources/assets/images/logo.png", "public/images/logo.png")
  .copyDirectory("resources/assets/fonts", "public/fonts")
  .autoload({ jquery: ["$", "jQuery", "window.jQuery"] })
  .version();

const mode = process.env.NODE_ENV === "production" ? "production" : "development";

export default defineConfig(async () => await viteConfigFromGraph(m.toGraph(), mode));
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

| Method | Description |
|---|---|
| `mix()` | Create a new Mix instance |
| `.setPublicPath(path)` | Output directory (default: `"public"`) |
| `.options({ processCssUrls })` | Build options |
| `.js(src, dest)` | JavaScript/TypeScript entry point |
| `.vue({ version: 3 })` | Enable Vue plugin for the preceding `.js()` call |
| `.sass(src, dest)` | Sass/SCSS entry point |
| `.css(src, dest)` | Plain CSS entry point |
| `.copy(src, dest)` | Copy a file to the output directory |
| `.copyDirectory(src, dest)` | Copy a directory to the output directory |
| `.autoload(map)` | Inject globals (e.g. jQuery) |
| `.version()` | Enable content hashing in output filenames |
| `.inProduction()` | Returns `true` when `NODE_ENV=production` |
| `.toGraph()` | Returns the build graph (pass to `viteConfigFromGraph`) |
| `viteConfigFromGraph(graph, mode)` | Returns a Vite `InlineConfig` |

## Webpack compatibility handled

- Sass `~` imports — `@import "~bootstrap-sass/assets/stylesheets/bootstrap"`
- Extensionless Vue imports — `import Component from "../Component"`
- Directory Vue imports resolving to `index.vue`
- Legacy bare asset paths in templates resolving from `resources/assets`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
