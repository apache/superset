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
 * Replaces the Cypress "Download Chart > download chart with image works"
 * spec, which was skipped once its hardcoded slice id stopped resolving. The
 * image capture itself is unit tested (src/utils/downloadAsImage.test.ts);
 * this proves the Explore menu wiring produces a real browser download.
 */
import { readFile } from 'fs/promises';
import { testWithAssets, expect } from '../../helpers/fixtures';
import { ExplorePage } from '../../pages/ExplorePage';
import { TIMEOUT } from '../../utils/constants';
import { createExploreTestChart } from './explore-test-helpers';

const JPEG_MAGIC = [0xff, 0xd8, 0xff];

testWithAssets(
  'exporting a chart screenshot as jpeg downloads a jpeg file',
  async ({ page, testAssets }, testInfo) => {
    const { id: chartId } = await createExploreTestChart(
      page,
      testAssets,
      testInfo,
      { prefix: 'explore_download_image' },
    );

    const explorePage = new ExplorePage(page);
    await explorePage.goto(chartId);
    // Capture only once the chart has painted, not its loading state.
    await expect(
      explorePage
        .getChartContainer()
        .locator('table tbody tr:not(:has(.dt-no-results))')
        .first(),
    ).toBeVisible({ timeout: TIMEOUT.CHART_RENDER });

    const download = await explorePage.downloadFromExportAllData(
      'Export screenshot (jpeg)',
    );

    // The file is named after the kebab-cased chart name.
    expect(download.suggestedFilename()).toMatch(
      /^explore-download-image-.*\.jpg$/,
    );
    const bytes = await readFile(await download.path());
    expect([...bytes.subarray(0, 3)]).toEqual(JPEG_MAGIC);
  },
);
