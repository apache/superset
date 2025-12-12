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
 * Migration of Cypress query.test.ts (all tests originally skipped).
 * Tests remain skipped to preserve parity and avoid flakiness until stabilized.
 * Page object actions are implemented so enabling them later is straightforward.
 */

test.describe('SqlLab query panel (migrated, skipped)', () => {
    let sqlLab: SqlLabPage;

    test.beforeEach(async ({ page }) => {
        sqlLab = new SqlLabPage(page);
        await sqlLab.goto();
    });

    test.skip('supports entering and running a query', async () => {
        // Set a simple query
        await sqlLab.setEditorContent('SELECT 1');

        // Run query & capture timer before and after
        const timerBefore = await sqlLab.getTimerLabel().textContent();
        await sqlLab.runQuery();
        const timerAfter = await sqlLab.getTimerLabel().textContent();

        expect(timerBefore).not.toBeNull();
        expect(timerAfter).not.toBeNull();
        // Basic assertion that timer resets (contains 00:00 at some point)
        expect(timerBefore?.includes('00:00')).toBeTruthy();
    });

    test.skip('successfully saves a query (placeholder)', async () => {
        // Implementation would:
        // 1. Enter query
        // 2. Run query
        // 3. Open save modal
        // 4. Enter name & save
        // 5. Re-load saved query & re-run
        // 6. Compare results sets
        // Left skipped; requires stable fixtures & modal selectors.
    });

    test.skip('Create a chart from a query', async () => {
        await sqlLab.setEditorContent('SELECT gender, name FROM birth_names');
        await sqlLab.runQuery();
        await sqlLab.createChartFromQuery();

        // Validate chart explore basics (column presence)
        await expect(sqlLab.getDatasourceTitle()).toContainText(
            'SELECT gender, name',
        );
        const columnLabels = sqlLab.getColumnOptionLabels();
        await expect(columnLabels.first()).toContainText('gender');
        await expect(columnLabels.last()).toContainText('name');
    });
});