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
 * Regression for #32960: the `formatDate` Handlebars helper renders a real
 * formatted date instead of a "... is not a function" helper error. CI green
 * closes #32960; CI red means the fix is still needed in the Handlebars plugin
 * (superset-frontend/plugins/plugin-chart-handlebars).
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPost } from '../../helpers/api/requests';
import { getDatasetByName } from '../../helpers/api/dataset';
import { TIMEOUT } from '../../utils/constants';

const DATASET_NAME = 'birth_names';

testWithAssets(
  'Handlebars formatDate helper renders a formatted date (#32960)',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const dataset = await getDatasetByName(page, DATASET_NAME);
    if (!dataset) {
      throw new Error(`Dataset ${DATASET_NAME} not found`);
    }
    const datasetId = dataset.id;

    const params = {
      datasource: `${datasetId}__table`,
      viz_type: 'handlebars',
      query_mode: 'aggregate',
      groupby: ['ds'],
      metrics: ['count'],
      adhoc_filters: [],
      row_limit: 5,
      handlebarsTemplate:
        "<ul class='data-list'>{{#each data}}" +
        "<li class='hb-item'>{{formatDate 'DD.MM.YYYY' ds}}</li>" +
        '{{/each}}</ul>',
      styleTemplate: '',
    };

    const chartResp = await apiPost(page, 'api/v1/chart/', {
      slice_name: `handlebars_format_date_${Date.now()}`,
      viz_type: 'handlebars',
      datasource_id: datasetId,
      datasource_type: 'table',
      params: JSON.stringify(params),
    });
    expect(chartResp.ok()).toBe(true);
    const chartId: number = (await chartResp.json()).id;
    testAssets.trackChart(chartId);

    await page.goto(`explore/?slice_id=${chartId}`);
    await page.waitForSelector('[data-test="datasource-control"]', {
      timeout: 30_000,
    });

    const panel = page.locator('[data-test="chart-container"]');
    await panel.waitFor({ state: 'visible', timeout: 30_000 });

    // The helper error surfaces as a "... is not a function" message rendered
    // in place of the chart content.
    await expect(panel).not.toContainText('is not a function', {
      timeout: 20_000,
    });

    // At least one list item should contain a DD.MM.YYYY formatted date.
    await expect(panel.locator('li.hb-item').first()).toHaveText(
      /\d{2}\.\d{2}\.\d{4}/,
      { timeout: 20_000 },
    );
  },
);
