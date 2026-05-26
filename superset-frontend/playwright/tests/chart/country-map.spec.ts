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
 * End-to-end coverage for the country_map_v2 plugin.
 *
 * Scope is deliberately narrow:
 *   1. Static GeoJSON assets are actually served by the deployed
 *      Superset (catches packaging regressions like the
 *      .dockerignore drop that produced 404s in PR-preview builds).
 *   2. A fresh country_map_v2 chart renders without the
 *      "No GeoJSON URL resolved" / "Error loading map" sentinel and
 *      produces a non-empty SVG.
 *
 * Cross-viz form_data migration is covered by the unit tests in
 * test/plugin/migrateFromLegacy.test.ts. Anything more granular about
 * the UI (each control's visibility, validators, etc.) is also unit-
 * tested. This file is reserved for the gluing-it-all-together checks
 * that a unit test physically cannot perform.
 */

import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiPostChart } from '../../helpers/api/chart';
import { getDatasetByName } from '../../helpers/api/dataset';

const test = testWithAssets;

const STATIC_BASE = '/static/assets/country-maps';

// A small whitelist of files the build pipeline always emits. If any
// of these 404s, the assets aren't reaching the running server (the
// classic .dockerignore-drop failure mode).
const REQUIRED_ASSETS = [
  'manifest.json',
  'ukr_admin0.geo.json',
  'default_admin0.geo.json',
  'ukr_admin1_FRA.geo.json',
  'ukr_admin1_USA.geo.json',
  'regional_FRA_regions_ukr.geo.json',
  'composite_france_overseas_ukr.geo.json',
];

test.describe('country_map_v2', () => {
  test('serves all required static GeoJSON assets', async ({ page }) => {
    for (const name of REQUIRED_ASSETS) {
      const url = `${STATIC_BASE}/${name}`;
      const res = await page.request.get(url);
      expect(res.status(), `${url} should respond 200`).toBe(200);
      const body = await res.text();
      expect(
        body.length,
        `${url} body should be non-empty`,
      ).toBeGreaterThan(0);

      // Sanity check: every payload should parse as JSON, and the
      // geo files should declare a FeatureCollection.
      const parsed = JSON.parse(body);
      if (name.endsWith('.geo.json')) {
        expect(parsed.type).toBe('FeatureCollection');
        expect(Array.isArray(parsed.features)).toBe(true);
      } else if (name === 'manifest.json') {
        expect(Array.isArray(parsed.worldviews)).toBe(true);
        expect(parsed.worldviews).toContain('ukr');
      }
    }
  });

  test('renders a France subdivisions chart end-to-end', async ({
    page,
    testAssets,
  }, testInfo) => {
    // birth_france_by_region ships with --load-examples and matches the
    // built-in Country Map example chart (one row per French department,
    // ISO codes in DEPT_ID).
    const dataset = await getDatasetByName(page, 'birth_france_by_region');
    test.skip(
      !dataset,
      'birth_france_by_region dataset not loaded — run Superset with --load-examples',
    );

    const params = {
      viz_type: 'country_map_v2',
      datasource: `${dataset!.id}__table`,
      worldview: 'ukr',
      admin_level: '1',
      country: 'FRA',
      entity: 'DEPT_ID',
      metric: {
        aggregate: 'AVG',
        column: { column_name: '2004', type: 'INT' },
        expressionType: 'SIMPLE',
        label: 'AVG(2004)',
      },
      row_limit: 1000,
      linear_color_scheme: 'schemeBlues',
      number_format: 'SMART_NUMBER',
    };

    const createRes = await apiPostChart(page, {
      slice_name: `e2e_country_map_v2_${Date.now()}_${testInfo.parallelIndex}`,
      datasource_id: dataset!.id,
      datasource_type: 'table',
      viz_type: 'country_map_v2',
      params: JSON.stringify(params),
    });
    expect(createRes.ok(), 'chart create should succeed').toBe(true);
    const created = await createRes.json();
    const sliceId = created.result?.id ?? created.id;
    testAssets.trackChart(sliceId);

    await page.goto(`explore/?slice_id=${sliceId}`);
    await page.waitForURL('**/explore/**', { timeout: 15_000 });

    // The chart container always renders; we're checking the *content*.
    // Wait until either the SVG is drawn (success) or the error banner
    // appears (failure) so the test fails fast either way.
    const chartArea = page.locator('.chart-container, [data-test="chart-container"]').first();
    await expect(chartArea).toBeVisible({ timeout: 15_000 });

    // The renderer puts up an explicit error message when geoJsonUrl
    // can't be resolved or the fetch fails — this is the user-visible
    // sentinel the original bug produced.
    await expect(
      page.getByText(/Error loading map|No GeoJSON URL resolved/i),
    ).toHaveCount(0, { timeout: 20_000 });

    // Positive assertion: the renderer drew SVG paths (one per French
    // department, ~96-101 features after flying-islands repositioning).
    const svgPaths = chartArea.locator('svg path');
    await expect(svgPaths.first()).toBeVisible({ timeout: 20_000 });
    const count = await svgPaths.count();
    expect(
      count,
      'should render at least 50 path elements for France subdivisions',
    ).toBeGreaterThan(50);
  });
});
