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
 * Regression coverage for the Drill to Detail modal's results table.
 *
 * The drill pane measures its available height with a resize detector and
 * hands it to a virtualized table, so the rows only render if the modal's
 * internal height chain (resizable wrapper -> modal container -> modal body ->
 * flex pane) actually resolves to a real height. That chain is wired together
 * with CSS selectors targeting Ant Design's internal modal classes, which
 * TypeScript cannot see and unit tests do not exercise: when the antd v6
 * upgrade renamed `.ant-modal-content` to `.ant-modal-container`, the chain
 * silently broke, the pane measured ~0, and the table briefly flashed its rows
 * before collapsing to an empty body with only the header and pagination
 * visible.
 *
 * Only a real browser sees layout, so this is pinned here rather than in the
 * DOM-contract unit suite. Because the failure mode is
 * render-then-collapse, a single "rows are visible" read could pass during
 * the initial flash — the assertion therefore requires the table body to hold
 * a real height across two consecutive reads.
 *
 * CI green => the drill modal's table renders rows at a stable, non-collapsed
 *             height.
 * CI red   => the modal height chain broke again (or drill-to-detail failed to
 *             open/load at all).
 */
import { testWithAssets, expect } from '../../helpers/fixtures';
import { TIMEOUT } from '../../utils/constants';
import { DashboardPage } from '../../pages/DashboardPage';
import { createDashboardWithCharts } from './dashboard-test-helpers';

const MIN_STABLE_BODY_HEIGHT = 100;
// Max fraction the body height may drift between the two reads below; a
// partial collapse (e.g. 400px -> 150px) still clears MIN_STABLE_BODY_HEIGHT
// but fails this, so the check enforces stability, not just a floor.
const HEIGHT_DRIFT_TOLERANCE = 0.25;

testWithAssets(
  'drill to detail modal renders result rows at a stable height',
  async ({ page, testAssets }) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const { dashboardId } = await createDashboardWithCharts(
      page,
      testAssets,
      testWithAssets.info(),
      {
        datasetName: 'birth_names',
        chartNamePrefix: 'drill_detail',
        dashboardTitlePrefix: 'drill_detail_modal',
        chartSpecs: [
          {
            viz_type: 'pie',
            params: {
              groupby: ['gender'],
              metric: 'count',
            },
          },
        ],
      },
    );

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();
    await dashboard.waitForChartsToLoad();

    // Open the chart context menu. The ECharts canvas exposes no data-test
    // hooks for its regions, so right-click the centre of the chart container;
    // the exact-text match below then works whether the click landed on a
    // slice (which adds "Drill to detail by" items) or on the chart background.
    // The first right-click after load can be swallowed by a chart re-render
    // closing the menu, so retry the click until the menu actually shows.
    const chart = page.locator('[data-test="chart-container"]').first();
    await chart.scrollIntoViewIfNeeded();
    const contextMenu = page.locator('[data-test="chart-context-menu"]');
    await expect(async () => {
      const box = await chart.boundingBox();
      if (!box) {
        throw new Error('chart container has no bounding box');
      }
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
        button: 'right',
      });
      await expect(contextMenu).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });
    await page
      .getByRole('menuitem', { name: 'Drill to detail', exact: true })
      .click();

    const modal = page.locator('.ant-modal:visible');
    await expect(modal).toBeVisible({ timeout: TIMEOUT.FORM_LOAD });

    // Wait for the samples request to resolve into a rendered table: the row
    // count pill and the virtualized body both come from the loaded page.
    const tableBody = modal.locator('.virtual-grid');
    await expect(tableBody).toBeAttached({ timeout: TIMEOUT.CHART_RENDER });

    // The regression collapses the body *after* first paint, so require the
    // height to hold across two consecutive reads rather than sampling once
    // (a single read could land inside the flash and pass a broken build).
    await expect(async () => {
      const first = await tableBody.boundingBox();
      const firstHeight = first?.height ?? 0;
      expect(firstHeight).toBeGreaterThan(MIN_STABLE_BODY_HEIGHT);
      await page.waitForTimeout(300);
      const second = await tableBody.boundingBox();
      const secondHeight = second?.height ?? 0;
      expect(secondHeight).toBeGreaterThan(MIN_STABLE_BODY_HEIGHT);
      expect(Math.abs(secondHeight - firstHeight)).toBeLessThanOrEqual(
        firstHeight * HEIGHT_DRIFT_TOLERANCE,
      );
    }).toPass({ timeout: TIMEOUT.CHART_RENDER });

    // And the rows are real data, not just an expanded empty scroller:
    // birth_names sample rows always carry a gender value.
    await expect(modal.getByText(/^(boy|girl)$/).first()).toBeVisible({
      timeout: TIMEOUT.API_RESPONSE,
    });
  },
);
