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
 * thumbnails and example galleries from live example charts.
 *
 * This is a maintenance tool, not a test: charts are DISCOVERED via the
 * API (dashboards -> charts), so it keeps working as example dashboards
 * evolve. Every distinct chart found for a viz type gets captured — the
 * preferred (or alphabetically-first) chart becomes the 512x512
 * `thumbnail.png`, and each additional distinct chart fills the next
 * `exampleGallery` slot declared for that viz type, so the gallery shows
 * real variety instead of the same chart resized. The two static pieces
 * are the viz type -> image path maps below (VIZ_TYPE_THUMBNAILS,
 * VIZ_TYPE_GALLERY), which change when a plugin's images or gallery
 * shape change — never when examples change. Viz types found on
 * dashboards but missing from both maps, and gallery slots left unfilled
 * for lack of enough distinct example charts, are reported at the end
 * without failing the run.
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
 * - A brand-new gallery image (rather than an existing file being
 *   refreshed) still needs to be registered in the plugin's metadata
 *   before it renders in the gallery; the capture logs a reminder.
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

/**
 * Hover this element just before the screenshot, so charts whose identity
 * benefits from an interaction (a visible tooltip) capture mid-hover.
 */
const HOVER_BEFORE_CAPTURE: Record<string, string> = {
  cal_heatmap: '[data-test="chart-container"] svg rect[class*=" r"]',
};
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
  // handlebars intentionally unmapped: its generic logo represents the
  // template-anything nature of the chart better than any one example.
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
  rose: `${ECHARTS}/Rose/images/thumbnail.png`,
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
  big_number: 'Sales Year over Year',
  bubble_v2: 'Life Expectancy VS Rural %',
  bullet: 'Total Sales Bullet',
  cal_heatmap: 'Sales Calendar Heatmap',
  chord: 'Product Line Chord',
  echarts_area: 'Sales Stacked Area',
  echarts_timeseries_bar: 'Sales Stacked Bars',
  echarts_timeseries_line: 'Monthly Sales Line',
  echarts_timeseries_smooth: 'Monthly Sales Smooth',
  echarts_timeseries_step: 'Quarterly Sales Steps',
  funnel: 'Population Funnel',
  gauge_chart: 'Rural Population Gauge',
  heatmap_v2: 'Sales Grid Heatmap',
  histogram_v2: 'Life Expectancy Histogram',
  horizon: 'Population Growth Horizon',
  mixed_timeseries: 'Sales Mixed Chart',
  paired_ttest: 'Population Paired t-Test',
  partition: 'Population Partition',
  pie: 'Product Line Donut',
  pivot_table_v2: 'Sales Pivot Highlights',
  radar: 'Game Sales Radar',
  rose: 'Population Nightingale Rose',
  sunburst_v2: 'Population Sunburst',
  table: 'Sales Summary Table',
  time_pivot: 'Sales Period Pivot',
  time_table: 'Product Line Time Table',
  tree_chart: 'Sales Territory Tree',
  treemap_v2: 'Population Treemap',
  waterfall: 'Quarterly Sales Waterfall',
};

/** Gallery example images use a wide aspect, matching the existing art. */
const EXAMPLE_WIDTH = 800;
const EXAMPLE_HEIGHT = 460;

/**
 * Every plugin's `exampleGallery` image slots (never including
 * `thumbnail.png`/`thumbnail-dark.png`, which stays governed by
 * VIZ_TYPE_THUMBNAILS), in the order they appear in that plugin's
 * `index.ts`. One entry per viz type that declares a gallery — including
 * `handlebars`, whose gallery is filled even though its picker thumbnail
 * intentionally stays the generic logo (unmapped in VIZ_TYPE_THUMBNAILS).
 *
 * For a viz type with N slots here, the crawler assigns its (N+1)
 * distinct dashboard charts (the thumbnail's pick, then this many more)
 * to thumbnail, slot 1, slot 2, ... in that order, so gallery images show
 * different charts than the thumbnail and each other rather than the same
 * chart resized. Fewer distinct charts than slots just leaves the
 * trailing slots untouched (reported, not failed) — add more example
 * charts to fill them.
 *
 * Update this when a plugin's exampleGallery array changes shape.
 */
const VIZ_TYPE_GALLERY: Record<string, string[]> = {
  'ag-grid-table': [
    'plugins/plugin-chart-ag-grid-table/src/images/Table.jpg',
    'plugins/plugin-chart-ag-grid-table/src/images/Table2.jpg',
    'plugins/plugin-chart-ag-grid-table/src/images/Table3.jpg',
  ],
  big_number: [
    `${ECHARTS}/BigNumber/BigNumberWithTrendline/images/Big_Number_Trendline.jpg`,
  ],
  big_number_total: [
    `${ECHARTS}/BigNumber/BigNumberTotal/images/BigNumber.jpg`,
    `${ECHARTS}/BigNumber/BigNumberTotal/images/BigNumber2.jpg`,
  ],
  box_plot: [`${ECHARTS}/BoxPlot/images/BoxPlot.jpg`],
  bubble_v2: [
    `${ECHARTS}/Bubble/images/example1.png`,
    `${ECHARTS}/Bubble/images/example2.png`,
  ],
  bullet: [`${ECHARTS}/Bullet/images/example.jpg`],
  cal_heatmap: ['plugins/plugin-chart-calendar/src/images/example.jpg'],
  cartodiagram: [
    'plugins/plugin-chart-cartodiagram/src/images/example1.png',
    'plugins/plugin-chart-cartodiagram/src/images/example2.png',
  ],
  chord: ['plugins/plugin-chart-chord/src/images/chord.jpg'],
  country_map: [
    'plugins/plugin-chart-country-map/src/images/exampleUsa.jpg',
    'plugins/plugin-chart-country-map/src/images/exampleGermany.jpg',
  ],
  echarts_area: [`${ECHARTS}/Timeseries/Area/images/Area1.png`],
  echarts_timeseries: [`${ECHARTS}/Timeseries/images/Time-series_Chart.jpg`],
  echarts_timeseries_bar: [
    `${ECHARTS}/Timeseries/Regular/Bar/images/Bar1.png`,
    `${ECHARTS}/Timeseries/Regular/Bar/images/Bar2.png`,
    `${ECHARTS}/Timeseries/Regular/Bar/images/Bar3.png`,
  ],
  echarts_timeseries_line: [
    `${ECHARTS}/Timeseries/Regular/Line/images/Line1.png`,
    `${ECHARTS}/Timeseries/Regular/Line/images/Line2.png`,
    `${ECHARTS}/Timeseries/Regular/Line/images/Line3.png`,
  ],
  echarts_timeseries_scatter: [
    `${ECHARTS}/Timeseries/Regular/Scatter/images/Scatter1.png`,
  ],
  echarts_timeseries_smooth: [
    `${ECHARTS}/Timeseries/Regular/SmoothLine/images/SmoothLine1.png`,
  ],
  echarts_timeseries_step: [
    `${ECHARTS}/Timeseries/Step/images/Step1.png`,
    `${ECHARTS}/Timeseries/Step/images/Step2.png`,
  ],
  funnel: [`${ECHARTS}/Funnel/images/example.jpg`],
  gantt_chart: [
    `${ECHARTS}/Gantt/images/example1.png`,
    `${ECHARTS}/Gantt/images/example2.png`,
  ],
  gauge_chart: [
    `${ECHARTS}/Gauge/images/example1.jpg`,
    `${ECHARTS}/Gauge/images/example2.jpg`,
  ],
  graph_chart: [`${ECHARTS}/Graph/images/example.jpg`],
  handlebars: [
    'plugins/plugin-chart-handlebars/src/images/example1.jpg',
    'plugins/plugin-chart-handlebars/src/images/example2.jpg',
  ],
  heatmap_v2: [
    `${ECHARTS}/Heatmap/images/example1.png`,
    `${ECHARTS}/Heatmap/images/example2.png`,
    `${ECHARTS}/Heatmap/images/example3.png`,
  ],
  histogram_v2: [
    `${ECHARTS}/Histogram/images/example1.png`,
    `${ECHARTS}/Histogram/images/example2.png`,
  ],
  horizon: ['plugins/plugin-chart-horizon/src/images/Horizon_Chart.jpg'],
  mixed_timeseries: [`${ECHARTS}/MixedTimeseries/images/example.jpg`],
  paired_ttest: ['plugins/plugin-chart-paired-t-test/src/images/example.jpg'],
  para: [
    'plugins/plugin-chart-parallel-coordinates/src/images/example1.jpg',
    'plugins/plugin-chart-parallel-coordinates/src/images/example2.jpg',
  ],
  partition: ['plugins/plugin-chart-partition/src/images/example.jpg'],
  pie: [
    `${ECHARTS}/Pie/images/Pie1.jpg`,
    `${ECHARTS}/Pie/images/Pie2.jpg`,
    `${ECHARTS}/Pie/images/Pie3.jpg`,
    `${ECHARTS}/Pie/images/Pie4.jpg`,
  ],
  pivot_table_v2: ['plugins/plugin-chart-pivot-table/src/images/example.jpg'],
  point_cluster_map: [
    'plugins/plugin-chart-point-cluster-map/src/images/MapBox.jpg',
    'plugins/plugin-chart-point-cluster-map/src/images/MapBox2.jpg',
  ],
  radar: [
    `${ECHARTS}/Radar/images/example1.jpg`,
    `${ECHARTS}/Radar/images/example2.jpg`,
  ],
  rose: [
    `${ECHARTS}/Rose/images/example1.jpg`,
    `${ECHARTS}/Rose/images/example2.jpg`,
  ],
  sankey_v2: [
    `${ECHARTS}/Sankey/images/example1.png`,
    `${ECHARTS}/Sankey/images/example2.png`,
  ],
  sunburst_v2: [
    `${ECHARTS}/Sunburst/images/Sunburst1.png`,
    `${ECHARTS}/Sunburst/images/Sunburst2.png`,
  ],
  table: [
    'plugins/plugin-chart-table/src/images/Table.jpg',
    'plugins/plugin-chart-table/src/images/Table2.jpg',
    'plugins/plugin-chart-table/src/images/Table3.jpg',
  ],
  time_pivot: [`${ECHARTS}/TimePivot/images/example.jpg`],
  time_table: ['src/visualizations/TimeTable/images/example.jpg'],
  tree_chart: [`${ECHARTS}/Tree/images/tree.png`],
  treemap_v2: [
    `${ECHARTS}/Treemap/images/treemap_v2_1.png`,
    `${ECHARTS}/Treemap/images/treemap_v2_2.jpg`,
  ],
  waterfall: [
    `${ECHARTS}/Waterfall/images/example1.png`,
    `${ECHARTS}/Waterfall/images/example2.png`,
    `${ECHARTS}/Waterfall/images/example3.png`,
  ],
  word_cloud: [
    'plugins/plugin-chart-word-cloud/src/images/Word_Cloud.jpg',
    'plugins/plugin-chart-word-cloud/src/images/Word_Cloud_2.jpg',
  ],
  world_map: [
    'plugins/plugin-chart-world-map/src/images/WorldMap1.jpg',
    'plugins/plugin-chart-world-map/src/images/WorldMap2.jpg',
  ],
  deck_arc: [`${DECKGL}/Arc/images/example.png`],
  deck_contour: [`${DECKGL}/Contour/images/example.png`],
  deck_geojson: [`${DECKGL}/Geojson/images/example.png`],
  deck_grid: [`${DECKGL}/Grid/images/example.png`],
  deck_heatmap: [`${DECKGL}/Heatmap/images/example.png`],
  deck_hex: [`${DECKGL}/Hex/images/example.png`],
  deck_multi: ['plugins/preset-chart-deckgl/src/Multi/images/example.png'],
  deck_path: [`${DECKGL}/Path/images/example.png`],
  deck_polygon: [`${DECKGL}/Polygon/images/example.png`],
  deck_scatter: [`${DECKGL}/Scatter/images/example.png`],
  deck_screengrid: [`${DECKGL}/Screengrid/images/example.png`],
};

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
  colorScheme: 'light' | 'dark',
): Promise<Buffer> {
  // An explicit navigation timeout keeps one hung load from stalling the
  // whole crawl until the test timeout.
  await page.goto(`/explore/?slice_id=${chart.id}&standalone=1`, {
    timeout: 60_000,
  });
  // Dashboards render charts on colorBgContainer cards, but the standalone
  // explore page paints the gray colorBgLayout (via the antd Layout
  // wrapper); match the dashboard context so thumbnails look like charts
  // do where users see them.
  await page
    .addStyleTag({
      content: `body, .ant-layout { background: ${
        colorScheme === 'dark' ? '#141414' : '#ffffff'
      } !important; }`,
    })
    .catch(() => {});
  const textOnly = TEXT_ONLY_VIZ_TYPES.has(chart.vizType);
  await page
    .locator(textOnly ? TEXT_RENDERED_CHART_SELECTOR : RENDERED_CHART_SELECTOR)
    .first()
    .waitFor({ state: 'visible', timeout: 60_000 });
  // Give animations/map tiles (or text-only chart data) time to settle
  await page.waitForTimeout(textOnly ? 4_000 : 2_000);
  // Some thumbnails read better mid-interaction (e.g. the calendar heatmap
  // showing its tooltip); hover the configured element before the still.
  const hoverSelector = HOVER_BEFORE_CAPTURE[chart.vizType];
  if (hoverSelector) {
    // Hover a mid-chart element rather than the first (often an empty
    // corner cell), falling back to the first when there are few.
    const cells = page.locator(hoverSelector);
    const count = await cells.count().catch(() => 0);
    await cells
      .nth(Math.floor(count / 2))
      .hover({ timeout: 5_000 })
      .catch(() => {});
    await page.waitForTimeout(500);
  }
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
  const lightShot = await renderAndShoot(page, chart, 'light');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lightShot);
  // eslint-disable-next-line no-console
  console.log(`captured ${chart.sliceName} (${chart.vizType}) -> ${output}`);

  if (wantDark) {
    await page.emulateMedia({ colorScheme: 'dark' });
    const darkShot = await renderAndShoot(page, chart, 'dark');
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

    // Every distinct chart per viz type gets captured: the preferred (or
    // alphabetically-first) chart becomes the picker thumbnail, and each
    // subsequent distinct chart fills the next declared gallery slot, so
    // gallery images show real variety instead of the same chart resized.
    const byVizType = new Map<string, ExampleChart[]>();
    for (const chart of charts) {
      const group = byVizType.get(chart.vizType) ?? [];
      group.push(chart);
      byVizType.set(chart.vizType, group);
    }

    const thumbnailSize = { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE };
    const exampleSize = { width: EXAMPLE_WIDTH, height: EXAMPLE_HEIGHT };
    const unmapped: string[] = [];
    const underfilledGalleries: string[] = [];
    const failures: string[] = [];
    for (const [vizType, group] of [...byVizType.entries()].sort()) {
      if (vizTypeFilter && !vizTypeFilter.has(vizType)) continue;

      const thumbOutput = VIZ_TYPE_THUMBNAILS[vizType];
      const galleryOutputs = VIZ_TYPE_GALLERY[vizType] ?? [];
      if (!thumbOutput && !galleryOutputs.length) {
        unmapped.push(vizType);
        continue;
      }

      // Preferred slice (if present) leads; the rest follow alphabetically.
      group.sort((a, b) => a.sliceName.localeCompare(b.sliceName));
      const preferredIndex = group.findIndex(
        c => c.sliceName === PREFERRED_SLICES[vizType],
      );
      const ordered =
        preferredIndex > 0
          ? [
              group[preferredIndex],
              ...group.slice(0, preferredIndex),
              ...group.slice(preferredIndex + 1),
            ]
          : group;

      // Only advance past the thumbnail's chart when a thumbnail is
      // actually captured (e.g. handlebars has no VIZ_TYPE_THUMBNAILS
      // entry by design, so its gallery gets the full ordered list).
      let nextIndex = 0;
      if (thumbOutput) {
        const chart = ordered[0];
        nextIndex = 1;
        try {
          await captureChart(page, chart, thumbOutput, thumbnailSize);
        } catch (error) {
          failures.push(`${vizType} (${chart.sliceName}): ${error}`);
        }
      }

      const missingSlots: string[] = [];
      for (const output of galleryOutputs) {
        const chart = ordered[nextIndex];
        nextIndex += 1;
        if (!chart) {
          missingSlots.push(output);
          continue;
        }
        try {
          await captureChart(page, chart, output, exampleSize);
        } catch (error) {
          failures.push(`${vizType} gallery (${chart.sliceName}): ${error}`);
        }
      }
      if (missingSlots.length) {
        underfilledGalleries.push(
          `${vizType}: not enough distinct dashboard charts for ${missingSlots.join(', ')}`,
        );
      }
    }

    if (unmapped.length) {
      // eslint-disable-next-line no-console
      console.log(
        `viz types on dashboards with no thumbnail or gallery mapping (add to VIZ_TYPE_THUMBNAILS/VIZ_TYPE_GALLERY if wanted): ${unmapped.join(', ')}`,
      );
    }
    if (underfilledGalleries.length) {
      // eslint-disable-next-line no-console
      console.log(
        `gallery slots left untouched for lack of distinct example charts:\n${underfilledGalleries.join('\n')}`,
      );
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
