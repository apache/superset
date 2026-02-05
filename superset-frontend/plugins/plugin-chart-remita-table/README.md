# Remita Table Plugin (Local Integration Notes)

This plugin integrates a Remita-enhanced Table visualization on top of the local base Table plugin.

Key points:

- Local base plugin reuse
  - The compiled `esm/` and `lib/` files import the base Table plugin via relative paths:
    - `../../plugin-chart-table/src/*`
  - This avoids brittle package subpath resolution (e.g., `@superset-ui/plugin-chart-table/src/*`) across different dev setups.

- Why relative imports?
  - Superset’s webpack aliases source workspaces to their `src/` directories.
  - When consuming compiled bundles from another local plugin, subpath aliases can inadvertently point to non-existent paths.
  - Using explicit relative imports to the local `plugins/plugin-chart-table/src/*` keeps dev and build pipelines stable.

- Registration
  - The plugin is registered in `src/visualizations/presets/MainPreset.js` using `ChartPlugin` with Remita’s `buildQuery`, `controlPanel`, and `transformProps`, and reuses the base Table chart component.

- Security
  - The backend exposes `REMITA_TABLE_ALLOWED_ACTION_ORIGINS` and the SPA sets `window.REMITA_TABLE_ALLOWED_ACTION_ORIGINS` (includes current origin).
  - The plugin validates action URLs against the allowlist and blocks unsafe schemes.

- Header actions
  - Dashboard header actions for Remita (`remita_table`) are injected in `SliceHeaderControls` and publish `remita.notification` events.

- TypeScript checks
  - The root TS project excludes this plugin’s `src/` and `test/` to avoid API drift during type checks.
  - The compiled `lib/` remains consumable by the app, while `src/` is kept for maintenance.

- Rebuilds (optional)
  - If you change `src/`, rebuild the plugin package to refresh `lib/` and `esm/`:
    - `npm run plugins:build` (from `superset-frontend/`)

