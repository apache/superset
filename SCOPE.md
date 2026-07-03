<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# SCOPE: Remove the legacy viz pipeline (`explore_json` + `viz.py`)

> **This file is a working tracker for the `remove-legacy-viz-pipeline` feature branch.**
> It accumulates everything done on this branch and will be distilled into the final
> PR body. It is deleted before the feature branch merges to `master`.
> Companion file: [UPDATES.md](UPDATES.md) staging entries destined for `UPDATING.md`.

## Goal

Migrate every remaining `useLegacyApi: true` viz plugin to the v1 `/api/v1/chart/data`
endpoint (adding `buildQuery.ts` + `post_processing` operations / `transformProps`
reshaping as needed), then delete the deprecated `explore_json` endpoints and
`superset/viz.py` entirely, and drop the `legacy-` prefix from the surviving plugin
package names. Both endpoints have carried `@deprecated(eol_version="5.0.0")` gates;
this branch is the EOL.

## Inventory: the 15 remaining legacy viz types

| # | viz_type | Plugin | Strategy | Status |
|---|----------|--------|----------|--------|
| 1 | `para` | legacy-plugin-chart-parallel-coordinates | Convert in place (pass-through) | ✅ (merged) |
| 2 | `country_map` | legacy-plugin-chart-country-map | Convert in place (select/rename) | ✅ (merged) |
| 3 | `bullet` | legacy-preset-chart-nvd3/Bullet | Convert in place (single metric) | ✅ (merged) |
| 4 | `chord` | legacy-plugin-chart-chord | Convert in place (matrix in transformProps) | ✅ (merged) |
| 5 | `world_map` | legacy-plugin-chart-world-map | Convert in place (country join in JS) | ✅ (merged) |
| 6 | `paired_ttest` | legacy-plugin-chart-paired-t-test | Convert in place (pivot op) | ✅ (merged) |
| 7 | `time_table` | src/visualizations/TimeTable | Convert in place (pivot op) | ✅ (merged) |
| 8 | `cal_heatmap` | legacy-plugin-chart-calendar | Convert in place (pivot + epoch keys in JS) | ✅ (merged) |
| 9 | `horizon` | legacy-plugin-chart-horizon | Convert in place (timeseries pipeline) | 🔃 (#41725) |
| 10 | `rose` | legacy-plugin-chart-rose | Convert in place (timeseries pipeline) | 🔃 (#41726) |
| 11 | `time_pivot` | legacy-preset-chart-nvd3/TimePivot | Convert in place (pivot + rank in JS) | 🔃 (#41727) |
| 12 | `bubble` | legacy-preset-chart-nvd3/Bubble | Retarget → `bubble_v2` (MigrateViz exists, needs Alembic revision) | ⬜ |
| 13 | `compare` | legacy-preset-chart-nvd3/Compare | Retarget → `echarts_timeseries_line` (new MigrateViz) | ⬜ |
| 14 | `partition` | legacy-plugin-chart-partition | Convert in place (hierarchy in transformProps) | ⬜ |
| 15 | `deck_multi` | preset-chart-deckgl/Multi | Client-side filter-metadata merge + stub buildQuery | ⬜ |

"Convert in place" = keep the renderer and the `viz_type` key, add a modern
`buildQuery.ts`, move the `viz.py` `get_data()` reshape into `transformProps.ts`,
flip `useLegacyApi` off. No saved-chart DB migration needed since `viz_type` is
unchanged. "Retarget" = migrate saved charts to an existing modern chart via a
`MigrateViz` processor + Alembic revision, then delete the legacy plugin.

## Phases / sub-PRs (each targets this feature branch)

### Phase 0 — Dead code deletion
- [x] `superset-frontend/plugins/legacy-preset-chart-deckgl/` turned out to have **zero tracked files** — it was a stale local `node_modules/` husk, removed locally, nothing to commit
- [x] Delete `legacy-preset-chart-nvd3/src/BoxPlot/` leftovers (unregistered; superseded by ECharts BoxPlot)
- [x] Delete orphaned `viz.py` classes with no registered frontend: `MapboxViz`, `MapLibreViz`, `EventFlowViz` (no tests referenced them; `mapbox` saved charts were already migrated to `point_cluster_map` by revision `ce6bd21901ab`; the frontend `point_cluster_map` plugin has its own modern `buildQuery`, so removing `MapLibreViz` also fixes cache warm-up, which routed any `viz_type in viz_types` through the legacy path)

### Phase 1 — Chart migrations (tiers 1→4, easiest first; order above)
Per-chart checklist:
- [ ] `buildQuery.ts` returning a `buildQueryContext(...)` with needed `post_processing` operators
- [ ] `transformProps.ts` ports the `viz.py` `get_data()` reshape (where not expressible as post_processing)
- [ ] `useLegacyApi` removed from plugin metadata
- [ ] Jest tests: buildQuery output + transformProps against fixtures captured from the legacy pipeline
- [ ] Verify legacy saved-chart `form_data` (`granularity_sqla`/`time_range`) flows through `buildQueryContext` — add a normalizing same-viz-type `MigrateViz` if not
- [ ] For retargets: `MigrateViz` processor + `superset/cli/viz_migrations.py` registration + Alembic revision (with MySQL MEDIUMTEXT widening) + migration tests
- [ ] UPDATES.md entry if user-facing behavior changes

### Phase 2 — Backend removal
- [ ] Remove `explore_json` / `explore_json_data` / `generate_json` from `superset/views/core.py` (incl. CSV/XLSX/async branches)
- [ ] Remove CSRF exemption (`superset/config.py`) and GLOBAL_ASYNC_QUERIES explore_json path
- [ ] Delete `superset/viz.py`; unwind importers: `views/utils.py` (`get_viz`), `models/slice.py` (`Slice.viz`), `commands/chart/warm_up_cache.py`, `common/query_context_processor.py` (annotation path), `security/manager.py` (`BaseViz` overload)
- [ ] Delete `tests/unit_tests/test_viz_*.py`, `tests/integration_tests/viz_tests.py`
- [ ] Frontend plumbing: remove `useLegacyApi` from `ChartMetadata`, `shouldUseLegacyApi`, `/explore_json/` branches in `exploreUtils`, `chartAction.ts`, `ChartClient.ts`, `StatefulChart.tsx`, `DrillByModal.tsx`

### Phase 3 — Renames (folded into per-chart PRs where possible)
- [ ] `legacy-plugin-chart-*` → `plugin-chart-*` (dirs, npm names, `file:` deps, MainPreset imports, Storybook/docs)
- [ ] Resolve what remains of `legacy-preset-chart-nvd3` (bullet, time_pivot survivors)
- [ ] Drop "(legacy)" suffixes from user-facing chart names

## Log of work completed

(append entries as sub-PRs merge: date, sub-PR #, summary)

- 2026-07-02 — #41715 Phase 0 merged: removed orphaned `viz.py` classes
  (`MapboxViz`, `MapLibreViz`, `EventFlowViz`) and nvd3 BoxPlot leftovers.
- 2026-07-02 — #41716 `para` merged: buildQuery (series→columns, secondary
  metric alias, sort-metric append, explicit orderby ownership), 8 Jest tests.
- 2026-07-02 — #41717 `country_map` merged: buildQuery (entity+metric),
  country_id/metric rename in transformProps with both-labels guard, 15 tests.
- 2026-07-02 — #41718 `bullet` merged: buildQuery (single ungrouped metric),
  records→{measures} reshape in nvd3 transformProps Bullet branch, 5 tests.
- 2026-07-02 — #41719 `chord`, #41720 `world_map`, #41721 `paired_ttest`,
  #41723 `time_table`, #41724 `cal_heatmap` merged. Notable bot-caught fixes
  along the way: ChartProps camelization bug in world_map's country join,
  numeric group ordering in paired_ttest, comma escaping + sub-second keys +
  grouped single-metric guard in time_table.
- Open PRs: #41725 `horizon`, #41726 `rose` (uses server-side post_processing
  pipeline: pivot/resample/rolling/compare/contribution/flatten),
  #41727 `time_pivot` (pandas offset rollback ported to JS).

- 2026-07-02 — Phase 0: removed orphaned `viz.py` classes (`MapboxViz`, `MapLibreViz`,
  `EventFlowViz`, −204 lines) and the unregistered nvd3 BoxPlot story leftovers.
  Verified: `ruff` clean, `tests/unit_tests/test_viz_*` pass.

## Decisions

- **compare** → migrating to `echarts_timeseries_line`; nvd3's interactive % rebasing is not preserved (flagged in UPDATES.md).
- **partition** → attempting convert-in-place; if the transformProps port proves unmaintainable, fall back to proposing deprecation on dev@.
- Feature branch lives on `apache/superset` so phase PRs can target it. Tracking files (SCOPE.md, UPDATES.md) are stripped before final merge.
- Tracking files are updated ONLY via direct commits to the feature branch (sub-PRs editing SCOPE.md all conflicted after the first squash-merge).

## Open questions

(record anything needing Evan's / community input)
