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

## What Happened

Reproduction steps:

1. Create a Line chart on a dataset with a temporal column (e.g. `order_date`), set that column as the X-axis with **Month** as Time Grain, add a metric, and create the chart. This sets `groupby` to the temporal column and `time_grain_sqla` to `P1M`.
2. Switch the visualization type to **Table**.
3. Switch **Query Mode** to **Raw Records**.
4. Add the same temporal column as a column, then update the chart.

Expected: the temporal column renders raw (unaggregated) values, and the outgoing query for the chart data does not carry a time grain.

Actual: the outgoing request body's query object still contains `time_grain_sqla: "P1M"`, and the temporal column is rendered with monthly-grain formatting even though the SQL result rows are unaggregated raw records.

## Root Cause

`verified` — `superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx`, the `time_grain_sqla` control override (previously lines 267-295): its `visibility` function only checks whether the current `groupby` control value contains a temporal column. It never checks `query_mode`, unlike every sibling query-mode-dependent control in the same file (`groupby`, `metrics`, `percent_metrics`, `timeseries_limit_metric`, `show_totals`, `totals_aggregate`, all of which gate on `isAggMode`/`isRawMode`).

`groupby`'s own visibility is `isAggMode` with `resetOnHide: false` (line 241-242), so when the query mode is switched to Raw Records, `groupby`'s control row is hidden from the UI but its underlying value in `form_data` is deliberately *not* cleared (this lets a user switch back to Aggregate mode without losing their prior groupby selection). Because `time_grain_sqla`'s visibility only inspects `groupby`'s stale value, it keeps evaluating to `true` in Raw Records mode whenever that stale value happens to be a temporal column — which is exactly the case in this repro, since the user built the chart as an aggregated Line chart first.

Because the control is (incorrectly) still "visible", `StashFormDataContainer` (`superset-frontend/src/explore/components/StashFormDataContainer/index.tsx`) never stashes `time_grain_sqla` out of `form_data`, so the stale `P1M` value survives in the redux `form_data` used to build the outgoing query. The Table plugin's `buildQuery` (`superset-frontend/plugins/plugin-chart-table/src/buildQuery.ts:70-71`) then unconditionally reads `formData.time_grain_sqla` and passes it into `buildQueryContext`, which places it on the query object's `extras.time_grain_sqla` (`superset-frontend/packages/superset-ui-core/src/query/extractExtras.ts:76`) regardless of query mode — the core query builder has no concept of "query mode" and relies entirely on each chart plugin's `buildQuery` to omit fields that don't apply. The Table plugin only strips time-grain-derived behavior from the AGGREGATE branch (`buildQuery.ts:138`, `queryMode === QueryMode.Aggregate`); it never clears `time_grain_sqla` itself for the RAW branch.

On the render side, `transformProps.ts` already has a `queryMode !== QueryMode.Raw` guard (line 282) around applying granularity-based smart-date formatting, but that guard only prevents the *smart-date* auto-format path — it does not stop `time_grain_sqla` from being sent to (and, depending on backend/DB codec behavior, applied by) the query itself, which is what the ticket's network trace observed.

## Why It Wasn't Caught

Test gap: `plugins/plugin-chart-table/test/controlPanel.test.ts` only tested the case-insensitivity of the `groupby`-to-`is_dttm` lookup (added in PR #37893); no test exercised `query_mode` at all for this control. `git log -p --follow` on `controlPanel.tsx` shows this `visibility` function has never taken `query_mode`/`isAggMode` into account since it was first introduced in PR #21547 (2022) — the row containing the control was originally gated by `isFeatureEnabled(FeatureFlag.GENERIC_CHART_AXES) && isAggMode`, but `isAggMode` there is a function reference used in a boolean expression at module-eval time, not a call — so it was always truthy and never actually restricted anything to aggregate mode, even at introduction. That flag-gating wrapper (and the identical no-op `isAggMode` reference) was removed entirely in PR #26372 once `GENERIC_CHART_AXES` was made the default, leaving only the feature-flag-free `visibility` function seen today, which still never calls `isAggMode`/`isRawMode`. In other words, this was a latent gap from the control's original implementation, not a regression from an intentional design change.

Assumption gap: the author of the visibility function assumed "the `groupby` control holds a temporal column" was a sufficient proxy for "this chart is doing time-grain aggregation on that column," which is true only in AGGREGATE mode; the RAW_RECORDS query mode (where `groupby` is hidden and stale) was not considered.

## The Fix

The identical fix is applied in both `superset-frontend/plugins/plugin-chart-table/src/controlPanel.tsx` and `superset-frontend/plugins/plugin-chart-ag-grid-table/src/controlPanel.tsx` (see the sibling-plugin note above): the `time_grain_sqla` control override's `visibility` function.

Before:
```tsx
visibility: ({ controls }) => {
  const dttmLookup = Object.fromEntries(
    ensureIsArray(controls?.groupby?.options).map(option => [
      (option.column_name || '').toLowerCase(),
      option.is_dttm,
    ]),
  );

  return ensureIsArray(controls?.groupby.value)
    .map(selection => {
      if (isAdhocColumn(selection)) {
        return true;
      }
      if (isPhysicalColumn(selection)) {
        return !!dttmLookup[(selection || '').toLowerCase()];
      }
      return false;
    })
    .some(Boolean);
},
```

After: short-circuit to `false` unless the chart is in Aggregate query mode, using the same `isAggMode` helper every sibling control in this file already uses:
```tsx
visibility: ({ controls }) => {
  if (!isAggMode({ controls })) {
    return false;
  }
  const dttmLookup = Object.fromEntries(
    ensureIsArray(controls?.groupby?.options).map(option => [
      (option.column_name || '').toLowerCase(),
      option.is_dttm,
    ]),
  );

  return ensureIsArray(controls?.groupby.value)
    .map(selection => {
      if (isAdhocColumn(selection)) {
        return true;
      }
      if (isPhysicalColumn(selection)) {
        return !!dttmLookup[(selection || '').toLowerCase()];
      }
      return false;
    })
    .some(Boolean);
},
```

With this change, switching to Raw Records mode makes `time_grain_sqla`'s visibility evaluate to `false` regardless of `groupby`'s stale value. `StashFormDataContainer` then stashes `time_grain_sqla` out of `form_data` (its default `disableStash` is unset and it does not opt out), so the outgoing query for a Raw Records table no longer carries a time grain, and the temporal column renders as raw, unformatted-by-grain data. Switching back to Aggregate mode (with a temporal `groupby` column) restores `time_grain_sqla`'s visibility and its previously stashed value, so the existing aggregated-table behavior is unchanged.

This fix does not touch the per-column `CUSTOMIZE` → D3 time format override path (`column_config` / `d3TimeFormat` in `transformProps.ts`), which continues to take precedence over any grain-derived formatting exactly as before.

`verified` — the sibling `plugin-chart-ag-grid-table` plugin (`superset-frontend/plugins/plugin-chart-ag-grid-table/src/controlPanel.tsx`) has the exact same `time_grain_sqla` visibility function, byte-for-byte the same logic as the pre-fix `plugin-chart-table` version, including the same `groupby` `resetOnHide: false` setup and a locally-defined `isAggMode` helper already in scope. It is registered in `superset-frontend/src/visualizations/presets/MainPreset.ts` as the `VizType.TableAgGrid` chart type behind `FeatureFlag.AgGridTableEnabled` (`AG_GRID_TABLE_ENABLED`, default `False` in `superset/config.py`). This flag is opt-in rather than dead/unshipped code — any deployment that enables it exposes a second, user-selectable "Table" style viz type through the same viz-picker/Explore flow, so it reproduces this bug identically once enabled. It is fixed with the identical change described above, rather than treated as an unreachable latent bug.

## Latent Bugs Found

- The same stale-`groupby`-value pattern (`resetOnHide: false`) is intentional and shared by several other controls in both `controlPanel.tsx` files (`metrics`, `percent_metrics`, `timeseries_limit_metric`, `order_by_cols`, `show_totals`, `totals_aggregate`); all of those already gate their own visibility on `isAggMode`/`isRawMode` directly, so they were not affected by this bug. Not fixed because out of scope: none found affected.
- `buildQuery.ts` (both `plugin-chart-table` and `plugin-chart-ag-grid-table`) reads `time_grain_sqla` via `extra_form_data?.time_grain_sqla || formData.time_grain_sqla` without any query-mode gate of its own; it happens to only be dangerous when `form_data.time_grain_sqla` is stale, which the controlPanel fixes now prevent. A defense-in-depth guard here (e.g. only reading `time_grain_sqla` when `queryMode === QueryMode.Aggregate`) was considered but not added, to keep this fix minimal and scoped to the one root cause.

## Prevention

Add a jest test asserting `query_mode`-dependent visibility for any control whose `visibility` function is customized per chart plugin, whenever the control also has a shared/base default visibility being overridden — a lint or contributor-doc note reminding authors that stale unrelated control values are the norm (`resetOnHide: false` is common) and any visibility override must re-derive its own query-mode gate rather than relying on another control's own gating. This regression is covered going forward by `plugins/plugin-chart-table/test/controlPanel.test.ts` and `plugins/plugin-chart-ag-grid-table/test/controlPanel.test.tsx`.
