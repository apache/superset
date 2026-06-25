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
 * Dashboard edit-mode component tests — migrated from the deprecated Cypress
 * suite (cypress-base/cypress/e2e/dashboard/editmode.test.ts, "Components"
 * block). These cover the chart/markdown drag-and-drop workflows that the
 * upstream Cypress notes flagged as the one part of edit mode that genuinely
 * requires E2E coverage ("Chart drag/drop functionality requires true E2E
 * testing"). The grid uses react-dnd with the HTML5 backend, so drags are
 * driven by synthetic native drag events (see helpers/dnd.ts).
 *
 * The 21 skipped "Color consistency" tests from the same Cypress file are NOT
 * migrated here: they assert per-series colors by reading an `.nv-legend-symbol`
 * SVG `fill` attribute that no longer exists (ECharts renders to <canvas>, which
 * is not DOM-inspectable — the upstream FIXME skipped them for exactly this
 * reason). The underlying color-precedence logic is covered by Jest/RTL.
 */

import {
  testWithAssets,
  expect,
  type TestAssets,
} from '../../helpers/fixtures';
import { apiPost } from '../../helpers/api/requests';
import { apiPostDashboard } from '../../helpers/api/dashboard';
import { DashboardPage } from '../../pages/DashboardPage';
import type { Page } from '@playwright/test';

const DATASET_NAME = 'birth_names';

async function findDatasetIdByName(page: Page, name: string): Promise<number> {
  const rison = `(filters:!((col:table_name,opr:eq,value:'${name}')))`;
  const resp = await page.request.get(`api/v1/dataset/?q=${rison}`);
  const body = await resp.json();
  if (!body.result?.length) {
    throw new Error(`Dataset ${name} not found`);
  }
  return body.result[0].id;
}

/** Create a hermetic chart from birth_names, NOT placed on any dashboard. */
async function createChart(
  page: Page,
  testAssets: TestAssets,
): Promise<string> {
  const datasetId = await findDatasetIdByName(page, DATASET_NAME);
  const sliceName = `edit_mode_chart_${Date.now()}_${Math.floor(
    performance.now(),
  )}`;
  const resp = await apiPost(page, 'api/v1/chart/', {
    slice_name: sliceName,
    viz_type: 'big_number_total',
    datasource_id: datasetId,
    datasource_type: 'table',
    params: JSON.stringify({
      datasource: `${datasetId}__table`,
      viz_type: 'big_number_total',
      metric: 'count',
    }),
  });
  expect(resp.ok()).toBe(true);
  testAssets.trackChart((await resp.json()).id);
  return sliceName;
}

/** Create an empty published dashboard and return its id. */
async function createDashboard(
  page: Page,
  testAssets: TestAssets,
): Promise<number> {
  const resp = await apiPostDashboard(page, {
    dashboard_title: `edit_mode_${Date.now()}_${Math.floor(performance.now())}`,
    published: true,
  });
  expect(resp.ok()).toBe(true);
  const body = await resp.json();
  const id: number = body.result?.id ?? body.id;
  testAssets.trackDashboard(id);
  return id;
}

testWithAssets(
  'edit mode: add a chart to the dashboard via drag-and-drop',
  async ({ page, testAssets }) => {
    const sliceName = await createChart(page, testAssets);
    const dashboardId = await createDashboard(page, testAssets);

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();
    await dashboard.enterEditMode();

    await expect(dashboard.chartHolders()).toHaveCount(0);
    await dashboard.addChartByName(sliceName);
    await expect(dashboard.chartHolders()).toHaveCount(1);
  },
);

testWithAssets(
  'edit mode: remove an added chart from the dashboard',
  async ({ page, testAssets }) => {
    const sliceName = await createChart(page, testAssets);
    const dashboardId = await createDashboard(page, testAssets);

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();
    await dashboard.enterEditMode();

    await dashboard.addChartByName(sliceName);
    await expect(dashboard.chartHolders()).toHaveCount(1);

    await dashboard.deleteChartHolder();
    await expect(dashboard.chartHolders()).toHaveCount(0);
  },
);

testWithAssets(
  'edit mode: add a markdown component via drag-and-drop',
  async ({ page, testAssets }) => {
    // Heaviest edit-mode flow (drag + ace edit + commit + mouse resize); give it
    // extra headroom so it stays reliable when the suite runs in parallel.
    testWithAssets.slow();
    const dashboardId = await createDashboard(page, testAssets);

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();
    await dashboard.enterEditMode();

    await dashboard.addLayoutElement('Text / Markdown');
    const editor = dashboard.markdownEditors().first();
    await expect(editor).toBeVisible();

    // Enter edit mode by focusing the component. The markdown enters edit on a
    // document-level focus handler attached after mount, so a single early click
    // can be missed under load; retry until the ace editor appears. Click the
    // rendered "Header 1" heading element specifically (never the trailing
    // hyperlink in the default content), so a stray click can't navigate away.
    const aceContent = editor.locator('.ace_content');
    const heading = editor.locator('h1', { hasText: 'Header 1' });
    await expect(async () => {
      if (await aceContent.isVisible()) return;
      await heading.click();
      await expect(aceContent).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
    await expect(aceContent).toContainText('Header 1');
    await expect(aceContent).toContainText('markdown formatting');

    // Replace the content and confirm the edit is reflected.
    const aceInput = editor.locator('.ace_text-input');
    await aceInput.press('ControlOrMeta+a');
    await aceInput.press('Delete');
    await aceInput.type('Test resize');
    await expect(aceContent).toContainText('Test resize');

    // Commit by clicking outside the component; the preview keeps the text.
    const boxBefore = await editor.boundingBox();
    await page.locator('[data-test="editable-title-input"]').first().click();
    await expect(editor).toContainText('Test resize');

    // Resize via the bottom handle and confirm the component grew taller.
    const handle = editor.locator('.resizable-container-handle--bottom').last();
    const hb = await handle.boundingBox();
    expect(hb).not.toBeNull();
    if (hb && boxBefore) {
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.mouse.down();
      await page.mouse.move(hb.x + hb.width / 2, hb.y + 150, { steps: 10 });
      await page.mouse.up();
      const boxAfter = await editor.boundingBox();
      expect(boxAfter!.height).toBeGreaterThan(boxBefore.height);
    }
  },
);
