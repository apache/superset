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
 * @fileoverview Scope resolution + the adhoc-filter adapter, shared by
 * every query-bound widget (`ChartWidget`/`AgGridTableWidget`/
 * `MetricTileWidget`).
 *
 * A query-bound consumer never subscribes to individual filter nodes by
 * hand — at fetch time it asks {@link getActiveFiltersForDataset} to
 * collect the currently resolved filters that apply to it, scoped by
 * dataset match unless a source narrows itself to specific nodes. The
 * result is merged into the same `dataBinding.filters` a chart's own
 * authored filters already flow through (see `chartData.ts`), so
 * "listening" is really just "recompute this at fetch time, driven by the
 * same effect dependency the widget already re-runs on."
 *
 * {@link getActiveFiltersForDataset} does not care what *type* a source
 * node is — it finds every node currently holding a resolved value on
 * `dashboard.VALUE_CHANGED_EVENT` (see `filterVocabulary.ts`'s
 * `FilterValueChangedPayload`) and treats it as a filter, `filter.select`
 * or otherwise. `ChartWidget` emitting its own cross-filter on a data-point
 * click (see its own comment) needs nothing special from this module to
 * be picked up by every other chart on the same dataset — matching the
 * shape is the entire contract, the same one `filterVocabulary.ts`'s own
 * doc comment already invites any widget to use.
 */

import { dashboard as dashboardApi } from '@apache-superset/core';
import { provider } from './store';
import { isContainerType } from './DashboardProvider';
import type {
  ResolvedFilter,
  FilterValueChangedPayload,
} from './filterVocabulary';

/** The registry-key prefix every filter widget type shares (`filter.select`, `filter.range`, ...). */
export const FILTER_TYPE_PREFIX = 'filter.';

/**
 * Whether `type` is an actual filter — one that resolves to a value and
 * therefore has its own `datasetId`/`column`/`scope` — as opposed to
 * `filter.bar`, which shares the `filter.` prefix (it belongs to the same
 * family, and benefits from grouping alongside the others wherever widget
 * types are listed) but is a plain arranging container with no target of
 * its own. Anything sharing the prefix that isn't a registered container
 * type is a leaf filter; `filter.bar` is the one exception today, and any
 * future filter *container* type would be excluded the same way, with
 * nothing here needing to change to cover it.
 */
export function isLeafFilterType(type: string): boolean {
  return type.startsWith(FILTER_TYPE_PREFIX) && !isContainerType(type);
}

/** Every node id in the tree, root included — there is no bulk accessor on `DashboardProvider` itself. */
function collectAllNodeIds(): string[] {
  const ids: string[] = [];
  const visit = (id: string) => {
    ids.push(id);
    provider.getNode(id)?.children?.forEach(visit);
  };
  visit(provider.getRoot().id);
  return ids;
}

/**
 * Turns one resolved filter into the `{expressionType, subject, operator,
 * comparator, clause}` shape `dataBinding.filters` expects (see
 * `chartData.ts` — it flows straight into `adhoc_filters`). A `RANGE`/
 * `TIME_RANGE` filter can produce two entries (a lower and an upper bound)
 * or one, depending on which side of the range is set.
 */
export function toAdhocFilters(
  resolved: ResolvedFilter | null | undefined,
): Record<string, unknown>[] {
  if (!resolved) return [];
  const base = {
    expressionType: 'SIMPLE',
    subject: resolved.column,
    clause: 'WHERE',
  };
  switch (resolved.operator) {
    case 'EQUALS':
      return [{ ...base, operator: '==', comparator: resolved.value }];
    case 'NOT_EQUALS':
      return [{ ...base, operator: '!=', comparator: resolved.value }];
    case 'IN':
      return [{ ...base, operator: 'IN', comparator: resolved.value }];
    case 'NOT_IN':
      return [{ ...base, operator: 'NOT IN', comparator: resolved.value }];
    case 'RANGE': {
      const { min, max } = (resolved.value ?? {}) as {
        min?: unknown;
        max?: unknown;
      };
      const out: Record<string, unknown>[] = [];
      if (min != null) out.push({ ...base, operator: '>=', comparator: min });
      if (max != null) out.push({ ...base, operator: '<=', comparator: max });
      return out;
    }
    case 'TIME_RANGE': {
      const { start, end } = (resolved.value ?? {}) as {
        start?: unknown;
        end?: unknown;
      };
      const out: Record<string, unknown>[] = [];
      if (start != null)
        out.push({ ...base, operator: '>=', comparator: start });
      if (end != null) out.push({ ...base, operator: '<', comparator: end });
      return out;
    }
    default:
      return [];
  }
}

/**
 * Collects the resolved filters that currently apply to `consumerNodeId`,
 * already converted to adhoc-filter shape.
 *
 * A node is a filter *source* purely by having a resolved value published
 * on `dashboard.VALUE_CHANGED_EVENT` — not by its `type`. `filter.select`
 * is the built-in, purpose-authored way to get one there, but nothing here
 * checks for it: a chart cross-filtering on its own click, or any other
 * widget an extension contributes, becomes a source the instant it emits a
 * `{selection, resolved}` payload shaped like `FilterValueChangedPayload`.
 * This is the "general bus" the composition doc describes — the vocabulary
 * a value is expressed in, not a registry of who's allowed to speak it.
 *
 * Scope defaults to "every source targeting the same dataset," read off
 * the resolved value's own `datasource` (what it actually resolved
 * against), not an authored `datasetId` prop that could drift from it. A
 * source narrows this with an explicit `props.scope.targets` list of node
 * ids, which overrides the dataset-match default rather than adding to
 * it. A source is never its own consumer — a node's own emitted value
 * never feeds back into its own query, the same way a filter was never
 * going to filter itself; without this, a chart cross-filtering on its
 * own data point would immediately narrow its own next fetch down to that
 * one point.
 */
export function getActiveFiltersForDataset(
  datasetId: number,
  consumerNodeId: string,
): Record<string, unknown>[] {
  const candidateIds = collectAllNodeIds().filter(id => id !== consumerNodeId);

  return candidateIds.flatMap(sourceId => {
    const value = provider.getValue(
      sourceId,
      dashboardApi.VALUE_CHANGED_EVENT,
    ) as FilterValueChangedPayload | undefined;
    if (!value?.resolved) return [];

    const rawScopeTargets = (
      provider.getNode(sourceId)?.props?.scope as
        { targets?: string[] } | undefined
    )?.targets;
    // Blank entries don't count as real targets — the generic Form control
    // for this plain string array seeds one empty-string row the moment the
    // Scope section renders, before an author ever touches it, so
    // `scope.targets` routinely comes back as `[""]` rather than `[]` or
    // `undefined`. Filtering those out first means a never-touched Scope
    // reads the same as no targets at all, whichever shape it happened to
    // serialize as.
    const scopeTargets = rawScopeTargets?.filter(target => target !== '');
    // An empty (or blank-only) list is still the documented default (see
    // `FilterScope`'s own docstring: "Empty targets ... means every
    // query-bound widget reading the same datasetId") — `[]` is truthy in
    // JS, so checking mere presence here would treat "never touched" the
    // same as "explicitly scoped to nobody," silently excluding every
    // same-dataset consumer. Only a *non-empty* list of real ids is the
    // explicit override.
    const applies =
      scopeTargets && scopeTargets.length > 0
        ? scopeTargets.includes(consumerNodeId)
        : value.resolved.datasource === datasetId;

    return applies ? toAdhocFilters(value.resolved) : [];
  });
}
