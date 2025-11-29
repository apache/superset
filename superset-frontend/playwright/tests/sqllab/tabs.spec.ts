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
import { SqlLabPage } from '../../pages/SqlLabPage';

/**
 * Migration of Cypress tabs.test.ts to Playwright.
 * Cypress patterns replaced:
 * - cy.visit -> page.goto (SqlLabPage.goto)
 * - cy.get(selector).then(...) counting -> locator.count() & evaluateAll
 * - cy.contains -> locator.filter({ hasText }) / expect().toContainText
 * - Force clicks retained where necessary due to hidden icons
 */

test.describe('SqlLab query tabs', () => {
    let sqlLab: SqlLabPage;

    test.beforeEach(async ({ page }) => {
        sqlLab = new SqlLabPage(page);
        await sqlLab.goto();
    });

    test('allows you to create and close a tab', async ({ page }) => {
        const tabsLocator = sqlLab.getTabs();
        const initialTabCount = await tabsLocator.count();

        // Determine highest Untitled Query number
        const titles = await tabsLocator.allTextContents();
        const untitledNumbers = titles
            .map(t => Number(t.match(/Untitled Query (\d+)/)?.[1] || 0))
            .filter(n => n > 0);
        const initialUntitledMax = untitledNumbers.length
            ? Math.max(...untitledNumbers)
            : 0;

        // Add two new tabs
        await sqlLab.addTabViaButton();
        await expect(tabsLocator).toHaveCount(initialTabCount + 1);
        await expect(tabsLocator.last()).toContainText(
            `Untitled Query ${initialUntitledMax + 1}`,
        );

        await sqlLab.addTabViaButton();
        await expect(tabsLocator).toHaveCount(initialTabCount + 2);
        await expect(tabsLocator.last()).toContainText(
            `Untitled Query ${initialUntitledMax + 2}`,
        );

        // Close last tab via dropdown menu option
        await sqlLab.closeLastTabViaMenu();
        await expect(tabsLocator).toHaveCount(initialTabCount + 1);
        await expect(tabsLocator.last()).toContainText(
            `Untitled Query ${initialUntitledMax + 1}`,
        );

        // Close remaining added tab via remove icon
        await sqlLab.clickLastRemoveIcon();
        await expect(tabsLocator).toHaveCount(initialTabCount);
    });

    test('opens a new tab by a button and a shortcut', async ({ page }) => {
        const tabsLocator = sqlLab.getTabs();
        const initialTabCount = await tabsLocator.count();
        const titles = await tabsLocator.allTextContents();
        const untitledNumbers = titles
            .map(t => Number(t.match(/Untitled Query (\d+)/)?.[1] || 0))
            .filter(n => n > 0);
        const initialUntitledMax = untitledNumbers.length
            ? Math.max(...untitledNumbers)
            : 0;

        // Configure editor settings (simulate content + limit)
        await sqlLab.setEditorContent('some random query string');
        await sqlLab.configureRowLimit();

        // Add tab via button
        await sqlLab.addTabViaButton();
        await expect(tabsLocator).toHaveCount(initialTabCount + 1);
        await expect(tabsLocator.last()).toContainText(
            `Untitled Query ${initialUntitledMax + 1}`,
        );
        await expect(sqlLab.getEditorContent()).toContainText('SELECT ...');
        await expect(page.locator('#js-sql-toolbar .limitDropdown').first()).toContainText(
            '10',
        );

        // Close tab
        await sqlLab.clickLastRemoveIcon();
        await expect(tabsLocator).toHaveCount(initialTabCount);

        // Add tab via shortcut
        await sqlLab.addTabViaShortcut();
        await expect(tabsLocator).toHaveCount(initialTabCount + 1);
        await expect(tabsLocator.last()).toContainText(
            `Untitled Query ${initialUntitledMax + 1}`,
        );
        await expect(sqlLab.getEditorContent()).toContainText('SELECT ...');
        await expect(page.locator('#js-sql-toolbar .limitDropdown').first()).toContainText(
            '10',
        );
    });
});