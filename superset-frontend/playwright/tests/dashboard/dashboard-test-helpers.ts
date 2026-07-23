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
        datasource,
        viz_type: spec.viz_type,
        ...spec.params,
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
