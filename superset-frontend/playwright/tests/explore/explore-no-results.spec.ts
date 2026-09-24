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
import { apiPostChart } from '../../helpers/api/chart';
import { getDatasetByName } from '../../helpers/api/dataset';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import { ExplorePage } from '../../pages/ExplorePage';
import { TIMEOUT } from '../../utils/constants';

const DATASET_NAME = 'birth_names';

testWithAssets(
  'chart with a filter matching no rows shows "No results"',
  async ({ page, testAssets }, testInfo) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) throw new Error(`Dataset ${DATASET_NAME} not found`);

    const params = {
      datasource: `${dataset.id}__table`,
      viz_type: 'table',
      query_mode: 'raw',
      all_columns: ['name', 'gender', 'num'],
      adhoc_filters: [
        {
          expressionType: 'SIMPLE',
          subject: 'state',
          operator: 'IN',
          comparator: ['Fake State'],
          clause: 'WHERE',
        },
      ],
      order_by_cols: [],
      row_limit: 1000,
      server_pagination: false,
    };

    const resp = await apiPostChart(page, {
      slice_name: `explore_no_results_${Date.now()}_${testInfo.parallelIndex}`,
      viz_type: 'table',
      datasource_id: dataset.id,
      datasource_type: 'table',
      params: JSON.stringify(params),
    });
    expect(resp.ok()).toBe(true);
    const chartId = await extractIdFromResponse(resp);
    testAssets.trackChart(chartId);

    const explorePage = new ExplorePage(page);
    const chartQueryFinished = page.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/v1/chart/data'),
      { timeout: TIMEOUT.API_RESPONSE },
    );
    await explorePage.goto(chartId);
    await chartQueryFinished;

    await expect(explorePage.getChartContainer()).toContainText(
      'No results were returned for this query',
      { timeout: TIMEOUT.CHART_RENDER },
    );
  },
);
