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
 * E2E coverage for dashboard native (dashboard-level) filters, migrated from
 * the deprecated Cypress `nativeFilters` specs.
 *
 * Scope: only behaviours that exercise a real backend round-trip are migrated
 * here — cascading option re-queries, default-to-first-item resolution, value
 * filters re-querying target charts, and default values persisting across a
 * reload. Filter dependencies are configured via the dashboard's
 * `native_filter_configuration` (the persisted `cascadeParentIds` field) so the
 * tests drive only the filter bar, not the deprecated native-filter edit modal.
 *
 * Two groups of Cypress cases are not migrated here (see the PR migration
 * ledger):
 *   - Config-modal mechanics (create/reorder filters, bi-directional dependency
 *     prevention, numerical range display modes, tooltips, undo/restore/cancel)
 *     assert client-side modal state with no backend round-trip and belong in
 *     the React Testing Library component suite.
 *   - Removal behaviours ("stop filtering when a filter is removed", "remove
 *     parent filters") do assert a backend round-trip, but their only trigger is
 *     deleting a filter through the deprecated config modal this migration
 *     avoids. They are a deliberate scope reduction, not relocated coverage.
 */

import type { Locator, Page } from '@playwright/test';
import { testWithAssets, expect } from '../../helpers/fixtures';
import { TIMEOUT } from '../../utils/constants';
import { DashboardPage } from '../../pages/DashboardPage';
import {
  buildFilterJsonMetadata,
  buildSelectFilter,
  createDashboardWithCharts,
  sliceIdFromChartDataUrl,
} from './dashboard-test-helpers';

const DATASET_NAME = 'wb_health_population';
const REGION_COLUMN = 'region';
const COUNTRY_COLUMN = 'country_name';
const COUNTRY_CODE_COLUMN = 'country_code';

// Verified narrowing relation against wb_health_population: selecting the
// "North America" region scopes country_name to exactly these three values.
const NORTH_AMERICA = 'North America';
const NORTH_AMERICA_COUNTRIES = ['Bermuda', 'Canada', 'United States'];

/**
 * Waits for the chart-data POST issued for a specific chart, identified by
 * slice id. A native filter's own options request hits the same
 * `/api/v1/chart/data` endpoint, so a plain `waitForPost(page,
 * '/api/v1/chart/data')` can resolve on the filter's request instead of the
 * target chart's — scoping to the chart's slice id makes the wait
 * deterministic.
 */
function waitForChartDataResponse(page: Page, sliceId: number) {
  return page.waitForResponse(
    response =>
      response.request().method() === 'POST' &&
      response.url().includes('/api/v1/chart/data') &&
      sliceIdFromChartDataUrl(response.url()) === sliceId,
  );
}

/**
 * The value a big-number chart is showing, parsed from its rendered header.
 * Resolves to NaN while nothing numeric is rendered (e.g. mid re-render) so
 * numeric matchers keep polling instead of passing on an empty string.
 */
async function readRenderedNumber(header: Locator): Promise<number> {
  const digits = (await header.allTextContents()).join('').replace(/\D/g, '');
  return digits ? Number(digits) : NaN;
}

testWithAssets(
  'dependent filter narrows its options to the selected parent',
  async ({ page, testAssets }, testInfo) => {
    const { dashboardId } = await createDashboardWithCharts(
      page,
      testAssets,
      testInfo,
      {
        datasetName: DATASET_NAME,
        chartNamePrefix: 'native_filters',
        dashboardTitlePrefix: 'native_filters',
        chartSpecs: [
          {
            viz_type: 'table',
            params: {
              query_mode: 'raw',
              all_columns: [COUNTRY_COLUMN, REGION_COLUMN],
              row_limit: 1000,
            },
          },
        ],
        buildJsonMetadata: ({ charts, datasetId }) => {
          const chartsInScope = charts.map(chart => chart.id);
          const region = buildSelectFilter({
            datasetId,
            column: REGION_COLUMN,
            chartsInScope,
            name: 'Region',
          });
          const country = buildSelectFilter({
            datasetId,
            column: COUNTRY_COLUMN,
            chartsInScope,
            name: 'Country',
            cascadeParentIds: [region.id],
          });
          return buildFilterJsonMetadata({
            chartsInScope,
            nativeFilters: [region, country],
          });
        },
      },
    );

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();
    const filterBar = await dashboardPage.waitForFilterBar();

    await filterBar.selectOption(NORTH_AMERICA, 0);
    await filterBar.apply();
    await dashboardPage.waitForChartsToLoad();

    // Opening the child filter must show only the parent-scoped countries.
    const countrySelect = filterBar.getFilterSelect(1);
    await countrySelect.open();
    const optionTexts = await countrySelect.getVisibleOptionTexts();
    await countrySelect.close();
    expect(new Set(optionTexts)).toEqual(new Set(NORTH_AMERICA_COUNTRIES));
  },
);

testWithAssets(
  'dependent filter auto-selects the first item when its parent changes',
  async ({ page, testAssets }, testInfo) => {
    const { dashboardId } = await createDashboardWithCharts(
      page,
      testAssets,
      testInfo,
      {
        datasetName: DATASET_NAME,
        chartNamePrefix: 'native_filters',
        dashboardTitlePrefix: 'native_filters',
        chartSpecs: [
          {
            viz_type: 'table',
            params: {
              query_mode: 'raw',
              all_columns: [COUNTRY_COLUMN, REGION_COLUMN],
              row_limit: 1000,
            },
          },
        ],
        buildJsonMetadata: ({ charts, datasetId }) => {
          const chartsInScope = charts.map(chart => chart.id);
          const region = buildSelectFilter({
            datasetId,
            column: REGION_COLUMN,
            chartsInScope,
            name: 'Region',
          });
          const country = buildSelectFilter({
            datasetId,
            column: COUNTRY_COLUMN,
            chartsInScope,
            name: 'Country',
            cascadeParentIds: [region.id],
            defaultToFirstItem: true,
          });
          return buildFilterJsonMetadata({
            chartsInScope,
            nativeFilters: [region, country],
          });
        },
      },
    );

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();
    const filterBar = await dashboardPage.waitForFilterBar();

    await filterBar.selectOption(NORTH_AMERICA, 0);
    await filterBar.apply();
    await dashboardPage.waitForChartsToLoad();

    // The dependent country filter resolves to the first scoped option.
    await expect(filterBar.getValueLocator(1)).toContainText(
      NORTH_AMERICA_COUNTRIES[0],
    );
  },
);

testWithAssets(
  'filter depending on two parents narrows by both selections',
  async ({ page, testAssets }, testInfo) => {
    const { dashboardId } = await createDashboardWithCharts(
      page,
      testAssets,
      testInfo,
      {
        datasetName: DATASET_NAME,
        chartNamePrefix: 'native_filters',
        dashboardTitlePrefix: 'native_filters',
        chartSpecs: [
          {
            viz_type: 'table',
            params: {
              query_mode: 'raw',
              all_columns: [COUNTRY_CODE_COLUMN, COUNTRY_COLUMN, REGION_COLUMN],
              row_limit: 1000,
            },
          },
        ],
        buildJsonMetadata: ({ charts, datasetId }) => {
          const chartsInScope = charts.map(chart => chart.id);
          const region = buildSelectFilter({
            datasetId,
            column: REGION_COLUMN,
            chartsInScope,
            name: 'Region',
          });
          const country = buildSelectFilter({
            datasetId,
            column: COUNTRY_COLUMN,
            chartsInScope,
            name: 'Country',
            cascadeParentIds: [region.id],
          });
          const code = buildSelectFilter({
            datasetId,
            column: COUNTRY_CODE_COLUMN,
            chartsInScope,
            name: 'Country Code',
            cascadeParentIds: [region.id, country.id],
          });
          return buildFilterJsonMetadata({
            chartsInScope,
            nativeFilters: [region, country, code],
          });
        },
      },
    );

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();
    const filterBar = await dashboardPage.waitForFilterBar();

    // With only the region chosen, the country-code filter spans every North
    // America country code.
    await filterBar.selectOption(NORTH_AMERICA, 0);
    await filterBar.apply();
    await dashboardPage.waitForChartsToLoad();

    const codeSelect = filterBar.getFilterSelect(2);
    await codeSelect.open();
    const regionScopedCodes = await codeSelect.getVisibleOptionTexts();
    await codeSelect.close();
    // 3 North America countries => 3 country codes.
    expect(regionScopedCodes).toHaveLength(NORTH_AMERICA_COUNTRIES.length);

    // Adding a country selection narrows the country-code filter further.
    await filterBar.selectOption('Canada', 1);
    await filterBar.apply();
    await dashboardPage.waitForChartsToLoad();

    await codeSelect.open();
    const countryScopedCodes = await codeSelect.getVisibleOptionTexts();
    await codeSelect.close();
    expect(countryScopedCodes.length).toBeLessThan(regionScopedCodes.length);
    expect(countryScopedCodes).toHaveLength(1);
  },
);

testWithAssets(
  'applying a value filter re-queries the target chart',
  async ({ page, testAssets }, testInfo) => {
    const { dashboardId, charts } = await createDashboardWithCharts(
      page,
      testAssets,
      testInfo,
      {
        datasetName: DATASET_NAME,
        chartNamePrefix: 'native_filters',
        dashboardTitlePrefix: 'native_filters',
        chartSpecs: [
          {
            viz_type: 'big_number_total',
            // Plain integer format so the rendered total parses back exactly
            // (the SMART_NUMBER default abbreviates, e.g. "11.3k").
            params: { metric: 'count', adhoc_filters: [], y_axis_format: ',d' },
          },
        ],
        buildJsonMetadata: ({ charts: metadataCharts, datasetId }) => {
          const chartsInScope = metadataCharts.map(chart => chart.id);
          const region = buildSelectFilter({
            datasetId,
            column: REGION_COLUMN,
            chartsInScope,
            name: 'Region',
          });
          return buildFilterJsonMetadata({
            chartsInScope,
            nativeFilters: [region],
          });
        },
      },
    );
    const targetChartId = charts[0].id;

    const dashboardPage = new DashboardPage(page);
    const renderedTotal = dashboardPage
      .getChart(targetChartId)
      .locator('.superset-legacy-chart-big-number .header-line');

    // Wait for the target chart's initial chart-data POST, then read the total
    // off the rendered big number rather than the response body. The body only
    // carries `result[0].data` on a synchronous 200; with GLOBAL_ASYNC_QUERIES
    // enabled a cold-cache query answers 202 with a job payload and the data
    // arrives out of band, so the rendered value is what proves the data
    // landed in either mode (same 200/202 handling as dashboard-load.spec.ts).
    // Scoped to the target chart's slice id: the Region filter's own options
    // request fires on the same `gotoById` load and hits the same endpoint.
    const initialDataPromise = waitForChartDataResponse(page, targetChartId);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    expect([200, 202]).toContain((await initialDataPromise).status());
    await expect(renderedTotal).toHaveText(/\d/, {
      timeout: TIMEOUT.CHART_RENDER,
    });
    const totalCount = await readRenderedNumber(renderedTotal);
    expect(totalCount).toBeGreaterThan(0);

    // Apply the region filter and capture the re-queried total.
    const filterBar = await dashboardPage.waitForFilterBar();
    await filterBar.selectOption(NORTH_AMERICA, 0);

    const filteredDataPromise = waitForChartDataResponse(page, targetChartId);
    await filterBar.apply();
    expect([200, 202]).toContain((await filteredDataPromise).status());

    // The filter round-tripped to the backend: North America is a strict subset.
    // Polled because the chart keeps showing the previous total until the
    // re-queried data renders.
    await expect
      .poll(() => readRenderedNumber(renderedTotal), {
        timeout: TIMEOUT.CHART_RENDER,
        message: 'filtered big number should render a smaller total',
      })
      .toBeLessThan(totalCount);
    expect(await readRenderedNumber(renderedTotal)).toBeGreaterThan(0);
  },
);

testWithAssets(
  'default filter value is respected after a reload',
  async ({ page, testAssets }, testInfo) => {
    const { dashboardId } = await createDashboardWithCharts(
      page,
      testAssets,
      testInfo,
      {
        datasetName: DATASET_NAME,
        chartNamePrefix: 'native_filters',
        dashboardTitlePrefix: 'native_filters',
        chartSpecs: [
          {
            viz_type: 'table',
            params: {
              query_mode: 'raw',
              all_columns: [COUNTRY_COLUMN, REGION_COLUMN],
              row_limit: 1000,
            },
          },
        ],
        buildJsonMetadata: ({ charts, datasetId }) => {
          const chartsInScope = charts.map(chart => chart.id);
          const region = buildSelectFilter({
            datasetId,
            column: REGION_COLUMN,
            chartsInScope,
            name: 'Region',
            defaultValue: NORTH_AMERICA,
          });
          return buildFilterJsonMetadata({
            chartsInScope,
            nativeFilters: [region],
          });
        },
      },
    );

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();
    const filterBar = await dashboardPage.waitForFilterBar();

    // The default value pre-populates the filter bar.
    await expect(filterBar.getValueLocator(0)).toContainText(NORTH_AMERICA);

    // Only North America rows render in the target chart.
    const chart = page.locator('[data-test="grid-content"]');
    await expect(chart).toContainText(NORTH_AMERICA);
    await expect(chart).not.toContainText('South America');

    // The default survives a full reload (re-applied from json_metadata).
    await page.reload();
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();
    await expect(filterBar.getValueLocator(0)).toContainText(NORTH_AMERICA);
    await expect(chart).not.toContainText('South America');
  },
);
