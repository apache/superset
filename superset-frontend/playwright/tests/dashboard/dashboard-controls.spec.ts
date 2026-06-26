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
 * E2E migration of the Cypress "Dashboard top-level controls" suite
 * (dashboard/controls.test.ts).
 *
 * The genuine end-to-end behaviour is the dashboard-level force refresh: every
 * chart must re-query the backend with `force=true` (bypassing the cache), and
 * each response must report `is_cached: false`. This can only be verified
 * against a real backend, so it is migrated here.
 *
 * The other case ("should allow chart level refresh") only asserted the menu
 * item's `ant-dropdown-menu-item-disabled` class — a DOM/state assertion with no
 * backend round-trip, and one the original itself flagged as flaky. It belongs
 * in component/RTL coverage and is intentionally not migrated.
 *
 * CI green => force refresh re-queries every chart with force=true and the
 *             backend serves fresh (uncached) results.
 * CI red   => force refresh did not bypass the cache or did not re-query charts.
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPost, apiPut } from '../../helpers/api/requests';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { TIMEOUT } from '../../utils/constants';
import { DashboardPage } from '../../pages/DashboardPage';

const DATASET_NAME = 'birth_names';

testWithAssets(
  'dashboard-level force refresh re-queries every chart with force=true and uncached results',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) {
      throw new Error(`Dataset ${DATASET_NAME} not found`);
    }
    const datasetId = dataset.id;
    const datasource = `${datasetId}__table`;

    const chartSpecs = [
      { datasource, viz_type: 'big_number_total', metric: 'count' },
      {
        datasource,
        viz_type: 'table',
        query_mode: 'aggregate',
        groupby: ['name'],
        metrics: ['count'],
        row_limit: 100,
      },
    ];

    const chartIds: number[] = [];
    for (const params of chartSpecs) {
      const resp = await apiPost(page, 'api/v1/chart/', {
        slice_name: `controls_${params.viz_type}_${Date.now()}`,
        viz_type: params.viz_type,
        datasource_id: datasetId,
        datasource_type: 'table',
        params: JSON.stringify(params),
      });
      expect(resp.ok()).toBe(true);
      const body = await resp.json();
      const chartId: number = body.id ?? body.result?.id;
      testAssets.trackChart(chartId);
      chartIds.push(chartId);
    }

    const chartKeys = chartIds.map(id => `CHART-${id}`);
    const positionJson: Record<string, unknown> = {
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
        children: chartKeys,
        parents: ['ROOT_ID', 'GRID_ID'],
        meta: { background: 'BACKGROUND_TRANSPARENT' },
      },
    };
    chartIds.forEach((chartId, index) => {
      positionJson[chartKeys[index]] = {
        type: 'CHART',
        id: chartKeys[index],
        children: [],
        parents: ['ROOT_ID', 'GRID_ID', 'ROW-1'],
        meta: {
          chartId,
          width: 6,
          height: 50,
          sliceName: `controls_${index}`,
        },
      };
    });

    const dashResp = await apiPostDashboard(page, {
      dashboard_title: `controls_force_refresh_${Date.now()}`,
      published: true,
      position_json: JSON.stringify(positionJson),
    });
    expect(dashResp.ok()).toBe(true);
    const dashBody = await dashResp.json();
    const dashboardId: number = dashBody.result?.id ?? dashBody.id;
    testAssets.trackDashboard(dashboardId);

    for (const chartId of chartIds) {
      await apiPut(page, `api/v1/chart/${chartId}`, {
        dashboards: [dashboardId],
      });
    }

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();
    // Initial load warms the cache; the force refresh must then bypass it.
    await dashboard.waitForChartsToLoad();

    // Capture the force-refresh chart-data round-trips. The chart id is carried
    // in the request URL's form_data param (`{"slice_id":N}`), so we can tie
    // each forced request back to a specific chart and assert that every chart
    // — not just "enough requests" — was re-queried.
    const sliceIdFromForceUrl = (url: string): number | undefined => {
      const formData = new URL(url).searchParams.get('form_data');
      if (!formData) return undefined;
      try {
        return JSON.parse(formData).slice_id as number;
      } catch {
        return undefined;
      }
    };
    const forcedSliceIds = new Set<number>();
    const forceResponses: Promise<{
      sliceId: number | undefined;
      status: number;
      isCached: unknown;
    }>[] = [];
    page.on('response', response => {
      const request = response.request();
      if (
        request.method() === 'POST' &&
        response.url().includes('/api/v1/chart/data') &&
        response.url().includes('force=true')
      ) {
        const sliceId = sliceIdFromForceUrl(response.url());
        if (sliceId !== undefined) forcedSliceIds.add(sliceId);
        forceResponses.push(
          (async () => {
            const body = await response.json();
            const result = Array.isArray(body.result) ? body.result[0] : body;
            return {
              sliceId,
              status: response.status(),
              isCached: result?.is_cached,
            };
          })(),
        );
      }
    });

    await dashboard.forceRefresh();

    // Every chart — identified by slice_id, not merely by request count — must
    // fire its own forced re-query. Polling on the distinct set (rather than the
    // raw length) rejects a regression that refreshes one chart twice while
    // skipping another.
    await expect
      .poll(
        () => chartIds.every(id => forcedSliceIds.has(id)),
        { timeout: TIMEOUT.API_RESPONSE },
      )
      .toBe(true);

    const resolved = await Promise.all(forceResponses);
    for (const { sliceId, status, isCached } of resolved) {
      // Each forced request targeted one of this dashboard's charts...
      expect(chartIds).toContain(sliceId);
      // ...and the backend served a real result...
      expect(status).toBe(200);
      // ...that was freshly computed, not served from cache. The backend reports
      // an uncached result as a falsy is_cached (null or false depending on
      // version); a cached result would report true.
      expect(
        isCached,
        `force-refreshed result should not be cached, got is_cached=${isCached}`,
      ).toBeFalsy();
    }

    // The set of refreshed charts matches exactly the charts on the dashboard:
    // none skipped, none foreign.
    expect([...forcedSliceIds].sort()).toEqual([...chartIds].sort());
  },
);
