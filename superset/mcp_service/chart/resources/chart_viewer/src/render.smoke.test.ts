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
 * Render smoke tests: drive a REAL ECharts instance with the options our
 * adapter produces.
 *
 * The rest of the adapter suite asserts the *shape* of the option object,
 * which would keep passing even if ECharts rejected it at runtime — exactly
 * the blind spot that let a major-version bump (5 -> 6) land unverified.
 * These tests call `setOption` for real, so an option key ECharts no longer
 * accepts, a chart/component type we forgot to register in `echarts.ts`, or a
 * breaking change in the series contract fails here instead of in a host.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { SVGRenderer } from 'echarts/renderers';
import { echarts } from './echarts';

import {
  buildSparklineOption,
  chartDataToEChartsOption,
  resolveBigNumber,
} from './adapter';
import { getThemeTokens } from './theme';
import type { ChartData, DataColumn, ViewType } from './types';

// jsdom does not implement HTMLCanvasElement.getContext, so the production
// CanvasRenderer cannot run here. Register the SVG renderer for tests: it
// exercises the same option parsing, series construction and coordinate
// system, which is what these tests are for. Pixel output is out of scope —
// that is what host verification covers.
echarts.use([SVGRenderer]);

const RENDER_OPTS = { renderer: 'svg' } as const;

const theme = getThemeTokens('light');

function col(
  name: string,
  data_type: DataColumn['data_type'],
): DataColumn {
  return {
    name,
    display_name: name,
    data_type,
    sample_values: [],
    null_count: 0,
    unique_count: 3,
  };
}

function timeSeries(metrics: string[]): ChartData {
  return {
    chart_id: 1,
    chart_name: 'Smoke',
    chart_type: 'echarts_timeseries_line',
    columns: [col('ds', 'temporal'), ...metrics.map((m) => col(m, 'numeric'))],
    data: [
      { ds: '2026-01-01', ...Object.fromEntries(metrics.map((m) => [m, 10])) },
      { ds: '2026-01-02', ...Object.fromEntries(metrics.map((m) => [m, 20])) },
      { ds: '2026-01-03', ...Object.fromEntries(metrics.map((m) => [m, 15])) },
    ],
    row_count: 3,
    total_rows: 3,
  };
}

/**
 * ECharts needs a laid-out element. jsdom reports zero dimensions, so pin an
 * explicit size — otherwise init warns and skips rendering entirely.
 */
function mountTarget(): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 600, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true });
  document.body.appendChild(el);
  return el;
}

describe('ECharts renders the adapter’s options for real', () => {
  let el: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    el = mountTarget();
  });

  const views: ViewType[] = ['line', 'bar', 'area'];

  it.each(views)('renders a single-metric %s chart without throwing', (view) => {
    const chart = echarts.init(el, undefined, RENDER_OPTS);
    try {
      const option = chartDataToEChartsOption(timeSeries(['revenue']), view, {
        theme,
      });
      expect(() => chart.setOption(option)).not.toThrow();
      // A series actually made it into the live instance.
      const applied = chart.getOption() as { series?: unknown[] };
      expect(applied.series?.length).toBe(1);
    } finally {
      chart.dispose();
    }
  });

  it.each(views)('renders a multi-metric %s chart with a legend', (view) => {
    const chart = echarts.init(el, undefined, RENDER_OPTS);
    try {
      const option = chartDataToEChartsOption(
        timeSeries(['revenue', 'cost', 'margin']),
        view,
        { theme },
      );
      chart.setOption(option);
      const applied = chart.getOption() as {
        series?: unknown[];
        legend?: Array<{ show?: boolean }>;
      };
      expect(applied.series?.length).toBe(3);
      // Multi-series must surface a legend, which is what the metric chips key off.
      expect(applied.legend?.[0]?.show).toBe(true);
    } finally {
      chart.dispose();
    }
  });

  it('honours the activeMetrics subset (metric toggle path)', () => {
    const chart = echarts.init(el, undefined, RENDER_OPTS);
    try {
      const option = chartDataToEChartsOption(
        timeSeries(['revenue', 'cost', 'margin']),
        'line',
        { theme, activeMetrics: ['revenue'] },
      );
      chart.setOption(option);
      const applied = chart.getOption() as { series?: unknown[] };
      expect(applied.series?.length).toBe(1);
    } finally {
      chart.dispose();
    }
  });

  it('renders a categorical (non-temporal) bar chart', () => {
    const chart = echarts.init(el, undefined, RENDER_OPTS);
    try {
      const data: ChartData = {
        chart_id: 2,
        chart_name: 'By country',
        chart_type: 'echarts_timeseries_bar',
        columns: [col('country', 'string'), col('sales', 'numeric')],
        data: [
          { country: 'US', sales: 100 },
          { country: 'CA', sales: 50 },
        ],
        row_count: 2,
        total_rows: 2,
      };
      expect(() =>
        chart.setOption(chartDataToEChartsOption(data, 'bar', { theme })),
      ).not.toThrow();
    } finally {
      chart.dispose();
    }
  });

  it('renders the big-number sparkline via the real resolve -> build path', () => {
    const chart = echarts.init(el, undefined, RENDER_OPTS);
    try {
      // Mirror BigNumber.tsx: resolveBigNumber produces the spark series,
      // which is what buildSparklineOption consumes.
      const { spark } = resolveBigNumber(timeSeries(['revenue']));
      // A temporal column is present, so a sparkline must be derivable.
      expect(spark).not.toBeNull();
      expect(() =>
        chart.setOption(buildSparklineOption(spark!, theme)),
      ).not.toThrow();
    } finally {
      chart.dispose();
    }
  });

  it('survives switching view types on a live instance (morph path)', () => {
    // bar -> line -> area on the SAME instance is what universalTransition
    // animates. A stale/incompatible series id or type would throw here.
    const chart = echarts.init(el, undefined, RENDER_OPTS);
    try {
      const data = timeSeries(['revenue', 'cost']);
      for (const view of ['bar', 'line', 'area', 'bar'] as ViewType[]) {
        expect(() =>
          chart.setOption(chartDataToEChartsOption(data, view, { theme }), {
            notMerge: false,
          }),
        ).not.toThrow();
      }
    } finally {
      chart.dispose();
    }
  });

  it('renders empty data without throwing', () => {
    const chart = echarts.init(el, undefined, RENDER_OPTS);
    try {
      const empty: ChartData = {
        chart_id: 3,
        chart_name: 'Empty',
        chart_type: 'echarts_timeseries_line',
        columns: [col('ds', 'temporal'), col('v', 'numeric')],
        data: [],
        row_count: 0,
        total_rows: 0,
      };
      expect(() =>
        chart.setOption(chartDataToEChartsOption(empty, 'line', { theme })),
      ).not.toThrow();
    } finally {
      chart.dispose();
    }
  });
});
