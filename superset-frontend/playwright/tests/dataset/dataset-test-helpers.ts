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
import {
  createTestVirtualDataset,
  createWideTestDataset,
} from '../../helpers/api/dataset';

interface TestDatasetResult {
  id: number;
  name: string;
}

interface CreateTestDatasetOptions {
  /** Prefix for generated name (default: 'test') */
  prefix?: string;
}

interface CreateWideTestDatasetOptions extends CreateTestDatasetOptions {
  /** Number of columns to project in the virtual dataset (default 50). */
  columnCount?: number;
}

/**
 * Creates a test virtual dataset.
 * Uses createTestVirtualDataset() to create a simple virtual dataset for testing.
 *
 * Note: The dataset duplicate API only works with virtual datasets. This helper
 * creates virtual datasets directly to avoid that limitation.
 *
 * @example
 * // Basic usage
 * const { id, name } = await createTestDataset(page, testAssets, test.info());
 *
 * @example
 * // Custom prefix
 * const { id, name } = await createTestDataset(page, testAssets, test.info(), {
 *   prefix: 'test_delete',
 * });
 */
export async function createTestDataset(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
  options?: CreateTestDatasetOptions,
): Promise<TestDatasetResult> {
  const prefix = options?.prefix ?? 'test';
  const name = `${prefix}_${Date.now()}_${testInfo.parallelIndex}`;

  const id = await createTestVirtualDataset(page, name);
  if (!id) {
    throw new Error(`Failed to create test dataset: ${name}`);
  }
  testAssets.trackDataset(id);

  return { id, name };
}

/**
 * Creates a wide virtual dataset (default 50 columns) for typing-perf tests.
 * The dataset's columns are auto-named `col_0` … `col_{N-1}` from the SQL
 * projection. Tracked for cleanup via testAssets.
 *
 * @example
 * const { id, name } = await createWideTestDatasetForTest(
 *   page, testAssets, test.info(), { columnCount: 50, prefix: 'wide_perf' }
 * );
 */
export async function createWideTestDatasetForTest(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
  options?: CreateWideTestDatasetOptions,
): Promise<TestDatasetResult> {
  const prefix = options?.prefix ?? 'wide_test';
  const columnCount = options?.columnCount ?? 50;
  const name = `${prefix}_${Date.now()}_${testInfo.parallelIndex}`;

  const id = await createWideTestDataset(page, name, columnCount);
  if (!id) {
    throw new Error(
      `Failed to create wide test dataset (${columnCount} cols): ${name}`,
    );
  }
  testAssets.trackDataset(id);

  return { id, name };
}
