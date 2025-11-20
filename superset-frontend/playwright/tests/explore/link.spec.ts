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
import { nanoid } from 'nanoid';
import { ExplorePage } from '../../pages/ExplorePage';

// Migration of link.test.ts
// API verification (request counts) and deletion helpers omitted; relies on backend fixtures.

test.describe('Explore links', () => {
    let explore: ExplorePage;

    test.beforeEach(async ({ page }) => {
        explore = new ExplorePage(page);
        await explore.gotoChartList();
        await explore.clickChartInList('Growth Rate');
        await explore.waitForV1ChartData();
    });

    test('Open and close view query modal', async ({ page }) => {
        await explore.openViewQueryModal();
        await expect(page.locator('code')).toBeVisible();
        await page.locator('.ant-modal-close').first().click();
        await expect(page.locator('.ant-modal-content')).toHaveCount(0); // closes
    });

    test('Iframe link (embed code)', async ({ page }) => {
        await explore.openSharePopover();
        await explore.openEmbedCode();
        await expect(page.locator('#embed-code-popover textarea[name=embedCode]')).toContainText('iframe');
    });

    test('Chart save as AND overwrite', async ({ page }) => {
        const newChartName = `Test chart [${nanoid()}]`;
        // Save As
        await explore.startSaveChart();
        await explore.chooseSaveAs();
        await explore.setNewChartName(newChartName);
        await explore.confirmSave();
        await explore.waitForV1ChartData();

        // Navigate back to list and open new chart (basic validation)
        await explore.gotoChartList();
        await explore.clickChartInList(newChartName);
        await explore.waitForV1ChartData();

        // Overwrite
        await explore.startSaveChart();
        await explore.chooseOverwrite();
        await explore.confirmSave();
        await explore.waitForV1ChartData();
        await expect(explore.getMetadataBar()).toBeVisible();
    });

    test('Chart save as and add to new dashboard', async ({ page }) => {
        const baseName = 'Growth Rate';
        const newChartName = `${baseName} [${nanoid()}]`;
        const dashboardTitle = `Test dashboard [${nanoid()}]`;
        // Save As + new dashboard
        await explore.startSaveChart();
        await explore.chooseSaveAs();
        await explore.setNewChartName(newChartName);
        await explore.selectDashboardInSaveModal(dashboardTitle);
        await explore.confirmSave();
        await explore.waitForV1ChartData();

        // Open newly saved chart
        await explore.gotoChartList();
        await explore.clickChartInList(newChartName);
        await explore.waitForV1ChartData();
        await expect(explore.getMetadataBar()).toBeVisible();
    });
});
// link.tests.ts -> link.spec.ts