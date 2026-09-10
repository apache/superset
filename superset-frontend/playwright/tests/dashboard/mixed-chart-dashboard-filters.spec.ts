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
 * Regression for #29519: a dashboard-level filter that is in scope for a Mixed
 * (mixed_timeseries) chart should apply to BOTH of the chart's queries — Query
 * A and Query B — not just Query A.
 *
 * A Mixed chart issues a single query context with two queries
 * (queries[0] = A, queries[1] = B). This test creates a Mixed chart, puts it on
 * a dashboard behind a native filter scoped to the chart, loads the dashboard,
 * and inspects the outgoing POST /api/v1/chart/data payload to assert the filter
 * is present in both queries.
 *
 * CI green => both queries inherit the dashboard filter (contract holds);
 *             merging closes #29519 and guards against regressions.
 * CI red   => Query B dropped the filter; the bug is live in the Mixed chart
 *             query-building path (plugin-chart-echarts/src/MixedTimeseries).
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPost, apiPut } from '../../helpers/api/requests';
import {
  apiPostDashboard,
  buildSingleRowDashboardLayout,
} from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import { DashboardPage } from '../../pages/DashboardPage';
import { TIMEOUT } from '../../utils/constants';
import {
  buildFilterJsonMetadata,
  buildSelectFilter,
} from './dashboard-test-helpers';

const DATASET_NAME = 'birth_names';
const FILTER_COLUMN = 'gender';
const FILTER_VALUE = 'boy';

testWithAssets(
  'Mixed chart applies dashboard filter to both queries (#29519)',
  async ({ page, testAssets }) => {
    // Four API round-trips of setup precede a full dashboard load with a
    // preselected native filter, matching the other dashboard specs that build
    // their fixtures over the API rather than importing them.
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) {
      throw new Error(`Dataset ${DATASET_NAME} not found`);
    }
    const datasetId = dataset.id;

    const chartParams = {
      datasource: `${datasetId}__table`,
      viz_type: 'mixed_timeseries',
      x_axis: 'ds',
      time_grain_sqla: 'P1Y',
      metrics: ['count'],
      groupby: [],
      adhoc_filters: [],
      metrics_b: ['count'],
      groupby_b: [],
      adhoc_filters_b: [],
      row_limit: 100,
      row_limit_b: 100,
      truncate_metric: true,
      truncate_metric_b: true,
      comparison_type: 'values',
      color_scheme: 'supersetColors',
    };
    const chartResp = await apiPost(page, 'api/v1/chart/', {
      slice_name: `mixed_filter_repro_${Date.now()}`,
      viz_type: 'mixed_timeseries',
      datasource_id: datasetId,
      datasource_type: 'table',
      params: JSON.stringify(chartParams),
    });
    expect(chartResp.ok()).toBe(true);
    const chartId = await extractIdFromResponse(chartResp);
    testAssets.trackChart(chartId);

    const positionJson = buildSingleRowDashboardLayout([
      {
        id: chartId,
        sliceName: 'mixed_filter_repro',
        width: 8,
        height: 60,
      },
    ]);
    // Preselect the filter value so it is already applied on the dashboard's
    // first chart-data request — that request is what the assertions inspect.
    const jsonMetadata = buildFilterJsonMetadata({
      chartsInScope: [chartId],
      nativeFilters: [
        buildSelectFilter({
          datasetId,
          column: FILTER_COLUMN,
          chartsInScope: [chartId],
          name: 'Gender',
          defaultValue: FILTER_VALUE,
        }),
      ],
    });
    const dashResp = await apiPostDashboard(page, {
      dashboard_title: `mixed_filter_repro_${Date.now()}`,
      published: true,
      position_json: JSON.stringify(positionJson),
      json_metadata: JSON.stringify(jsonMetadata),
    });
    expect(dashResp.ok()).toBe(true);
    const dashboardId = await extractIdFromResponse(dashResp);
    testAssets.trackDashboard(dashboardId);

    await apiPut(page, `api/v1/chart/${chartId}`, {
      dashboards: [dashboardId],
    });

    // Capture the Mixed chart's data request (the one with two queries).
    const twoQueryPayloads: any[] = [];
    page.on('request', req => {
      if (req.url().includes('/api/v1/chart/data') && req.method() === 'POST') {
        try {
          const body = req.postDataJSON();
          if (body?.queries?.length === 2) {
            twoQueryPayloads.push(body);
          }
        } catch {
          // ignore non-JSON bodies
        }
      }
    });

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();

    await expect
      .poll(() => twoQueryPayloads.length, { timeout: 15_000 })
      .toBeGreaterThan(0);

    const payload = twoQueryPayloads[twoQueryPayloads.length - 1];
    const filtersA = JSON.stringify(payload.queries[0].filters || []);
    const filtersB = JSON.stringify(payload.queries[1].filters || []);

    expect(
      filtersA.includes(FILTER_COLUMN),
      'Query A should inherit the dashboard filter',
    ).toBe(true);
    expect(
      filtersB.includes(FILTER_COLUMN),
      'Query B should inherit the dashboard filter (see #29519)',
    ).toBe(true);
  },
);
