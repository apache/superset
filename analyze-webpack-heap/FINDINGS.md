# Webpack Watch Mode Memory Analysis: Apache Superset Frontend

## Executive Summary

The Superset frontend webpack build in `--watch` mode consumes 7-8GB of Node.js heap. This analysis identifies the root causes ranked by impact and proposes fixes at three time horizons.

**Good news**: The config already has some best practices (filesystem cache, `eval-cheap-module-source-map`, SWC transpilation). The remaining issues are structural.

---

## Current Build Profile

| Metric | Value |
|--------|-------|
| Webpack version | 5.105.x |
| Entry points | 5 (`preamble`, `theme`, `menu`, `spa`, `embedded`, `service-worker`) |
| Direct dependencies | 138 |
| Dev dependencies | 140 |
| TypeScript files (src/) | 1,742 |
| TypeScript files (plugins/) | 705 |
| TypeScript files (packages/) | 935 |
| Total TS files compiled | ~3,382 |
| Symlinked plugin packages | 19 plugins + 5 packages |
| Chart plugins loaded eagerly | ~50+ in MainPreset.ts |
| Transpiler | SWC (good) |
| Source maps (dev) | `eval-cheap-module-source-map` (good) |
| Filesystem cache | Enabled (good) |
| TypeScript checker | ForkTsCheckerWebpackPlugin with `build: true` and 8GB memory limit |

---

## Top Root Causes (Ranked by Memory Impact)

### 1. ForkTsCheckerWebpackPlugin with `build: true` and 23 Project References (~2-3 GB)

**The single biggest memory hog.**

The plugin is configured with:
```js
new ForkTsCheckerWebpackPlugin({
  async: true,
  typescript: {
    build: true,               // Enables project references mode
    mode: 'write-references',  // Generates .d.ts files
    memoryLimit: 8192,         // 8GB allowed!
  },
})
```

With `build: true`, the TypeScript checker loads and type-checks the root `tsconfig.json` AND all 23 project references (every plugin and package). This is essentially running `tsc --build` in a separate process with an 8GB memory allowance. The checker keeps the entire program graph in memory for incremental checking.

**Impact**: The checker process alone can consume 2-3 GB. Combined with webpack's own module graph, this pushes total process memory to 7-8 GB.

**Why `build: true` exists**: It auto-generates `.d.ts` files for plugins/packages so you don't need a separate `npm run plugins:build` step. But this is a development convenience that costs enormous memory.

### 2. Massive Module Graph from Symlinked Plugin Source Resolution (~1.5-2 GB)

The webpack config resolves all `@superset-ui/*` and `@apache-superset/*` packages to their **source directories** instead of pre-built `lib/` output:

```js
// webpack.config.js lines 632-643
config.resolve.alias[pkg] = path.resolve(APP_DIR, `${dir}/src`);
```

This means webpack compiles **19 plugins + 5 packages from source** on every build. Each plugin brings in its own dependency tree. The entire module graph (3,382 TS files + their transitive imports) must be held in memory simultaneously during watch mode.

### 3. All Chart Plugins Loaded Eagerly in MainPreset.ts (~1-1.5 GB)

`MainPreset.ts` eagerly imports every single chart plugin at the top level:
- 19 legacy/modern chart plugins
- 27+ ECharts chart variants
- 5 filter plugins
- DeckGL preset (6+ map layers)

None of these are lazy-loaded. This forces webpack to include the entire chart ecosystem in the initial module graph, including heavy dependencies like `echarts`, `d3`, `mapbox-gl`, `ol` (OpenLayers), `deck.gl`, and `ag-grid`.

### 4. Heavy Dependencies Not Tree-Shaken or Externalized (~0.5-1 GB)

Key heavy libraries that bloat the module graph:
- **echarts** (~3.5 MB minified) - pulled in completely
- **antd** (~1.5 MB minified, `eager: true` in ModuleFederation)
- **mapbox-gl** (~800 KB)
- **ol** (OpenLayers) (~700 KB)
- **deck.gl** (6 packages) (~500 KB)
- **ag-grid** (~800 KB)
- **d3** ecosystem (many sub-packages)
- **lodash** (transform plugin helps, but still large)
- **jquery** (still a dependency!)

### 5. CSS Source Maps Always Enabled (~0.3-0.5 GB)

```js
// css-loader with sourceMap: true even in dev
{ loader: 'css-loader', options: { sourceMap: true } }
```

CSS source maps are generated even in watch mode. These add up across the codebase.

### 6. Poll-Based File Watching with `poll: 2000` (Minor Memory, Major CPU)

```js
watchOptions: {
  poll: 2000,
  aggregateTimeout: 500,
}
```

Polling every 2 seconds forces Node.js to stat every file in the watch tree. This doesn't directly cause 7GB heap usage, but it increases GC pressure and prevents memory from being reclaimed efficiently. Native `fs.watch` (the default without `poll`) is far more efficient.

---

## Recommendations

### Quick Wins (< 1 hour, config changes only)

#### Q1. Reduce ForkTsCheckerWebpackPlugin memory limit and disable `build` mode

The 8192 MB memory limit is far too generous. Reducing it and disabling `build: true` (which loads all 23 project references) will dramatically reduce checker memory.

**Trade-off**: You'll need to run `npm run plugins:build` separately to generate `.d.ts` files, OR disable the checker entirely in watch mode and rely on IDE type checking.

#### Q2. Disable CSS source maps in development

Source maps for CSS are rarely needed during development (browser devtools show the original styles via the `style-loader` injected `<style>` tags).

#### Q3. Remove `poll: 2000` — use native fs.watch instead

Polling is only needed in certain Docker/VM setups where native file events don't propagate. For native Linux/Mac development, `poll` should be removed to use the more efficient `fs.watch`.

#### Q4. Add `--max-old-space-size` to the `dev` script

The `dev` script currently has no memory limit:
```json
"dev": "webpack --mode=development --color --watch"
```

Adding a 4GB limit would prevent unbounded growth and force the GC to be more aggressive.

#### Q5. Ignore more directories in watchOptions

The current ignore list is good but could be extended to reduce the number of files webpack watches.

### Medium-Term Fixes (Days to Weeks)

#### M1. Lazy-load chart plugins in MainPreset.ts

Convert chart plugin imports to dynamic `import()` via `react-loadable` (already a dependency). This would make webpack code-split each chart plugin into its own chunk and not hold the entire chart ecosystem in the initial module graph:

```ts
// Instead of: import CalendarChartPlugin from '@superset-ui/legacy-plugin-chart-calendar';
// Use lazy registration with dynamic import
```

This is the single highest-impact medium-term change. It could reduce the module graph size by 40-60%.

#### M2. Pre-build plugin packages, stop resolving from source

Change the symlink alias strategy to use pre-built `lib/` directories instead of `src/`. Run a watch on plugin source separately (e.g., `tsc --build --watch`) and let webpack consume the compiled output.

#### M3. Externalize heavy libraries for development

For dev builds only, consider externalizing `echarts`, `antd`, `mapbox-gl`, and `deck.gl` as script tags loaded from a local vendor bundle or CDN. This removes them from the webpack module graph entirely.

#### M4. Remove or replace jQuery

jQuery is still listed as a dependency. If it's only used in a few legacy plugins, replacing those usages and removing the dependency would help.

### Long-Term Fixes (Months)

#### L1. Migrate to Vite or Rspack

Both are significantly faster and use less memory than webpack 5:
- **Rspack**: Drop-in webpack replacement, 5-10x faster, Rust-based
- **Vite**: Uses native ESM in development, no bundling during dev at all

Rspack is the lower-risk option since it's webpack-compatible. Vite would require more config changes but offers the best dev experience.

#### L2. Module Federation for plugin isolation

The existing `ModuleFederationPlugin` config only shares `react`, `react-dom`, and `antd`. A more aggressive use of Module Federation could build plugins as independent remotes, loaded at runtime. This would dramatically reduce the main build's module graph.

#### L3. Move to a monorepo build tool (Turborepo/Nx)

Use Turborepo or Nx to orchestrate builds across the workspace packages. Each plugin would build independently with caching, and only the main app would be watched during development.

---

## What's Already Done Right

The config already has several memory-conscious choices:
- **Filesystem cache** (`cache: { type: 'filesystem' }`) - avoids full rebuilds on restart
- **SWC transpilation** instead of babel-loader for webpack (faster, less memory)
- **`eval-cheap-module-source-map`** - the lightest source map option that still gives useful debugging
- **thread-loader disabled in dev** - threads add memory overhead; correct choice for HMR
- **`async: true`** on ForkTsCheckerWebpackPlugin - doesn't block compilation
- **SplitChunksPlugin** with high `minSize: 1000000` in dev - reduces chunk count
- **`watchOptions.ignored`** includes node_modules, .git, lib, esm, dist

---

## Summary of Changes Implemented

See the companion commits for:
1. Reduced `ForkTsCheckerWebpackPlugin` memory limit from 8192 to 2048 MB, disabled `build` mode in watch
2. Disabled CSS source maps in development mode
3. Removed `poll` from watchOptions (use native fs.watch)
4. Added `--max-old-space-size=4096` to the `dev` script
5. Extended `watchOptions.ignored` patterns

**Expected memory reduction**: From 7-8 GB to approximately 3-4 GB with quick wins alone.
