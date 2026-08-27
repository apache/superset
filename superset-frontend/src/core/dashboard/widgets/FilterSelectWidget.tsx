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

import { useEffect, useState } from 'react';
import { dashboard as dashboardApi } from '@apache-superset/core';
import { SupersetClient } from '@superset-ui/core';
import type { JsonResponse } from '@superset-ui/core';
import { Flex, Select, Typography } from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import { provider, useDashboardRevision } from '../store';
import { FILTER_BAR_APPLY_EVENT } from '../filterVocabulary';
import type {
  ResolvedFilter,
  FilterValueChangedPayload,
} from '../filterVocabulary';

/**
 * Distinct values for `column`, the same `GET .../column/<name>/values/`
 * lookup Explore's own ad hoc filter popover uses to suggest a comparator
 * (see `AdhocFilterEditPopoverSimpleTabContent`) — a purpose-built,
 * dataset-agnostic endpoint, not the general chart-data query path
 * `fetchQueryData` wraps. Only asked for when the author hasn't set
 * `props.options` themselves (see the call site): an authored list always
 * wins, since it's an explicit override, not a fallback.
 */
function useDistinctColumnValues(
  datasetId: number | undefined,
  column: string | undefined,
): string[] {
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    if (datasetId == null || !column) {
      setValues([]);
      return undefined;
    }
    let cancelled = false;
    SupersetClient.get({
      endpoint: `/api/v1/datasource/table/${datasetId}/column/${column}/values/`,
    })
      .then((response: JsonResponse) => {
        const result = response.json.result as unknown[];
        if (!cancelled) {
          setValues(result.filter(v => v != null).map(v => String(v)));
        }
      })
      .catch(() => {
        if (!cancelled) setValues([]);
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId, column]);

  return values;
}

/**
 * A `filter.select` widget's own selection → constraint logic — the
 * filter-domain equivalent of a chart's `build_queries`. Frontend-only
 * because it reacts to a *live viewer selection*, not authored config —
 * unlike the widget's control schema (`datasetId`/`column`/`options`/...),
 * which is backend-owned (see `superset/widgets/controls.py`'s
 * `FilterSelectControls`), there is no document state here to serve from a
 * schema: this only ever runs in response to this session's own clicks.
 */
function resolveSelectFilter(
  column: string,
  selection: string[],
  datasource?: number,
): ResolvedFilter | null {
  if (!selection.length) return null;
  return selection.length === 1
    ? { column, operator: 'EQUALS', value: selection[0], datasource }
    : { column, operator: 'IN', value: selection, datasource };
}

/**
 * The built-in `filter.select` widget — a value/multi-select filter,
 * registered like any other widget (see `registerBuiltInWidgets`). Unlike
 * `ChartWidget`/`AgGridTableWidget`, its own props (`column`, `datasetId`,
 * `options`, `defaultSelection`, `scope`) are authored config read straight
 * from the node — but what it writes on interaction is *not*
 * `dashboard.updateProps`. It calls `dashboard.emit`/`dashboard.getValue`
 * instead — the same generic mechanism any widget uses to affect another —
 * because a viewer's current selection is per-session state, not part of
 * the shared, authored document every other viewer and editor sees (see
 * the design note on `updateProps` in `@apache-superset/core`'s
 * `dashboard` namespace).
 *
 * Options come from `props.options` when the author has set one — still a
 * static, hand-authored list for this prototype — and otherwise from a
 * live `useDistinctColumnValues` lookup against the target column, so a
 * filter placed through the Inspector's schema-driven `datasetId`/`column`
 * fields alone already has real values to offer. Narrowing those options
 * by a parent filter's selection (cascading) is still deferred.
 *
 * A standalone filter (or one dropped anywhere other than a `filter.bar`)
 * still emits on every change, immediately, same as always. One sitting
 * inside a `filter.bar` instead holds each change as a local
 * `pendingSelection` — visible right away in this Select's own displayed
 * value, but not emitted to {@link dashboardApi.VALUE_CHANGED_EVENT} (the
 * event every query-bound consumer reads) until the bar's own Apply
 * button fires {@link FILTER_BAR_APPLY_EVENT} on the bar's id (see
 * `FilterBarWidget`'s own render). This is the *only* thing
 * being inside a bar changes about a filter — the value it eventually
 * emits, and how every consumer resolves it, are identical either way.
 */
export default function FilterSelectWidget({ nodeId }: { nodeId: string }) {
  // Covers both structural/layout changes and this node's own emitted
  // value — `emit` ticks the same revision `commit` does (see
  // `DashboardProvider`), so one subscription is enough.
  useDashboardRevision();

  const node = provider.getNode(nodeId);
  const column = node?.props?.column as string | undefined;
  const datasetId = node?.props?.datasetId as number | undefined;
  const authoredOptions = node?.props?.options as string[] | undefined;
  // Called unconditionally, same as every other hook here — `column`/
  // `datasetId` being unset yet is handled inside the hook, not by
  // skipping the call.
  const queriedOptions = useDistinctColumnValues(datasetId, column);
  const options = authoredOptions ?? queriedOptions;
  const defaultSelection = node?.props?.defaultSelection as
    string[] | undefined;

  const parentId = provider.getParentId(nodeId);
  const inFilterBar =
    parentId !== undefined && provider.getNode(parentId)?.type === 'filter.bar';

  // Not yet applied, if set — see this component's own doc comment. Reset
  // to `undefined` once flushed, so the displayed value goes back to
  // reading straight off `currentValue`/`defaultSelection` below.
  const [pendingSelection, setPendingSelection] = useState<
    string[] | undefined
  >(undefined);

  const currentValue = provider.getValue(
    nodeId,
    dashboardApi.VALUE_CHANGED_EVENT,
  ) as FilterValueChangedPayload | undefined;

  // Applies the author's default exactly once, the first time this filter
  // is ever rendered with no live selection yet — a later edit to
  // `defaultSelection` doesn't retroactively override a viewer's own
  // choice, the same way changing a form's default doesn't reset a value
  // the user already typed into it.
  useEffect(() => {
    if (
      column &&
      defaultSelection &&
      provider.getValue(nodeId, dashboardApi.VALUE_CHANGED_EVENT) === undefined
    ) {
      provider.emit(nodeId, dashboardApi.VALUE_CHANGED_EVENT, {
        selection: defaultSelection,
        resolved: resolveSelectFilter(column, defaultSelection, datasetId),
      });
    }
    // Intentionally run once per node id, not on every column/default edit —
    // see the comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  // Only subscribed while actually parented by a bar — flushes this
  // filter's own pending draft when (and only when) the event's `nodeId`
  // matches *this* filter's parent, since `dashboard.on` delivers every
  // bar's Apply, from any bar, to every listener. Skips entirely when
  // nothing has been edited since the last apply (`pendingSelection` still
  // `undefined`) — an untouched filter has nothing to commit, and
  // re-emitting its already-applied value would only cost every
  // query-bound consumer an unnecessary refetch.
  useEffect(() => {
    if (!inFilterBar || parentId === undefined) return undefined;
    const subscription = provider.on(FILTER_BAR_APPLY_EVENT, event => {
      if (event.nodeId !== parentId || pendingSelection === undefined) return;
      provider.emit(nodeId, dashboardApi.VALUE_CHANGED_EVENT, {
        selection: pendingSelection,
        resolved: column
          ? resolveSelectFilter(column, pendingSelection, datasetId)
          : null,
      });
      setPendingSelection(undefined);
    });
    return () => subscription.dispose();
  }, [inFilterBar, parentId, pendingSelection, column, datasetId, nodeId]);

  if (!node) return null;

  if (!column || datasetId == null) {
    return (
      <Flex
        align="center"
        justify="center"
        style={{ width: '100%', height: '100%', padding: 8 }}
      >
        <Typography.Text type="secondary">
          {t('This filter has no target column configured')}.
        </Typography.Text>
      </Flex>
    );
  }

  const value =
    pendingSelection ??
    (currentValue?.selection as string[] | undefined) ??
    defaultSelection ??
    [];

  return (
    <div
      // No padding of its own — every other widget type (ChartWidget,
      // MetricTileWidget, MarkdownWidget, ...) relies purely on
      // WidgetView's own card inset rather than adding a second one on top
      // of it, and a filter inside a filter.bar has no card at all to
      // inset from (see FilterBarWidget) — its own unpadded label sits
      // directly above this, so any padding here would misalign the two.
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Select
        mode="multiple"
        allowClear
        ariaLabel={`Filter by ${column}`}
        placeholder={`Filter by ${column}`}
        options={options.map(option => ({ label: option, value: option }))}
        value={value}
        // This widget's own container clips overflow (immediately above)
        // so its content never bleeds into a neighboring widget — this
        // component's own default `getPopupContainer` renders the
        // dropdown into that same clipped parent, though, so without this
        // override the option list gets cut off at the widget's edge
        // instead of floating over the canvas the way any other dropdown
        // does.
        getPopupContainer={() => document.body}
        onChange={next => {
          const selection = Array.isArray(next) ? (next as string[]) : [];
          if (inFilterBar) {
            // Held until the bar's own Apply fires — see the subscription
            // above and this component's own doc comment.
            setPendingSelection(selection);
            return;
          }
          provider.emit(nodeId, dashboardApi.VALUE_CHANGED_EVENT, {
            selection,
            resolved: resolveSelectFilter(column, selection, datasetId),
          });
        }}
        // The shared `Select`'s own styles (see `Select/styles.tsx`) cap
        // `.ant-select-content` — the row every tag chip sits in — at a
        // fixed one-line `max-height`, everywhere it's used in the app.
        // With more than a couple of tags selected, they wrap onto a
        // second line the way any multi-select's tags do, but that cap
        // clips it rather than letting the box grow to show them — this
        // filter needs to actually display what's selected, up to
        // whatever room the widget itself has, so it overrides that cap
        // for just this instance.
        css={{
          width: '100%',
          '.ant-select-content': { maxHeight: 'none !important' },
          '.ant-select-selection-item': { maxHeight: 'none !important' },
        }}
      />
    </div>
  );
}
