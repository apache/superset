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
import type { dashboard as dashboardApi } from '@apache-superset/core';
import { useTheme } from '@apache-superset/core/theme';
import type { QueryFormMetric } from '@superset-ui/core';
import { Flex, Loading, Typography } from '@superset-ui/core/components';
import { provider, useDashboardRevision } from '../store';
import { fetchQueryData } from '../chartData';
import { resolveBindings } from '../resolveBindings';
import {
  applyStructuredEchartsSeries,
  type EchartsChartType,
  type SeriesOverrideValue,
} from './echartsStructuredSeries';

type DataBindingSpec = dashboardApi.DataBindingSpec;
type DataRow = dashboardApi.DataRow;

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
}: {
  width: number;
  height: number;
  option: EChartsCoreOption;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts>();

  useEffect(() => {
    if (!divRef.current) return undefined;
    chartRef.current = echarts.init(divRef.current);
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
 */
export default function ChartWidget({ nodeId }: { nodeId: string }) {
  useDashboardRevision();
  const theme = useTheme();
  const [containerRef, size] = useElementSize();
  const [rows, setRows] = useState<DataRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const node = provider.getNode(nodeId);
  const dataBinding = node?.props?.dataBinding as DataBindingSpec | undefined;
  const bindingKey = JSON.stringify(dataBinding);

  useEffect(() => {
    if (!dataBinding) {
      setError('This chart widget has no dataBinding.');
      setRows(null);
      return undefined;
    }
    let cancelled = false;
    setError(null);
    setRows(null);
    fetchQueryData(dataBinding)
      .then(result => {
        if (!cancelled) setRows(result.rows);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
    // dataBinding is a fresh object every render — bindingKey is its stable,
    // value-equality-comparable proxy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindingKey]);

  const chartType = node?.props?.chartType as
    EchartsChartType | null | undefined;
  const customizeSeries = (
    node?.props?.customize as
      { series?: Record<string, SeriesOverrideValue> } | undefined
  )?.series;

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
    // The chart's name is drawn by the widget's header, which reads it from
    // this same option (see `widgetLabel`). Leaving it here too would print it
    // twice, at two sizes, in two places — and the header's copy is the one
    // that sits where every other widget's name sits.
    const withoutTitle = { ...withStructuredSeries };
    delete withoutTitle.title;
    return withoutTitle;
  }, [
    node?.props?.echartsOptions,
    chartType,
    customizeSeries,
    dataBinding,
    rows,
    theme,
  ]);

  if (!node) return null;

  return (
    <div
      ref={containerRef}
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
        />
      )}
    </div>
  );
}
