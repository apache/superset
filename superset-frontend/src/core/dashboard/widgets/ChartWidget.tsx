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
import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption, ECharts } from 'echarts/core';
import {
  BarChart,
  BoxplotChart,
  CustomChart,
  FunnelChart,
  GaugeChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart,
  SunburstChart,
  TreeChart,
  TreemapChart,
} from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import { dashboard as dashboardApi } from '@apache-superset/core';
import { useTheme } from '@apache-superset/core/theme';
import type { QueryFormMetric } from '@superset-ui/core';
import { Flex, Loading, Typography } from '@superset-ui/core/components';
import { provider, useDashboardRevision } from '../store';
import { fetchQueryData } from '../chartData';
import { resolveBindings } from '../resolveBindings';
import { getActiveFiltersForDataset } from '../collectActiveFilters';
import type { FilterValueChangedPayload } from '../filterVocabulary';
import {
  applyStructuredEchartsSeries,
  type EchartsChartType,
  type SeriesOverrideValue,
} from './echartsStructuredSeries';
import {
  applyStructuredChrome,
  type EchartsChromeValue,
} from './echartsStructuredChrome';

type DataBindingSpec = dashboardApi.DataBindingSpec;
type DataRow = dashboardApi.DataRow;

/** The one field of ECharts' own click-event payload this widget reads — a data point's category/name, exactly what a bar/pie/etc. click carries for a categorical series. */
interface EchartsClickParams {
  name?: string;
}

// Registers the renderer plus a broad set of chart/component types, once, at
// module load. Mirrors plugin-chart-echarts's own Echart.tsx registration —
// that component isn't reusable here (not part of the package's public
// exports, and has a Redux dependency this page has no reason to take on),
// and nothing else guarantees these are registered before a chart renders:
// a ChartPlugin's registration is metadata-only, and the real render module
// (with its own `use([...])` call) only loads lazily the first time that
// specific plugin actually renders — which never happens on this page,
// since it bypasses ChartPlugin/SuperChart entirely. AI-authored options can
// use any of these series/component types, hence registering broadly rather
// than guessing which ones this page will need.
echarts.use([
  CanvasRenderer,
  BarChart,
  BoxplotChart,
  CustomChart,
  FunnelChart,
  GaugeChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart,
  SunburstChart,
  TreeChart,
  TreemapChart,
  AriaComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  LegendComponent,
  ToolboxComponent,
  TooltipComponent,
  TitleComponent,
  VisualMapComponent,
  LabelLayout,
]);

/**
 * Tracks an element's rendered pixel size — ECharts has no self-sizing (it
 * only reacts to explicit `resize({width, height})` calls), so whatever
 * renders it owns measuring the DOM. This measures both dimensions: a grid
 * item's cell is always a definite pixel box (its column share of the
 * container's width, its `rowSpan × rowUnit` height, both enforced by the
 * parent grid — see `RootGrid`), so there's no case here where a
 * measured size is ambiguous or collapses to zero the way an unconstrained
 * flex height could.
 */
function useElementSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

/**
 * A minimal, self-contained ECharts canvas — deliberately not the
 * `<Echart>` wrapper `plugin-chart-echarts` uses internally (that component
 * isn't part of the package's public exports, and pulls in a Redux
 * dependency this prototype has no reason to take on). The renderer and
 * chart/component modules it needs are registered by this module's own
 * `use([...])` call above, so this only needs to init/setOption/resize.
 */
function EchartsCanvas({
  width,
  height,
  option,
  onPointClick,
}: {
  width: number;
  height: number;
  option: EChartsCoreOption;
  onPointClick?: (params: EchartsClickParams) => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts>();
  // The click listener is bound once, in the same effect that creates the
  // chart instance — re-binding it on every `onPointClick` identity change
  // would mean adding/removing an ECharts listener on every render for no
  // reason. A ref always reads the *latest* callback instead, the same
  // "stable subscription, fresh closure" split any addEventListener-based
  // effect needs once the handler itself isn't the effect's only dependency.
  const onPointClickRef = useRef(onPointClick);
  useEffect(() => {
    onPointClickRef.current = onPointClick;
  }, [onPointClick]);

  useEffect(() => {
    if (!divRef.current) return undefined;
    chartRef.current = echarts.init(divRef.current);
    chartRef.current.on('click', (params: EchartsClickParams) =>
      onPointClickRef.current?.(params),
    );
    return () => {
      chartRef.current?.dispose();
      chartRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (width > 0 && height > 0) {
      chartRef.current?.resize({ width, height });
    }
  }, [width, height]);

  useEffect(() => {
    // notMerge: true — an AI edit can change series/axis shapes drastically
    // between calls (e.g. pie -> bar), so stale config from the previous
    // option must not linger.
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={divRef} style={{ width, height }} />;
}

/**
 * The built-in `echarts` widget — registered like any other widget
 * (see `registerBuiltInWidgets`). Fetches its `dataBinding`
 * (generic, viz_type-less — see `chartData.ts`), resolves any `$bind`
 * markers in its `echartsOptions` against the results, and draws the
 * result. No `SuperChart`/`ChartPlugin`/`buildQuery`/`transformProps`
 * involved — the AI authors close to a real ECharts `option` directly.
 *
 * `props.crossFilter: true` turns a click on a data point into a filter —
 * this widget emitting `dashboard.VALUE_CHANGED_EVENT` on itself, the exact
 * same event/payload shape `FilterSelectWidget` emits (see
 * `filterVocabulary.ts`). Nothing downstream (`collectActiveFilters.ts`,
 * every other query-bound widget reading the same dataset) knows or cares
 * that the source this time is a chart reacting to its own click rather
 * than a purpose-built filter control — that's the entire point of the
 * event bus being general rather than filter-specific. A standalone
 * `echarts` widget with `crossFilter` unset behaves exactly as it always
 * has; this is additive, not a mode switch.
 */
export default function ChartWidget({ nodeId }: { nodeId: string }) {
  // Covers both structural/layout changes and any filter's emitted value —
  // `dashboard.emit` ticks the same revision (see `DashboardProvider`).
  useDashboardRevision();
  const theme = useTheme();
  const [containerRef, size] = useElementSize();
  const [rows, setRows] = useState<DataRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const node = provider.getNode(nodeId);
  const dataBinding = node?.props?.dataBinding as DataBindingSpec | undefined;
  // A query-bound widget doesn't subscribe to individual filter nodes — it
  // recomputes which filters currently apply to it (scoped by dataset
  // match, see `collectActiveFilters.ts`) every time this component
  // re-renders, and merges them in the same way its own authored filters
  // already flow into `dataBinding.filters`.
  const effectiveBinding = dataBinding
    ? {
        ...dataBinding,
        filters: [
          ...(dataBinding.filters ?? []),
          ...getActiveFiltersForDataset(dataBinding.datasetId, nodeId),
        ],
      }
    : undefined;
  const bindingKey = JSON.stringify(effectiveBinding);

  // Cross-filtering: opt-in (see `props.crossFilter`) and, for this
  // prototype, scoped to the *first* dimension only — a data point from a
  // multi-dimension query (e.g. a stacked bar grouped by two columns)
  // could in principle resolve a constraint per dimension, but nothing
  // here disambiguates which of ECharts' click fields maps to which
  // dimension beyond the category name, so a second dimension is simply
  // not filterable by click yet.
  const crossFilterColumn = dataBinding?.dimensions?.[0];
  const crossFilterEnabled =
    Boolean(node?.props?.crossFilter) && crossFilterColumn !== undefined;

  const handlePointClick = (params: EchartsClickParams) => {
    if (!crossFilterEnabled || !crossFilterColumn || !dataBinding) return;
    const clickedValue = params.name;
    if (clickedValue == null) return;

    const current = provider.getValue(
      nodeId,
      dashboardApi.VALUE_CHANGED_EVENT,
    ) as FilterValueChangedPayload | undefined;
    // Clicking the same point again clears the cross-filter rather than
    // re-asserting it — the same toggle a filter's own `allowClear` gives
    // a viewer, just reached by clicking the data itself instead of an
    // "x" on a control.
    const alreadySelected =
      current?.resolved?.column === crossFilterColumn &&
      current.resolved.value === clickedValue;

    provider.emit(
      nodeId,
      dashboardApi.VALUE_CHANGED_EVENT,
      alreadySelected
        ? { selection: null, resolved: null }
        : {
            selection: clickedValue,
            resolved: {
              column: crossFilterColumn,
              operator: 'EQUALS',
              value: clickedValue,
              datasource: dataBinding.datasetId,
            },
          },
    );
  };

  useEffect(() => {
    if (!effectiveBinding) {
      setError('This chart widget has no dataBinding.');
      setRows(null);
      return undefined;
    }
    let cancelled = false;
    setError(null);
    setRows(null);
    fetchQueryData(effectiveBinding)
      .then(result => {
        if (!cancelled) setRows(result.rows);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
    // effectiveBinding is a fresh object every render — bindingKey is its
    // stable, value-equality-comparable proxy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindingKey]);

  const chartType = node?.props?.chartType as
    EchartsChartType | null | undefined;
  const customizeSeries = (
    node?.props?.customize as
      { series?: Record<string, SeriesOverrideValue> } | undefined
  )?.series;
  const chrome = node?.props?.chrome as EchartsChromeValue | undefined;

  const option = useMemo(() => {
    if (!rows) return undefined;
    const resolved = resolveBindings(
      (node?.props?.echartsOptions as Record<string, unknown>) ?? {},
      { rows, theme },
    );
    const withStructuredSeries = applyStructuredEchartsSeries(
      resolved,
      chartType,
      (dataBinding?.metrics ?? []) as QueryFormMetric[],
      rows,
      customizeSeries,
    );
    const withStructuredChrome = applyStructuredChrome(
      withStructuredSeries,
      chrome,
    );
    // The chart's name is drawn by the widget's header, which reads it from
    // this same option (see `widgetLabel`). Leaving it here too would print it
    // twice, at two sizes, in two places — and the header's copy is the one
    // that sits where every other widget's name sits.
    const withoutTitle = { ...withStructuredChrome };
    delete withoutTitle.title;
    return withoutTitle;
  }, [
    node?.props?.echartsOptions,
    chartType,
    customizeSeries,
    chrome,
    dataBinding,
    rows,
    theme,
  ]);

  if (!node) return null;

  return (
    <div
      ref={containerRef}
      data-test={`chart-${nodeId}`}
      // `WidgetView`'s own root has an onClick that selects this widget on
      // *any* click inside it, native-DOM-bubbling up to it regardless of
      // what ECharts does with the same click — ECharts' own click handler
      // (see `EchartsCanvas`) gets a synthetic params object, not the DOM
      // event, so there's no stopping propagation from inside it. This is
      // the one point in the tree between the canvas and that handler this
      // widget still controls, so it's where a cross-filter click has to be
      // kept from also reselecting the widget — deliberately not taught to
      // `WidgetView` itself, which has no business knowing what
      // `crossFilter` is. `role` says what's true regardless: this div
      // gains no interactive semantics of its own from the handler below
      // (it neither needs nor gets a keyboard equivalent) — the actual
      // interactive surface is ECharts' own canvas, which isn't part of the
      // accessibility tree at all.
      role="presentation"
      // The other half of the fix, and the one that actually matters:
      // `RootGrid`'s GridStack instance treats a press *anywhere* in this
      // widget as the start of a drag unless the target matches its own
      // cancel selector (see `cancelSelectorFor`) — GridStack has no
      // built-in exemption for an arbitrary `<canvas>` the way it does for
      // a plain form control, so without this attribute the press never
      // reaches ECharts' own click detection at all, drag or not. The
      // `onClick`/`role` above only guard what happens *after* a click
      // does fire; this is what lets one fire in the first place.
      // `undefined` (not `false`) when disabled — a `data-*` attribute set
      // to `false` still renders as the string `"false"` and would still
      // match `[data-widget-interactive]`, which only tests presence.
      data-widget-interactive={crossFilterEnabled || undefined}
      onClick={
        crossFilterEnabled ? event => event.stopPropagation() : undefined
      }
      style={{
        // Fills the box `WidgetView`'s placement wrapper gives this
        // widget — that wrapper is always a definite pixel box (its column
        // share of the container's width, its `rowSpan × rowUnit` height),
        // so this is never zero or ambiguous.
        width: '100%',
        height: '100%',
        // Surface, border and corners belong to the card `WidgetView`
        // draws around this widget and the name above it, so that the name is
        // inside the frame rather than over it.
        overflow: 'hidden',
      }}
    >
      {error && (
        <Flex
          align="center"
          justify="center"
          style={{ width: '100%', height: '100%' }}
        >
          <Typography.Text type="danger">{error}</Typography.Text>
        </Flex>
      )}
      {!error && !option && (
        <Flex
          align="center"
          justify="center"
          style={{ width: '100%', height: '100%' }}
        >
          <Loading position="inline-centered" size="s" />
        </Flex>
      )}
      {!error && option && size.width > 0 && size.height > 0 && (
        <EchartsCanvas
          width={size.width}
          height={size.height}
          option={option}
          onPointClick={handlePointClick}
        />
      )}
    </div>
  );
}
