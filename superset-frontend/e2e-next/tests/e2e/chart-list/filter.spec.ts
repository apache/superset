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
import { test } from '@playwright/test';
import { CHART_LIST } from '../../utils/urls';
import { setGridMode, clearAllInputs } from '../../utils';
import { InterceptItemCategory, setFilter } from '../explore/utils';

test.describe('Charts filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHART_LIST);
    await setGridMode(page, 'card');
    await clearAllInputs(page);
  });

  test('should allow filtering by "Owner"', async ({ page }) => {
    await setFilter(page, 'Owner', 'alpha user', InterceptItemCategory.Chart);
    await setFilter(page, 'Owner', 'admin user', InterceptItemCategory.Chart);
  });

  test('should allow filtering by "Modified by" correctly', async ({
    page,
  }) => {
    await setFilter(
      page,
      'Modified by',
      'alpha user',
      InterceptItemCategory.Chart,
    );
    await setFilter(
      page,
      'Modified by',
      'admin user',
      InterceptItemCategory.Chart,
    );
  });

  test('should allow filtering by "Type" correctly', async ({ page }) => {
    await setFilter(page, 'Type', 'Area Chart', InterceptItemCategory.Chart);
    await setFilter(page, 'Type', 'Bubble Chart', InterceptItemCategory.Chart);
  });

  test('should allow filtering by "Dataset" correctly', async ({ page }) => {
    await setFilter(
      page,
      'Dataset',
      'energy_usage',
      InterceptItemCategory.Chart,
    );
    await setFilter(
      page,
      'Dataset',
      'unicode_test',
      InterceptItemCategory.Chart,
    );
  });

  test('should allow filtering by "Dashboards" correctly', async ({ page }) => {
    await setFilter(
      page,
      'Dashboard',
      'Unicode Test',
      InterceptItemCategory.Chart,
    );
    await setFilter(
      page,
      'Dashboard',
      'Tabbed Dashboard',
      InterceptItemCategory.Chart,
    );
  });
});
