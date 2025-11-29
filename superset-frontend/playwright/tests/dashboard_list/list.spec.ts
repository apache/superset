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
 * Dashboard list test suite.
 * Tests list/card view modes, sorting, bulk operations, and CRUD actions.
 *
 * Migration notes from Cypress:
 * - Replaced cy.visit() with page object goto()
 * - Replaced cy.getBySel() with page.locator('[data-test="..."]')
 * - Replaced cy.get().should() chains with expect(locator).toBe...()
 * - Replaced cy.wait('@intercept') with page.waitForResponse() in page object
 * - Replaced .contains() with locator.filter({ hasText: '...' }) or getByText()
 * - Moved all API intercepts into page object methods (encapsulation)
 * - Moved helper functions into page object methods (DRY principle)
 * - Used beforeEach for test isolation instead of before/beforeEach mix
 * - Assertions stay in tests, actions moved to page object
 */
test.describe('Dashboards list', () => {
    test.describe('list mode', () => {
        let dashboardListPage: DashboardListPage;

        test.beforeEach(async ({ page }) => {
            dashboardListPage = new DashboardListPage(page);
            await dashboardListPage.goto();
            await dashboardListPage.setGridMode('list');
        });

        test('should load rows in list mode', async () => {
            await expect(dashboardListPage.getListViewTable()).toBeVisible();
            await expect(dashboardListPage.getSortHeaders().nth(0)).toContainText(
                'Name',
            );
            await expect(dashboardListPage.getSortHeaders().nth(1)).toContainText(
                'Status',
            );
            await expect(dashboardListPage.getSortHeaders().nth(2)).toContainText(
                'Owners',
            );
            await expect(dashboardListPage.getSortHeaders().nth(3)).toContainText(
                'Last modified',
            );
            await expect(dashboardListPage.getSortHeaders().nth(4)).toContainText(
                'Actions',
            );
        });

        test('should sort correctly in list mode', async () => {
            // Sort ascending
            await dashboardListPage.clickSortHeader(0);
            await dashboardListPage.waitForLoadingComplete();
            await expect(dashboardListPage.getTableRow(0)).toContainText(
                'Supported Charts Dashboard',
            );

            // Sort descending
            await dashboardListPage.clickSortHeader(0);
            await dashboardListPage.waitForLoadingComplete();
            await expect(dashboardListPage.getTableRow(0)).toContainText(
                "World Bank's Data",
            );

            // Reset sort
            await dashboardListPage.clickSortHeader(0);
        });

        test('should bulk select in list mode', async () => {
            await dashboardListPage.toggleBulkSelect();
            await dashboardListPage.selectAllInListView();

            // Check that checkboxes are checked (6 total including header)
            await expect(dashboardListPage.getAntTableCheckboxes()).toHaveCount(6);
            const allChecked = await dashboardListPage
                .getAntTableCheckboxes()
                .evaluateAll(inputs =>
                    inputs.every(input => (input as HTMLInputElement).checked),
                );
            expect(allChecked).toBe(true);

            // Verify bulk select copy shows correct count
            await expect(dashboardListPage.getBulkSelectCopy()).toContainText(
                '5 Selected',
            );

            // Verify bulk actions are present
            const bulkActions = dashboardListPage.getBulkSelectActions();
            await expect(bulkActions).toHaveCount(2);
            await expect(bulkActions.nth(0)).toContainText('Delete');
            await expect(bulkActions.nth(1)).toContainText('Export');

            // Deselect all
            await dashboardListPage.deselectAll();
            await expect(dashboardListPage.getCheckedCheckboxes()).toHaveCount(0);
            await expect(dashboardListPage.getBulkSelectCopy()).toContainText(
                '0 Selected',
            );
            await expect(dashboardListPage.getBulkSelectActions()).toHaveCount(0);
        });
    });

    test.describe('card mode', () => {
        let dashboardListPage: DashboardListPage;

        test.beforeEach(async ({ page }) => {
            dashboardListPage = new DashboardListPage(page);
            await dashboardListPage.goto();
            await dashboardListPage.setGridMode('card');
        });

        test('should load rows in card mode', async () => {
            await expect(dashboardListPage.getListViewTable()).not.toBeVisible();
            await expect(dashboardListPage.getCards()).toHaveCount(5);
        });

        test('should bulk select in card mode', async () => {
            await dashboardListPage.toggleBulkSelect();
            await dashboardListPage.clickCardsForBulkSelect(5);

            await expect(dashboardListPage.getBulkSelectCopy()).toContainText(
                '5 Selected',
            );

            const bulkActions = dashboardListPage.getBulkSelectActions();
            await expect(bulkActions).toHaveCount(2);
            await expect(bulkActions.nth(0)).toContainText('Delete');
            await expect(bulkActions.nth(1)).toContainText('Export');

            await dashboardListPage.deselectAll();
            await expect(dashboardListPage.getBulkSelectCopy()).toContainText(
                '0 Selected',
            );
            await expect(dashboardListPage.getBulkSelectActions()).toHaveCount(0);
        });

        test('should sort in card mode', async () => {
            await dashboardListPage.setFilter('Sort', 'Alphabetical');
            await expect(dashboardListPage.getCard(0)).toContainText(
                'Supported Charts Dashboard',
            );
        });

        test('should preserve other filters when sorting', async () => {
            await expect(dashboardListPage.getCards()).toHaveCount(5);
            await dashboardListPage.setFilter('Status', 'Published');
            await dashboardListPage.setFilter('Sort', 'Least recently modified');
            await expect(dashboardListPage.getCards()).toHaveCount(3);
        });
    });

    test.describe('common actions', () => {
        let dashboardListPage: DashboardListPage;

        test.beforeEach(async ({ page }) => {
            // Note: Relies on test environment having sample dashboards already created
            // Original Cypress test used cy.createSampleDashboards([0, 1, 2, 3])
            // For Playwright, sample dashboards should be created via backend fixtures
            // or global test setup rather than per-test API calls
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

        test.skip('should delete correctly in list mode', async () => {
            // Skipped in original Cypress test
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

        test('should edit correctly', async ({ page }) => {
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