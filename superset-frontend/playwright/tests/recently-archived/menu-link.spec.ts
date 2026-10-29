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

/**
 * The Recently-Archived view is reachable from Settings → Manage when the
 * SOFT_DELETE feature flag is enabled (sc-111760 T004).
 */
import { test, expect } from '@playwright/test';
import { skipUnlessFeatureEnabled } from '../../helpers/featureFlags';

test.beforeEach(async ({ page }) => {
  await skipUnlessFeatureEnabled(page, 'SOFT_DELETE');
});

test('Settings menu links to the Recently Archived view', async ({ page }) => {
  await page.goto('chart/list/');

  // Open the Settings dropdown in the top navigation (the trigger's accessible
  // name includes the caret, e.g. "down Settings").
  await page.getByRole('menuitem', { name: /Settings/ }).hover();
  const link = page.getByRole('menuitem', { name: 'Recently Archived' });
  await expect(link).toBeVisible();
  await link.click();

  // Tolerate a query string: ListView immediately persists its sort and
  // pagination state (?pageIndex=0&sortColumn=…) into the URL on mount, so
  // a bare-path pattern only matches if the assertion races that write.
  await expect(page).toHaveURL(/\/archived\/?(\?.*)?$/);
  await expect(page.getByTestId('archived-list-view')).toBeVisible();
});
