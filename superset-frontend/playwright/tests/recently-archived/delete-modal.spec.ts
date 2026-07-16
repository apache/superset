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
 * With SOFT_DELETE enabled the delete-confirmation modal becomes recoverable:
 * it explains the object is moved to the archive (and for how long), and drops
 * the "type DELETE to confirm" friction. Non-destructive — the modal is opened
 * and dismissed without deleting anything.
 */
import { test, expect } from '@playwright/test';

test('chart delete confirmation reflects soft-delete (archive) semantics', async ({
  page,
}) => {
  await page.goto('chart/list/');
  await page.locator('[data-test="chart-row-delete"]').first().waitFor();
  await page.locator('[data-test="chart-row-delete"]').first().click();

  // The action reads as "Archive", not "Delete".
  await expect(page.getByText(/^Archive .+\?$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible();

  // Recoverable copy instead of "Are you sure … permanently".
  await expect(page.getByText(/moved to Recently Archived/i)).toBeVisible();
  await expect(
    page.getByText(/recover it there within \d+ days/i),
  ).toBeVisible();

  // No "type DELETE to confirm" input in recoverable mode.
  await expect(page.getByTestId('delete-modal-input')).toHaveCount(0);

  // Dismiss without deleting.
  await page.getByTestId('close-modal-btn').click();
});
