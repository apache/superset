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

import { test, expect } from '@playwright/test';
import { DATASET_LIST_PATH } from '../../utils/urls';
import {
  intercept,
  InterceptItemCategory,
  InterceptType,
} from '../explore/utils';

test.describe('Dataset list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DATASET_LIST_PATH);
  });

  test('should open Explore on dataset name click', async ({ page }) => {
    const interceptedDatasetExplore = intercept(
      page,
      InterceptType[InterceptItemCategory.Dataset].Explore,
    );

    await page
      .getByTestId('listview-table')
      .getByTestId('internal-link')
      .filter({ hasText: 'birth_names' })
      .click();
    await interceptedDatasetExplore;

    await expect(
      page.getByTestId('datasource-control').locator('.title-select'),
    ).toContainText('birth_names');
    await expect(page.locator('.metric-option-label').first()).toContainText(
      'COUNT(*)',
    );
    await expect(page.locator('.column-option-label').first()).toContainText(
      'ds',
    );
    await expect(
      page
        .getByTestId('fast-viz-switcher')
        .locator('div:not([role="button"])')
        .filter({ hasText: 'Table' }),
    ).toBeVisible();
  });
});
