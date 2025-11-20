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
import { ExplorePage } from '../../pages/ExplorePage';

/**
 * Migration of Cypress advanced_analytics.test.ts
 * - Collapses intercept logic into response waits
 * - Uses ExplorePage abstractions for advanced analytics interaction
 */

test.describe('Advanced analytics', () => {
    let explore: ExplorePage;

    test.beforeEach(async ({ page }) => {
        explore = new ExplorePage(page);
        await explore.gotoChartList();
        await explore.clickChartInList('Num Births Trend');
        await explore.waitForV1ChartData();
    });

    test('Create custom time compare', async () => {
        await explore.expandAdvancedAnalytics();
        await explore.addTimeCompare(['28 days', '1 year']);
        await explore.runQuery();

        // Reload to simulate persistence check
        await explore.rawPage.reload();
        await explore.waitForV1ChartData();
        await explore.expandAdvancedAnalytics();
        // Verify time compare selections appear (basic presence check)
        const selector = '[data-test="time_compare"] .ant-select-selector';
        await expect(explore.rawPage.locator(selector)).toContainText('28 days');
        await expect(explore.rawPage.locator(selector)).toContainText('1 year');
    });
});