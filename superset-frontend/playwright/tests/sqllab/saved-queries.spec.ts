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
 * Saved Queries list E2E tests.
 *
 * Regression tests for subdirectory deployments: "+ Query" and query label
 * links must navigate to SQL Lab without duplicating the path prefix (sc-103661).
 */

import { test, expect } from '@playwright/test';
import { URL as APP_URLS } from '../../utils/urls';
import { TIMEOUT } from '../../utils/constants';

test('+ Query button navigates to SQL Lab without duplicating path segments', async ({
  page,
}) => {
  test.setTimeout(TIMEOUT.SLOW_TEST);

  await page.goto(APP_URLS.SAVED_QUERIES_LIST);

  // Wait for the list to load
  await page.waitForSelector('[data-test="saved_query-list-view"]', {
    timeout: TIMEOUT.PAGE_LOAD,
  });

  // Click the "+ Query" button in the submenu (accessible name is "plus Query" due to icon)
  await page.getByRole('button', { name: /Query/i }).click();

  // Wait for SQL Lab to load
  await page.waitForURL(/sqllab/, { timeout: TIMEOUT.PAGE_LOAD });

  const url = new URL(page.url());

  // No path segment should appear twice consecutively — catches the double-prefix bug
  // where React Router prepends the basename a second time (e.g. /superset/superset/sqllab).
  expect(url.pathname).not.toMatch(/\/(\w+)\/\1\//);

  // SQL Lab editor must be visible (not a blank page)
  await expect(page.locator('[data-test="sql-editor-tabs"]')).toBeVisible({
    timeout: TIMEOUT.PAGE_LOAD,
  });
});
