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
 * @fileoverview A second control in a widget's own header, beside the remove
 * button — the header-side counterpart to `widgetLabel`. Most widget types
 * have nothing to put there and get nothing rendered. `collapsible` needs an
 * expand/collapse toggle next to its remove control rather than a second bar
 * of its own further down the card (see `CollapsibleWidget`); `carousel`
 * needs a way to add a slide that isn't the dot strip itself, since the dot
 * strip is meant to read as a plain position indicator rather than a row of
 * controls (see `CarouselWidget`); every query-bound type (`echarts`,
 * `ag-grid-table`, `metric-tile`) shows whether it's currently being
 * filtered, or (for `echarts`, the one type that can) filtering others,
 * at all — otherwise there is no visible sign that the general event bus
 * is doing anything (see `FilterActivityIndicator`).
 */
import type { ReactElement } from 'react';
import { dashboard as dashboardApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { ActionButton, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { provider } from './store';
import { SLIDE_TYPE, untitledSlideLabel } from './widgets/CarouselWidget';
import {
  getActiveFiltersForDataset,
  toAdhocFilters,
} from './collectActiveFilters';
import type { FilterValueChangedPayload } from './filterVocabulary';

/**
 * The same operators `toAdhocFilters` (`collectActiveFilters.ts`) writes
 * into `dataBinding.filters` — spelled the way a reader says them rather
 * than the way a query does, for the one place this vocabulary is shown
 * to a person instead of fed to `fetchQueryData`.
 */
const OPERATOR_LABELS: Record<string, string> = {
  '==': '=',
  '!=': '≠',
  IN: 'in',
  'NOT IN': 'not in',
  '>=': '≥',
  '<=': '≤',
};

/** One adhoc filter (`toAdhocFilters`'s own output shape), as a reader would say it — "region = west", "sales ≥ 100". */
function describeAdhocFilter(filter: Record<string, unknown>): string {
  const { comparator } = filter;
  const value = Array.isArray(comparator)
    ? comparator.join(', ')
    : String(comparator);
  const operator = String(filter.operator);
  return `${filter.subject} ${OPERATOR_LABELS[operator] ?? operator} ${value}`;
}

/** Several adhoc filters, joined the way a sentence lists things rather than a data structure does. */
function describeAdhocFilters(filters: Record<string, unknown>[]): string {
  return filters.map(describeAdhocFilter).join(', ');
}

/**
 * How tall a collapsed widget stays — just enough for `WidgetView`'s
 * own header, plus a little room around it, rather than the bare minimum
 * (`1`) either unit accepts: at exactly the header's own height a collapsed
 * widget reads as clipped rather than deliberately shut. Read in
 * `layout.rowSpan`'s own unit, whatever this node's container happens to
 * interpret that as (a grid row on the root's own grid, a pixel inside a
 * flow area — see the composition/layout design doc).
 */
const COLLAPSED_ROW_SPAN = 2;

/**
 * The height restored on expanding, when nothing narrower was ever
 * authored to begin with — the same default a freshly placed container
 * arrives with (see `placeBlock`), so expanding a widget nobody has resized
 * yet returns it to exactly the size it was placed at.
 */
const DEFAULT_EXPANDED_ROW_SPAN = 4;

function CollapsibleToggle({ nodeId }: { nodeId: string }): ReactElement {
  const node = provider.getNode(nodeId);
  const collapsed = Boolean(node?.props?.collapsed);

  const toggle = (): void => {
    const current = provider.getNode(nodeId);
    if (!current) return;
    if (collapsed) {
      const restored =
        (current.props?.expandedRowSpan as number | undefined) ??
        DEFAULT_EXPANDED_ROW_SPAN;
      provider.updateLayout(nodeId, { rowSpan: restored });
      provider.updateProps(nodeId, { collapsed: false });
    } else {
      // The height about to be given up is saved so expanding again
      // returns to it rather than always to the default — an author who
      // grew a collapsible before collapsing it should not find it back at
      // its original size on the way out.
      provider.updateProps(nodeId, {
        collapsed: true,
        expandedRowSpan: current.layout?.rowSpan ?? DEFAULT_EXPANDED_ROW_SPAN,
      });
      provider.updateLayout(nodeId, { rowSpan: COLLAPSED_ROW_SPAN });
    }
  };

  return (
    <ActionButton
      label={collapsed ? t('Expand widget') : t('Collapse widget')}
      tooltip={collapsed ? t('Expand') : t('Collapse')}
      placement="bottom"
      dataTest={`widget-collapse-toggle-${nodeId}`}
      onClick={toggle}
      icon={
        collapsed ? (
          <Icons.CaretRightOutlined iconSize="s" />
        ) : (
          <Icons.CaretDownOutlined iconSize="s" />
        )
      }
    />
  );
}

/**
 * Appends a new slide and selects nothing itself — `CarouselWidget` notices
 * the growth on its own next render and switches to it (see its own
 * comment). This component can't do that switching directly: it renders as
 * `CarouselWidget`'s sibling in `WidgetView`'s header, not as
 * anything that could hold or reach the active-slide state living inside
 * `CarouselWidget`.
 */
function CarouselAddSlide({ nodeId }: { nodeId: string }): ReactElement {
  const addSlide = (): void => {
    const index = provider.getNode(nodeId)?.children?.length ?? 0;
    provider.addWidget(nodeId, index, {
      type: SLIDE_TYPE,
      props: { label: untitledSlideLabel(index) },
    });
  };

  return (
    <ActionButton
      label={t('Add slide')}
      tooltip={t('Add slide')}
      placement="bottom"
      dataTest={`carousel-add-${nodeId}`}
      onClick={addSlide}
      icon={<Icons.PlusOutlined iconSize="s" />}
    />
  );
}

/**
 * Every query-bound type's own header control — `echarts`, `ag-grid-table`,
 * and `metric-tile` alike, since all three merge
 * `collectActiveFilters.ts`'s scan into their own query the identical way
 * (see each widget's own comment). Not an action so much as a light: on
 * whenever this widget's own query is currently narrowed by some other
 * node's resolved value — type-agnostic, so a `filter.select`, a
 * `filter.bar`'s filter, or another chart's own cross-filter all count the
 * same way — or, only for a type that can emit one itself (`echarts`
 * today, via `ChartWidget`'s `crossFilter`), by this widget's own
 * cross-filter click. The receiving half of the same general bus a click
 * already demonstrates on the sending side — a widget being filtered
 * otherwise has no visible sign of it at all beyond its data quietly
 * changing. `null` for a widget neither filtered nor filtering, which is
 * most of the time.
 *
 * Only ever a real control (clickable, clearing the selection) when
 * there's something *this* widget can clear — its own cross-filter, the
 * same effect clicking the same data point again already has. This never
 * happens for `ag-grid-table`/`metric-tile` today, since neither emits one
 * of its own — nothing here needs to know that; `hasOwnCrossFilter` is
 * simply always false for a node that's never called `dashboard.emit` on
 * itself. An incoming filter's source (another widget, a `filter.select`,
 * a `filter.bar`) isn't this control's to reach into and reset, so that
 * case is informational only, not a button with nothing to do.
 */
function FilterActivityIndicator({
  nodeId,
}: {
  nodeId: string;
}): ReactElement | null {
  const node = provider.getNode(nodeId);
  const datasetId = (
    node?.props?.dataBinding as { datasetId?: number } | undefined
  )?.datasetId;

  const incomingFilters =
    datasetId != null ? getActiveFiltersForDataset(datasetId, nodeId) : [];
  const hasIncomingFilter = incomingFilters.length > 0;

  const ownValue = provider.getValue(
    nodeId,
    dashboardApi.VALUE_CHANGED_EVENT,
  ) as FilterValueChangedPayload | undefined;
  const hasOwnCrossFilter = Boolean(ownValue?.resolved);

  if (!hasIncomingFilter && !hasOwnCrossFilter) return null;

  if (hasOwnCrossFilter) {
    // `ownValue.resolved` is a `ResolvedFilter`, not the adhoc shape
    // `describeAdhocFilters` reads — `toAdhocFilters` is the same
    // converter `collectActiveFilters.ts` already runs every OTHER
    // consumer's incoming filters through, reused here so both halves of
    // this tooltip are worded identically.
    const ownDescription = describeAdhocFilters(
      toAdhocFilters(ownValue?.resolved),
    );
    const tooltip = hasIncomingFilter
      ? t(
          "Filtered by another widget: %s. Click to clear this widget's own selection: %s.",
          describeAdhocFilters(incomingFilters),
          ownDescription,
        )
      : t("Click to clear this widget's own selection: %s.", ownDescription);
    return (
      <ActionButton
        label={tooltip}
        tooltip={tooltip}
        placement="bottom"
        dataTest={`filter-activity-indicator-${nodeId}`}
        onClick={() =>
          provider.emit(nodeId, dashboardApi.VALUE_CHANGED_EVENT, {
            selection: null,
            resolved: null,
          })
        }
        icon={<Icons.FilterOutlined iconSize="s" />}
      />
    );
  }

  return (
    <Tooltip
      title={t(
        'Filtered by another widget: %s',
        describeAdhocFilters(incomingFilters),
      )}
      placement="bottom"
    >
      <span
        data-test={`filter-activity-indicator-${nodeId}`}
        style={{ display: 'flex', cursor: 'default' }}
      >
        <Icons.FilterOutlined iconSize="s" />
      </span>
    </Tooltip>
  );
}

const HEADER_CONTROLS: Record<string, (nodeId: string) => ReactElement | null> =
  {
    collapsible: nodeId => <CollapsibleToggle nodeId={nodeId} />,
    carousel: nodeId => <CarouselAddSlide nodeId={nodeId} />,
    echarts: nodeId => <FilterActivityIndicator nodeId={nodeId} />,
    'ag-grid-table': nodeId => <FilterActivityIndicator nodeId={nodeId} />,
    'metric-tile': nodeId => <FilterActivityIndicator nodeId={nodeId} />,
  };

/**
 * A second control for the widget of `type` to show in its own header,
 * beside the remove button — or `null` for every type that has nothing to
 * put there, which is nearly all of them.
 */
export function widgetHeaderControl(
  type: string,
  nodeId: string,
): ReactElement | null {
  return HEADER_CONTROLS[type]?.(nodeId) ?? null;
}
