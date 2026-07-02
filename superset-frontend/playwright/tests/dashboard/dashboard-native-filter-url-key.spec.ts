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
 * E2E migration of the Cypress "nativefilter url param key" suite
 * (dashboard/key_value.test.ts).
 *
 * When a dashboard with native filters loads, the filter bar publishes its data
 * mask to the backend `filter_state` key-value store and stamps the returned
 * key into the URL as `native_filters_key`. The original suite only sniffed the
 * URL (the key is a string; it differs across visits). That is genuinely a
 * full-stack behaviour — the key is minted by a real server round-trip and
 * persisted server-side — so it is migrated here, but strengthened to assert the
 * round-trip rather than just the URL shape:
 *
 *   1. A POST /api/v1/dashboard/<id>/filter_state mints the key, and that key is
 *      what lands in the URL.
 *   2. The key resolves server-side: GET /api/v1/dashboard/<id>/filter_state/<key>
 *      returns the stored data mask (200). A client-only token would not resolve.
 *   3. Reloading reuses the same resolvable key for the session/tab.
 *
 * The original suite's second case ("should have different key when page
 * reloads") was non-functional: it compared `native_filters_key` against an
 * `initialFilterKey` variable that was declared but never assigned, so it
 * asserted against `undefined` and passed vacuously. The real backend contract
 * is the opposite — CreateFilterStateCommand reuses the existing key for a given
 * (session, tab, dashboard) via a contextual cache — so this migration asserts
 * the true behaviour (reuse) instead of the bug it inherited.
 *
 * The dashboard is built hermetically (one native filter + one chart on
 * birth_names), replacing the original's dependency on the seeded world_health
 * dashboard (whose example charts are flaky under load).
 *
 * CI green => the filter bar minted a persisted, server-resolvable key and
 *             reloading reused that same resolvable key.
 * CI red   => no key was published, or the key did not resolve server-side.
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPost, apiPut } from '../../helpers/api/requests';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { TIMEOUT } from '../../utils/constants';
import { DashboardPage } from '../../pages/DashboardPage';

const DATASET_NAME = 'birth_names';
const FILTER_COLUMN = 'gender';

testWithAssets(
  'native filter bar mints a persisted, server-resolvable filter_state key and reuses it on reload',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) {
      throw new Error(`Dataset ${DATASET_NAME} not found`);
    }
    const datasetId = dataset.id;

    // A single chart for the native filter to target.
    const chartParams = {
      datasource: `${datasetId}__table`,
      viz_type: 'big_number_total',
      metric: 'count',
      adhoc_filters: [],
    };
    const chartResp = await apiPost(page, 'api/v1/chart/', {
      slice_name: `nf_key_${Date.now()}`,
      viz_type: 'big_number_total',
      datasource_id: datasetId,
      datasource_type: 'table',
      params: JSON.stringify(chartParams),
    });
    expect(chartResp.ok()).toBe(true);
    const chart = await chartResp.json();
    const chartId: number = chart.id ?? chart.result?.id;
    testAssets.trackChart(chartId);

    const filterId = `NATIVE_FILTER-${Math.random().toString(36).slice(2, 10)}`;
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
        meta: { chartId, width: 6, height: 50, sliceName: 'nf_key' },
      },
    };

    const jsonMetadata = {
      native_filter_configuration: [
        {
          id: filterId,
          name: 'Gender',
          filterType: 'filter_select',
          type: 'NATIVE_FILTER',
          targets: [{ datasetId, column: { name: FILTER_COLUMN } }],
          controlValues: {
            multiSelect: false,
            enableEmptyFilter: false,
            defaultToFirstItem: false,
            inverseSelection: false,
            searchAllOptions: false,
          },
          defaultDataMask: { filterState: {}, extraFormData: {} },
          cascadeParentIds: [],
          scope: { rootPath: ['ROOT_ID'], excluded: [] },
          chartsInScope: [chartId],
        },
      ],
      chart_configuration: {},
      cross_filters_enabled: false,
      global_chart_configuration: {
        scope: { rootPath: ['ROOT_ID'], excluded: [] },
        chartsInScope: [chartId],
      },
    };

    const dashResp = await apiPostDashboard(page, {
      dashboard_title: `nf_key_${Date.now()}`,
      published: true,
      position_json: JSON.stringify(positionJson),
      json_metadata: JSON.stringify(jsonMetadata),
    });
    expect(dashResp.ok()).toBe(true);
    const dashBody = await dashResp.json();
    const dashboardId: number = dashBody.result?.id ?? dashBody.id;
    testAssets.trackDashboard(dashboardId);

    const linkResp = await apiPut(page, `api/v1/chart/${chartId}`, {
      dashboards: [dashboardId],
    });
    expect(linkResp.ok()).toBe(true);

    const dashboard = new DashboardPage(page);

    // Confirm the key resolves to a stored data mask via the backend
    // filter_state GET endpoint — proving it is a real server-side entry, not a
    // client token. A client-only token would not resolve.
    const assertKeyResolves = async (key: string) => {
      const stateResp = await page.request.get(
        `api/v1/dashboard/${dashboardId}/filter_state/${key}`,
      );
      expect(
        stateResp.status(),
        `filter_state key ${key} should resolve server-side`,
      ).toBe(200);
      const stateBody = await stateResp.json();
      // The stored value is the serialized data mask (valid JSON).
      expect(
        () => JSON.parse(stateBody.value),
        `filter_state key ${key} should carry a stored data mask`,
      ).not.toThrow();
    };

    // The filter bar mints the key via a POST to filter_state on load.
    let createPosted = false;
    page.on('response', response => {
      const req = response.request();
      if (
        req.method() === 'POST' &&
        /\/api\/v1\/dashboard\/\d+\/filter_state(\?|$)/.test(response.url())
      ) {
        createPosted = true;
      }
    });

    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();
    const firstKey = await dashboard.waitForNativeFiltersKey();

    expect(firstKey).toEqual(expect.any(String));
    expect(firstKey.length).toBeGreaterThan(0);
    // The key was minted by a real create round-trip, not invented client-side.
    expect(
      createPosted,
      'a POST to filter_state should mint the key on load',
    ).toBe(true);
    await assertKeyResolves(firstKey);

    // Reload: the backend reuses the existing key for this (session, tab,
    // dashboard), and it still resolves server-side.
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();
    const reloadKey = await dashboard.waitForNativeFiltersKey();
    expect(
      reloadKey,
      'reloading should reuse the same filter_state key for the session/tab',
    ).toEqual(firstKey);
    await assertKeyResolves(reloadKey);
  },
);
