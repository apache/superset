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
  type DashboardPositionJson,
} from '../../helpers/api/dashboard';
import {
  apiPostVirtualDataset,
  getDatasetByName,
} from '../../helpers/api/dataset';
import { getDatabaseByName } from '../../helpers/api/database';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import { DashboardPage } from '../../pages/DashboardPage';
import { GAQ } from '../../utils/constants';
import { DashboardFilterBar } from '../../components/dashboard/DashboardFilterBar';

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
  /**
   * Ids of filters this one cascades from — its options narrow to whatever the
   * parent filter(s) currently scope. Omit for a top-level filter.
   */
  cascadeParentIds?: string[];
  /**
   * Auto-select the first option whenever the scoped option set changes
   * (e.g. after a parent filter narrows it). Default: false.
   */
  defaultToFirstItem?: boolean;
}

/**
 * Builds one `filter_select` native filter for a dashboard's `json_metadata`.
 * The filter id is generated here; most specs address filters through the filter
 * bar UI, and a spec that needs the id reads it off the returned config.
 */
export function buildSelectFilter(
  options: SelectFilterOptions,
): NativeFilterConfig {
  const {
    datasetId,
    column,
    chartsInScope,
    name,
    defaultValue,
    cascadeParentIds,
    defaultToFirstItem,
  } = options;
  return {
    id: `NATIVE_FILTER-${Math.random().toString(36).slice(2, 10)}`,
    name: name ?? column,
    filterType: 'filter_select',
    type: 'NATIVE_FILTER',
    targets: [{ datasetId, column: { name: column } }],
    controlValues: {
      multiSelect: false,
      enableEmptyFilter: false,
      defaultToFirstItem: defaultToFirstItem ?? false,
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
    cascadeParentIds: cascadeParentIds ?? [],
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

/**
 * "A chart that renders a number" -- all most GAQ tests need from their fixture.
 *
 * `count` here is the *saved* metric the physical example datasets ship with.
 * A dataset created through the API carries no saved metrics at all
 * (`fetch_metadata` only discovers columns), so on one of those this spec's
 * query fails with "Metric 'count' does not exist" -- use
 * {@link BIG_NUMBER_ADHOC_COUNT_SPEC} for those.
 */
export const BIG_NUMBER_COUNT_SPEC: DashboardChartSpec = {
  viz_type: 'big_number_total',
  params: { metric: 'count' },
};

/**
 * `COUNT(name)` as an ad-hoc metric: resolvable on any dataset over
 * `birth_names`, whether or not it has saved metrics.
 */
export const ADHOC_COUNT_NAME_METRIC = {
  expressionType: 'SIMPLE',
  column: { column_name: 'name' },
  aggregate: 'COUNT',
  label: 'COUNT(name)',
} as const;

/** {@link BIG_NUMBER_COUNT_SPEC} for datasets without saved metrics. */
export const BIG_NUMBER_ADHOC_COUNT_SPEC: DashboardChartSpec = {
  viz_type: 'big_number_total',
  params: { metric: ADHOC_COUNT_NAME_METRIC },
};

interface CreateDashboardWithChartsOptions {
  /** Example dataset the charts query, by name (e.g. 'birth_names'). */
  datasetName?: string;
  /** Dataset id, for datasets without a stable name (e.g. a per-run virtual one). */
  datasetId?: number;
  /** Chart slice-name prefix: `${chartNamePrefix}_${viz_type}_${suffix}`. */
  chartNamePrefix: string;
  /** Dashboard title prefix (default: `chartNamePrefix`). */
  dashboardTitlePrefix?: string;
  chartSpecs: DashboardChartSpec[];
  /**
   * Grid width per chart, passed through to `buildSingleRowDashboardLayout`.
   * Defaults to `GRID_DEFAULT_CHART_WIDTH` (4) -- lower this when `chartSpecs`
   * has enough entries that the default width would exceed the 12-column
   * single-row grid.
   */
  chartWidth?: number;
  /**
   * When set, the dashboard gets one single-select native filter on this
   * column, scoped to every chart. Single-select is load-bearing for the tests
   * that use it: each selection replaces the previous one rather than
   * accumulating, so a rapid swap is unambiguously a swap.
   */
  selectFilter?: { column: string; name?: string };
  /** Custom dashboard layout; defaults to placing every chart in one row. */
  buildLayout?: (
    charts: readonly DashboardLayoutChart[],
  ) => DashboardPositionJson;
  /**
   * Dashboard `json_metadata` (e.g. native filters via
   * `buildFilterJsonMetadata`); omitted when not provided. Receives the created
   * charts and the resolved dataset id so filters can target both.
   */
  buildJsonMetadata?: (context: {
    charts: readonly DashboardLayoutChart[];
    datasetId: number;
  }) => Record<string, unknown>;
}

/**
 * Builds a published dashboard via the API: creates each chart, lays them out,
 * and associates them so they render. Every created chart and the dashboard are
 * registered for fixture cleanup. Charts are returned in the same order as
 * `chartSpecs`, so callers can pair them back to per-spec metadata by index.
 */
export async function createDashboardWithCharts(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
  options: CreateDashboardWithChartsOptions,
): Promise<{ dashboardId: number; charts: DashboardLayoutChart[] }> {
  let { datasetId } = options;
  if (datasetId === undefined) {
    if (!options.datasetName) {
      throw new Error('Provide either datasetName or datasetId');
    }
    const dataset = await getDatasetByName(page, options.datasetName);
    if (!dataset) {
      throw new Error(`Dataset ${options.datasetName} not found`);
    }
    datasetId = dataset.id;
  }
  const datasource = `${datasetId}__table`;

  // Parallel-safe suffix so chart/dashboard names never collide across workers.
  const uniqueSuffix = `${Date.now()}_${testInfo.parallelIndex}`;

  const charts: DashboardLayoutChart[] = [];
  for (const spec of options.chartSpecs) {
    const sliceName = `${options.chartNamePrefix}_${spec.viz_type}_${uniqueSuffix}`;
    const resp = await apiPostChart(page, {
      slice_name: sliceName,
      viz_type: spec.viz_type,
      datasource_id: datasetId,
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

  const positionJson = options.buildLayout
    ? options.buildLayout(charts)
    : buildSingleRowDashboardLayout(charts);
  const chartIds = charts.map(chart => chart.id);
  // Two ways to supply dashboard metadata: `buildJsonMetadata` is the general
  // escape hatch, `selectFilter` the shorthand for the common single-select
  // case. If a caller passes both, the explicit callback wins.
  const jsonMetadata =
    options.buildJsonMetadata?.({ charts, datasetId }) ??
    (options.selectFilter
      ? buildFilterJsonMetadata({
          chartsInScope: chartIds,
          nativeFilters: [
            buildSelectFilter({
              datasetId,
              column: options.selectFilter.column,
              chartsInScope: chartIds,
              name: options.selectFilter.name,
            }),
          ],
        })
      : undefined);
  const dashResp = await apiPostDashboard(page, {
    dashboard_title: `${options.dashboardTitlePrefix ?? options.chartNamePrefix}_${uniqueSuffix}`,
    published: true,
    position_json: JSON.stringify(positionJson),
    ...(jsonMetadata && { json_metadata: JSON.stringify(jsonMetadata) }),
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

/** The rendered value of a big-number chart. */
export function bigNumberValueLocator(
  dashboard: DashboardPage,
  chartId: number,
): Locator {
  return dashboard
    .getChart(chartId)
    .locator('.superset-legacy-chart-big-number .header-line');
}

interface SetupDashboardWithChartsResult {
  dashboardId: number;
  charts: DashboardLayoutChart[];
  dashboard: DashboardPage;
  /** Big-number value locator per chart, in the same order as `charts`. */
  valueLocators: Locator[];
}

/**
 * {@link createDashboardWithCharts} plus navigating to the result and waiting
 * for it to load. Callers still assert on `valueLocators` themselves -- a
 * happy-path test wants them visible, a broken-chart test wants an error alert.
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
    bigNumberValueLocator(dashboard, chart.id),
  );

  await dashboard.gotoById(dashboardId);
  await dashboard.waitForLoad(navigateOptions);

  return { dashboardId, charts, dashboard, valueLocators };
}

export interface GaqSignals {
  /**
   * Every chart-data response status seen for a slice, in order. Under the
   * Global Task Framework an async chart-data request produces *two* responses
   * for the same URL: the 202 that hands the work to GTF, then the 200 the
   * client gets when it re-issues the request and is served from the cache the
   * tasks populated. A single value per slice would hide one of them.
   *
   * A native filter's value fetch hits the same endpoint without a `slice_id`,
   * so it is keyed under `undefined` (see {@link sliceIdFromChartDataUrl}).
   */
  submitStatusesFor(sliceId?: number): readonly number[];
  /** First status seen for a slice; `undefined` if it has not responded yet. */
  submitStatusFor(sliceId?: number): number | undefined;
  /**
   * Statuses for a slice whose *request payload* satisfies `matches`, in order.
   *
   * {@link submitStatusesFor} keys only on slice id, so when two requests for
   * one slice are in flight it reports whichever responded first -- which on a
   * loaded runner need not be the one under test. Correlating on the payload
   * (see {@link nativeFilterValuesIn}) identifies a specific request instead of
   * relying on response ordering.
   */
  submitStatusesWhere(
    sliceId: number | undefined,
    matches: (requestBody: string) => boolean,
  ): readonly number[];
  /** Poll/fetch events are counted, not flagged: on a busy dashboard they arrive per chart. */
  readonly taskStatusPollCount: number;
  /** Chart-data re-requests that were served synchronously (200) after a 202. */
  readonly cachedRereadCount: number;
  readonly sawTaskStatusPoll: boolean;
  /** True once some slice went 202 -> 200: a full async round trip completed. */
  readonly sawAsyncRoundTrip: boolean;
}

/**
 * The values a chart-data payload filters `column` on.
 *
 * A dashboard merges its native filters into the request as
 * `{ col, op: 'IN', val: [...] }` clauses (see `getSelectExtraFormData` in
 * src/filters/utils.ts). Reading them back is what lets a test say "this
 * response belongs to the 'girl' request" rather than trusting arrival order.
 *
 * Returns an empty array for an unparseable body, so a caller's predicate
 * simply does not match rather than throwing inside a `response` listener.
 */
export function nativeFilterValuesIn(
  requestBody: string,
  column: string,
): string[] {
  const values: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node === null || typeof node !== 'object') {
      return;
    }
    const clause = node as { col?: unknown; val?: unknown };
    if (clause.col === column && clause.val !== undefined) {
      const vals = Array.isArray(clause.val) ? clause.val : [clause.val];
      vals.forEach(val => values.push(String(val)));
    }
    Object.values(node as Record<string, unknown>).forEach(visit);
  };
  try {
    visit(JSON.parse(requestBody));
  } catch {
    return [];
  }
  return values;
}

/**
 * Records the GAQ lifecycle signals seen from now on.
 *
 * Under GTF the cycle is: `POST /api/v1/chart/data` with `async_mode` returns
 * **202**; the client polls `GET /api/v1/task/status_changes`, then re-issues
 * the same POST and gets **200** from the cache those tasks warmed.
 *
 * Attach only once the traffic you care about is the *next* thing to happen: an
 * initial dashboard load fires the same signals. Reads are live getters, so
 * callers can poll them inside `expect(...).toPass()`.
 */
export function trackGaqSignals(page: Page): GaqSignals {
  const submitStatuses = new Map<number | undefined, number[]>();
  /** Every chart-data response, with the payload that produced it. */
  const submissions: {
    sliceId: number | undefined;
    status: number;
    requestBody: string;
  }[] = [];
  let taskStatusPollCount = 0;
  let cachedRereadCount = 0;

  page.on('response', response => {
    const request = response.request();
    const url = response.url();

    if (request.method() === 'POST' && url.includes('/api/v1/chart/data')) {
      const sliceId = sliceIdFromChartDataUrl(url);
      const seen = submitStatuses.get(sliceId) ?? [];
      // A 200 following a 202 for the same slice is the re-request being served
      // from the warmed cache -- the completion half of the round trip.
      if (response.status() === 200 && seen.includes(202)) {
        cachedRereadCount += 1;
      }
      submitStatuses.set(sliceId, [...seen, response.status()]);
      submissions.push({
        sliceId,
        status: response.status(),
        requestBody: request.postData() ?? '',
      });
      return;
    }
    if (
      request.method() === 'GET' &&
      url.includes(GAQ.TASK_STATUS_CHANGES_PATH)
    ) {
      taskStatusPollCount += 1;
    }
  });

  return {
    submitStatusesFor: sliceId => submitStatuses.get(sliceId) ?? [],
    submitStatusFor: sliceId => submitStatuses.get(sliceId)?.[0],
    submitStatusesWhere: (sliceId, matches) =>
      submissions
        .filter(
          entry => entry.sliceId === sliceId && matches(entry.requestBody),
        )
        .map(entry => entry.status),
    get taskStatusPollCount() {
      return taskStatusPollCount;
    },
    get cachedRereadCount() {
      return cachedRereadCount;
    },
    get sawTaskStatusPoll() {
      return taskStatusPollCount > 0;
    },
    get sawAsyncRoundTrip() {
      return cachedRereadCount > 0;
    },
  };
}

interface SetupFilteredDashboardOptions {
  /** Dataset backing both the chart and the filter's value lookup -- see {@link CreateDashboardWithChartsOptions}. */
  datasetName?: string;
  datasetId?: number;
  /** Prefix for the generated chart and dashboard names. */
  namePrefix: string;
  /** Column the native filter targets. */
  filterColumn: string;
  /** Label shown in the filter bar (default: the column name). */
  filterName?: string;
  /**
   * The dashboard's single chart (default: {@link BIG_NUMBER_COUNT_SPEC}).
   * Callers passing an API-created dataset must supply one whose metric does
   * not depend on saved metrics -- see {@link BIG_NUMBER_ADHOC_COUNT_SPEC}.
   */
  chartSpec?: DashboardChartSpec;
}

interface SetupFilteredDashboardResult {
  dashboardId: number;
  chartId: number;
  dashboard: DashboardPage;
  filterBar: DashboardFilterBar;
  /** Big-number value locator for the dashboard's single chart. */
  value: Locator;
}

/**
 * Builds a dashboard with one big-number chart plus a single-select native
 * filter scoped to it. Does NOT navigate: some callers must attach network
 * listeners before the first load (the filter's value fetch fires during the
 * filter panel's own initialization).
 */
export async function setupDashboardWithSelectFilter(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
  options: SetupFilteredDashboardOptions,
): Promise<SetupFilteredDashboardResult> {
  const { dashboardId, charts } = await createDashboardWithCharts(
    page,
    testAssets,
    testInfo,
    {
      datasetName: options.datasetName,
      datasetId: options.datasetId,
      chartNamePrefix: options.namePrefix,
      chartSpecs: [options.chartSpec ?? BIG_NUMBER_COUNT_SPEC],
      chartWidth: 6,
      selectFilter: { column: options.filterColumn, name: options.filterName },
    },
  );
  const [chart] = charts;
  const dashboard = new DashboardPage(page);

  return {
    dashboardId,
    chartId: chart.id,
    dashboard,
    filterBar: new DashboardFilterBar(page),
    value: bigNumberValueLocator(dashboard, chart.id),
  };
}

/**
 * A virtual dataset whose query text is unique to this run.
 *
 * Chart and filter-value results are cached by query text, so a dataset over a
 * shared physical table is cache-cold the first time it runs and a cache hit
 * every time after -- and a test that means to exercise the async pipeline
 * quietly stops doing so. The per-run SQL comment keeps the cache key unique,
 * which is what lets a spec assert the async cycle on a first, unforced load.
 *
 * The dataset is registered for fixture cleanup.
 *
 * @param options.namePrefix - Prefix for the dataset name; the run suffix is appended.
 * @param options.select - SELECT to wrap (default: `SELECT name FROM birth_names`).
 * @returns The new dataset's id, and the suffix, for callers that name other
 *   per-run objects consistently with it.
 */
export async function createCacheColdVirtualDataset(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
  options: { namePrefix: string; select?: string },
): Promise<{ datasetId: number; uniqueSuffix: string }> {
  const examplesDb = await getDatabaseByName(page, 'examples');
  if (!examplesDb) {
    throw new Error('examples database not found');
  }

  const uniqueSuffix = `${Date.now()}_${testInfo.parallelIndex}`;
  const select = options.select ?? 'SELECT name FROM birth_names';
  const datasetResp = await apiPostVirtualDataset(page, {
    database: examplesDb.id,
    schema: '',
    table_name: `${options.namePrefix}_${uniqueSuffix}`,
    sql: `${select} /* run:${uniqueSuffix} */`,
    editors: [],
  });
  expect(datasetResp.ok()).toBe(true);
  const datasetId = await extractIdFromResponse(datasetResp);
  testAssets.trackDataset(datasetId);

  return { datasetId, uniqueSuffix };
}

/** Column {@link createQueryClockDataset} stamps every query with. */
export const QUERIED_AT_COLUMN = 'queried_at_ms';

/**
 * A chart showing the latest {@link QUERIED_AT_COLUMN} stamp.
 *
 * `,d` rather than the default SMART_NUMBER, which rounds two stamps seconds
 * apart to the same "1.76T".
 */
export const BIG_NUMBER_QUERY_CLOCK_SPEC: DashboardChartSpec = {
  viz_type: 'big_number_total',
  params: {
    metric: {
      expressionType: 'SIMPLE',
      column: { column_name: QUERIED_AT_COLUMN },
      aggregate: 'MAX',
      label: `MAX(${QUERIED_AT_COLUMN})`,
    },
    y_axis_format: ',d',
  },
};

/**
 * {@link createCacheColdVirtualDataset} over `birth_names`, with every query
 * also stamped with the server clock.
 *
 * The example data is static, so a correct re-execution reproduces the same
 * numbers -- which means "the value is what it was" cannot tell a genuine
 * re-render from a DOM that never updated. Pair this with
 * {@link BIG_NUMBER_QUERY_CLOCK_SPEC} and {@link readQueryClock} for a value
 * that *must* move whenever the query really ran again.
 */
export async function createQueryClockDataset(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
  options: { namePrefix: string },
): Promise<{ datasetId: number; uniqueSuffix: string }> {
  return createCacheColdVirtualDataset(page, testAssets, testInfo, {
    namePrefix: options.namePrefix,
    select:
      `SELECT name, CAST(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000 AS BIGINT) ` +
      `AS ${QUERIED_AT_COLUMN} FROM birth_names`,
  });
}

/** The number rendered by a {@link BIG_NUMBER_QUERY_CLOCK_SPEC} chart. */
export async function readQueryClock(locator: Locator): Promise<number> {
  return Number((await locator.textContent())?.replace(/,/g, ''));
}
