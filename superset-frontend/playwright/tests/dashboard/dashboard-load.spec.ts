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
 * E2E migration of the Cypress "Dashboard load" suite (dashboard/load.test.ts).
 *
 * Only the "should load dashboard" case is a genuine end-to-end test: it loads a
 * multi-chart dashboard and proves every chart renders by issuing real backend
 * queries. The remaining legacy cases (edit/standalone URL-param rendering,
 * send-log-data) only assert DOM/URL state with no backend round-trip and belong
 * in component/RTL coverage instead.
 *
 * The dashboard and charts are built via the API and cleaned up by the fixture;
 * the chart queries use the repository's read-only birth_names example dataset.
 *
 * CI green => the dashboard route mounts, every chart POSTs /api/v1/chart/data
 *             successfully, and each chart paints its expected output.
 * CI red   => the dashboard failed to load or a chart never rendered.
 */
import type { Locator } from '@playwright/test';
import { testWithAssets, expect } from '../../helpers/fixtures';
import { type DashboardLayoutChart } from '../../helpers/api/dashboard';
import { TIMEOUT } from '../../utils/constants';
import { DashboardPage } from '../../pages/DashboardPage';
import {
  createDashboardWithCharts,
  sliceIdFromChartDataUrl,
} from './dashboard-test-helpers';

const ECHARTS_SERIES_COLOR: [number, number, number] = [31, 168, 201];

type ChartOutput = 'big-number' | 'table' | 'echarts';
type CreatedChart = DashboardLayoutChart & { output: ChartOutput };

async function canvasColorPixelCount(
  canvas: Locator,
  target: [number, number, number],
): Promise<number> {
  return canvas.evaluate((element: HTMLCanvasElement, [red, green, blue]) => {
    const context = element.getContext('2d');
    if (!context || element.width === 0 || element.height === 0) {
      return 0;
    }
    const pixels = context.getImageData(0, 0, element.width, element.height);
    let count = 0;
    for (let index = 0; index < pixels.data.length; index += 4) {
      if (
        pixels.data[index + 3] >= 200 &&
        Math.abs(pixels.data[index] - red) < 12 &&
        Math.abs(pixels.data[index + 1] - green) < 12 &&
        Math.abs(pixels.data[index + 2] - blue) < 12
      ) {
        count += 1;
      }
    }
    return count;
  }, target);
}

async function expectChartOutput(
  chart: Locator,
  output: ChartOutput,
): Promise<void> {
  if (output === 'big-number') {
    const value = chart.locator(
      '.superset-legacy-chart-big-number .header-line',
    );
    await expect(value).toBeVisible();
    await expect(value).toHaveText(/\d/);
    return;
  }
  if (output === 'table') {
    await expect(
      chart.locator('table tbody tr:not(:has(.dt-no-results))').first(),
    ).toBeVisible();
    return;
  }

  const canvas = chart.locator('canvas').first();
  await expect(canvas).toBeVisible();
  await expect
    .poll(() => canvasColorPixelCount(canvas, ECHARTS_SERIES_COLOR), {
      timeout: TIMEOUT.API_RESPONSE * 2,
      message: 'ECharts canvas should paint the configured data series',
    })
    .toBeGreaterThan(20);
}

testWithAssets(
  'dashboard loads and every chart renders via real queries',
  async ({ page, testAssets }) => {
    // Building + loading a multi-chart dashboard chains several slow queries.
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    // A spread of viz types that all render cleanly from the birth_names dataset,
    // each paired with the terminal output it should paint.
    const chartSpecs: {
      viz_type: string;
      output: ChartOutput;
      params: Record<string, unknown>;
    }[] = [
      {
        viz_type: 'big_number_total',
        output: 'big-number',
        params: { metric: 'count' },
      },
      {
        viz_type: 'table',
        output: 'table',
        params: {
          query_mode: 'aggregate',
          groupby: ['name'],
          metrics: ['count'],
          row_limit: 100,
        },
      },
      {
        viz_type: 'echarts_timeseries_line',
        output: 'echarts',
        params: {
          x_axis: 'ds',
          xAxisForceCategorical: true,
          time_grain_sqla: 'P1Y',
          metrics: ['count'],
          groupby: [],
          row_limit: 100,
          color_scheme: 'supersetColors',
          show_legend: false,
        },
      },
    ];

    const { dashboardId, charts: createdCharts } =
      await createDashboardWithCharts(page, testAssets, testWithAssets.info(), {
        datasetName: 'birth_names',
        chartNamePrefix: 'load_smoke',
        dashboardTitlePrefix: 'load_smoke',
        chartSpecs,
      });
    // Pair each created chart back to the output it should paint (same order).
    const charts: CreatedChart[] = createdCharts.map((chart, index) => ({
      ...chart,
      output: chartSpecs[index].output,
    }));
    const chartIds = charts.map(chart => chart.id);

    // Record the real chart-data round-trips the dashboard makes on load,
    // keyed by the chart each one queried for, so we can prove every chart
    // queried — not just that some chart did.
    const chartDataStatusBySliceId = new Map<number, number>();
    page.on('response', response => {
      const request = response.request();
      if (
        request.method() !== 'POST' ||
        !response.url().includes('/api/v1/chart/data')
      ) {
        return;
      }
      const sliceId = sliceIdFromChartDataUrl(response.url());
      if (sliceId !== undefined) {
        chartDataStatusBySliceId.set(sliceId, response.status());
      }
    });

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();

    // Assert the real terminal output for each known visualization rather than
    // inferring completion from a generic wrapper shared by loading and errors.
    for (const chart of charts) {
      await expectChartOutput(dashboard.getChart(chart.id), chart.output);
    }

    // The render came from real backend queries: every chart issued its own
    // chart-data POST and each one was accepted. 202 counts as accepted — with
    // GLOBAL_ASYNC_QUERIES enabled a cold-cache query legitimately returns 202
    // and delivers its result out of band. The render assertion above is what
    // proves the data actually arrived, so this only needs to rule out a chart
    // that never queried or was rejected outright.
    for (const chartId of chartIds) {
      const status = chartDataStatusBySliceId.get(chartId);
      expect(
        status,
        `chart ${chartId} should have issued a /api/v1/chart/data POST`,
      ).toBeDefined();
      expect(
        [200, 202],
        `chart ${chartId}'s /api/v1/chart/data response should be 200 or 202, got ${status}`,
      ).toContain(status);
    }
  },
);
