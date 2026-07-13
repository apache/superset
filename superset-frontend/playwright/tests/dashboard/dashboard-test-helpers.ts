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
import type { TestAssets } from '../../helpers/fixtures';
import { apiPostDashboard } from '../../helpers/api/dashboard';

interface TestDashboardResult {
  id: number;
  name: string;
}

/** A chart to place in a generated dashboard layout. */
export interface DashboardChartLayout {
  id: number;
  sliceName: string;
}

/**
 * Build a v2 `position_json` that lays the given charts out in a single row.
 *
 * Centralizes the ROOT → GRID → ROW → CHART scaffold that every dashboard-
 * building E2E test would otherwise hand-roll.
 */
export function buildDashboardPositionJson(
  charts: DashboardChartLayout[],
): Record<string, unknown> {
  const chartKeys = charts.map(chart => `CHART-${chart.id}`);
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
  charts.forEach((chart, index) => {
    positionJson[chartKeys[index]] = {
      type: 'CHART',
      id: chartKeys[index],
      children: [],
      parents: ['ROOT_ID', 'GRID_ID', 'ROW-1'],
      meta: {
        chartId: chart.id,
        width: 4,
        height: 50,
        sliceName: chart.sliceName,
      },
    };
  });
  return positionJson;
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
