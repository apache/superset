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
 * Dashboard filters test suite.
 * Tests filtering functionality for Owner, Modified by, and Status filters.
 *
 * Migration notes from Cypress:
 * - Replaced cy.visit() with page object goto()
 * - Replaced setGridMode() helper with page object method
 * - Replaced clearAllInputs() helper with page object method
 * - Replaced setFilter() helper with page object method that handles API waits
 * - Uses beforeEach instead of before for better test isolation (Playwright best practice)
 */
test.describe('Dashboards filters', () => {
    let dashboardListPage: DashboardListPage;

    test.beforeEach(async ({ page }) => {
        dashboardListPage = new DashboardListPage(page);
        await dashboardListPage.goto();
        await dashboardListPage.setGridMode('card');
    });

    test('should allow filtering by "Owner" correctly', async () => {
        await dashboardListPage.clearAllInputs();
        await dashboardListPage.setFilter('Owner', 'alpha user');
        await dashboardListPage.setFilter('Owner', 'admin user');
    });

    test('should allow filtering by "Modified by" correctly', async () => {
        await dashboardListPage.clearAllInputs();
        await dashboardListPage.setFilter('Modified by', 'alpha user');
        await dashboardListPage.setFilter('Modified by', 'admin user');
    });

    test('should allow filtering by "Status" correctly', async () => {
        await dashboardListPage.clearAllInputs();
        await dashboardListPage.setFilter('Status', 'Published');
        await dashboardListPage.setFilter('Status', 'Draft');
    });
});