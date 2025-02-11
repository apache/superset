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

import { test, expect, Page } from '@playwright/test';
import { DATABASE_LIST } from '../../utils/urls';

const closeModal = async (page: Page) => {
  const databaseModals = await page.getByTestId('database-modal').all();
  if (databaseModals.length > 0) {
    await databaseModals.at(0)?.click();
  }
};

test.describe('Add database', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DATABASE_LIST);
    await closeModal(page);
    await page.getByTestId('btn-create-database').click();

    // Click Postgres dynamic form
    await page.locator('.preferred > :nth-child(1)').click();
  });

  test('should open dynamic form', async ({ page }) => {
    // Make sure all the fields are rendering
    await expect(page.locator('input[name="host"]')).toHaveValue('');
    await expect(page.locator('input[name="port"]')).toHaveValue('');
    await expect(page.locator('input[name="database"]')).toHaveValue('');
    await expect(page.locator('input[name="password"]')).toHaveValue('');
    await expect(
      page.getByTestId('database-modal').locator('input[name="database_name"]'),
    ).toHaveValue('PostgreSQL');
  });

  test('should open SQLAlchemy form', async ({ page }) => {
    await page.getByTestId('sqla-connect-btn').click();

    // Check if the SQLAlchemy form is showing up
    await expect(page.getByTestId('database-name-input')).toBeVisible();
    await expect(page.getByTestId('sqlalchemy-uri-input')).toBeVisible();
  });

  test('show error alerts on dynamic form for bad host', async ({ page }) => {
    await page.locator('input[name="host"]').fill('abc', { force: true });
    await page.locator('input[name="port"]').fill('5432', { force: true });
    await expect(page.locator('.ant-form-item-explain-error')).toContainText(
      "The hostname provided can't be resolved",
    );
  });

  test('show error alerts on dynamic form for bad port', async ({ page }) => {
    await page.locator('input[name="host"]').fill('localhost', { force: true });
    await page.locator('input[name="port"]').fill('123', { force: true });
    await page.locator('input[name="database"]').focus();
    await expect(page.locator('.ant-form-item-explain-error')).toContainText(
      'The port is closed',
    );
  });
});
