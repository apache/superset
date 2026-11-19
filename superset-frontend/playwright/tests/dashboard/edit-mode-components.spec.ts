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
 * Dashboard edit-mode component tests — these replace the deprecated Cypress
 * spec cypress-base/cypress/e2e/dashboard/editmode.test.ts, deleted in the same
 * change. They cover the chart/markdown drag-and-drop workflows that the
 * upstream Cypress notes flagged as the one part of edit mode that genuinely
 * requires E2E coverage ("Chart drag/drop functionality requires true E2E
 * testing"). The grid uses react-dnd with the HTML5 backend, so drags are
 * driven by synthetic native drag events (see helpers/dnd.ts).
 *
 * Coverage here is a superset of the Cypress spec, which by the time of the
 * migration held a single "should add charts" test — its "Color consistency"
 * block had already been dropped upstream as permanently skipped (it read
 * per-series colors off an `.nv-legend-symbol` SVG `fill` that ECharts, which
 * renders to <canvas>, no longer produces). That color-precedence logic is
 * covered by Jest/RTL, not by E2E.
 */

import {
  testWithAssets,
  expect,
  type TestAssets,
} from '../../helpers/fixtures';
import { apiPostChart } from '../../helpers/api/chart';
import { getDatasetByName } from '../../helpers/api/dataset';
import { extractIdFromResponse } from '../../helpers/api/assertions';
import { DashboardPage } from '../../pages/DashboardPage';
import { createTestDashboard } from './dashboard-test-helpers';
import type { Page, TestInfo } from '@playwright/test';

const DATASET_NAME = 'birth_names';

/**
 * How long one click on the markdown component gets to bring up the ace editor
 * before the retry loop tries again, and how long the whole loop gets. The
 * per-attempt budget is deliberately short: the failure mode is a swallowed
 * click, and retrying is cheaper than waiting out the full budget once.
 */
const MARKDOWN_EDIT_ATTEMPT_TIMEOUT = 2000;
const MARKDOWN_EDIT_TOTAL_TIMEOUT = 20000;

/** Downward drag distance for the resize assertion — several grid rows. */
const RESIZE_DELTA_PX = 150;

/** Create a hermetic chart from birth_names, NOT placed on any dashboard. */
async function createChart(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
): Promise<string> {
  const dataset = await getDatasetByName(page, DATASET_NAME);
  if (!dataset) {
    throw new Error(`Dataset ${DATASET_NAME} not found`);
  }
  const sliceName = `edit_mode_chart_${Date.now()}_${testInfo.parallelIndex}`;
  const resp = await apiPostChart(page, {
    slice_name: sliceName,
    viz_type: 'big_number_total',
    datasource_id: dataset.id,
    datasource_type: 'table',
    params: JSON.stringify({
      datasource: `${dataset.id}__table`,
      viz_type: 'big_number_total',
      metric: 'count',
    }),
  });
  expect(resp.ok()).toBe(true);
  testAssets.trackChart(await extractIdFromResponse(resp));
  return sliceName;
}

/**
 * Create the empty published dashboard every test in this file starts from,
 * open it, and enter edit mode. Returns the page object positioned on the
 * builder, ready for a drag.
 */
async function openEmptyDashboardInEditMode(
  page: Page,
  testAssets: TestAssets,
  testInfo: TestInfo,
): Promise<DashboardPage> {
  const { id } = await createTestDashboard(page, testAssets, testInfo, {
    prefix: 'edit_mode',
    published: true,
  });

  const dashboard = new DashboardPage(page);
  await dashboard.gotoById(id);
  await dashboard.waitForLoad();
  await dashboard.enterEditMode();
  return dashboard;
}

testWithAssets(
  'edit mode: add a chart to the dashboard via drag-and-drop',
  async ({ page, testAssets }, testInfo) => {
    const sliceName = await createChart(page, testAssets, testInfo);
    const dashboard = await openEmptyDashboardInEditMode(
      page,
      testAssets,
      testInfo,
    );

    await expect(dashboard.getChartHolders()).toHaveCount(0);
    await dashboard.addChartByName(sliceName);
    await expect(dashboard.getChartHolders()).toHaveCount(1);
  },
);

testWithAssets(
  'edit mode: remove an added chart from the dashboard',
  async ({ page, testAssets }, testInfo) => {
    const sliceName = await createChart(page, testAssets, testInfo);
    const dashboard = await openEmptyDashboardInEditMode(
      page,
      testAssets,
      testInfo,
    );

    await dashboard.addChartByName(sliceName);
    await expect(dashboard.getChartHolders()).toHaveCount(1);

    await dashboard.deleteChartHolder();
    await expect(dashboard.getChartHolders()).toHaveCount(0);
  },
);

testWithAssets(
  'edit mode: add a markdown component via drag-and-drop',
  async ({ page, testAssets }, testInfo) => {
    // Heaviest edit-mode flow (drag + ace edit + commit + mouse resize); give it
    // extra headroom so it stays reliable when the suite runs in parallel.
    testWithAssets.slow();
    const dashboard = await openEmptyDashboardInEditMode(
      page,
      testAssets,
      testInfo,
    );

    await dashboard.addLayoutElement('Text / Markdown');
    const editor = dashboard.getMarkdownEditors().first();
    await expect(editor).toBeVisible();

    // Enter edit mode by focusing the component. The markdown enters edit on a
    // document-level focus handler attached after mount, so a single early click
    // can be missed under load; retry until the ace editor appears. Click the
    // rendered "Header 1" heading element specifically (never the trailing
    // hyperlink in the default content), so a stray click can't navigate away.
    const aceContent = dashboard.getMarkdownAceContent(editor);
    const heading = editor.locator('h1', { hasText: 'Header 1' });
    await expect(async () => {
      if (await aceContent.isVisible()) return;
      await heading.click();
      await expect(aceContent).toBeVisible({
        timeout: MARKDOWN_EDIT_ATTEMPT_TIMEOUT,
      });
    }).toPass({ timeout: MARKDOWN_EDIT_TOTAL_TIMEOUT });
    await expect(aceContent).toContainText('Header 1');
    await expect(aceContent).toContainText('markdown formatting');

    // Replace the content and confirm the edit is reflected.
    const aceInput = dashboard.getMarkdownAceInput(editor);
    await aceInput.press('ControlOrMeta+a');
    await aceInput.press('Delete');
    await aceInput.pressSequentially('Test resize');
    await expect(aceContent).toContainText('Test resize');

    // Commit by clicking outside the component. Ace unmounting is what proves
    // the component left its editing state — the wrapper contains "Test resize"
    // either way, since ace holds that text before the click too.
    await dashboard.blurToDashboardTitle();
    await expect(aceContent).toBeHidden();
    await expect(editor).toContainText('Test resize');

    // Resize via the bottom handle and confirm the component grew taller.
    const { heightBefore, heightAfter } = await dashboard.resizeComponent(
      editor,
      RESIZE_DELTA_PX,
    );
    expect(heightAfter).toBeGreaterThan(heightBefore);
  },
);
