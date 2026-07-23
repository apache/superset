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
 * Captures viz-picker gallery thumbnails from live example charts.
 *
 * This is a maintenance tool, not a test: it renders each example chart
 * standalone and overwrites the target plugin image with a fresh 512x512
 * screenshot. It only runs when CAPTURE_THUMBNAILS=1 is set, so the
 * regular Playwright suites never execute it.
 *
 * Usage (requires a running Superset with examples loaded):
 *   CAPTURE_THUMBNAILS=1 npx playwright test tests/tools/capture-viz-thumbnails.spec.ts --project chromium
 *
 * Notes:
 * - Only light-theme images are captured; `thumbnail-dark.png` variants
 *   are left untouched.
 * - New gallery images (e.g. the Line percent-change example) still need
 *   to be registered in the plugin's metadata before they render in the
 *   gallery; the capture logs a reminder for any non-thumbnail output.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@playwright/test';

const THUMBNAIL_SIZE = 512;
const RENDERED_CHART_SELECTOR =
  '[data-test="chart-container"]:has(svg, canvas, table):not(:has([data-test="loading-indicator"]))';

/** superset-frontend root, resolved from this spec's location. */
const FRONTEND_ROOT = path.resolve(__dirname, '..', '..', '..');

interface CaptureTarget {
  /** slice_name of the example chart to render */
  sliceName: string;
  /** output path relative to superset-frontend */
  output: string;
}

const TARGETS: CaptureTarget[] = [
  // Charts from the Misc Charts example dashboard
  {
    sliceName: 'Total Sales Bullet',
    output: 'plugins/plugin-chart-echarts/src/Bullet/images/thumbnail.png',
  },
  {
    sliceName: 'Sales Period Pivot',
    output: 'plugins/plugin-chart-echarts/src/TimePivot/images/thumbnail.png',
  },
  {
    sliceName: 'Population Nightingale Rose',
    output: 'plugins/plugin-chart-rose/src/images/thumbnail.png',
  },
  {
    sliceName: 'Sales Calendar Heatmap',
    output: 'plugins/plugin-chart-calendar/src/images/thumbnail.png',
  },
  {
    sliceName: 'Population Partition',
    output: 'plugins/plugin-chart-partition/src/images/thumbnail.png',
  },
  {
    sliceName: 'Population Paired t-Test',
    output: 'plugins/plugin-chart-paired-t-test/src/images/thumbnail.png',
  },
  {
    sliceName: 'Region Population Time Table',
    output: 'src/visualizations/TimeTable/images/thumbnail.png',
  },
  {
    // Gallery example for the Line chart's percent-change mode; register
    // it in the Line plugin metadata after capturing.
    sliceName: 'Population Percent Change',
    output:
      'plugins/plugin-chart-echarts/src/Timeseries/Regular/Line/images/Line3.png',
  },
  // Migrated charts whose examples live on other dashboards
  {
    sliceName: 'Parallel Coordinates',
    output:
      'plugins/plugin-chart-parallel-coordinates/src/images/thumbnail.png',
  },
  {
    sliceName: 'Birth in France by department in 2016',
    output: 'plugins/plugin-chart-country-map/src/images/thumbnail.png',
  },
  {
    sliceName: 'Cross Channel Relationship',
    output: 'plugins/plugin-chart-chord/src/images/thumbnail.png',
  },
  {
    sliceName: 'Seasonality of Revenue (per Product Line)',
    output: 'plugins/plugin-chart-horizon/src/images/thumbnail.png',
  },
  {
    sliceName: '% Rural',
    output: 'plugins/plugin-chart-world-map/src/images/thumbnail.png',
  },
];

test.describe('capture viz thumbnails', () => {
  test.skip(
    !process.env.CAPTURE_THUMBNAILS,
    'Thumbnail capture only runs with CAPTURE_THUMBNAILS=1',
  );

  for (const target of TARGETS) {
    test(`captures ${target.sliceName}`, async ({ page }) => {
      test.setTimeout(90_000);

      // Look up the slice id by name via the chart API
      const query = encodeURIComponent(
        `(filters:!((col:slice_name,opr:eq,value:'${target.sliceName.replace(
          /'/g,
          "''",
        )}')))`,
      );
      const response = await page.request.get(`/api/v1/chart/?q=${query}`);
      expect(response.ok()).toBeTruthy();
      const { result } = await response.json();
      expect(
        result.length,
        `example chart "${target.sliceName}" not found — are examples loaded?`,
      ).toBeGreaterThan(0);
      const sliceId = result[0].id;

      // Render the chart alone at thumbnail size and wait for real content
      await page.setViewportSize({
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE,
      });
      await page.goto(`/explore/?slice_id=${sliceId}&standalone=1`);
      await page
        .locator(RENDERED_CHART_SELECTOR)
        .first()
        .waitFor({ state: 'visible', timeout: 60_000 });
      // Give animations/tiles a moment to settle before the still
      await page.waitForTimeout(2_000);

      const outputPath = path.join(FRONTEND_ROOT, target.output);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      await page.screenshot({ path: outputPath });

      // eslint-disable-next-line no-console
      console.log(`captured ${target.sliceName} -> ${target.output}`);
      if (!target.output.endsWith('thumbnail.png')) {
        // eslint-disable-next-line no-console
        console.log(
          `NOTE: ${target.output} is a new gallery image — register it in the plugin metadata (exampleGallery) to surface it.`,
        );
      }
    });
  }
});
