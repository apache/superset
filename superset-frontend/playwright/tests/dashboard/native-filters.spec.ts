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

import type { Page } from '@playwright/test';
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPost, apiPut } from '../../helpers/api/requests';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { DashboardPage } from '../../pages/DashboardPage';
import { Button, Select } from '../../components/core';

const DATASET_NAME = 'wb_health_population';
const REGION_COLUMN = 'region';
const COUNTRY_COLUMN = 'country_name';
const COUNTRY_CODE_COLUMN = 'country_code';

// Verified narrowing relation against wb_health_population: selecting the
// "North America" region scopes country_name to exactly these three values.
const NORTH_AMERICA = 'North America';
const NORTH_AMERICA_COUNTRIES = ['Bermuda', 'Canada', 'United States'];

interface FilterConfig {
  id: string;
  name: string;
  column: string;
  cascadeParentIds?: string[];
  defaultToFirstItem?: boolean;
  defaultValue?: string;
}

async function findDatasetIdByName(page: Page, name: string): Promise<number> {
  const rison = `(filters:!((col:table_name,opr:eq,value:'${name}')))`;
  const resp = await page.request.get(`api/v1/dataset/?q=${rison}`);
  const body = await resp.json();
  if (!body.result?.length) {
    throw new Error(`Dataset ${name} not found`);
  }
  return body.result[0].id;
}

function nativeFilterId(): string {
  return `NATIVE_FILTER-${Math.random().toString(36).slice(2, 10)}`;
}

function buildFilter(datasetId: number, config: FilterConfig) {
  const filterState = config.defaultValue
    ? { value: [config.defaultValue] }
    : {};
  const extraFormData = config.defaultValue
    ? {
        filters: [
          {
            col: config.column,
            op: 'IN',
            val: [config.defaultValue],
          },
        ],
      }
    : {};
  return {
    id: config.id,
    name: config.name,
    filterType: 'filter_select',
    type: 'NATIVE_FILTER',
    targets: [{ datasetId, column: { name: config.column } }],
    controlValues: {
      multiSelect: false,
      enableEmptyFilter: false,
      defaultToFirstItem: config.defaultToFirstItem ?? false,
      inverseSelection: false,
      searchAllOptions: false,
    },
    defaultDataMask: { filterState, extraFormData },
    cascadeParentIds: config.cascadeParentIds ?? [],
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    chartsInScope: [],
  };
}

interface BuiltDashboard {
  dashboardId: number;
  chartId: number;
}

/**
 * Create a single-chart dashboard on the cascade dataset with the given native
 * filters, link the chart, and return the ids. The chart is a raw table over
 * the supplied columns so filtered rows are directly observable.
 */
async function buildFilterDashboard(
  page: Page,
  testAssets: { trackChart: (id: number) => void; trackDashboard: (id: number) => void },
  options: {
    datasetId: number;
    filters: FilterConfig[];
    chartColumns?: string[];
    viz?: 'table' | 'big_number_total';
  },
): Promise<BuiltDashboard> {
  const { datasetId, filters } = options;
  const viz = options.viz ?? 'table';
  const chartColumns = options.chartColumns ?? [COUNTRY_COLUMN, REGION_COLUMN];

  const chartParams =
    viz === 'big_number_total'
      ? {
          datasource: `${datasetId}__table`,
          viz_type: 'big_number_total',
          metric: 'count',
          adhoc_filters: [],
        }
      : {
          datasource: `${datasetId}__table`,
          viz_type: 'table',
          query_mode: 'raw',
          all_columns: chartColumns,
          row_limit: 1000,
        };

  const chartResp = await apiPost(page, 'api/v1/chart/', {
    slice_name: `native_filters_${Date.now()}`,
    viz_type: viz,
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
      meta: { chartId, width: 8, height: 50, sliceName: 'native_filters' },
    },
  };

  const nativeFilters = filters.map(f => ({
    ...buildFilter(datasetId, f),
    chartsInScope: [chartId],
  }));

  const jsonMetadata = {
    native_filter_configuration: nativeFilters,
    chart_configuration: {},
    cross_filters_enabled: false,
    global_chart_configuration: {
      scope: { rootPath: ['ROOT_ID'], excluded: [] },
      chartsInScope: [chartId],
    },
  };

  const dashResp = await apiPostDashboard(page, {
    dashboard_title: `native_filters_${Date.now()}`,
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

  return { dashboardId, chartId };
}

/** Select component wrapping the Nth native filter (0-based) in the filter bar. */
function filterSelect(page: Page, index: number): Select {
  return new Select(
    page,
    page.locator('[data-test="form-item-value"]').nth(index),
  );
}

/**
 * Options inside the currently-open antd select dropdown, as a read-only
 * locator. The Select component drives interactions (open/select); this is used
 * only to assert on the visible option set, which Select does not expose.
 */
function openDropdownOptions(page: Page) {
  return page.locator(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content',
  );
}

/** Apply button in the filter bar. */
function applyButton(page: Page): Button {
  return new Button(
    page,
    page
      .locator(
        '[data-test="filter-bar__apply-button"], [data-test="filterbar-action-buttons"] button[type="submit"]',
      )
      .first(),
  );
}

testWithAssets(
  'dependent filter narrows its options to the selected parent',
  async ({ page, testAssets }) => {
    const datasetId = await findDatasetIdByName(page, DATASET_NAME);
    const parentId = nativeFilterId();
    const childId = nativeFilterId();
    const { dashboardId } = await buildFilterDashboard(page, testAssets, {
      datasetId,
      filters: [
        { id: parentId, name: 'Region', column: REGION_COLUMN },
        {
          id: childId,
          name: 'Country',
          column: COUNTRY_COLUMN,
          cascadeParentIds: [parentId],
        },
      ],
    });

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();

    // Select the North America region in the parent filter.
    const regionFilter = filterSelect(page, 0);
    await regionFilter.open();
    await regionFilter.clickOption(NORTH_AMERICA);
    await regionFilter.close();
    await applyButton(page).click();
    await dashboardPage.waitForChartsToLoad();

    // Opening the child filter must show only the parent-scoped countries.
    await filterSelect(page, 1).open();
    await expect(openDropdownOptions(page).first()).toBeVisible();
    const optionTexts = (
      await openDropdownOptions(page).allTextContents()
    ).map(t => t.trim());
    expect(new Set(optionTexts)).toEqual(new Set(NORTH_AMERICA_COUNTRIES));
  },
);

testWithAssets(
  'dependent filter auto-selects the first item when its parent changes',
  async ({ page, testAssets }) => {
    const datasetId = await findDatasetIdByName(page, DATASET_NAME);
    const parentId = nativeFilterId();
    const childId = nativeFilterId();
    const { dashboardId } = await buildFilterDashboard(page, testAssets, {
      datasetId,
      filters: [
        { id: parentId, name: 'Region', column: REGION_COLUMN },
        {
          id: childId,
          name: 'Country',
          column: COUNTRY_COLUMN,
          cascadeParentIds: [parentId],
          defaultToFirstItem: true,
        },
      ],
    });

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();

    const regionFilter = filterSelect(page, 0);
    await regionFilter.open();
    await regionFilter.clickOption(NORTH_AMERICA);
    await regionFilter.close();
    await applyButton(page).click();
    await dashboardPage.waitForChartsToLoad();

    // The dependent country filter resolves to the first scoped option.
    await expect(
      page.locator('[data-test="form-item-value"]').nth(1),
    ).toContainText(NORTH_AMERICA_COUNTRIES[0]);
  },
);

testWithAssets(
  'filter depending on two parents narrows by both selections',
  async ({ page, testAssets }) => {
    const datasetId = await findDatasetIdByName(page, DATASET_NAME);
    const regionId = nativeFilterId();
    const countryId = nativeFilterId();
    const codeId = nativeFilterId();
    const { dashboardId } = await buildFilterDashboard(page, testAssets, {
      datasetId,
      chartColumns: [COUNTRY_CODE_COLUMN, COUNTRY_COLUMN, REGION_COLUMN],
      filters: [
        { id: regionId, name: 'Region', column: REGION_COLUMN },
        {
          id: countryId,
          name: 'Country',
          column: COUNTRY_COLUMN,
          cascadeParentIds: [regionId],
        },
        {
          id: codeId,
          name: 'Country Code',
          column: COUNTRY_CODE_COLUMN,
          cascadeParentIds: [regionId, countryId],
        },
      ],
    });

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();

    // With only the region chosen, the country-code filter spans every North
    // America country code.
    const regionFilter = filterSelect(page, 0);
    await regionFilter.open();
    await regionFilter.clickOption(NORTH_AMERICA);
    await regionFilter.close();
    await applyButton(page).click();
    await dashboardPage.waitForChartsToLoad();

    await filterSelect(page, 2).open();
    await expect(openDropdownOptions(page).first()).toBeVisible();
    const regionScopedCodes = (
      await openDropdownOptions(page).allTextContents()
    ).map(t => t.trim());
    // 3 North America countries => 3 country codes.
    expect(regionScopedCodes).toHaveLength(NORTH_AMERICA_COUNTRIES.length);
    await page.keyboard.press('Escape');

    // Adding a country selection narrows the country-code filter further.
    const countryFilter = filterSelect(page, 1);
    await countryFilter.open();
    await countryFilter.clickOption('Canada');
    await countryFilter.close();
    await applyButton(page).click();
    await dashboardPage.waitForChartsToLoad();

    await filterSelect(page, 2).open();
    await expect(openDropdownOptions(page).first()).toBeVisible();
    const countryScopedCodes = (
      await openDropdownOptions(page).allTextContents()
    ).map(t => t.trim());
    expect(countryScopedCodes.length).toBeLessThan(regionScopedCodes.length);
    expect(countryScopedCodes).toHaveLength(1);
  },
);

testWithAssets(
  'applying a value filter re-queries the target chart',
  async ({ page, testAssets }) => {
    const datasetId = await findDatasetIdByName(page, DATASET_NAME);
    const regionId = nativeFilterId();
    const { dashboardId } = await buildFilterDashboard(page, testAssets, {
      datasetId,
      viz: 'big_number_total',
      filters: [{ id: regionId, name: 'Region', column: REGION_COLUMN }],
    });

    const dashboardPage = new DashboardPage(page);

    // Capture the unfiltered total from the initial chart data response.
    const initialDataPromise = page.waitForResponse(
      r =>
        r.url().includes('/api/v1/chart/data') &&
        r.request().method() === 'POST',
    );
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    const initialData = await (await initialDataPromise).json();
    const totalCount = Object.values(initialData.result[0].data[0])[0] as number;
    expect(totalCount).toBeGreaterThan(0);

    // Apply the region filter and capture the re-queried total.
    const regionFilter = filterSelect(page, 0);
    await regionFilter.open();
    await regionFilter.clickOption(NORTH_AMERICA);
    await regionFilter.close();

    const filteredDataPromise = page.waitForResponse(
      r =>
        r.url().includes('/api/v1/chart/data') &&
        r.request().method() === 'POST',
    );
    await applyButton(page).click();
    const filteredData = await (await filteredDataPromise).json();
    const filteredCount = Object.values(
      filteredData.result[0].data[0],
    )[0] as number;

    // The filter round-tripped to the backend: North America is a strict subset.
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(totalCount);
  },
);

testWithAssets(
  'default filter value is respected after a reload',
  async ({ page, testAssets }) => {
    const datasetId = await findDatasetIdByName(page, DATASET_NAME);
    const regionId = nativeFilterId();
    const { dashboardId } = await buildFilterDashboard(page, testAssets, {
      datasetId,
      filters: [
        {
          id: regionId,
          name: 'Region',
          column: REGION_COLUMN,
          defaultValue: NORTH_AMERICA,
        },
      ],
    });

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.gotoById(dashboardId);
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();

    // The default value pre-populates the filter bar.
    await expect(
      page.locator('[data-test="form-item-value"]').first(),
    ).toContainText(NORTH_AMERICA);

    // Only North America rows render in the target chart.
    const chart = page.locator('[data-test="grid-content"]');
    await expect(chart).toContainText(NORTH_AMERICA);
    await expect(chart).not.toContainText('South America');

    // The default survives a full reload (re-applied from json_metadata).
    await page.reload();
    await dashboardPage.waitForLoad();
    await dashboardPage.waitForChartsToLoad();
    await expect(
      page.locator('[data-test="form-item-value"]').first(),
    ).toContainText(NORTH_AMERICA);
    await expect(page.locator('[data-test="grid-content"]')).not.toContainText(
      'South America',
    );
  },
);
