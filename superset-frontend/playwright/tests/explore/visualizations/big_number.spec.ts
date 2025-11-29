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

import { test, expect, type Page } from '@playwright/test';
import rison from 'rison';

/**
 * Migration of cypress/e2e/explore/visualizations/big_number.test.js
 * Mirrors the three scenarios: base render, no subheader, hidden trendline.
 */

test.describe('Visualization > Big Number with Trendline', () => {
    const BIG_NUMBER_FORM_DATA = {
        datasource: '2__table',
        viz_type: 'big_number',
        slice_id: 42,
        granularity_sqla: 'year',
        time_grain_sqla: 'P1D',
        time_range: '2000 : 2014-01-02',
        metric: 'sum__SP_POP_TOTL',
        adhoc_filters: [],
        compare_lag: '10',
        compare_suffix: 'over 10Y',
        y_axis_format: '.3s',
        show_trend_line: true,
        start_y_axis_at_zero: true,
        color_picker: {
            r: 0,
            g: 122,
            b: 135,
            a: 1,
        },
    } as const;

    async function visitBigNumber(page: Page, formData: typeof BIG_NUMBER_FORM_DATA) {
        const url = `/explore/?form_data=${encodeURIComponent(rison.encode(formData))}`;
        const waitForData = page.waitForResponse(
            response => response.url().includes('/api/v1/chart/data') || response.url().includes('/superset/explore_json/'),
            { timeout: 60000 },
        );
        await Promise.all([page.goto(url), waitForData]);
    }

    test('should render big number with trendline', async ({ page }) => {
        await visitBigNumber(page, BIG_NUMBER_FORM_DATA);
        await expect(page.locator('.chart-container .header-line')).toBeVisible();
        await expect(page.locator('.chart-container canvas')).toBeVisible();
    });

    test('should hide subheader when compare lag missing', async ({ page }) => {
        await visitBigNumber(page, { ...BIG_NUMBER_FORM_DATA, compare_lag: null });
        await expect(page.locator('.chart-container .header-line')).toBeVisible();
        await expect(page.locator('.chart-container .subtitle-line')).toHaveCount(0);
        await expect(page.locator('.chart-container canvas')).toBeVisible();
    });

    test('should hide trendline when disabled', async ({ page }) => {
        await visitBigNumber(page, { ...BIG_NUMBER_FORM_DATA, show_trend_line: false });
        await expect(page.locator('[data-test="chart-container"] .header-line')).toBeVisible();
        await expect(page.locator('[data-test="chart-container"] canvas')).toHaveCount(0);
    });
});
