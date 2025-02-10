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
import { REPORT_LIST } from '../../utils/urls';

test.describe('Report list view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REPORT_LIST);
  });

  test('should load report lists', async ({ page }) => {
    await expect(page.getByTestId('listview-table')).toBeVisible();

    const sortHeaders = page.getByTestId('sort-header');
    await expect(sortHeaders.nth(1)).toContainText('Last run');
    await expect(sortHeaders.nth(2)).toContainText('Name');
    await expect(sortHeaders.nth(3)).toContainText('Schedule');
    await expect(sortHeaders.nth(4)).toContainText('Notification method');
    await expect(sortHeaders.nth(5)).toContainText('Owners');
    await expect(sortHeaders.nth(6)).toContainText('Last modified');
    await expect(sortHeaders.nth(7)).toContainText('Active');
    await expect(sortHeaders.nth(8)).toContainText('Actions');
  });
});
