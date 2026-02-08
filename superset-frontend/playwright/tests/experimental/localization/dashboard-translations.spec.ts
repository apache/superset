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
import {
  apiGetDashboard,
  apiPutDashboard,
  apiDeleteDashboard,
  createTestDashboard,
} from '../../../helpers/api/dashboard';
import { apiGetAvailableLocales } from '../../../helpers/api/localization';
import { DashboardPage } from '../../../pages/DashboardPage';
import { TIMEOUT } from '../../../utils/constants';

/**
 * Dashboard Content Localization E2E Tests
 *
 * Prerequisites:
 * - Superset running with ENABLE_CONTENT_LOCALIZATION = True
 * - Multiple LANGUAGES configured in superset_config.py
 * - Admin user authenticated (via global-setup)
 *
 * Tests use hermetic data: each test creates and cleans up its own dashboard.
 */

const TEST_TRANSLATIONS = {
  dashboard_title: {
    de: 'Test-Dashboard',
    fr: 'Tableau de bord test',
  },
} as const;

// File-scope state (reset in beforeEach)
let testResources: { dashboardIds: number[] };

test.beforeEach(async () => {
  testResources = { dashboardIds: [] };
});

test.afterEach(async ({ page }) => {
  const promises = [];
  for (const id of testResources.dashboardIds) {
    promises.push(
      apiDeleteDashboard(page, id, { failOnStatusCode: false }).catch(
        error => {
          console.warn(
            `[Cleanup] Failed to delete dashboard ${id}:`,
            String(error),
          );
        },
      ),
    );
  }
  await Promise.all(promises);
});

test('should persist translations via PUT and return via GET', async ({
  page,
}) => {
  // Create hermetic test dashboard
  const title = `test_translations_persist_${Date.now()}`;
  const id = await createTestDashboard(page, title);
  expect(id).not.toBeNull();
  testResources.dashboardIds.push(id!);

  // Add translations via PUT
  const putResponse = await apiPutDashboard(page, id!, {
    translations: {
      dashboard_title: {
        de: TEST_TRANSLATIONS.dashboard_title.de,
        fr: TEST_TRANSLATIONS.dashboard_title.fr,
      },
    },
  });
  expect(putResponse.ok()).toBe(true);

  // Verify via GET with include_translations=true (editor mode)
  const getResponse = await apiGetDashboard(page, id!, {
    params: { include_translations: 'true' },
  });
  const data = await getResponse.json();

  // Editor mode returns original title (not localized)
  expect(data.result.dashboard_title).toBe(title);
  // Translations dict matches what was saved
  expect(data.result.translations.dashboard_title.de).toBe(
    TEST_TRANSLATIONS.dashboard_title.de,
  );
  expect(data.result.translations.dashboard_title.fr).toBe(
    TEST_TRANSLATIONS.dashboard_title.fr,
  );
});

test('should return localized title based on session locale', async ({
  page,
}) => {
  // Create dashboard with German translation
  const originalTitle = `test_locale_switch_${Date.now()}`;
  const germanTitle = 'Lokalisiertes Dashboard';
  const id = await createTestDashboard(page, originalTitle);
  expect(id).not.toBeNull();
  testResources.dashboardIds.push(id!);

  // Save German translation
  await apiPutDashboard(page, id!, {
    translations: {
      dashboard_title: { de: germanTitle },
    },
  });

  // Switch session locale to German via /lang/<locale> endpoint
  await page.request.get('lang/de', { maxRedirects: 0 });

  // GET in normal mode — session locale "de" triggers localization
  const localizedResponse = await apiGetDashboard(page, id!);
  const localizedData = await localizedResponse.json();
  expect(localizedData.result.dashboard_title).toBe(germanTitle);

  // Switch session locale back to English
  await page.request.get('lang/en', { maxRedirects: 0 });

  // GET in normal mode — session locale "en", no English translation → original title
  const originalResponse = await apiGetDashboard(page, id!);
  const originalData = await originalResponse.json();
  expect(originalData.result.dashboard_title).toBe(originalTitle);
});

test('should return available locales from localization endpoint', async ({
  page,
}) => {
  const response = await apiGetAvailableLocales(page);
  expect(response.ok()).toBe(true);

  const data = await response.json();
  const { locales, default_locale } = data.result;

  // Server must have at least one locale configured
  expect(Array.isArray(locales)).toBe(true);
  expect(locales.length).toBeGreaterThan(0);

  // Each locale has required fields
  for (const locale of locales) {
    expect(locale).toHaveProperty('code');
    expect(locale).toHaveProperty('name');
    expect(locale).toHaveProperty('flag');
    expect(typeof locale.code).toBe('string');
    expect(typeof locale.name).toBe('string');
  }

  // Default locale is a non-empty string
  expect(typeof default_locale).toBe('string');
  expect(default_locale.length).toBeGreaterThan(0);
});

test('should display locale switcher in dashboard properties modal', async ({
  page,
}) => {
  // Create hermetic test dashboard
  const title = `test_ui_translations_${Date.now()}`;
  const id = await createTestDashboard(page, title);
  expect(id).not.toBeNull();
  testResources.dashboardIds.push(id!);

  // Navigate to dashboard
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.gotoById(id!);
  await dashboardPage.waitForLoad({ timeout: TIMEOUT.PAGE_LOAD });

  // Enter edit mode (required for "Edit properties" menu item)
  await dashboardPage.enterEditMode();

  // Open properties modal via header actions menu
  await dashboardPage.clickEditProperties();

  // Wait for properties modal to be visible
  const propertiesDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Dashboard properties' });
  await propertiesDialog.waitFor({
    state: 'visible',
    timeout: TIMEOUT.FORM_LOAD,
  });

  // Verify LocaleSwitcher is visible as input suffix
  const localeSwitcher = propertiesDialog.getByRole('button', {
    name: /Locale switcher for Dashboard Title/,
  });
  await expect(localeSwitcher).toBeVisible();

  // Click LocaleSwitcher to open locale dropdown
  await localeSwitcher.click();

  // Verify dropdown shows configured locales (menu items from server)
  const dropdown = page.locator('.ant-dropdown:visible');
  await expect(dropdown.getByRole('menuitem', { name: 'English' })).toBeVisible();
});
