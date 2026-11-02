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

/**
 * Migrated from the Cypress `describe.skip('No Results', ...)` block in
 * explore/chart.test.js, which was skipped due to a hardcoded datasource id
 * (`3__table`). This version resolves the dataset by name instead.
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { ExplorePage } from '../../pages/ExplorePage';
import { TIMEOUT } from '../../utils/constants';
import { createExploreTestChart } from './explore-test-helpers';

testWithAssets(
  'chart with a filter matching no rows shows "No results"',
  async ({ page, testAssets }, testInfo) => {
    const { id: chartId } = await createExploreTestChart(
      page,
      testAssets,
      testInfo,
      {
        prefix: 'explore_no_results',
        adhocFilters: [
          {
            expressionType: 'SIMPLE',
            subject: 'state',
            operator: 'IN',
            comparator: ['Fake State'],
            clause: 'WHERE',
          },
        ],
      },
    );

    const explorePage = new ExplorePage(page);
    await explorePage.goto(chartId);

    await expect(explorePage.getChartContainer()).toContainText(
      'No results were returned for this query',
      { timeout: TIMEOUT.CHART_RENDER },
    );
  },
);
