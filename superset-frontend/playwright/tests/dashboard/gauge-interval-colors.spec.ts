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
 * Regression for #28766: a Gauge chart configured with interval bounds and
 * interval colors (mapped to a categorical color scheme) sometimes renders the
 * wrong interval colors when first loaded on a dashboard — a refresh fixes it.
 *
 * The gauge renders to a <canvas>, so this test reads pixels back from the
 * rendered gauge and asserts the configured interval colors are present in the
 * correct mapping. With `color_scheme: supersetColors` and
 * `interval_color_indices: '1,2'`, the gauge axis must paint the scheme's 1st
 * and 2nd colors (#1FA8C9 and #454E7C) and must NOT paint the 3rd (#5AC189),
 * which would indicate a shifted / fallback palette.
 *
 * CI green => the gauge paints the configured interval colors on first load;
 *             merging closes #28766 and guards against regressions.
 * CI red   => the interval colors are wrong on first load; the bug is live in
 *             plugin-chart-echarts/src/Gauge (color-scheme resolution).
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPostChart, apiPutChart } from '../../helpers/api/chart';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { DashboardPage } from '../../pages/DashboardPage';

const DATASET_NAME = 'birth_names';

// supersetColors palette (1-based, matching interval_color_indices):
// index 1 = #1FA8C9, index 2 = #454E7C, index 3 = #5AC189
const COLOR_INTERVAL_1: [number, number, number] = [31, 168, 201];
const COLOR_INTERVAL_2: [number, number, number] = [69, 78, 124];
const COLOR_UNUSED_3: [number, number, number] = [90, 193, 137];

testWithAssets(
  'Gauge renders configured interval colors on a dashboard (#28766)',
  async ({ page, testAssets }) => {
    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) {
      throw new Error(`Dataset ${DATASET_NAME} not found`);
    }
    const datasetId = dataset.id;

    const sliceName = `gauge_interval_colors_${Date.now()}`;
    const chartParams = {
      datasource: `${datasetId}__table`,
      viz_type: 'gauge_chart',
      metric: 'count',
      adhoc_filters: [],
      row_limit: 10,
      color_scheme: 'supersetColors',
      min_val: 0,
      max_val: 100,
      start_angle: 225,
      end_angle: -45,
      intervals: '50,100',
      interval_color_indices: '1,2',
      show_pointer: true,
      number_format: 'SMART_NUMBER',
      value_formatter: '{value}',
    };
    const chartResp = await apiPostChart(page, {
      slice_name: sliceName,
      viz_type: 'gauge_chart',
      datasource_id: datasetId,
      datasource_type: 'table',
      params: JSON.stringify(chartParams),
    });
    expect(chartResp.ok()).toBe(true);
    const chartBody = await chartResp.json();
    // Normalize: API may return id at top level or inside result.
    const chartId: number = chartBody.result?.id ?? chartBody.id;
    if (!chartId) {
      throw new Error(
        `Chart creation returned no id. Response: ${JSON.stringify(chartBody)}`,
      );
    }
    testAssets.trackChart(chartId);

    const chartLayoutKey = `CHART-${chartId}`;
    const positionJson = {
      DASHBOARD_VERSION_KEY: 'v2',
      ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: ['GRID_ID'] },
      GRID_ID: {
        type: 'GRID',
        id: 'GRID_ID',
        children: ['ROW-1'],
        parents: ['ROOT_ID'],
      },
      'ROW-1': {
        type: 'ROW',
        id: 'ROW-1',
        children: [chartLayoutKey],
        parents: ['ROOT_ID', 'GRID_ID'],
        meta: { background: 'BACKGROUND_TRANSPARENT' },
      },
      [chartLayoutKey]: {
        type: 'CHART',
        id: chartLayoutKey,
        children: [],
        parents: ['ROOT_ID', 'GRID_ID', 'ROW-1'],
        meta: {
          chartId,
          width: 6,
          height: 60,
          sliceName,
        },
      },
    };
    const dashResp = await apiPostDashboard(page, {
      dashboard_title: `gauge_interval_colors_${Date.now()}`,
      published: true,
      position_json: JSON.stringify(positionJson),
      json_metadata: JSON.stringify({ color_scheme: 'supersetColors' }),
    });
    expect(dashResp.ok()).toBe(true);
    const dashBody = await dashResp.json();
    const dashboardId: number = dashBody.result?.id ?? dashBody.id;
    testAssets.trackDashboard(dashboardId);

    await apiPutChart(page, chartId, { dashboards: [dashboardId] });

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();

    const canvas = page.locator('[data-test="chart-container"] canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 30_000 });

    // Read the configured interval colors back from the rendered canvas.
    // Poll because the gauge paints shortly after the chart container appears.
    const countColors = () =>
      canvas.evaluate(
        (el: HTMLCanvasElement, targets: Array<[number, number, number]>) => {
          const ctx = el.getContext('2d');
          if (!ctx) return targets.map(() => 0);
          const { data } = ctx.getImageData(0, 0, el.width, el.height);
          const counts = targets.map(() => 0);
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 200) continue;
            for (let t = 0; t < targets.length; t += 1) {
              const [r, g, b] = targets[t];
              if (
                Math.abs(data[i] - r) < 12 &&
                Math.abs(data[i + 1] - g) < 12 &&
                Math.abs(data[i + 2] - b) < 12
              ) {
                counts[t] += 1;
              }
            }
          }
          return counts;
        },
        [COLOR_INTERVAL_1, COLOR_INTERVAL_2, COLOR_UNUSED_3],
      );

    // Capture the counts inside the poll so the assertions below run against the
    // exact paint snapshot that satisfied the poll, not a second canvas read.
    let counts: number[] = [0, 0, 0];
    await expect
      .poll(
        async () => {
          counts = await countColors();
          return counts[0];
        },
        { timeout: 20_000 },
      )
      .toBeGreaterThan(50);

    const [interval1, interval2, unused3] = counts;

    expect(
      interval1,
      'Gauge should paint the 1st interval color (#1FA8C9)',
    ).toBeGreaterThan(50);
    expect(
      interval2,
      'Gauge should paint the 2nd interval color (#454E7C)',
    ).toBeGreaterThan(50);
    expect(
      unused3,
      'Gauge must not paint the 3rd palette color (#5AC189) — indicates a shifted/fallback palette (#28766)',
    ).toBe(0);
  },
);
