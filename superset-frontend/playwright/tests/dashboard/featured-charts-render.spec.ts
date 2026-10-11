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
 * Render smoke for the "Featured Charts" example dashboard.
 *
 * Replaces the per-visualization Cypress specs (big number, box plot, bubble,
 * gauge, graph, pie, sunburst, ...) that were skipped once example data moved
 * to YAML and later deleted. Those specs mostly asserted that a canvas or svg
 * existed; chart correctness lives in each plugin's transformProps/buildQuery
 * unit tests. This spec keeps the one thing only a real browser against a real
 * backend can prove: every registered visualization on the example dashboard
 * queries successfully and paints its output without an error.
 *
 * CI green => every chart on the dashboard issued an accepted chart-data query
 *             and rendered its terminal output with no error alert.
 * CI red   => a visualization failed to query or render, or the example
 *             dashboard lost one of the visualization types it covers.
 */
import type { Locator } from '@playwright/test';
import { test, expect } from '@playwright/test';
import {
  getDashboardByName,
  getDashboardCharts,
} from '../../helpers/api/dashboard';
import { DashboardPage } from '../../pages/DashboardPage';
import { TIMEOUT } from '../../utils/constants';
import { sliceIdFromChartDataUrl } from './dashboard-test-helpers';

const DASHBOARD_TITLE = 'Featured Charts';

// Visualization types the dashboard is expected to cover. A subset check, so
// adding charts to the example does not break the spec, but dropping one does.
const EXPECTED_VIZ_TYPES = [
  'big_number',
  'big_number_total',
  'box_plot',
  'bubble_v2',
  'echarts_area',
  'echarts_timeseries_bar',
  'echarts_timeseries_line',
  'echarts_timeseries_scatter',
  'funnel',
  'gantt_chart',
  'gauge_chart',
  'graph_chart',
  'heatmap_v2',
  'histogram_v2',
  'mixed_timeseries',
  'pie',
  'pivot_table_v2',
  'radar',
  'sankey_v2',
  'sunburst_v2',
  'table',
  'tree_chart',
  'treemap_v2',
  'waterfall',
  'word_cloud',
];

// Saturated-pixel floor for a chart's canvases. Painted charts on this
// dashboard score from several hundred to tens of thousands; a blank or
// axes-only canvas scores ~0. Series correctness is left to plugin unit tests.
const MIN_COLORED_PIXELS = 100;

// Default `expect` timeout from playwright.config.ts, spent by the assertions
// below that do not override it (big number text, error-alert count).
const DEFAULT_EXPECT_TIMEOUT = 8000;

// Worst-case time one chart can consume: the visibility wait and the paint
// poll each take a full CHART_RENDER, plus the two default-timeout assertions.
const PER_CHART_BUDGET = TIMEOUT.CHART_RENDER * 2 + DEFAULT_EXPECT_TIMEOUT * 2;

/**
 * The terminal output each visualization paints once its data has arrived.
 * ECharts-based visualizations (the default) paint a canvas.
 */
function chartOutput(chart: Locator, vizType: string): Locator {
  switch (vizType) {
    case 'big_number':
    case 'big_number_total':
      return chart.locator('.header-line');
    case 'table':
    case 'pivot_table_v2':
      return chart.locator('table tbody tr:not(:has(.dt-no-results))').first();
    case 'word_cloud':
      return chart.locator('svg text').first();
    default:
      return chart.locator('canvas').first();
  }
}

/**
 * Counts opaque, saturated pixels across every canvas in a chart (ECharts may
 * split a chart over several layers). Axes, gridlines and labels are drawn in
 * neutral grays, so only colored marks such as series and legend swatches
 * count.
 */
async function saturatedPixelCount(chart: Locator): Promise<number> {
  return chart.locator('canvas').evaluateAll((elements: HTMLCanvasElement[]) =>
    elements.reduce((total, element) => {
      const context = element.getContext('2d');
      if (!context || element.width === 0 || element.height === 0) {
        return total;
      }
      const { data } = context.getImageData(
        0,
        0,
        element.width,
        element.height,
      );
      let count = 0;
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        if (
          data[index + 3] >= 200 &&
          Math.max(red, green, blue) - Math.min(red, green, blue) > 40
        ) {
          count += 1;
        }
      }
      return total + count;
    }, 0),
  );
}

test('every chart on the Featured Charts dashboard renders', async ({
  page,
}) => {
  // Covers the lookups and dashboard load; widened once the chart count is
  // known so the sequential per-chart assertions cannot outlive the test.
  test.setTimeout(TIMEOUT.SLOW_TEST);

  const dashboardSummary = await getDashboardByName(page, DASHBOARD_TITLE);
  expect(
    dashboardSummary,
    `the "${DASHBOARD_TITLE}" example dashboard should be loaded`,
  ).not.toBeNull();
  const dashboardId = dashboardSummary!.id;

  const charts = await getDashboardCharts(page, dashboardId);
  // Charts are asserted one at a time and each can spend its full render
  // budget, so size the test timeout to the worst case rather than assuming
  // the queries overlap. Keeps the lookups' budget plus every chart's budget.
  test.setTimeout(TIMEOUT.SLOW_TEST + charts.length * PER_CHART_BUDGET);

  // The charts endpoint drops form_data for charts the user cannot access.
  const inaccessible = charts
    .filter(chart => !chart.form_data)
    .map(chart => `"${chart.slice_name}" (${chart.id})`);
  expect(
    inaccessible,
    'every chart on the dashboard should be accessible to the test user',
  ).toEqual([]);
  const vizTypes = charts.map(chart => chart.form_data?.viz_type);
  expect(vizTypes).toEqual(expect.arrayContaining(EXPECTED_VIZ_TYPES));

  const chartDataStatusBySliceId = new Map<number, number>();
  page.on('response', response => {
    if (
      response.request().method() !== 'POST' ||
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

  // Dashboard virtualization only mounts rows near the viewport, so bring each
  // chart into view (as a user scrolling the dashboard would) before asserting.
  for (const { id, slice_name: name, form_data: formData } of charts) {
    if (!formData) {
      throw new Error(`"${name}" (${id}) has no form_data`);
    }
    const chart = dashboard.getChart(id);
    await chart.scrollIntoViewIfNeeded();

    const output = chartOutput(chart, formData.viz_type);
    await expect(
      output,
      `"${name}" (${formData.viz_type}) should render its output`,
    ).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
    if (formData.viz_type.startsWith('big_number')) {
      await expect(output).toHaveText(/\d/);
    }
    if ((await output.evaluate(element => element.tagName)) === 'CANVAS') {
      await expect
        .poll(() => saturatedPixelCount(chart), {
          timeout: TIMEOUT.CHART_RENDER,
          message: `"${name}" (${formData.viz_type}) should paint colored marks`,
        })
        .toBeGreaterThan(MIN_COLORED_PIXELS);
    }
    await expect(
      chart.getByRole('alert'),
      `"${name}" (${formData.viz_type}) should not show an error`,
    ).toHaveCount(0);

    // 202 counts as accepted: with GLOBAL_ASYNC_QUERIES a cold-cache query
    // returns 202 and delivers its result out of band. The render assertion
    // above proves the data arrived.
    const status = chartDataStatusBySliceId.get(id);
    expect(
      [200, 202],
      `"${name}" chart-data response should be 200 or 202, got ${status}`,
    ).toContain(status);
  }
});
