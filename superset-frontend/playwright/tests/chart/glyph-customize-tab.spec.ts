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
 * Smoke test: Glyph-defined chart's Customize tab renders via GlyphOptionsPanel.
 *
 * Glyph charts (those built with defineChart) replace the legacy controlPanel.ts
 * file with declarative arg definitions. Their Customize tab is rendered by
 * GlyphOptionsPanel (a native React renderer) instead of the legacy
 * ControlSetRow pipeline. This test verifies that path actually works end-to-end:
 * open the Pie chart explore page, switch to Customize, and confirm a known
 * glyph control (Show legend) is rendered.
 */

import { testWithAssets, expect } from '../../helpers/fixtures';
import { ExplorePage } from '../../pages/ExplorePage';
import { apiPostChart } from '../../helpers/api/chart';
import { getDatasetByName } from '../../helpers/api/dataset';

const test = testWithAssets;

test('Pie chart Customize tab renders glyph controls', async ({
  page,
  testAssets,
}) => {
  // 1. Create a real Pie chart via API so we have something to load.
  const dataset = await getDatasetByName(page, 'members_channels_2');
  if (!dataset) {
    throw new Error(
      'members_channels_2 dataset not found — run Superset with --load-examples',
    );
  }

  const name = `glyph_pie_${Date.now()}_${test.info().parallelIndex}`;
  const response = await apiPostChart(page, {
    slice_name: name,
    datasource_id: dataset.id,
    datasource_type: 'table',
    viz_type: 'pie',
    params: JSON.stringify({
      viz_type: 'pie',
      groupby: ['channel'],
      metric: {
        aggregate: 'COUNT',
        column: null,
        expressionType: 'SIMPLE',
        label: 'count',
      },
      adhoc_filters: [],
      row_limit: 100,
      show_legend: true,
    }),
  });
  if (!response.ok()) {
    throw new Error(`Failed to create Pie chart: ${response.status()}`);
  }
  const body = await response.json();
  const id = body.result?.id ?? body.id;
  testAssets.trackChart(id);

  // 2. Open the Explore page for this chart.
  await page.goto(`/explore/?slice_id=${id}`);

  const explore = new ExplorePage(page);
  await explore.waitForPageLoad();

  // 3. Switch to the Customize tab. This is what triggers GlyphOptionsPanel
  //    to render — without it we'd be looking at the Data tab.
  await page.getByRole('tab', { name: 'Customize' }).click();

  // 4. The Customize tab should show at least one Chart Options collapse header.
  //    Both the section label and a known glyph arg (Show legend) belong to Pie,
  //    so we assert on the arg label to prove the native glyph renderer ran.
  await expect(page.getByText('Show legend').first()).toBeVisible();
});
