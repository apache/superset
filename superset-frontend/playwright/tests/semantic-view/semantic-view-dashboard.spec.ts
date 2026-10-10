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
 * Semantic-view dashboards against the in-memory stub provider
 * (tests/e2e_extensions/semantic_stub). The stub's `orders` view has fixed
 * rows, so totals are exact: Books 15 (East 10 + West 5), Games 7, Music 3.
 *
 * These specs skip unless the stub is loaded; CI runs them in a dedicated
 * step against `superset_test_config_semantic`.
 */

import type { Locator, Page } from '@playwright/test';
import {
  testWithAssets,
  expect,
  type TestAssets,
} from '../../helpers/fixtures';
import { apiPost, apiPut } from '../../helpers/api/requests';
import {
  apiPostDashboard,
  buildSingleRowDashboardLayout,
} from '../../helpers/api/dashboard';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import {
  apiCreateStubSemanticView,
  skipUnlessSemanticStub,
  StubSemanticView,
} from '../../helpers/api/semanticLayer';
import { DashboardPage } from '../../pages/DashboardPage';
import { TIMEOUT } from '../../utils/constants';
import {
  buildFilterJsonMetadata,
  buildSelectFilter,
  type NativeFilterConfig,
} from '../dashboard/dashboard-test-helpers';

const SLICE_NAME = 'Orders by category';

interface SemanticDashboard {
  view: StubSemanticView;
  chartId: number;
  dashboardId: number;
}

/** One table chart (category × total_amount) on a one-chart dashboard. */
async function createSemanticDashboard(
  page: Page,
  testAssets: TestAssets,
  nativeFilters: (
    view: StubSemanticView,
    chartId: number,
  ) => NativeFilterConfig[],
): Promise<SemanticDashboard> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const view = await apiCreateStubSemanticView(page, suffix);
  testAssets.trackSemanticLayer(view.layerUuid);

  const params = {
    datasource: view.datasource,
    viz_type: 'table',
    query_mode: 'aggregate',
    groupby: ['category'],
    metrics: ['total_amount'],
    adhoc_filters: [],
    row_limit: 100,
  };
  const chartResp = await apiPost(page, 'api/v1/chart/', {
    slice_name: `${SLICE_NAME} ${suffix}`,
    viz_type: 'table',
    datasource_id: view.viewId,
    datasource_type: 'semantic_view',
    params: JSON.stringify(params),
  });
  const chartId = await extractIdFromResponse(chartResp);
  testAssets.trackChart(chartId);

  const dashResp = await apiPostDashboard(page, {
    dashboard_title: `semantic_stub_${suffix}`,
    published: true,
    position_json: JSON.stringify(
      buildSingleRowDashboardLayout([
        { id: chartId, sliceName: SLICE_NAME, width: 6, height: 50 },
      ]),
    ),
    json_metadata: JSON.stringify(
      buildFilterJsonMetadata({
        chartsInScope: [chartId],
        nativeFilters: nativeFilters(view, chartId),
      }),
    ),
  });
  const dashboardId = await extractIdFromResponse(dashResp);
  testAssets.trackDashboard(dashboardId);
  await apiPut(page, `api/v1/chart/${chartId}`, { dashboards: [dashboardId] });

  return { view, chartId, dashboardId };
}

/**
 * The table row for a category. Cells are named by their column header, so
 * match on the cell's text instead of its accessible name.
 */
function rowFor(chart: Locator, category: string): Locator {
  return chart.getByRole('row').filter({
    // `has` is queried inside each row, so the inner locator must not be
    // rooted at `chart`.
    has: chart
      .page()
      .getByRole('cell')
      .filter({ hasText: new RegExp(`^${category}$`) }),
  });
}

testWithAssets.beforeEach(async ({ page }) => {
  await skipUnlessSemanticStub(page);
});

testWithAssets(
  'semantic-view chart renders on a dashboard',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    const { chartId, dashboardId } = await createSemanticDashboard(
      page,
      testAssets,
      () => [],
    );

    const chartData = page.waitForResponse(
      response =>
        response.url().includes('/api/v1/chart/data') &&
        response.request().method() === 'POST',
    );
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    expect((await chartData).status()).toBe(200);
    await dashboardPage.waitForChartsToLoad();

    const chart = dashboardPage.getChart(chartId);
    await expect(rowFor(chart, 'Books')).toContainText('15');
    await expect(rowFor(chart, 'Games')).toContainText('7');
    await expect(rowFor(chart, 'Music')).toContainText('3');
  },
);

testWithAssets(
  'native filter on a semantic-view dimension filters the chart',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);
    const { chartId, dashboardId } = await createSemanticDashboard(
      page,
      testAssets,
      (view, id) => [
        buildSelectFilter({
          datasetId: view.viewId,
          datasourceType: 'semantic_view',
          column: 'region',
          chartsInScope: [id],
          name: 'Region',
          defaultValue: 'West',
        }),
      ],
    );

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();

    // West only: Books 5 and Music 3; Games has no West orders.
    const chart = dashboardPage.getChart(chartId);
    await expect(rowFor(chart, 'Books')).toContainText('5');
    await expect(rowFor(chart, 'Books')).not.toContainText('15');
    await expect(rowFor(chart, 'Music')).toContainText('3');
    await expect(rowFor(chart, 'Games')).toHaveCount(0);
  },
);
