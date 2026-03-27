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
import type { TestAssets } from '../../helpers/fixtures/testAssets';
import { apiPostDashboard } from '../../helpers/api/dashboard';

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
