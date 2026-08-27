/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * @fileoverview Shared vocabulary for the built-in `filter.*` widget family
 * (`FilterSelectWidget` today; `filter.range`/`filter.time` would follow the
 * same shape) and the query-bound widgets that consume them
 * (`collectActiveFilters.ts`) — but not exclusive to `filter.*`. Any widget
 * that publishes a `FilterValueChangedPayload`-shaped value on
 * `dashboard.VALUE_CHANGED_EVENT` becomes a filter source to
 * `collectActiveFilters.ts`, whatever its own `type` is: `ChartWidget`'s
 * own `crossFilter` (a click on a data point emitting this same shape on
 * itself) is the built-in proof that this was never meant to be
 * filter-specific plumbing, just the one vocabulary every source and
 * every query-bound consumer happens to already agree on.
 *
 * Deliberately NOT part of `@apache-superset/core`: a filter is one kind
 * of widget among many, using `dashboard.emit`/`dashboard.getValue`
 * exactly like any other — the platform's public contract only needs to
 * stay generic (`payload: unknown`), not know what a filter's payload
 * looks like. This is implementation detail shared by whichever built-in
 * widgets choose to use it, the same way `echarts`'s
 * `EChartsCoreOption`/`$bind`-marker convention (see `resolveBindings.ts`)
 * is host-internal rather than published.
 *
 * A third-party widget is free to ignore this entirely and invent its own
 * payload shape; it only needs to match this one if it wants the built-in
 * chart-like widgets' filter merge to pick it up.
 */

/**
 * The small, closed operator vocabulary a resolved filter can express —
 * deliberately narrow so any consumer (chart, table, or otherwise) can
 * interpret every value without knowing which filter *type* produced it.
 */
export type FilterOperator =
  'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN' | 'RANGE' | 'TIME_RANGE';

/**
 * A filter's current selection, turned into a query constraint. Reuses the
 * same vocabulary as the backend's adhoc-filter / `SemanticQuery.filters`
 * shape rather than a bespoke one, so any query-bound consumer can merge
 * it in without knowing which filter type produced it.
 */
export interface ResolvedFilter {
  column: string;
  operator: FilterOperator;
  value: unknown;
  /** Narrows which dataset this constraint applies to, for cross-dataset dashboards. */
  datasource?: number;
}

/**
 * The payload shape a `filter.*` widget emits on
 * `dashboard.VALUE_CHANGED_EVENT` — the convention that lets
 * `getActiveFiltersForDataset` merge a filter's current value into a
 * query-bound widget's own query without knowing which filter type produced
 * it. `resolved` is `null` when the filter is currently cleared.
 */
export interface FilterValueChangedPayload {
  /** The raw, filter-type-specific selection (e.g. `['CA', 'NY']`). */
  selection: unknown;
  resolved: ResolvedFilter | null;
}

/**
 * Fired on a `filter.bar` node's own id when its Apply button is pressed
 * (see `FilterBarWidget`'s own render). Every `filter.*` child
 * currently holding a not-yet-applied draft selection commits it in
 * response — see `FilterSelectWidget`'s own `pendingSelection` state.
 *
 * A plain `dashboard.on`/`emit` convention like `VALUE_CHANGED_EVENT`, not a
 * new core-API concept: any widget can already emit/listen for any string,
 * so "tell my filter children to apply now" needs nothing beyond agreeing
 * on this one event name. A child doesn't need the event's payload to know
 * whether the apply was meant for it — it already knows its own parent id
 * (`provider.getParentId`), and checks that against `WidgetEvent`'s
 * `nodeId` instead, since `dashboard.on` delivers every emit of this event
 * type from any node, not just the bar a given child happens to sit in.
 */
export const FILTER_BAR_APPLY_EVENT = 'filterBarApply';
