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
import { createTestChart } from '../chart/chart-test-helpers';

/**
 * Creates a raw-mode table chart on birth_names for Explore tests.
 *
 * @example
 * const { id, name } = await createExploreTestChart(page, testAssets, test.info(), {
 *   prefix: 'explore_save',
 * });
 */
export async function createExploreTestChart(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
  options: { prefix: string; adhocFilters?: Record<string, unknown>[] },
): Promise<{ id: number; name: string }> {
  return createTestChart(page, testAssets, testInfo, {
    prefix: options.prefix,
    datasetName: 'birth_names',
    params: {
      query_mode: 'raw',
      all_columns: ['name', 'gender', 'num'],
      adhoc_filters: options.adhocFilters ?? [],
      order_by_cols: [],
      row_limit: 1000,
      server_pagination: false,
    },
  });
}
