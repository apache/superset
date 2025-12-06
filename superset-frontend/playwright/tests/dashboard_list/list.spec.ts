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
import { DashboardListPage } from '../../pages/DashboardListPage';

/**
 * Dashboard list E2E test suite.
 *
 * Per SIP-178, E2E tests focus on true end-to-end user workflows:
 * - Page navigation and loading
 * - View mode switching (list/card)
 * - Basic UI structure verification
 *
 * Filter/sort behavior is tested in component tests:
 * - src/components/ListView/ListView.test.tsx
 *
 * CRUD operations (delete, edit, favorite) are SKIPPED because they require
 * specific test fixtures that must be created via API before tests run.
 * See experimental/dataset/dataset-list.spec.ts for fixture patterns.
 */

test.describe('Dashboards list', () => {
    test.describe('list mode', () => {
        let dashboardListPage: DashboardListPage;

        test.beforeEach(async ({ page }) => {
            dashboardListPage = new DashboardListPage(page);
            await dashboardListPage.goto();
            await dashboardListPage.setGridMode('list');
            // setGridMode('list') includes waitForTableLoad() for stability
        });

        test('should load list view with correct headers', async ({ page }) => {
            // Verify table structure is visible
            await expect(dashboardListPage.getListViewTable()).toBeVisible();
            // Verify headers using role-based selector (matches actual DOM)
            await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
        });

        test('should show bulk select controls when enabled', async () => {
            await dashboardListPage.toggleBulkSelect();

            // Verify bulk select UI appears
            await expect(dashboardListPage.getBulkSelectCopy()).toBeVisible();
            await expect(dashboardListPage.getBulkSelectCopy()).toContainText(
                'Selected',
            );
        });
    });

    test.describe('card mode', () => {
        let dashboardListPage: DashboardListPage;

        test.beforeEach(async ({ page }) => {
            dashboardListPage = new DashboardListPage(page);
            await dashboardListPage.goto();
            await dashboardListPage.setGridMode('card');
            // setGridMode('card') includes waitForCardLoad() for stability
        });

        test('should load card view', async () => {
            // Table should not be visible in card mode
            await expect(dashboardListPage.getListViewTable()).not.toBeVisible();
            // At least one card should be visible (loaded via examples data)
            await expect(dashboardListPage.getCards().first()).toBeVisible();
        });

        test('should show bulk select controls when enabled', async () => {
            await dashboardListPage.toggleBulkSelect();

            // Verify bulk select UI appears
            await expect(dashboardListPage.getBulkSelectCopy()).toBeVisible();
        });
    });

    /**
     * CRUD action tests are skipped until fixture creation is implemented.
     *
     * These tests require specific sample dashboards to be created before running:
     * - '1 - Sample dashboard', '2 - Sample dashboard', etc.
     *
     * To enable these tests, follow the pattern in:
     * - experimental/dataset/dataset-list.spec.ts
     * - Use API helpers to create/cleanup sample dashboards in beforeEach/afterEach
     */
    test.describe.skip('common actions (requires fixtures)', () => {
        let dashboardListPage: DashboardListPage;

        test.beforeEach(async ({ page }) => {
            dashboardListPage = new DashboardListPage(page);
            await dashboardListPage.goto();
        });

        test('should allow to favorite/unfavorite dashboard', async () => {
            await dashboardListPage.setGridMode('card');
            await dashboardListPage.setFilter('Sort', 'Alphabetical');

            await expect(dashboardListPage.getCard(0)).toContainText(
                '1 - Sample dashboard',
            );

            // Favorite the dashboard
            await dashboardListPage.clickFavoriteIcon(false);

            // Unfavorite the dashboard
            await dashboardListPage.clickFavoriteIcon(true);

            // Verify star is gone
            await expect(
                dashboardListPage.getCard(0).locator('[aria-label="starred"]'),
            ).toHaveCount(0);
        });

        test('should bulk delete correctly', async () => {
            await dashboardListPage.toggleBulkSelect();

            // Bulk deletes in card-view
            await dashboardListPage.setGridMode('card');
            await dashboardListPage.setFilter('Sort', 'Alphabetical');

            // Select first two dashboards
            await dashboardListPage.getCard(0).click();
            await expect(dashboardListPage.getCard(0)).toContainText(
                '1 - Sample dashboard',
            );
            await dashboardListPage.getCard(1).click();
            await expect(dashboardListPage.getCard(1)).toContainText(
                '2 - Sample dashboard',
            );

            // Click delete action
            await dashboardListPage.getBulkSelectActions().nth(0).click();
            await dashboardListPage.confirmDelete(true);

            // Verify dashboards are deleted
            await expect(dashboardListPage.getCard(0)).not.toContainText(
                '1 - Sample dashboard',
            );
            await expect(dashboardListPage.getCard(1)).not.toContainText(
                '2 - Sample dashboard',
            );

            // Bulk deletes in list-view
            await dashboardListPage.setGridMode('list');
            await expect(dashboardListPage.getTableRow(0)).toContainText(
                '3 - Sample dashboard',
            );
            await expect(dashboardListPage.getTableRow(1)).toContainText(
                '4 - Sample dashboard',
            );

            await dashboardListPage.clickTableRowCheckboxes([0, 1]);
            await dashboardListPage.getBulkSelectActions().nth(0).click();
            await dashboardListPage.confirmDelete(true);

            await dashboardListPage.waitForLoadingComplete();
            await expect(dashboardListPage.getTableRow(0)).not.toContainText(
                '3 - Sample dashboard',
            );
            await expect(dashboardListPage.getTableRow(1)).not.toContainText(
                '4 - Sample dashboard',
            );
        });

        test('should delete correctly in list mode', async () => {
            await dashboardListPage.setGridMode('list');

            await expect(dashboardListPage.getTableRow(0)).toContainText(
                '4 - Sample dashboard',
            );
            await dashboardListPage.clickTrashIcon(0);
            await dashboardListPage.confirmDelete();
            await expect(dashboardListPage.getTableRow(0)).not.toContainText(
                '4 - Sample dashboard',
            );
        });

        test('should delete correctly in card mode', async () => {
            await dashboardListPage.setGridMode('card');
            await dashboardListPage.setFilter('Sort', 'Alphabetical');

            await expect(dashboardListPage.getCard(0)).toContainText(
                '1 - Sample dashboard',
            );
            await dashboardListPage.openMoreMenu();
            await dashboardListPage.clickDeleteButton();
            await dashboardListPage.confirmDelete();
            await expect(dashboardListPage.getCard(0)).not.toContainText(
                '1 - Sample dashboard',
            );
        });

        test('should edit correctly', async () => {
            // Edit in card-view
            await dashboardListPage.setGridMode('card');
            await dashboardListPage.setFilter('Sort', 'Alphabetical');
            await expect(dashboardListPage.getCard(0)).toContainText(
                '1 - Sample dashboard',
            );

            // Change title
            await dashboardListPage.openMoreMenu();
            await dashboardListPage.clickEditButton();
            await dashboardListPage.appendToDashboardTitle(' | EDITED');
            await expect(dashboardListPage.getCard(0)).toContainText(
                '1 - Sample dashboard | EDITED',
            );

            // Edit in list-view
            await dashboardListPage.setGridMode('list');
            await dashboardListPage.clickEditIcon(0);
            await dashboardListPage.editDashboardTitle('1 - Sample dashboard');
            await expect(dashboardListPage.getTableRow(0)).toContainText(
                '1 - Sample dashboard',
            );
        });
    });
});
