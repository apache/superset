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

import { CSSProperties, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@apache-superset/core/theme';
import {
  init,
  registerTheme,
  use,
  type EChartsCoreOption,
  type EChartsType,
} from 'echarts/core';
import {
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  SunburstChart,
  TreemapChart,
} from 'echarts/charts';
import {
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  PolarComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { t } from '@apache-superset/core/translation';
import { VizNode } from './types';
import { encodeToOption, resolveFormatters } from './resolve';
import { useBoundQuery } from './runtime';

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  RadarChart,
  FunnelChart,
  GaugeChart,
  TreemapChart,
  SunburstChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  VisualMapComponent,
  PolarComponent,
  RadarComponent,
  DataZoomComponent,
  GraphicComponent,
  MarkLineComponent,
]);

const THEME_NAME = 'supersetCanvas';

type ThemeTokens = ReturnType<typeof useTheme>;

/** Signature that changes when the app flips light/dark — drives re-theming. */
const themeSignature = (theme: ThemeTokens): string =>
  `${theme.colorText}|${theme.colorBgContainer}|${theme.colorPrimary}`;

/**
 * A full echarts theme built from antd tokens. Registered globally so axis,
 * legend and title colours follow the app theme — the parts a per-chart
 * `option` can't reach, since option values can't reference `@themeToken`s.
 */
function buildEchartsTheme(theme: ThemeTokens): Record<string, unknown> {
  const text = theme.colorText;
  const sub = theme.colorTextSecondary;
  const border = theme.colorBorderSecondary ?? theme.colorBorder;
  const split = theme.colorSplit ?? border;
  const palette = [
    theme.colorPrimary,
    theme.colorSuccess,
    theme.colorWarning,
    theme.colorInfo,
    theme.colorError,
    theme.colorPrimaryBorder,
    theme.colorWarningBorder,
  ].filter(Boolean);
  const axis = {
    axisLine: { lineStyle: { color: border } },
    axisTick: { lineStyle: { color: border } },
    axisLabel: { color: sub },
    splitLine: { lineStyle: { color: split } },
    splitArea: { areaStyle: { color: ['transparent', 'transparent'] } },
  };
  return {
    color: palette,
    backgroundColor: 'transparent',
    textStyle: { color: text, fontFamily: theme.fontFamily },
    title: { textStyle: { color: text }, subtextStyle: { color: sub } },
    legend: { textStyle: { color: sub } },
    categoryAxis: axis,
    valueAxis: axis,
    logAxis: axis,
    timeAxis: axis,
    visualMap: { textStyle: { color: sub } },
    graph: { color: palette },
  };
}

/** Default framing; colours now come from the registered theme. */
const themedBase: Record<string, unknown> = {
  grid: { left: 56, right: 16, top: 32, bottom: 32, containLabel: true },
};

function EchartsChart({
  option,
  themeKey,
  height = 320,
  style,
}: {
  option: EChartsCoreOption;
  themeKey: string;
  height?: number;
  style?: CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType>();
  const optionRef = useRef(option);
  optionRef.current = option;

  // Re-init when the theme flips (an echarts instance binds its theme at init).
  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }
    const chart = init(element, THEME_NAME);
    chartRef.current = chart;
    chart.setOption(optionRef.current, { notMerge: true });
    const handleResize = () => chart.resize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(element);
    window.addEventListener('resize', handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey]);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div
      ref={containerRef}
      data-test="canvas-echarts"
      css={{ width: '100%', height }}
      style={style}
    />
  );
}

/**
 * The echarts head of the Viz union: fetch a governed query, map the result onto
 * the declarative option via `encoding`, resolve formatters, render.
 */
export function EchartsViz({
  node,
  style,
}: {
  node: VizNode;
  style?: CSSProperties;
}) {
  const theme = useTheme();
  const { data } = node;
  const { loading, error, result } = useBoundQuery(
    data?.queryContext ?? { datasetId: -1, metrics: [] },
  );

  // Register (or refresh) the theme during render, before the child's init
  // effect runs — child effects fire before parent effects, so an effect here
  // would be too late for the first paint.
  const themeKey = themeSignature(theme);
  useMemo(() => {
    registerTheme(THEME_NAME, buildEchartsTheme(theme));
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey]);

  const option = useMemo<EChartsCoreOption | undefined>(() => {
    if (!result || !data) {
      return undefined;
    }
    const encoded = encodeToOption(
      { ...themedBase, ...node.option },
      data.encoding,
      result,
    );
    return resolveFormatters(encoded) as EChartsCoreOption;
  }, [result, data, node.option]);

  if (loading) {
    return <div data-test="canvas-echarts-loading">{t('Loading…')}</div>;
  }
  if (error) {
    return (
      <div data-test="canvas-echarts-error">{t('Query error: %s', error)}</div>
    );
  }
  if (result && result.records.length === 0) {
    return (
      <div data-test="canvas-echarts-empty">{t('No data for this query')}</div>
    );
  }
  if (!option) {
    return null;
  }
  return <EchartsChart option={option} themeKey={themeKey} style={style} />;
}
