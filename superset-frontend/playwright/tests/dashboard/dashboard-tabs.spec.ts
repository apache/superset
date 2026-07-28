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
 * E2E migration of the Cypress "Dashboard tabs" suite (dashboard/tabs.test.ts).
 *
 * Only one of the three original cases is a genuine end-to-end behaviour:
 * "should update size when switch tab". A chart living in an inactive (hidden)
 * tab must re-measure and refit its container when the tab is revealed after the
 * available width has changed — a real browser layout-reflow that can only be
 * exercised against a rendered chart in a real dashboard. The other two cases
 * ("should switch tabs" asserted only the `ant-tabs-tab-active` CSS class, and
 * "should send new queries when tab becomes visible" was already skipped) are
 * DOM/state assertions with no backend invariant and belong in component/RTL
 * coverage, so they are intentionally not migrated here.
 *
 * The original relied on a seeded tabbed dashboard and expanded the native
 * filter bar to change the available width. This migration builds the dashboard
 * hermetically (two top-level tabs, a width-sensitive treemap in the first) and
 * shrinks the viewport while the treemap is hidden — the equivalent width change,
 * with no dependency on seeded data.
 *
 * CI green => the treemap reflowed to the narrower width and fit its container
 *             (no horizontal overflow) after the tab switch.
 * CI red   => the chart kept a stale size and overflowed its container, or the
 *             width never changed (the reflow was never exercised).
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPost, apiPut } from '../../helpers/api/requests';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { TIMEOUT } from '../../utils/constants';
import { DashboardPage } from '../../pages/DashboardPage';

const DATASET_NAME = 'birth_names';
const WIDE_VIEWPORT = { width: 1400, height: 900 };
const NARROW_VIEWPORT = { width: 700, height: 900 };

testWithAssets(
  'chart in a hidden tab refits its container after the tab is revealed at a new width',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) {
      throw new Error(`Dataset ${DATASET_NAME} not found`);
    }
    const datasetId = dataset.id;
    const datasource = `${datasetId}__table`;

    // Tab A holds a width-sensitive treemap (echarts sizes it to fill the
    // container); Tab B holds a table so the second tab has real content.
    const chartSpecs = [
      {
        slug: 'treemap',
        params: {
          datasource,
          viz_type: 'treemap_v2',
          metric: 'count',
          groupby: ['gender'],
          row_limit: 100,
        },
      },
      {
        slug: 'table',
        params: {
          datasource,
          viz_type: 'table',
          query_mode: 'aggregate',
          groupby: ['name'],
          metrics: ['count'],
          row_limit: 100,
        },
      },
    ];

    const chartIds: Record<string, number> = {};
    for (const { slug, params } of chartSpecs) {
      const resp = await apiPost(page, 'api/v1/chart/', {
        slice_name: `tabs_${slug}_${Date.now()}`,
        viz_type: params.viz_type,
        datasource_id: datasetId,
        datasource_type: 'table',
        params: JSON.stringify(params),
      });
      expect(resp.ok()).toBe(true);
      const body = await resp.json();
      const chartId: number = body.id ?? body.result?.id;
      testAssets.trackChart(chartId);
      chartIds[slug] = chartId;
    }

    const treemapKey = `CHART-${chartIds.treemap}`;
    const tableKey = `CHART-${chartIds.table}`;

    // Top-level tabs live inside GRID_ID: ROOT -> GRID -> TABS -> TAB -> ROW -> CHART.
    const positionJson: Record<string, unknown> = {
      DASHBOARD_VERSION_KEY: 'v2',
      ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: ['GRID_ID'] },
      GRID_ID: {
        type: 'GRID',
        id: 'GRID_ID',
        children: ['TABS-TOP'],
        parents: ['ROOT_ID'],
      },
      'TABS-TOP': {
        type: 'TABS',
        id: 'TABS-TOP',
        children: ['TAB-A', 'TAB-B'],
        parents: ['ROOT_ID', 'GRID_ID'],
        meta: {},
      },
      'TAB-A': {
        type: 'TAB',
        id: 'TAB-A',
        children: ['ROW-A'],
        parents: ['ROOT_ID', 'GRID_ID', 'TABS-TOP'],
        meta: {
          text: 'Tab A',
          defaultText: 'Tab title',
          placeholder: 'Tab title',
        },
      },
      'TAB-B': {
        type: 'TAB',
        id: 'TAB-B',
        children: ['ROW-B'],
        parents: ['ROOT_ID', 'GRID_ID', 'TABS-TOP'],
        meta: {
          text: 'Tab B',
          defaultText: 'Tab title',
          placeholder: 'Tab title',
        },
      },
      'ROW-A': {
        type: 'ROW',
        id: 'ROW-A',
        children: [treemapKey],
        parents: ['ROOT_ID', 'GRID_ID', 'TABS-TOP', 'TAB-A'],
        meta: { background: 'BACKGROUND_TRANSPARENT' },
      },
      'ROW-B': {
        type: 'ROW',
        id: 'ROW-B',
        children: [tableKey],
        parents: ['ROOT_ID', 'GRID_ID', 'TABS-TOP', 'TAB-B'],
        meta: { background: 'BACKGROUND_TRANSPARENT' },
      },
      [treemapKey]: {
        type: 'CHART',
        id: treemapKey,
        children: [],
        parents: ['ROOT_ID', 'GRID_ID', 'TABS-TOP', 'TAB-A', 'ROW-A'],
        meta: {
          chartId: chartIds.treemap,
          width: 12,
          height: 50,
          sliceName: 'treemap',
        },
      },
      [tableKey]: {
        type: 'CHART',
        id: tableKey,
        children: [],
        parents: ['ROOT_ID', 'GRID_ID', 'TABS-TOP', 'TAB-B', 'ROW-B'],
        meta: {
          chartId: chartIds.table,
          width: 12,
          height: 50,
          sliceName: 'table',
        },
      },
    };

    const dashResp = await apiPostDashboard(page, {
      dashboard_title: `tabs_resize_${Date.now()}`,
      published: true,
      position_json: JSON.stringify(positionJson),
    });
    expect(dashResp.ok()).toBe(true);
    const dashBody = await dashResp.json();
    const dashboardId: number = dashBody.result?.id ?? dashBody.id;
    testAssets.trackDashboard(dashboardId);

    for (const chartId of Object.values(chartIds)) {
      await apiPut(page, `api/v1/chart/${chartId}`, {
        dashboards: [dashboardId],
      });
    }

    // Render the treemap at the wide viewport first so its initial layout (which
    // we measure against) is computed at the wide width.
    await page.setViewportSize(WIDE_VIEWPORT);

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();

    // Tab A is active on load; wait for its treemap to finish rendering.
    const treemapContainer = page
      .locator('[data-test-viz-type="treemap_v2"]')
      .locator('[data-test="chart-container"]');
    await treemapContainer.waitFor({
      state: 'visible',
      timeout: TIMEOUT.API_RESPONSE,
    });
    await dashboard.waitForChartsToLoad();

    const widthsAtWide = await treemapContainer.evaluate((el: HTMLElement) => ({
      offsetWidth: el.offsetWidth,
      scrollWidth: el.scrollWidth,
    }));

    // Switch to Tab B (treemap becomes hidden), shrink the viewport so the
    // available width changes while the treemap is not visible, then return.
    await dashboard.switchToTopLevelTab(1);
    await page.setViewportSize(NARROW_VIEWPORT);
    await dashboard.switchToTopLevelTab(0);

    // Let the reveal settle, mirroring the original's fixed wait.
    await treemapContainer.waitFor({
      state: 'visible',
      timeout: TIMEOUT.API_RESPONSE,
    });
    await dashboard.waitForChartsToLoad();

    // 1) The container itself reflowed to the narrower viewport synchronously on
    //    reveal. Without this the fit assertion below could pass trivially (a
    //    chart that never resized still has scrollWidth === offsetWidth), so this
    //    guards against a false green where the reflow was never exercised.
    const offsetWidthAtNarrow = await treemapContainer.evaluate(
      (el: HTMLElement) => el.offsetWidth,
    );
    expect(
      offsetWidthAtNarrow,
      `treemap container should narrow after the viewport shrank ` +
        `(wide=${widthsAtWide.offsetWidth}, narrow=${offsetWidthAtNarrow})`,
    ).toBeLessThan(widthsAtWide.offsetWidth);

    // 2) Once revealed, the treemap refits its container: its rendered content
    //    fills exactly the available width with no horizontal overflow. The
    //    echarts canvas re-measures a beat after the tab becomes visible, so we
    //    poll until it fits. A genuine resize-on-reveal regression leaves the
    //    chart permanently overflowing (scrollWidth > offsetWidth) and this poll
    //    times out red; ordinary resize latency converges and it passes.
    await expect
      .poll(
        () =>
          treemapContainer.evaluate(
            (el: HTMLElement) => el.scrollWidth - el.offsetWidth,
          ),
        {
          timeout: TIMEOUT.API_RESPONSE,
          message:
            'treemap should refit its container (no horizontal overflow) after the tab switch',
        },
      )
      .toBe(0);
  },
);
