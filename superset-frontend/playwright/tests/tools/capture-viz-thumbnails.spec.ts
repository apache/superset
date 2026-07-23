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
 * Crawls every dashboard on the target instance and refreshes viz-picker
 * gallery thumbnails from live example charts.
 *
 * This is a maintenance tool, not a test: charts are DISCOVERED via the
 * API (dashboards -> charts), so it keeps working as example dashboards
 * evolve. For each viz type found, one representative chart is rendered
 * standalone at 512x512 and the plugin's `thumbnail.png` is overwritten.
 * The only static piece is the viz type -> image path map below, which
 * changes when plugins are added or moved — never when examples change.
 * Viz types found on dashboards but missing from the map are reported at
 * the end without failing the run.
 *
 * It only runs when CAPTURE_THUMBNAILS=1 is set, so the regular
 * Playwright suites never execute it.
 *
 * Usage (requires a running Superset with examples loaded):
 *   npm run playwright:thumbnails
 *   VIZ_TYPES=bullet,rose npm run playwright:thumbnails   # subset
 *
 * Notes:
 * - Dark variants (`thumbnail-dark.png`, `example-dark.jpg`) are captured
 *   via prefers-color-scheme emulation whenever the sibling file exists;
 *   if the app ignores the emulation (dark theming disabled) the dark
 *   file is left untouched.
 * - New gallery images (e.g. the Line percent-change example) still need
 *   to be registered in the plugin's metadata before they render in the
 *   gallery; the capture logs a reminder for any new image.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect, Page } from '@playwright/test';

const THUMBNAIL_SIZE = 512;
const RENDERED_CHART_SELECTOR =
  '[data-test="chart-container"]:has(svg, canvas, table):not(:has([data-test="loading-indicator"]))';
/**
 * Charts that render plain markup — no svg/canvas/table for the rendered
 * selector to key on — get a looser signal plus a longer settle.
 */
const TEXT_ONLY_VIZ_TYPES = new Set([
  'ag-grid-table',
  'big_number_total',
  'handlebars',
  'pop_kpi',
]);
const TEXT_RENDERED_CHART_SELECTOR =
  '[data-test="chart-container"]:not(:has([data-test="loading-indicator"]))';

/** superset-frontend root, resolved from this spec's location. */
const FRONTEND_ROOT = path.resolve(__dirname, '..', '..', '..');

const ECHARTS = 'plugins/plugin-chart-echarts/src';
const DECKGL = 'plugins/preset-chart-deckgl/src/layers';

/**
 * Where each viz type's gallery thumbnail lives, relative to
 * superset-frontend. One entry per registered viz type with a thumbnail;
 * add a line when a new plugin ships.
 */
const VIZ_TYPE_THUMBNAILS: Record<string, string> = {
  'ag-grid-table':
    'plugins/plugin-chart-ag-grid-table/src/images/thumbnail.png',
  big_number: `${ECHARTS}/BigNumber/BigNumberWithTrendline/images/thumbnail.png`,
  big_number_total: `${ECHARTS}/BigNumber/BigNumberTotal/images/thumbnail.png`,
  box_plot: `${ECHARTS}/BoxPlot/images/thumbnail.png`,
  bubble_v2: `${ECHARTS}/Bubble/images/thumbnail.png`,
  bullet: `${ECHARTS}/Bullet/images/thumbnail.png`,
  cal_heatmap: 'plugins/plugin-chart-calendar/src/images/thumbnail.png',
  cartodiagram: 'plugins/plugin-chart-cartodiagram/src/images/thumbnail.png',
  chord: 'plugins/plugin-chart-chord/src/images/thumbnail.png',
  country_map: 'plugins/plugin-chart-country-map/src/images/thumbnail.png',
  deck_arc: `${DECKGL}/Arc/images/thumbnail.png`,
  deck_contour: `${DECKGL}/Contour/images/thumbnail.png`,
  deck_geojson: `${DECKGL}/Geojson/images/thumbnail.png`,
  deck_grid: `${DECKGL}/Grid/images/thumbnail.png`,
  deck_heatmap: `${DECKGL}/Heatmap/images/thumbnail.png`,
  deck_hex: `${DECKGL}/Hex/images/thumbnail.png`,
  deck_multi: 'plugins/preset-chart-deckgl/src/Multi/images/thumbnail.png',
  deck_path: `${DECKGL}/Path/images/thumbnail.png`,
  deck_polygon: `${DECKGL}/Polygon/images/thumbnail.png`,
  deck_scatter: `${DECKGL}/Scatter/images/thumbnail.png`,
  deck_screengrid: `${DECKGL}/Screengrid/images/thumbnail.png`,
  echarts_area: `${ECHARTS}/Timeseries/Area/images/thumbnail.png`,
  echarts_timeseries: `${ECHARTS}/Timeseries/images/thumbnail.png`,
  echarts_timeseries_bar: `${ECHARTS}/Timeseries/Regular/Bar/images/thumbnail.png`,
  echarts_timeseries_line: `${ECHARTS}/Timeseries/Regular/Line/images/thumbnail.png`,
  echarts_timeseries_scatter: `${ECHARTS}/Timeseries/Regular/Scatter/images/thumbnail.png`,
  echarts_timeseries_smooth: `${ECHARTS}/Timeseries/Regular/SmoothLine/images/thumbnail.png`,
  echarts_timeseries_step: `${ECHARTS}/Timeseries/Step/images/thumbnail.png`,
  funnel: `${ECHARTS}/Funnel/images/thumbnail.png`,
  gantt_chart: `${ECHARTS}/Gantt/images/thumbnail.png`,
  gauge_chart: `${ECHARTS}/Gauge/images/thumbnail.png`,
  graph_chart: `${ECHARTS}/Graph/images/thumbnail.png`,
  handlebars: 'plugins/plugin-chart-handlebars/src/images/thumbnail.png',
  heatmap_v2: `${ECHARTS}/Heatmap/images/thumbnail.png`,
  histogram_v2: `${ECHARTS}/Histogram/images/thumbnail.png`,
  horizon: 'plugins/plugin-chart-horizon/src/images/thumbnail.png',
  mixed_timeseries: `${ECHARTS}/MixedTimeseries/images/thumbnail.png`,
  paired_ttest: 'plugins/plugin-chart-paired-t-test/src/images/thumbnail.png',
  para: 'plugins/plugin-chart-parallel-coordinates/src/images/thumbnail.png',
  partition: 'plugins/plugin-chart-partition/src/images/thumbnail.png',
  pie: `${ECHARTS}/Pie/images/thumbnail.png`,
  pivot_table_v2: 'plugins/plugin-chart-pivot-table/src/images/thumbnail.png',
  point_cluster_map:
    'plugins/plugin-chart-point-cluster-map/src/images/thumbnail.png',
  pop_kpi: `${ECHARTS}/BigNumber/BigNumberPeriodOverPeriod/images/thumbnail.png`,
  radar: `${ECHARTS}/Radar/images/thumbnail.png`,
  rose: 'plugins/plugin-chart-rose/src/images/thumbnail.png',
  sankey_v2: `${ECHARTS}/Sankey/images/thumbnail.png`,
  sunburst_v2: `${ECHARTS}/Sunburst/images/thumbnail.png`,
  table: 'plugins/plugin-chart-table/src/images/thumbnail.png',
  time_pivot: `${ECHARTS}/TimePivot/images/thumbnail.png`,
  time_table: 'src/visualizations/TimeTable/images/thumbnail.png',
  tree_chart: `${ECHARTS}/Tree/images/thumbnail.png`,
  treemap_v2: `${ECHARTS}/Treemap/images/thumbnail.png`,
  waterfall: `${ECHARTS}/Waterfall/images/thumbnail.png`,
  word_cloud: 'plugins/plugin-chart-word-cloud/src/images/thumbnail.png',
  world_map: 'plugins/plugin-chart-world-map/src/images/thumbnail.png',
};

/**
 * When several example charts share a viz type, prefer these slices over
 * the default alphabetically-first pick. Missing slices fall back to the
 * default, so stale entries degrade gracefully.
 */
const PREFERRED_SLICES: Record<string, string> = {
  bullet: 'Total Sales Bullet',
  cal_heatmap: 'Sales Calendar Heatmap',
  paired_ttest: 'Population Paired t-Test',
  partition: 'Population Partition',
  rose: 'Population Nightingale Rose',
  time_pivot: 'Sales Period Pivot',
  time_table: 'Region Population Time Table',
};

/** Gallery example images use a wide aspect, matching the existing art. */
const EXAMPLE_WIDTH = 800;
const EXAMPLE_HEIGHT = 460;

interface ExtraCapture {
  sliceName: string;
  output: string;
  width: number;
  height: number;
}

/**
 * Extra captures beyond the per-viz-type thumbnail: gallery example
 * images that are obsolete (the Bullet/TimePivot/TimeTable examples
 * still show the removed nvd3 renderers) and brand-new gallery images.
 * Register new images in the plugin metadata after capturing.
 */
const EXTRA_CAPTURES: ExtraCapture[] = [
  {
    sliceName: 'Population Percent Change',
    output: `${ECHARTS}/Timeseries/Regular/Line/images/Line3.png`,
    width: EXAMPLE_WIDTH,
    height: EXAMPLE_HEIGHT,
  },
  {
    sliceName: 'Total Sales Bullet',
    output: `${ECHARTS}/Bullet/images/example.jpg`,
    width: EXAMPLE_WIDTH,
    height: EXAMPLE_HEIGHT,
  },
  {
    sliceName: 'Sales Period Pivot',
    output: `${ECHARTS}/TimePivot/images/example.jpg`,
    width: EXAMPLE_WIDTH,
    height: EXAMPLE_HEIGHT,
  },
  {
    sliceName: 'Region Population Time Table',
    output: 'src/visualizations/TimeTable/images/example.jpg',
    width: EXAMPLE_WIDTH,
    height: EXAMPLE_HEIGHT,
  },
];

interface ExampleChart {
  id: number;
  sliceName: string;
  vizType: string;
}

interface DashboardRow {
  id: number;
}

interface DashboardChartRow {
  id?: number;
  slice_name?: string;
  form_data?: { viz_type?: string };
}

/** Pages through a list endpoint, returning every result row. */
async function fetchAllPages<T>(page: Page, endpoint: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 100;
  for (let pageNum = 0; ; pageNum += 1) {
    const q = encodeURIComponent(
      `(page_size:${pageSize},page:${pageNum},order_direction:asc)`,
    );
    const response = await page.request.get(`${endpoint}?q=${q}`);
    expect(response.ok(), `GET ${endpoint} page ${pageNum}`).toBeTruthy();
    const { result }: { result: T[] } = await response.json();
    rows.push(...result);
    if (result.length < pageSize) return rows;
  }
}

/** Discovers every chart placed on any dashboard. */
async function discoverDashboardCharts(page: Page): Promise<ExampleChart[]> {
  const dashboards = await fetchAllPages<DashboardRow>(
    page,
    '/api/v1/dashboard/',
  );
  const chartsById = new Map<number, ExampleChart>();
  for (const dashboard of dashboards) {
    const response = await page.request.get(
      `/api/v1/dashboard/${dashboard.id}/charts`,
    );
    if (!response.ok()) continue;
    const { result }: { result: DashboardChartRow[] } = await response.json();
    for (const chart of result) {
      const vizType = chart.form_data?.viz_type;
      if (chart.id && chart.slice_name && vizType) {
        chartsById.set(chart.id, {
          id: chart.id,
          sliceName: chart.slice_name,
          vizType,
        });
      }
    }
  }
  return [...chartsById.values()];
}

/** thumbnail.png -> thumbnail-dark.png, example.jpg -> example-dark.jpg */
function darkSibling(output: string): string {
  return output.replace(/\.(png|jpg)$/, '-dark.$1');
}

async function renderAndShoot(
  page: Page,
  chart: ExampleChart,
): Promise<Buffer> {
  // An explicit navigation timeout keeps one hung load from stalling the
  // whole crawl until the test timeout.
  await page.goto(`/explore/?slice_id=${chart.id}&standalone=1`, {
    timeout: 60_000,
  });
  const textOnly = TEXT_ONLY_VIZ_TYPES.has(chart.vizType);
  await page
    .locator(textOnly ? TEXT_RENDERED_CHART_SELECTOR : RENDERED_CHART_SELECTOR)
    .first()
    .waitFor({ state: 'visible', timeout: 60_000 });
  // Give animations/map tiles (or text-only chart data) time to settle
  await page.waitForTimeout(textOnly ? 4_000 : 2_000);
  return page.screenshot();
}

/**
 * Captures a chart light and (when a dark variant is wanted) dark. Dark
 * rendering relies on the app following prefers-color-scheme (theme mode
 * SYSTEM); if the dark render is byte-identical to the light one the app
 * ignored the emulation, and the dark file is left untouched rather than
 * overwritten with light-theme art.
 */
async function captureChart(
  page: Page,
  chart: ExampleChart,
  output: string,
  size: { width: number; height: number },
): Promise<void> {
  const outputPath = path.join(FRONTEND_ROOT, output);
  const darkPath = path.join(FRONTEND_ROOT, darkSibling(output));
  const isNewImage = !fs.existsSync(outputPath);
  const wantDark = fs.existsSync(darkPath) || isNewImage;

  await page.setViewportSize(size);
  await page.emulateMedia({ colorScheme: 'light' });
  const lightShot = await renderAndShoot(page, chart);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lightShot);
  // eslint-disable-next-line no-console
  console.log(`captured ${chart.sliceName} (${chart.vizType}) -> ${output}`);

  if (wantDark) {
    await page.emulateMedia({ colorScheme: 'dark' });
    const darkShot = await renderAndShoot(page, chart);
    if (darkShot.equals(lightShot)) {
      // eslint-disable-next-line no-console
      console.log(
        `SKIPPED dark variant for ${chart.sliceName}: the app ignored the dark color-scheme emulation (is dark theming enabled?)`,
      );
    } else {
      fs.writeFileSync(darkPath, darkShot);
      // eslint-disable-next-line no-console
      console.log(
        `captured ${chart.sliceName} (dark) -> ${darkSibling(output)}`,
      );
    }
  }

  if (isNewImage) {
    // eslint-disable-next-line no-console
    console.log(
      `NOTE: ${output} is a new gallery image — register it in the plugin metadata (exampleGallery) to surface it.`,
    );
  }
}

test.describe('capture viz thumbnails', () => {
  test.skip(
    !process.env.CAPTURE_THUMBNAILS,
    'Thumbnail capture only runs with CAPTURE_THUMBNAILS=1',
  );

  test('crawls example dashboards and refreshes gallery thumbnails', async ({
    page,
  }) => {
    test.setTimeout(90 * 60_000);

    const vizTypeFilter = process.env.VIZ_TYPES
      ? new Set(process.env.VIZ_TYPES.split(',').map(v => v.trim()))
      : null;

    const charts = await discoverDashboardCharts(page);
    expect(
      charts.length,
      'no dashboard charts found — are examples loaded?',
    ).toBeGreaterThan(0);

    // One representative chart per viz type: the preferred slice when
    // present, else the alphabetically-first slice for determinism.
    const byVizType = new Map<string, ExampleChart[]>();
    for (const chart of charts) {
      const group = byVizType.get(chart.vizType) ?? [];
      group.push(chart);
      byVizType.set(chart.vizType, group);
    }

    const thumbnailSize = { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE };
    const unmapped: string[] = [];
    const failures: string[] = [];
    for (const [vizType, group] of [...byVizType.entries()].sort()) {
      if (vizTypeFilter && !vizTypeFilter.has(vizType)) continue;
      const output = VIZ_TYPE_THUMBNAILS[vizType];
      if (!output) {
        unmapped.push(vizType);
        continue;
      }
      group.sort((a, b) => a.sliceName.localeCompare(b.sliceName));
      const chart =
        group.find(c => c.sliceName === PREFERRED_SLICES[vizType]) ?? group[0];
      try {
        await captureChart(page, chart, output, thumbnailSize);
      } catch (error) {
        failures.push(`${vizType} (${chart.sliceName}): ${error}`);
      }
    }

    for (const extra of EXTRA_CAPTURES) {
      const chart = charts.find(c => c.sliceName === extra.sliceName);
      if (!chart || (vizTypeFilter && !vizTypeFilter.has(chart.vizType))) {
        continue;
      }
      try {
        await captureChart(page, chart, extra.output, {
          width: extra.width,
          height: extra.height,
        });
      } catch (error) {
        failures.push(`${extra.sliceName}: ${error}`);
      }
    }

    if (unmapped.length) {
      // eslint-disable-next-line no-console
      console.log(
        `viz types on dashboards with no thumbnail mapping (add to VIZ_TYPE_THUMBNAILS if wanted): ${unmapped.join(', ')}`,
      );
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
