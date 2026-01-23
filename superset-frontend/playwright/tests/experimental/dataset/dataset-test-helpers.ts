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
import { expect } from '@playwright/test';
import type { TestAssets } from '../../../helpers/fixtures/testAssets';
import {
  getDatasetByName,
  duplicateDataset,
} from '../../../helpers/api/dataset';

interface TestDatasetResult {
  id: number;
  name: string;
}

interface CreateTestDatasetOptions {
  /** Base dataset to duplicate (default: 'members_channels_2') */
  baseName?: string;
  /** Prefix for generated name (default: 'test') */
  prefix?: string;
}

/**
 * Creates a test dataset by duplicating an existing one.
 * Handles getDatasetByName + expect + duplicate + track pattern.
 *
 * @example
 * // Basic usage - duplicates members_channels_2
 * const { id, name } = await createTestDataset(page, testAssets, test.info());
 *
 * @example
 * // Custom base dataset (e.g., for tests needing specific columns)
 * const { id, name } = await createTestDataset(page, testAssets, test.info(), {
 *   baseName: 'birth_names',  // has 'ds' column for date format tests
 *   prefix: 'test_date_format',
 * });
 */
export async function createTestDataset(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
  options?: CreateTestDatasetOptions,
): Promise<TestDatasetResult> {
  const baseName = options?.baseName ?? 'members_channels_2';
  const prefix = options?.prefix ?? 'test';

  const original = await getDatasetByName(page, baseName);
  expect(original, `${baseName} dataset must exist`).not.toBeNull();

  const name = `${prefix}_${Date.now()}_${testInfo.parallelIndex}`;
  const { id } = await duplicateDataset(page, original!.id, name);
  testAssets.trackDataset(id);

  return { id, name };
}
