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

import type { Page, TestInfo } from '@playwright/test';
import { expect, type TestAssets } from '../../helpers/fixtures';
import { apiPostChart, apiPutChart } from '../../helpers/api/chart';
import {
  apiPostDashboard,
  buildSingleRowDashboardLayout,
  type DashboardLayoutChart,
} from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { extractIdFromResponse } from '../../helpers/api/assertions';

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
    charts.push({ id: chartId, sliceName });
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
