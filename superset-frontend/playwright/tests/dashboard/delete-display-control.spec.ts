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
 * Regression test: a deleted Display Control (chart customization) must not
 * reappear after clicking "Apply Filters". Seeds a dashboard with a Gender
 * filter and a Time grain Display Control, deletes the control via the config
 * modal, then applies and asserts it stays gone.
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPost, apiPut } from '../../helpers/api/requests';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { DashboardPage } from '../../pages/DashboardPage';

// Record video regardless of pass/fail (before/after clips).
testWithAssets.use({ video: 'on' });

const DATASET_NAME = 'birth_names';
const FILTER_COLUMN = 'gender';
const TEMPORAL_COLUMN = 'ds';

testWithAssets(
  'Deleted Display Control must not reappear after Apply Filters',
  async ({ page, testAssets }, testInfo) => {
    testInfo.setTimeout(90000);
    const shot = (n: string) =>
      page.screenshot({
        path: testInfo.outputPath(`${n}.png`),
        fullPage: false,
      });

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) {
      throw new Error(`Dataset ${DATASET_NAME} not found`);
    }
    const datasetId = dataset.id;

    // 1. Seed a chart the filter + control can target.
    const chartParams = {
      datasource: `${datasetId}__table`,
      viz_type: 'big_number_total',
      metric: 'count',
      adhoc_filters: [],
      header_font_size: 0.4,
      subheader_font_size: 0.15,
    };
    const chartResp = await apiPost(page, 'api/v1/chart/', {
      slice_name: `display_control_repro_${Date.now()}`,
      viz_type: 'big_number_total',
      datasource_id: datasetId,
      datasource_type: 'table',
      params: JSON.stringify(chartParams),
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
        meta: {
          chartId,
          width: 6,
          height: 50,
          sliceName: 'display_control_repro',
        },
      },
    };

    // 2. json_metadata: one dashboard filter + one Display Control.
    const filterId = `NATIVE_FILTER-${Math.random().toString(36).slice(2, 10)}`;
    const customizationId = `CHART_CUSTOMIZATION-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

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
      chart_customization_config: [
        {
          id: customizationId,
          type: 'CHART_CUSTOMIZATION',
          name: 'Time grain',
          filterType: 'chart_customization_timegrain',
          description: '',
          targets: [{ datasetId, column: { name: TEMPORAL_COLUMN } }],
          scope: { rootPath: ['ROOT_ID'], excluded: [] },
          controlValues: {},
          defaultDataMask: { filterState: {}, extraFormData: {} },
          chartsInScope: [chartId],
          removed: false,
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
      dashboard_title: `display_control_repro_${Date.now()}`,
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

    // 3. Open the dashboard.
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad({ timeout: 30000 });
    await dashboardPage.waitForChartsToLoad({ timeout: 8000 }).catch(() => {});

    // Both the Gender filter and the Time grain Display Control should render.
    await expect(dashboardPage.getDisplayControlsHeader()).toBeVisible();
    await expect(dashboardPage.getDisplayControl('Time grain')).toBeVisible();
    // eslint-disable-next-line no-console
    console.log('STEP 1: Display control "Time grain" is present in the bar.');
    await shot('01-initial-bar');

    // 4. Open the filters config modal via the settings gear.
    const modal = await dashboardPage.openNativeFiltersConfigModal();
    await shot('02-modal-open');

    // 5. Delete the "Time grain" Display Control in the modal sidebar.
    await modal.removeDisplayControl('Time grain');
    await expect(modal.getRemovedMarker()).toBeVisible();
    // eslint-disable-next-line no-console
    console.log('STEP 2: Display control marked (Removed) in modal.');
    await shot('03-modal-removed');

    // 6. Save the modal.
    await modal.clickSave();
    await modal.waitForHidden({ timeout: 20000 });
    await dashboardPage.waitForChartsToLoad({ timeout: 8000 }).catch(() => {});
    await shot('04-after-save');

    const goneAfterSave = await dashboardPage
      .getDisplayControl('Time grain')
      .isVisible()
      .catch(() => false);
    // eslint-disable-next-line no-console
    console.log(
      `STEP 3: After save, "Time grain" visible in bar = ${goneAfterSave}`,
    );

    // 7. Click Apply Filters.
    await dashboardPage.applyFiltersIfEnabled();
    await dashboardPage.waitForChartsToLoad({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot('05-after-apply');

    const reappeared = await dashboardPage
      .getDisplayControl('Time grain')
      .isVisible()
      .catch(() => false);
    // eslint-disable-next-line no-console
    console.log(
      `STEP 4: After Apply Filters, "Time grain" reappeared = ${reappeared}`,
    );

    // The deleted Display Control must stay gone.
    await expect(
      dashboardPage.getDisplayControl('Time grain'),
      'Deleted Display Control must not reappear after Apply Filters',
    ).toHaveCount(0);
  },
);
