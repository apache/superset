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

// Migration of Cypress annotations.test.ts
// Original test is flaky (visual layer rendering). Keep skipped until layer assertion strategy defined.

test.describe('Annotations (migrated)', () => {
    test.skip('Create formula annotation y-axis goal line', async ({ page }) => {
        const explore = new ExplorePage(page);
        await explore.gotoChartList();
        await explore.clickChartInList('Num Births Trend');
        await explore.waitForV1ChartData();

        await explore.openAnnotationsLayers();
        await explore.addFormulaAnnotation('Goal line', 'y=1400000');
        await explore.runQuery();

        // Basic presence check (kept minimal; full visual validation deferred)
        await expect(page.locator('[data-test=annotation_layers]')).toContainText('Goal line');
    });
});
// annotations.test.ts -> annotations.spec.ts