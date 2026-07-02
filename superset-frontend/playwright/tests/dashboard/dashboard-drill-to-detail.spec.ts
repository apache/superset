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
 * E2E migration of the Cypress "Drill to detail modal" suite
 * (dashboard/drilltodetail.test.ts).
 *
 * Drill to detail lets a viewer open a modal of the underlying sample rows for a
 * chart — optionally filtered to a single data point — by either the chart's
 * "More Options" header menu or a right-click context menu on the chart body.
 * The modal calls the real `/datasource/samples` API, so this is genuinely
 * end-to-end: each test API-builds a hermetic dashboard from the `birth_names`
 * dataset, renders it in the browser, drives the real menus, and asserts the
 * resulting backend round-trip (the samples POST and the filter the modal
 * applies).
 *
 * Why the original suite was fully `describe.skip`:
 *   "it has issues with autoscrolling and the locked title flakes intricately
 *    when the rightClick is obstructed by the title."
 * That failure mode is Cypress-specific — Cypress auto-scrolls the target under
 * the sticky chart header before every action. Playwright scrolls once and the
 * target stays put, so the entry points are portable here.
 *
 * What is migrated, and how it is kept deterministic:
 *   - Modal mechanics (open from header menu, pagination, reload-resets-page)
 *     and the no-filter big-number drill use stable DOM elements.
 *   - Table and Pivot drills right-click real DOM cells (no canvas pixels).
 *   - Canvas (echarts) charts — Pie, Line, Scatter, generic/smooth/step
 *     time-series, Mixed, Box plot, Funnel, Gauge, Treemap — DID rely on
 *     hard-coded pixel coordinates in Cypress to land on a specific slice/point.
 *     Instead of reproducing those brittle pixels, these tests scan a stable
 *     region of the canvas (see `rightClickCanvasDatum`), read whichever value
 *     the drill submenu actually offers for the point under the cursor, drill by
 *     that value, and assert the SAME value round-trips into the modal filter.
 *     This exercises the full canvas → contextmenu → datum → samples pipeline
 *     while staying independent of exact geometry. `Big Number with Trendline`
 *     drills the whole chart (no datum filter), like `Big Number`.
 *
 * Excluded (kept out, matching the original's own `describe.skip`s): Bar, Area,
 * World Map, Radar — skipped upstream for chart-specific reasons.
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import type { Page } from '@playwright/test';
import { apiPost, apiPut } from '../../helpers/api/requests';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { TIMEOUT } from '../../utils/constants';
import { DashboardPage } from '../../pages/DashboardPage';

const DATASET_NAME = 'birth_names';

/**
 * Parse a RowCountLabel value ("75.7k rows", "1,234 rows") into a number so
 * tests can assert the *invariant* (filtered < unfiltered) without hard-coding
 * the dataset-specific totals the original Cypress suite baked in.
 */
function parseRowCount(text: string): number {
  const m = text.match(/([\d.,]+)\s*([kKmM]?)/);
  if (!m) return NaN;
  let n = parseFloat(m[1].replace(/,/g, ''));
  const suffix = m[2].toLowerCase();
  if (suffix === 'k') n *= 1e3;
  if (suffix === 'm') n *= 1e6;
  return n;
}

interface ChartSpec {
  vizType: string;
  sliceName: string;
  params: Record<string, unknown>;
}

/**
 * API-build a hermetic single-chart dashboard from birth_names and return its
 * id. Mirrors the build pattern used by the other migrated dashboard specs
 * (create chart → build positionJson → create dashboard → link chart).
 */
async function buildSingleChartDashboard(
  page: Page,
  testAssets: {
    trackChart(id: number): void;
    trackDashboard(id: number): void;
  },
  spec: ChartSpec,
): Promise<number> {
  const dataset = await getDatasetByName(page, DATASET_NAME);
  if (!dataset) {
    throw new Error(`Dataset ${DATASET_NAME} not found`);
  }
  const datasetId = dataset.id;
  const datasource = `${datasetId}__table`;

  const chartResp = await apiPost(page, 'api/v1/chart/', {
    slice_name: `${spec.sliceName}_${Date.now()}`,
    viz_type: spec.vizType,
    datasource_id: datasetId,
    datasource_type: 'table',
    params: JSON.stringify({
      datasource,
      viz_type: spec.vizType,
      ...spec.params,
    }),
  });
  expect(chartResp.ok()).toBe(true);
  const chart = await chartResp.json();
  const chartId: number = chart.id ?? chart.result?.id;
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
      meta: { chartId, width: 12, height: 60, sliceName: spec.sliceName },
    },
  };

  const dashResp = await apiPostDashboard(page, {
    dashboard_title: `${spec.sliceName}_dash_${Date.now()}`,
    published: true,
    position_json: JSON.stringify(positionJson),
  });
  expect(dashResp.ok()).toBe(true);
  const dashBody = await dashResp.json();
  const dashboardId: number = dashBody.result?.id ?? dashBody.id;
  testAssets.trackDashboard(dashboardId);

  const linkResp = await apiPut(page, `api/v1/chart/${chartId}`, {
    dashboards: [dashboardId],
  });
  expect(linkResp.ok()).toBe(true);

  return dashboardId;
}

/**
 * Right-click an echarts canvas until a data point is hit — i.e. until the
 * context menu offers an *enabled* "Drill to detail by" submenu (a miss renders
 * that item disabled, as a plain menu item rather than a submenu title).
 *
 * echarts renders to a single canvas, so there is no per-datum DOM element to
 * target and the exact pixel of a mark depends on chart geometry (donut hole,
 * legend size, axis padding). Rather than hard-code Cypress's brittle pixel
 * coordinates, this scans a small set of candidate points — a radial ring for
 * pie/radial charts, a grid for cartesian charts — and stops at the first that
 * lands on a mark. The drill value is then whatever that mark represents, so the
 * caller asserts a value round-trip rather than a specific geometry.
 */
async function rightClickCanvasDatum(
  page: Page,
  canvas: ReturnType<Page['locator']>,
  pattern: 'ring' | 'grid' | 'dense',
): Promise<void> {
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no bounding box');

  const ringPoints = (): Array<{ x: number; y: number }> => {
    const pts: Array<{ x: number; y: number }> = [];
    const cx = box.width / 2;
    const cy = box.height / 2;
    const minSide = Math.min(box.width, box.height);
    for (const rf of [0.3, 0.22, 0.38]) {
      for (let a = 0; a < 360; a += 45) {
        const rad = (a * Math.PI) / 180;
        pts.push({
          x: cx + Math.cos(rad) * minSide * rf,
          y: cy + Math.sin(rad) * minSide * rf,
        });
      }
    }
    return pts;
  };
  const gridPoints = (): Array<{ x: number; y: number }> => {
    const pts: Array<{ x: number; y: number }> = [];
    for (const yf of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      for (const xf of [0.3, 0.45, 0.6, 0.2, 0.75]) {
        pts.push({ x: box.width * xf, y: box.height * yf });
      }
    }
    return pts;
  };

  // 'dense' merges both scans for radial/stacked shapes (gauge, funnel, box
  // plot) whose drillable marks don't fall neatly on a single ring or grid.
  let candidates: Array<{ x: number; y: number }>;
  if (pattern === 'ring') candidates = ringPoints();
  else if (pattern === 'grid') candidates = gridPoints();
  else candidates = [...gridPoints(), ...ringPoints()];

  // The submenu *title* element only exists when "Drill to detail by" is an
  // enabled submenu (a real datum was hit); a miss renders a disabled item.
  const enabledDrillBy = page
    .locator('.ant-dropdown-menu-submenu-title')
    .filter({ hasText: 'Drill to detail by' });

  for (const pt of candidates) {
    await canvas.click({ button: 'right', position: pt });
    const hit = await enabledDrillBy
      .waitFor({ state: 'visible', timeout: 400 })
      .then(() => true)
      .catch(() => false);
    if (hit) return;
    await page.keyboard.press('Escape');
  }
  throw new Error(
    `no drillable datum found on canvas after scanning ${candidates.length} points`,
  );
}

/** A samples POST fired (proves the modal hit the real backend). */
function expectSamplesPost(page: Page) {
  return page.waitForResponse(
    r =>
      r.url().includes('/datasource/samples') &&
      r.request().method() === 'POST',
    { timeout: TIMEOUT.API_RESPONSE },
  );
}

async function loadDashboardWithChart(
  dashboard: DashboardPage,
  dashboardId: number,
  vizType: string,
): Promise<void> {
  await dashboard.gotoById(dashboardId);
  await dashboard.waitForLoad();
  await dashboard
    .chartByVizType(vizType)
    .locator('[data-test="chart-container"]')
    .first()
    .waitFor({ state: 'visible', timeout: TIMEOUT.QUERY_EXECUTION });
  await dashboard.waitForChartsToLoad();
}

/**
 * Full canvas-drill round-trip for an echarts (canvas-rendered) chart: build a
 * hermetic single-chart dashboard, render it, right-click a real datum, drill by
 * whatever value the submenu offers under the cursor, and assert that same value
 * lands in the modal filter. Geometry-independent — see rightClickCanvasDatum.
 * Reused across every canvas viz type so each migrated chart is a thin caller.
 */
async function expectCanvasDrillByValueRoundTrips(
  page: Page,
  testAssets: {
    trackChart(id: number): void;
    trackDashboard(id: number): void;
  },
  spec: ChartSpec,
  pattern: 'ring' | 'grid' | 'dense',
): Promise<void> {
  const dashboard = new DashboardPage(page);
  const dashboardId = await buildSingleChartDashboard(page, testAssets, spec);
  await loadDashboardWithChart(dashboard, dashboardId, spec.vizType);

  const canvas = dashboard
    .chartByVizType(spec.vizType)
    .locator('canvas')
    .first();
  await expect(canvas).toBeVisible();
  await rightClickCanvasDatum(page, canvas, pattern);

  const offered = await dashboard.drillByOfferedValues();
  expect(offered.length).toBeGreaterThan(0);
  const value = offered[0];
  const samples = expectSamplesPost(page);
  await dashboard.contextMenuDrillToDetailBy(value);
  await samples;

  await expect(dashboard.drillModal()).toBeVisible();
  await expect(dashboard.drillFilterValues().first()).toContainText(value);
}

// Shared form-data fragment for the echarts time-series family (line/scatter/
// generic/smooth/step): one temporal axis, one metric, split by gender series.
const TIMESERIES_PARAMS = {
  x_axis: 'ds',
  time_grain_sqla: 'P1Y',
  metrics: ['count'],
  groupby: ['gender'],
  row_limit: 1000,
};

testWithAssets(
  'drill-to-detail modal: opens from the header menu, paginates, and reload resets to page 1',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    const dashboard = new DashboardPage(page);
    const dashboardId = await buildSingleChartDashboard(page, testAssets, {
      vizType: 'big_number_total',
      sliceName: 'drill_bignum',
      params: { metric: 'count', adhoc_filters: [] },
    });

    await loadDashboardWithChart(dashboard, dashboardId, 'big_number_total');

    // Open the modal from the chart's "More Options" header menu.
    const samplesOnOpen = expectSamplesPost(page);
    await dashboard.openDrillToDetailFromMenu('big_number_total');
    await samplesOnOpen;

    const modal = dashboard.drillModal();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Drill to detail:');
    // The metadata bar and a real row count prove the modal loaded backend data.
    await expect(modal.locator('[data-test="metadata-bar"]')).toBeVisible();
    await expect(modal.locator('[data-test="row-count-label"]')).toContainText(
      'rows',
    );
    // No drill filter was applied (whole-chart drill).
    await expect(dashboard.drillFilterValues()).toHaveCount(0);

    // The full dataset spans multiple pages, and the grid has rendered rows.
    const pageItems = modal.locator('.ant-pagination-item');
    expect(await pageItems.count()).toBeGreaterThan(1);
    await expect(modal.locator('.virtual-table-cell').first()).toBeVisible();
    await expect(modal.locator('.ant-pagination-item-active')).toContainText(
      '1',
    );

    // Paginate forward: clicking page 2 fires a real samples fetch and moves the
    // active page to 2.
    const samplesOnPage2 = expectSamplesPost(page);
    await modal.locator('.ant-pagination-item').nth(1).click();
    await samplesOnPage2;
    await expect(modal.locator('.ant-pagination-item-active')).toContainText(
      '2',
    );

    // Reload re-fetches and resets back to the first page.
    const samplesOnReload = expectSamplesPost(page);
    await modal.getByRole('button', { name: 'Reload' }).click();
    await samplesOnReload;
    await expect(modal.locator('.ant-pagination-item-active')).toContainText(
      '1',
    );
  },
);

testWithAssets(
  'drill-to-detail modal: big number value right-click drills the whole chart (no filter)',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    const dashboard = new DashboardPage(page);
    const dashboardId = await buildSingleChartDashboard(page, testAssets, {
      vizType: 'big_number_total',
      sliceName: 'drill_bignum_rc',
      params: { metric: 'count', adhoc_filters: [] },
    });

    await loadDashboardWithChart(dashboard, dashboardId, 'big_number_total');

    // Right-click the rendered number itself opens the context menu.
    const samples = expectSamplesPost(page);
    await dashboard
      .chartByVizType('big_number_total')
      .locator('.header-line')
      .click({ button: 'right' });
    await dashboard.contextMenuDrillToDetail();
    await samples;

    await expect(dashboard.drillModal()).toBeVisible();
    // Whole-chart drill: no per-value filter tag.
    await expect(dashboard.drillFilterValues()).toHaveCount(0);
    await expect(
      dashboard.drillModal().locator('[data-test="row-count-label"]'),
    ).toContainText('rows');
  },
);

testWithAssets(
  'drill-to-detail modal: table cell right-click drills by that value and clearing the filter restores the full set',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    const dashboard = new DashboardPage(page);
    const dashboardId = await buildSingleChartDashboard(page, testAssets, {
      vizType: 'table',
      sliceName: 'drill_table',
      params: {
        query_mode: 'aggregate',
        groupby: ['gender'],
        metrics: ['count'],
        row_limit: 100,
        server_pagination: false,
      },
    });

    await loadDashboardWithChart(dashboard, dashboardId, 'table');

    // Right-click the "boy" dimension cell and drill by it.
    const samplesOnDrill = expectSamplesPost(page);
    await dashboard
      .chartByVizType('table')
      .getByText('boy', { exact: true })
      .first()
      .click({ button: 'right' });
    await dashboard.contextMenuDrillToDetailBy('boy');
    await samplesOnDrill;

    const modal = dashboard.drillModal();
    await expect(modal).toBeVisible();
    await expect(dashboard.drillFilterValues().first()).toContainText('boy');

    const filteredCount = parseRowCount(
      await modal.locator('[data-test="row-count-label"]').innerText(),
    );
    expect(filteredCount).toBeGreaterThan(0);

    // Clearing the filter reloads the samples and restores the larger, unfiltered total.
    const samplesOnClear = expectSamplesPost(page);
    await modal.locator('[data-test="filter-col"]').getByLabel('Close').click();
    await samplesOnClear;
    await expect(dashboard.drillFilterValues()).toHaveCount(0);
    await expect
      .poll(async () =>
        parseRowCount(
          await modal.locator('[data-test="row-count-label"]').innerText(),
        ),
      )
      .toBeGreaterThan(filteredCount);
  },
);

testWithAssets(
  'drill-to-detail modal: pivot table cell right-click drills by the cell value',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    const dashboard = new DashboardPage(page);
    const dashboardId = await buildSingleChartDashboard(page, testAssets, {
      vizType: 'pivot_table_v2',
      sliceName: 'drill_pivot',
      params: {
        groupbyRows: ['gender'],
        groupbyColumns: [],
        metrics: ['count'],
        aggregateFunction: 'Sum',
        rowTotals: false,
        colTotals: false,
      },
    });

    await loadDashboardWithChart(dashboard, dashboardId, 'pivot_table_v2');

    await dashboard
      .chartByVizType('pivot_table_v2')
      .locator('[role="gridcell"]')
      .first()
      .click({ button: 'right' });

    // The cell's row dimension determines the offered value; drill by it and
    // assert the same value lands in the modal filter.
    const offered = await dashboard.drillByOfferedValues();
    expect(offered.length).toBeGreaterThan(0);
    const value = offered[0];
    const samples = expectSamplesPost(page);
    await dashboard.contextMenuDrillToDetailBy(value);
    await samples;

    await expect(dashboard.drillModal()).toBeVisible();
    await expect(dashboard.drillFilterValues().first()).toContainText(value);
  },
);

testWithAssets(
  'drill-to-detail modal: pie slice right-click (canvas) drills by the slice value',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    const dashboard = new DashboardPage(page);
    const dashboardId = await buildSingleChartDashboard(page, testAssets, {
      vizType: 'pie',
      sliceName: 'drill_pie',
      params: { groupby: ['gender'], metric: 'count' },
    });

    await loadDashboardWithChart(dashboard, dashboardId, 'pie');

    const canvas = dashboard.chartByVizType('pie').locator('canvas').first();
    await expect(canvas).toBeVisible();

    // Pie is a donut by default (center is a hole), so scan the ring for a slice.
    await rightClickCanvasDatum(page, canvas, 'ring');

    const offered = await dashboard.drillByOfferedValues();
    expect(offered.length).toBeGreaterThan(0);
    const value = offered[0];
    const samples = expectSamplesPost(page);
    await dashboard.contextMenuDrillToDetailBy(value);
    await samples;

    await expect(dashboard.drillModal()).toBeVisible();
    await expect(dashboard.drillFilterValues().first()).toContainText(value);
  },
);

testWithAssets(
  'drill-to-detail modal: line chart point right-click (canvas) drills by the point value',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    const dashboard = new DashboardPage(page);
    const dashboardId = await buildSingleChartDashboard(page, testAssets, {
      vizType: 'echarts_timeseries_line',
      sliceName: 'drill_line',
      params: {
        x_axis: 'ds',
        time_grain_sqla: 'P1Y',
        metrics: ['count'],
        groupby: ['gender'],
        row_limit: 1000,
      },
    });

    await loadDashboardWithChart(
      dashboard,
      dashboardId,
      'echarts_timeseries_line',
    );

    const canvas = dashboard
      .chartByVizType('echarts_timeseries_line')
      .locator('canvas')
      .first();
    await expect(canvas).toBeVisible();

    // Scan the plot grid for a point on one of the series lines.
    await rightClickCanvasDatum(page, canvas, 'grid');

    const offered = await dashboard.drillByOfferedValues();
    expect(offered.length).toBeGreaterThan(0);
    const value = offered[0];
    const samples = expectSamplesPost(page);
    await dashboard.contextMenuDrillToDetailBy(value);
    await samples;

    await expect(dashboard.drillModal()).toBeVisible();
    await expect(dashboard.drillFilterValues().first()).toContainText(value);
  },
);

testWithAssets(
  'drill-to-detail modal: big number with trendline right-click drills the whole chart (no filter)',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    const dashboard = new DashboardPage(page);
    const dashboardId = await buildSingleChartDashboard(page, testAssets, {
      vizType: 'big_number',
      sliceName: 'drill_bignum_trend',
      params: {
        metric: 'count',
        x_axis: 'ds',
        time_grain_sqla: 'P1Y',
        adhoc_filters: [],
      },
    });

    await loadDashboardWithChart(dashboard, dashboardId, 'big_number');

    // Right-click the rendered number opens the context menu; whole-chart drill.
    const samples = expectSamplesPost(page);
    await dashboard
      .chartByVizType('big_number')
      .locator('.header-line')
      .click({ button: 'right' });
    await dashboard.contextMenuDrillToDetail();
    await samples;

    await expect(dashboard.drillModal()).toBeVisible();
    await expect(dashboard.drillFilterValues()).toHaveCount(0);
    await expect(
      dashboard.drillModal().locator('[data-test="row-count-label"]'),
    ).toContainText('rows');
  },
);

testWithAssets(
  'drill-to-detail modal: scatter chart point right-click (canvas) drills by the point value',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    await expectCanvasDrillByValueRoundTrips(
      page,
      testAssets,
      {
        vizType: 'echarts_timeseries_scatter',
        sliceName: 'drill_scatter',
        // Enlarge the markers so a region scan reliably lands on a point;
        // scatter's default dots are a few pixels wide and a sparse grid misses
        // them.
        params: { ...TIMESERIES_PARAMS, markerSize: 20 },
      },
      'dense',
    );
  },
);

testWithAssets(
  'drill-to-detail modal: generic time-series point right-click (canvas) drills by the point value',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    await expectCanvasDrillByValueRoundTrips(
      page,
      testAssets,
      {
        vizType: 'echarts_timeseries',
        sliceName: 'drill_generic',
        params: TIMESERIES_PARAMS,
      },
      'grid',
    );
  },
);

testWithAssets(
  'drill-to-detail modal: smooth line point right-click (canvas) drills by the point value',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    await expectCanvasDrillByValueRoundTrips(
      page,
      testAssets,
      {
        vizType: 'echarts_timeseries_smooth',
        sliceName: 'drill_smooth',
        params: TIMESERIES_PARAMS,
      },
      'grid',
    );
  },
);

testWithAssets(
  'drill-to-detail modal: step line point right-click (canvas) drills by the point value',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    await expectCanvasDrillByValueRoundTrips(
      page,
      testAssets,
      {
        vizType: 'echarts_timeseries_step',
        sliceName: 'drill_step',
        params: TIMESERIES_PARAMS,
      },
      'grid',
    );
  },
);

testWithAssets(
  'drill-to-detail modal: mixed time-series point right-click (canvas) drills by the point value',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    await expectCanvasDrillByValueRoundTrips(
      page,
      testAssets,
      {
        vizType: 'mixed_timeseries',
        sliceName: 'drill_mixed',
        params: {
          x_axis: 'ds',
          time_grain_sqla: 'P1Y',
          metrics: ['count'],
          groupby: ['gender'],
          metrics_b: ['count'],
          groupby_b: ['gender'],
          row_limit: 1000,
        },
      },
      'grid',
    );
  },
);

testWithAssets(
  'drill-to-detail modal: box plot right-click (canvas) drills by the box value',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    await expectCanvasDrillByValueRoundTrips(
      page,
      testAssets,
      {
        vizType: 'box_plot',
        sliceName: 'drill_boxplot',
        params: {
          groupby: ['gender'],
          metrics: ['count'],
          columns: ['ds'],
        },
      },
      'dense',
    );
  },
);

testWithAssets(
  'drill-to-detail modal: funnel segment right-click (canvas) drills by the segment value',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    await expectCanvasDrillByValueRoundTrips(
      page,
      testAssets,
      {
        vizType: 'funnel',
        sliceName: 'drill_funnel',
        params: { groupby: ['gender'], metric: 'count' },
      },
      'dense',
    );
  },
);

testWithAssets(
  'drill-to-detail modal: gauge right-click (canvas) drills by the gauge value',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    await expectCanvasDrillByValueRoundTrips(
      page,
      testAssets,
      {
        vizType: 'gauge_chart',
        sliceName: 'drill_gauge',
        params: { groupby: ['gender'], metric: 'count' },
      },
      'dense',
    );
  },
);

testWithAssets(
  'drill-to-detail modal: treemap tile right-click (canvas) drills by the tile value',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    await expectCanvasDrillByValueRoundTrips(
      page,
      testAssets,
      {
        vizType: 'treemap_v2',
        sliceName: 'drill_treemap',
        params: { metric: 'count', groupby: ['gender'] },
      },
      'dense',
    );
  },
);

testWithAssets(
  'drill-to-detail modal: drilling a time-series point "by all" applies every dimension of that point',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    const dashboard = new DashboardPage(page);
    const dashboardId = await buildSingleChartDashboard(page, testAssets, {
      vizType: 'echarts_timeseries_line',
      sliceName: 'drill_all',
      // Two groupby dimensions so each point genuinely carries more than one
      // drillable value — the whole point of "Drill to detail by all".
      params: { ...TIMESERIES_PARAMS, groupby: ['gender', 'state'] },
    });

    await loadDashboardWithChart(
      dashboard,
      dashboardId,
      'echarts_timeseries_line',
    );

    const canvas = dashboard
      .chartByVizType('echarts_timeseries_line')
      .locator('canvas')
      .first();
    await expect(canvas).toBeVisible();
    await rightClickCanvasDatum(page, canvas, 'grid');

    // A line point carries two dimensions (the temporal value and the gender
    // series), so "Drill to detail by all" must apply both as filters.
    const offered = await dashboard.drillByOfferedValues();
    expect(offered.length).toBeGreaterThanOrEqual(2);
    const samples = expectSamplesPost(page);
    await dashboard.contextMenuDrillToDetailBy('all');
    await samples;

    await expect(dashboard.drillModal()).toBeVisible();
    expect(await dashboard.drillFilterValues().count()).toBeGreaterThanOrEqual(
      2,
    );
  },
);

testWithAssets(
  'drill-to-detail modal: table drills correctly by each of multiple dimension values',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    const dashboard = new DashboardPage(page);
    const dashboardId = await buildSingleChartDashboard(page, testAssets, {
      vizType: 'table',
      sliceName: 'drill_table_multi',
      params: {
        query_mode: 'aggregate',
        groupby: ['gender'],
        metrics: ['count'],
        row_limit: 100,
        server_pagination: false,
      },
    });

    await loadDashboardWithChart(dashboard, dashboardId, 'table');

    for (const value of ['boy', 'girl']) {
      const samples = expectSamplesPost(page);
      await dashboard
        .chartByVizType('table')
        .getByText(value, { exact: true })
        .first()
        .click({ button: 'right' });
      await dashboard.contextMenuDrillToDetailBy(value);
      await samples;

      const modal = dashboard.drillModal();
      await expect(modal).toBeVisible();
      await expect(dashboard.drillFilterValues().first()).toContainText(value);
      await dashboard.closeDrillModal();
    }
  },
);
