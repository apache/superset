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
import rison from 'rison';
import { ExplorePage } from '../../pages/ExplorePage';

// Partial migration of Cypress chart.test.js
// Complex dashboard/chart fixture creation (createSampleDashboards/createSampleCharts) omitted.
// Cross-referenced dashboards flow kept skipped until fixture strategy defined for Playwright.

test.describe('Cross-referenced dashboards (migrated)', () => {
    test.skip('should show the cross-referenced dashboards', async ({ page }) => {
        const explore = new ExplorePage(page);
        await explore.gotoChartList();
        await explore.clickChartInList('1 - Sample chart');
        await explore.waitForV1ChartData();
        await expect(explore.getMetadataBar()).toContainText('Not added');
    });
});

test.describe('No Results', () => {
    test('No results message shows up', async ({ page }) => {
        const formData = {
            viz_type: 'echarts_timeseries_line',
            datasource: 'birth_names', // relies on default test data
            time_range: 'No filter',
            metrics: ['num'],
            adhoc_filters: [
                {
                    expressionType: 'SIMPLE',
                    subject: 'state',
                    operator: 'IN',
                    comparator: ['Fake State'],
                    clause: 'WHERE',
                    sqlExpression: null,
                },
            ],
        };
        const url = `/explore/?form_data=${encodeURIComponent(rison.encode(formData))}`;
        await page.goto(url);
        // Wait for chart data GET
        await page.waitForResponse(r => r.url().includes('/api/v1/chart/data') && r.request().method() === 'GET');
        await expect(page.locator('div.chart-container')).toContainText('No results were returned for this query');
    });
});
// chart.test.ts -> chart.spec.ts