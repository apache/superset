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
 * Regression for #32960: the `formatDate` Handlebars helper (provided by
 * just-handlebars-helpers) stopped working after 4.1.2, rendering
 * "i is not a function" (minified) / "moment is not a function" (dev) instead
 * of the formatted date. The library helper resolves `moment` lazily via
 * `global.moment` / `require('moment/min/moment-with-locales')`, which the
 * bundled HandlebarsViewer no longer satisfies (it switched to dayjs).
 *
 * The fix registers a dayjs-backed `formatDate` override in HandlebarsViewer
 * (superset-frontend/plugins/plugin-chart-handlebars). This spec guards it: it
 * creates a Handlebars chart whose template uses `{{formatDate 'DD.MM.YYYY' ds}}`
 * and asserts the chart renders a real formatted date rather than the helper
 * error. Because the failure was a bundling/minification artifact (moment
 * resolves fine under Jest's Node `require`), an E2E test is required to cover it.
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPostChart } from '../../helpers/api/chart';
import { getDatasetByName } from '../../helpers/api/dataset';
import { ExplorePage } from '../../pages/ExplorePage';
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
      // Note: HTML_SANITIZATION (on by default) strips non-allowlisted
      // attributes such as `class`, so the rendered markup is plain
      // <ul>/<li> elements. The assertions below target `li` directly.
      handlebarsTemplate:
        '<ul>{{#each data}}' +
        "<li>{{formatDate 'DD.MM.YYYY' ds}}</li>" +
        '{{/each}}</ul>',
      styleTemplate: '',
    };

    const chartResp = await apiPostChart(page, {
      slice_name: `handlebars_format_date_${Date.now()}`,
      viz_type: 'handlebars',
      datasource_id: datasetId,
      datasource_type: 'table',
      params: JSON.stringify(params),
    });
    expect(chartResp.ok()).toBe(true);
    // The chart API may return either a top-level `{ id }` or a wrapped
    // `{ result: { id } }` shape; handle both and fail explicitly otherwise.
    const chartBody = await chartResp.json();
    const chartId: number = chartBody.result?.id ?? chartBody.id;
    expect(chartId, 'chart creation should return an id').toBeTruthy();
    testAssets.trackChart(chartId);

    const explorePage = new ExplorePage(page);
    await explorePage.goto(chartId);

    const panel = explorePage.getChartContainer();
    await panel.waitFor({ state: 'visible', timeout: TIMEOUT.PAGE_LOAD });

    // The helper error surfaces as a "... is not a function" message rendered
    // in place of the chart content.
    await expect(panel).not.toContainText('is not a function', {
      timeout: TIMEOUT.API_RESPONSE,
    });

    // At least one list item should contain a DD.MM.YYYY formatted date.
    await expect(panel.locator('li').first()).toHaveText(
      /\d{2}\.\d{2}\.\d{4}/,
      {
        timeout: TIMEOUT.API_RESPONSE,
      },
    );
  },
);
