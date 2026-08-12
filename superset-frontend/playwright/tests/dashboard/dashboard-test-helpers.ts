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

import type { Locator, Page, TestInfo } from '@playwright/test';
import { expect, type TestAssets } from '../../helpers/fixtures';
import { apiPostChart, apiPutChart } from '../../helpers/api/chart';
import {
  apiPostDashboard,
  buildSingleRowDashboardLayout,
  type DashboardLayoutChart,
} from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import { DashboardPage } from '../../pages/DashboardPage';

/**
 * Extracts the chart id that a `/api/v1/chart/data` request was issued for.
 *
 * The chart-data POST carries its slice id in the encoded
 * `form_data={"slice_id":<id>}` query param (see `chartAction.ts`). Parsing it
 * lets a test tie each request back to a specific chart and assert that every
 * chart queried — rather than only counting requests, which cannot distinguish
 * "all charts queried once" from "one chart queried twice, another skipped".
 *
 * @param url - The chart-data request or response URL
 * @returns The slice id, or undefined if the URL carries no parsable one
 */
export function sliceIdFromChartDataUrl(url: string): number | undefined {
  const formData = new URL(url).searchParams.get('form_data');
  if (!formData) {
    return undefined;
  }
  try {
    const sliceId = JSON.parse(formData).slice_id;
    return typeof sliceId === 'number' ? sliceId : undefined;
  } catch {
    // Not a slice-id form_data payload.
    return undefined;
  }
}

interface TestDashboardResult {
  id: number;
  name: string;
}

interface CreateTestDashboardOptions {
  /** Prefix for generated name (default: 'test_dashboard') */
  prefix?: string;
  /** Publish the dashboard on creation (default: false, the API default) */
  published?: boolean;
}

/**
 * Creates a test dashboard via the API for E2E testing.
 *
 * @example
 * const { id, name } = await createTestDashboard(page, testAssets, test.info());
 *
 * @example
 * const { id, name } = await createTestDashboard(page, testAssets, test.info(), {
 *   prefix: 'test_delete',
 * });
 */
export async function createTestDashboard(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
  options?: CreateTestDashboardOptions,
): Promise<TestDashboardResult> {
  const prefix = options?.prefix ?? 'test_dashboard';
  const name = `${prefix}_${Date.now()}_${testInfo.parallelIndex}`;

  const response = await apiPostDashboard(page, {
    dashboard_title: name,
    // Serialized as JSON, which drops undefined — no need to omit the key.
    published: options?.published,
  });

  if (!response.ok()) {
    throw new Error(`Failed to create test dashboard: ${response.status()}`);
  }

  const body = await response.json();
  // Handle both response shapes: { id } or { result: { id } }
  const id = body.result?.id ?? body.id;
  if (!id) {
    throw new Error(
      `Dashboard creation returned no id. Response: ${JSON.stringify(body)}`,
    );
  }

  testAssets.trackDashboard(id);

  return { id, name };
}

/** Scope covering the whole dashboard — every filter built here is unscoped. */
const ROOT_SCOPE = { rootPath: ['ROOT_ID'], excluded: [] };

interface DataMask {
  filterState: Record<string, unknown>;
  extraFormData: Record<string, unknown>;
}

export interface NativeFilterConfig {
  id: string;
  name: string;
  filterType: string;
  type: string;
  targets: Array<{ datasetId: number; column: { name: string } }>;
  controlValues: Record<string, boolean>;
  defaultDataMask: DataMask;
  cascadeParentIds: string[];
  scope: typeof ROOT_SCOPE;
  chartsInScope: number[];
}

interface SelectFilterOptions {
  /** Dataset backing the filtered column. */
  datasetId: number;
  /** Column the filter targets. */
  column: string;
  /** Charts the filter applies to. */
  chartsInScope: number[];
  /** Label shown in the filter bar (default: the column name). */
  name?: string;
  /**
   * Value preselected when the dashboard loads. Omit for a filter that starts
   * unset — the distinction is load-bearing: a preselected filter is applied to
   * the initial chart-data request, an unset one is not.
   */
  defaultValue?: string;
}

/**
 * Builds one `filter_select` native filter for a dashboard's `json_metadata`.
 * The filter id is generated here because no test needs to know it — filters are
 * addressed through the filter bar UI, not by id.
 */
export function buildSelectFilter(
  options: SelectFilterOptions,
): NativeFilterConfig {
  const { datasetId, column, chartsInScope, name, defaultValue } = options;
  return {
    id: `NATIVE_FILTER-${Math.random().toString(36).slice(2, 10)}`,
    name: name ?? column,
    filterType: 'filter_select',
    type: 'NATIVE_FILTER',
    targets: [{ datasetId, column: { name: column } }],
    controlValues: {
      multiSelect: false,
      enableEmptyFilter: false,
      defaultToFirstItem: false,
      inverseSelection: false,
      searchAllOptions: false,
    },
    defaultDataMask:
      defaultValue === undefined
        ? { filterState: {}, extraFormData: {} }
        : {
            filterState: { value: [defaultValue] },
            extraFormData: {
              filters: [{ col: column, op: 'IN', val: [defaultValue] }],
            },
          },
    cascadeParentIds: [],
    scope: ROOT_SCOPE,
    chartsInScope,
  };
}

interface FilterMetadataOptions {
  /** Charts the dashboard's global filter scope covers. */
  chartsInScope: number[];
  nativeFilters: NativeFilterConfig[];
  /**
   * Display Controls, serialized as-is. Kept untyped and pass-through: only one
   * spec builds them, so a second builder would be speculative.
   */
  chartCustomizations?: Record<string, unknown>[];
}

/**
 * Builds the `json_metadata` envelope a filtered dashboard needs. Cross-filters
 * are off so a click on one chart cannot perturb another test's assertions.
 */
export function buildFilterJsonMetadata(
  options: FilterMetadataOptions,
): Record<string, unknown> {
  return {
    native_filter_configuration: options.nativeFilters,
    ...(options.chartCustomizations && {
      chart_customization_config: options.chartCustomizations,
    }),
    chart_configuration: {},
    cross_filters_enabled: false,
    global_chart_configuration: {
      scope: ROOT_SCOPE,
      chartsInScope: options.chartsInScope,
    },
  };
}

export interface DashboardChartSpec {
  /** Sent as the chart's top-level `viz_type` and injected into its params. */
  viz_type: string;
  /**
   * Chart params minus `datasource` and `viz_type` — the helper injects both
   * (the datasource is resolved from the dataset, so callers never thread the
   * dataset id through their spec).
   */
  params: Record<string, unknown>;
}

interface CreateDashboardWithChartsOptions {
  /** Example dataset the charts query (e.g. 'birth_names'). */
  datasetName: string;
  /** Chart slice-name prefix: `${chartNamePrefix}_${viz_type}_${suffix}`. */
  chartNamePrefix: string;
  /** Dashboard title prefix: `${dashboardTitlePrefix}_${suffix}`. */
  dashboardTitlePrefix: string;
  chartSpecs: DashboardChartSpec[];
  /**
   * Grid width per chart, passed through to `buildSingleRowDashboardLayout`.
   * Defaults to `GRID_DEFAULT_CHART_WIDTH` (4) -- lower this when `chartSpecs`
   * has enough entries that the default width would exceed the 12-column
   * single-row grid.
   */
  chartWidth?: number;
}

/**
 * Builds a published dashboard via the API: creates each chart, lays them out in
 * a single row, and associates them so they render. Every created chart and the
 * dashboard are registered for fixture cleanup. Charts are returned in the same
 * order as `chartSpecs`, so callers can pair them back to per-spec metadata by
 * index.
 */
export async function createDashboardWithCharts(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
  options: CreateDashboardWithChartsOptions,
): Promise<{ dashboardId: number; charts: DashboardLayoutChart[] }> {
  const dataset = await getDatasetByName(page, options.datasetName);
  if (!dataset) {
    throw new Error(`Dataset ${options.datasetName} not found`);
  }
  const datasource = `${dataset.id}__table`;

  // Parallel-safe suffix so chart/dashboard names never collide across workers.
  const uniqueSuffix = `${Date.now()}_${testInfo.parallelIndex}`;

  const charts: DashboardLayoutChart[] = [];
  for (const spec of options.chartSpecs) {
    const sliceName = `${options.chartNamePrefix}_${spec.viz_type}_${uniqueSuffix}`;
    const resp = await apiPostChart(page, {
      slice_name: sliceName,
      viz_type: spec.viz_type,
      datasource_id: dataset.id,
      datasource_type: 'table',
      params: JSON.stringify({
        // Caller params first so the helper-owned datasource/viz_type always win
        // and a stray key in a spec cannot repoint the chart at another dataset.
        ...spec.params,
        datasource,
        viz_type: spec.viz_type,
      }),
    });
    expect(resp.ok()).toBe(true);
    const chartId = await extractIdFromResponse(resp);
    testAssets.trackChart(chartId);
    charts.push({ id: chartId, sliceName, width: options.chartWidth });
  }

  // Lay all charts out in a single row.
  const positionJson = buildSingleRowDashboardLayout(charts);
  const dashResp = await apiPostDashboard(page, {
    dashboard_title: `${options.dashboardTitlePrefix}_${uniqueSuffix}`,
    published: true,
    position_json: JSON.stringify(positionJson),
  });
  expect(dashResp.ok()).toBe(true);
  const dashboardId = await extractIdFromResponse(dashResp);
  testAssets.trackDashboard(dashboardId);

  // Associate every chart with the dashboard so they actually render.
  for (const chart of charts) {
    await apiPutChart(page, chart.id, { dashboards: [dashboardId] });
  }

  return { dashboardId, charts };
}

interface SetupDashboardWithChartsResult {
  dashboardId: number;
  charts: DashboardLayoutChart[];
  dashboard: DashboardPage;
  /** Big-number value locator per chart, in the same order as `charts`. */
  valueLocators: Locator[];
}

/**
 * Combines {@link createDashboardWithCharts} with navigating to the result and
 * waiting for it to load -- the setup every GAQ test case that renders a plain
 * big-number dashboard needs before it starts recording its own signals or
 * assertions. Callers still assert on `valueLocators` themselves (a happy-path
 * test wants them visible; a broken-chart test wants an error alert instead),
 * so this only removes the identical creation/navigation boilerplate, not the
 * per-test assertions layered on top of it.
 *
 * @example
 * const { charts, dashboard, valueLocators } =
 *   await setupDashboardWithBigNumberCharts(page, testAssets, testInfo, {
 *     datasetName: 'birth_names',
 *     chartNamePrefix: 'gaq_tc1_cold_cache',
 *     dashboardTitlePrefix: 'gaq_tc1_cold_cache',
 *     chartSpecs: [{ viz_type: 'big_number_total', params: { metric: 'count' } }],
 *   });
 * const [chart] = charts;
 * const [value] = valueLocators;
 * await expect(value).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });
 */
export async function setupDashboardWithBigNumberCharts(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
  options: CreateDashboardWithChartsOptions,
  navigateOptions?: { timeout?: number },
): Promise<SetupDashboardWithChartsResult> {
  const { dashboardId, charts } = await createDashboardWithCharts(
    page,
    testAssets,
    testInfo,
    options,
  );
  const dashboard = new DashboardPage(page);
  const valueLocators = charts.map(chart =>
    dashboard
      .getChart(chart.id)
      .locator('.superset-legacy-chart-big-number .header-line'),
  );

  await dashboard.gotoById(dashboardId);
  await dashboard.waitForLoad(navigateOptions);

  return { dashboardId, charts, dashboard, valueLocators };
}

export interface ChartAsyncSignals {
  /** Status of the chart-data POST matching `matchSliceId`, once observed. */
  submitStatus?: number;
  /** Whether the client polled `/api/v1/async_event/` at least once. */
  sawAsyncEventPoll: boolean;
  /** Whether the client fetched the final payload from `/api/v1/chart/data/<cache_key>`. */
  sawFinalCachedFetch: boolean;
}

/**
 * Attaches a `page.on('response', ...)` listener that records the three GAQ
 * lifecycle signals for a single chart-data request: the submission's status,
 * whether the client polled the async-event endpoint, and whether it fetched
 * the final cached payload.
 *
 * `matchSliceId` distinguishes a chart's own chart-data request (a numeric
 * slice id) from a native filter's value fetch, which carries no slice id at
 * all (see `sliceIdFromChartDataUrl`) -- pass `undefined` to track a
 * filter-value request instead of a chart's.
 *
 * Returns a single mutable object, rather than a tuple of `let` bindings, so
 * callers can read the latest values from inside a `toPass` retry block
 * without closing over stale variables.
 */
export function trackChartAsyncSignals(
  page: Page,
  matchSliceId: number | undefined,
): ChartAsyncSignals {
  const signals: ChartAsyncSignals = {
    submitStatus: undefined,
    sawAsyncEventPoll: false,
    sawFinalCachedFetch: false,
  };

  page.on('response', response => {
    const request = response.request();
    const url = response.url();

    if (
      request.method() === 'POST' &&
      url.includes('/api/v1/chart/data') &&
      sliceIdFromChartDataUrl(url) === matchSliceId
    ) {
      signals.submitStatus = response.status();
      return;
    }
    if (request.method() === 'GET' && url.includes('/api/v1/async_event/')) {
      signals.sawAsyncEventPoll = true;
      return;
    }
    if (
      request.method() === 'GET' &&
      /\/api\/v1\/chart\/data\/qc-/.test(url)
    ) {
      signals.sawFinalCachedFetch = true;
    }
  });

  return signals;
}

export interface MultiChartAsyncSignals {
  /** Chart-data submit status keyed by slice id, for the charts in `chartIds`. */
  submitStatusBySliceId: Map<number, number>;
  asyncEventPollCount: number;
  finalFetchCount: number;
}

/**
 * Same signals as {@link trackChartAsyncSignals}, shaped for a dashboard with
 * several charts in flight at once: each chart's own submit status is kept
 * (keyed by slice id) instead of a single status, and poll/final-fetch events
 * are counted instead of recorded as a single boolean, since they arrive from
 * every chart concurrently.
 */
export function trackMultiChartAsyncSignals(
  page: Page,
  chartIds: Set<number>,
): MultiChartAsyncSignals {
  const signals: MultiChartAsyncSignals = {
    submitStatusBySliceId: new Map(),
    asyncEventPollCount: 0,
    finalFetchCount: 0,
  };

  page.on('response', response => {
    const request = response.request();
    const url = response.url();

    if (request.method() === 'POST' && url.includes('/api/v1/chart/data')) {
      const sliceId = sliceIdFromChartDataUrl(url);
      if (sliceId !== undefined && chartIds.has(sliceId)) {
        signals.submitStatusBySliceId.set(sliceId, response.status());
      }
      return;
    }
    if (request.method() === 'GET' && url.includes('/api/v1/async_event/')) {
      signals.asyncEventPollCount += 1;
      return;
    }
    if (
      request.method() === 'GET' &&
      /\/api\/v1\/chart\/data\/qc-/.test(url)
    ) {
      signals.finalFetchCount += 1;
    }
  });

  return signals;
}
