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
 * Documentation Screenshot Generator
 *
 * Captures screenshots for the Superset documentation site and README.
 * Depends on example data loaded via `superset load_examples`.
 *
 * Run locally:
 *   cd superset-frontend
 *   PLAYWRIGHT_BASE_URL=http://localhost:8088 PLAYWRIGHT_ADMIN_PASSWORD=admin npm run docs:screenshots
 *
 * Or directly:
 *   npx playwright test --config=playwright/generators/playwright.config.ts docs/
 *
 * Screenshots are saved under docs/static/img/.
 * As new screenshots are scripted, entries are removed from screenshot-manifest.yaml
 * and the output path moves from that manifest into the test below.
 */

import path from 'path';
import { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { URL } from '../../utils/urls';
import { apiDelete, apiGet } from '../../helpers/api/requests';

const DOCS_STATIC = path.resolve(__dirname, '../../../../docs/static/img');
const SCREENSHOTS_DIR = path.join(DOCS_STATIC, 'screenshots');
const TUTORIAL_DIR = path.join(DOCS_STATIC, 'tutorial');

/**
 * Waits for animations and async renders to settle before taking a screenshot.
 * ECharts entry animations, image lazy-loading, and other async UI updates
 * require a short pause that can't be expressed as a deterministic wait condition.
 */
async function settle(page: Page, ms = 1000): Promise<void> {
  await page.waitForTimeout(ms);
}

/**
 * Navigates to the Sales Dashboard (from example data) and waits for charts
 * to finish rendering. Used by several tutorial screenshots that show the
 * dashboard in view or edit mode.
 */
async function openSalesDashboard(page: Page): Promise<void> {
  await page.goto(URL.DASHBOARD_LIST);
  const searchInput = page.getByPlaceholder('Type a value');
  await expect(searchInput).toBeVisible({ timeout: 15000 });
  await searchInput.fill('Sales Dashboard');
  await searchInput.press('Enter');

  const dashboardLink = page.getByRole('link', { name: /sales dashboard/i });
  await expect(dashboardLink).toBeVisible({ timeout: 10000 });
  await dashboardLink.click();

  const dashboardWrapper = page.locator(
    '[data-test="dashboard-content-wrapper"]',
  );
  await expect(dashboardWrapper).toBeVisible({ timeout: 30000 });
  await expect(
    page.locator('.dashboard-component-chart-holder').first(),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    dashboardWrapper.locator('[data-test="loading-indicator"]'),
  ).toHaveCount(0, { timeout: 30000 });
  await expect(
    page.locator('.dashboard-component-chart-holder canvas').first(),
  ).toBeVisible({ timeout: 15000 });
}

/**
 * Delete all dashboards matching the given exact title, along with the
 * charts attached to them. Used by the save-flow test to clean up after
 * itself and to recover from prior failed runs (idempotent pre-cleanup).
 *
 * Only safe because the title is unique to the test ("Superset Duper
 * Sales Dashboard"); don't reuse this against titles that could match
 * example-data dashboards.
 */
async function deleteDashboardByTitle(
  page: Page,
  title: string,
): Promise<void> {
  const filter = `(filters:!((col:dashboard_title,opr:eq,value:'${title}')))`;
  const resp = await apiGet(page, 'api/v1/dashboard/', {
    params: { q: filter },
    failOnStatusCode: false,
  });
  if (!resp.ok()) return;
  const body = await resp.json();
  const dashboards: { id: number }[] = body.result || [];

  for (const dash of dashboards) {
    const chartsResp = await apiGet(
      page,
      `api/v1/dashboard/${dash.id}/charts`,
      { failOnStatusCode: false },
    );
    const chartIds: number[] = chartsResp.ok()
      ? ((await chartsResp.json()).result || [])
          .map((c: { id?: number }) => c.id)
          .filter((id: unknown): id is number => typeof id === 'number')
      : [];

    await apiDelete(page, `api/v1/dashboard/${dash.id}`, {
      failOnStatusCode: false,
    });
    for (const id of chartIds) {
      await apiDelete(page, `api/v1/chart/${id}`, { failOnStatusCode: false });
    }
  }
}

test('chart gallery screenshot', async ({ page }) => {
  await page.goto(URL.CHART_ADD);

  // Wait for chart creation page to load
  await expect(page.getByText('Choose chart type')).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('tab', { name: 'All charts' }).click();

  // Wait for viz gallery to render chart type thumbnails
  const vizGallery = page.locator('.viz-gallery');
  await expect(vizGallery).toBeVisible();
  await expect(
    vizGallery.locator('[data-test="viztype-selector-container"]').first(),
  ).toBeVisible();

  await settle(page);
  await vizGallery.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'gallery.jpg'),
    type: 'jpeg',
  });
});

test('dashboard screenshot', async ({ page }) => {
  await openSalesDashboard(page);

  // Open the filter bar (collapsed by default)
  const expandButton = page.locator('[data-test="filter-bar__expand-button"]');
  if (await expandButton.isVisible()) {
    await expandButton.click();
    // Wait for filter bar content to expand and render filter controls
    await expect(
      page.locator('[data-test="filter-bar__collapsable"]'),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('[data-test="filterbar-action-buttons"]'),
    ).toBeVisible({ timeout: 5000 });
  }

  // Allow ECharts entry animations to finish before capturing
  await settle(page);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'dashboard.jpg'),
    type: 'jpeg',
    fullPage: true,
  });
});

test('chart editor screenshot', async ({ page }) => {
  await page.goto(URL.CHART_LIST);

  // Search for the Scatter Plot chart by name
  const searchInput = page.getByPlaceholder('Type a value');
  await expect(searchInput).toBeVisible({ timeout: 15000 });
  await searchInput.fill('Scatter Plot');
  await searchInput.press('Enter');

  // Click the Scatter Plot link to open explore
  const chartLink = page.getByRole('link', { name: /scatter plot/i });
  await expect(chartLink).toBeVisible({ timeout: 10000 });
  await chartLink.click();

  // Wait for explore page to fully load
  await page.waitForURL('**/explore/**', { timeout: 15000 });
  const sliceContainer = page.locator('[data-test="slice-container"]');
  await expect(sliceContainer).toBeVisible({ timeout: 15000 });

  // Wait for the chart to finish rendering (loading spinners clear, chart content appears)
  await expect(
    sliceContainer.locator('[data-test="loading-indicator"]'),
  ).toHaveCount(0, { timeout: 15000 });
  await expect(sliceContainer.locator('canvas, svg').first()).toBeVisible({
    timeout: 15000,
  });

  await settle(page);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'explore.jpg'),
    type: 'jpeg',
    fullPage: true,
  });
});

test('SQL Lab screenshot', async ({ page }) => {
  // SQL Lab has many interactive steps — allow extra time
  test.setTimeout(90000);
  await page.goto(URL.SQLLAB);

  // SQL Lab may open with no active query tab — create one if needed
  const addTabButton = page.getByRole('tab', { name: /add a new tab/i });
  const aceEditor = page.locator('.ace_content');

  // Wait for either the editor or the "add tab" prompt
  await expect(addTabButton.or(aceEditor)).toBeVisible({ timeout: 15000 });

  // If no editor is visible, click "Add a new tab" to create a query tab
  if (await addTabButton.isVisible()) {
    await addTabButton.click();
  }
  await expect(aceEditor).toBeVisible({ timeout: 15000 });

  // Click the active query tab to ensure focus is on the editor pane
  await page.getByText('Untitled Query').first().click();

  // Write a multi-line SELECT with explicit columns to fill the editor
  await aceEditor.click();
  const editor = page.getByRole('textbox', { name: /cursor/i });
  await editor.fill(
    'SELECT\n  ds,\n  name,\n  gender,\n  state,\n  num\nFROM birth_names\nLIMIT 100',
  );

  // Run the query — use the stable data-test attribute on the action button
  const runButton = page.locator('[data-test="run-query-action"]');
  await expect(runButton).toBeVisible();
  await runButton.click();

  // Wait for results to appear (look for the "N rows" badge in the results panel)
  await expect(page.getByText(/\d+ rows/)).toBeVisible({
    timeout: 30000,
  });

  // Switch to the Results tab to show the query output
  await page.getByRole('tab', { name: 'Results' }).click();

  // Move mouse away from buttons to dismiss any tooltips, then wait for them to disappear
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toHaveCount(0, { timeout: 2000 });

  await settle(page);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'sql_lab.jpg'),
    type: 'jpeg',
    fullPage: true,
  });
});

// ---------------------------------------------------------------------------
// Tutorial screenshots
// ---------------------------------------------------------------------------

test('datasets list screenshot', async ({ page }) => {
  await page.goto(URL.DATASET_LIST);

  const table = page.locator('[data-test="listview-table"]');
  await expect(table).toBeVisible({ timeout: 15000 });
  // Wait for at least one visible data row (skip ant-table-measure-row which is always hidden)
  await expect(
    table.locator('tbody tr:not(.ant-table-measure-row)').first(),
  ).toBeVisible({ timeout: 10000 });

  // Viewport screenshot (not fullPage) captures the SubMenu — showing the
  // "Datasets" nav item, Bulk Select button, and + Dataset button — plus the
  // top of the table. This is more informative than screenshotting the table alone.
  await settle(page);
  await page.screenshot({
    path: path.join(TUTORIAL_DIR, 'tutorial_08_sources_tables.png'),
    type: 'png',
  });
});

test('chart type picker screenshot', async ({ page }) => {
  await page.goto(URL.CHART_ADD);

  // Wait for the dataset step to appear (step title is first match; placeholder is second)
  await expect(page.getByText('Choose a dataset').first()).toBeVisible({
    timeout: 15000,
  });

  // Open the dataset selector and choose birth_names
  await page.getByTestId('Dataset').click();
  await page.keyboard.type('birth_names');
  // The dataset select uses a hidden ARIA listbox — the visible popup is a portal.
  // Wait for the first option to appear in the DOM, then select it via keyboard.
  await expect(
    page.locator('[role="listbox"] [role="option"]').first(),
  ).toBeAttached({ timeout: 10000 });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  // Open the chart gallery and wait for thumbnails to render
  await expect(page.getByText('Choose chart type')).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('tab', { name: 'All charts' }).click();
  const vizGallery = page.locator('.viz-gallery');
  await expect(vizGallery).toBeVisible();
  await expect(
    vizGallery.locator('[data-test="viztype-selector-container"]').first(),
  ).toBeVisible();

  // Select the Pivot Table chart type
  await vizGallery
    .locator('[data-test="viztype-selector-container"]')
    .filter({ hasText: 'Pivot Table' })
    .first()
    .click();

  // Allow thumbnails to finish loading and selection state to render
  await settle(page);

  // Viewport screenshot shows the dataset step (birth_names selected) and
  // the chart type gallery (Pivot Table highlighted)
  await page.screenshot({
    path: path.join(TUTORIAL_DIR, 'create_pivot.png'),
    type: 'png',
  });
});

test('publish button dashboard screenshot', async ({ page }) => {
  // Toggle Sales Dashboard to Draft, hover the label so the tooltip renders,
  // then capture the header area plus enough room below for the tooltip.
  // Always restores the dashboard to Published at the end.
  await openSalesDashboard(page);

  const publishedLabel = page.getByText('Published', { exact: true }).first();
  await expect(publishedLabel).toBeVisible({ timeout: 10000 });
  await publishedLabel.click();

  const draftLabel = page.getByText('Draft', { exact: true }).first();
  await expect(draftLabel).toBeVisible({ timeout: 10000 });

  try {
    await draftLabel.hover();
    await expect(page.getByRole('tooltip')).toBeVisible({ timeout: 5000 });
    await settle(page, 500);

    const headerBox = await page
      .locator('[data-test="dashboard-header-container"]')
      .boundingBox();
    if (!headerBox) {
      throw new Error('Could not locate dashboard header container');
    }
    await page.screenshot({
      path: path.join(TUTORIAL_DIR, 'publish_button_dashboard.png'),
      type: 'png',
      clip: {
        x: headerBox.x,
        y: headerBox.y,
        width: headerBox.width,
        height: headerBox.height + 140,
      },
    });
  } finally {
    // Restore: click Draft to re-publish so other runs start from a clean state
    await page.mouse.move(0, 0);
    await draftLabel.click();
    await expect(
      page.getByText('Published', { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
  }
});

test('edit button screenshot', async ({ page }) => {
  // Capture the right-side action buttons (Edit dashboard + "..." menu)
  // rather than the edit button in isolation.
  await openSalesDashboard(page);
  await settle(page);

  const rightPanel = page.locator('.right-button-panel');
  await expect(rightPanel).toBeVisible({ timeout: 5000 });
  await rightPanel.screenshot({
    path: path.join(TUTORIAL_DIR, 'tutorial_edit_button.png'),
    type: 'png',
  });
});

test('chart resize screenshot', async ({ page }) => {
  // Enter edit mode, start a resize drag on the right-edge handle, then
  // screenshot the chart mid-drag. While `DashboardGrid` is in the resizing
  // state it renders vertical `grid-column-guide` overlays across the grid
  // and the chart gets a blue `--resizing` outline — that's the state the
  // original tutorial screenshot was capturing.
  await openSalesDashboard(page);

  const editButton = page.locator('[data-test="edit-dashboard-button"]');
  await expect(editButton).toBeVisible();
  await editButton.click();

  await expect(
    page.locator('[data-test="dashboard-builder-sidepane"]'),
  ).toBeVisible({ timeout: 10000 });

  const chart = page.locator('.dashboard-component-chart-holder').first();
  await expect(chart).toBeVisible();
  const chartBox = await chart.boundingBox();
  if (!chartBox) {
    throw new Error('Could not locate chart bounding box');
  }

  // Hover over the chart so the on-hover action buttons (drag/trash/settings)
  // and resize handles become visible.
  await page.mouse.move(
    chartBox.x + chartBox.width / 2,
    chartBox.y + chartBox.height / 2,
  );
  await settle(page, 200);

  // The right-edge handle is a `<span>` added by re-resizable with our
  // custom class. Locating it by class is more reliable than computing
  // coordinates from the chart-holder (which isn't the full resizable box).
  const rightHandle = page
    .locator('.resizable-container-handle--right')
    .first();
  await expect(rightHandle).toBeVisible();
  const handleBox = await rightHandle.boundingBox();
  if (!handleBox) {
    throw new Error('Could not locate right-edge resize handle');
  }
  const handleX = handleBox.x + handleBox.width / 2;
  const handleY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(handleX, handleY);
  await page.mouse.down();
  // Move far enough to snap at least one grid column, which puts
  // DashboardGrid into isResizing=true so the column guides render.
  await page.mouse.move(handleX + 80, handleY, { steps: 10 });
  await settle(page, 500);

  // Clip to the chart area plus a left gutter for the hover action rail
  // and right padding that reaches past the dragged handle position.
  const leftGutter = 32;
  const rightPadding = 100;
  const topPadding = 16;
  const bottomPadding = 24;
  await page.screenshot({
    path: path.join(TUTORIAL_DIR, 'tutorial_chart_resize.png'),
    type: 'png',
    clip: {
      x: Math.max(0, chartBox.x - leftGutter),
      y: Math.max(0, chartBox.y - topPadding),
      width: chartBox.width + leftGutter + rightPadding,
      height: chartBox.height + topPadding + bottomPadding,
    },
  });

  // Release back at the start to avoid persisting a size change. Edit-mode
  // changes aren't saved (we never click the dashboard Save button).
  await page.mouse.move(handleX, handleY, { steps: 6 });
  await page.mouse.up();
});

test('save flow and first dashboard screenshots', async ({ page }) => {
  // Captures two linked tutorial screenshots in a single flow so the second
  // faithfully shows the dashboard the user just created:
  //   1. tutorial_save_slice.png — Save modal with the "Add to dashboard"
  //      dropdown surfacing a creatable option for a new dashboard.
  //   2. tutorial_first_dashboard.png — the freshly-created dashboard with
  //      the single saved chart (matches the tutorial narrative).
  //
  // Creates and then deletes a "Superset Duper Sales Dashboard" dashboard
  // plus the duplicate chart it owns. Pre-cleans in case a prior run failed.
  const NEW_DASHBOARD_NAME = 'Superset Duper Sales Dashboard';
  await deleteDashboardByTitle(page, NEW_DASHBOARD_NAME);

  // 1100px is wide enough to show the full "Superset Duper Sales Dashboard"
  // title alongside the header actions without truncation.
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto(URL.CHART_LIST);

  const searchInput = page.getByPlaceholder('Type a value');
  await expect(searchInput).toBeVisible({ timeout: 15000 });
  await searchInput.fill('Scatter Plot');
  await searchInput.press('Enter');

  const chartLink = page.getByRole('link', { name: /scatter plot/i });
  await expect(chartLink).toBeVisible({ timeout: 10000 });
  await chartLink.click();

  await page.waitForURL('**/explore/**', { timeout: 15000 });
  const sliceContainer = page.locator('[data-test="slice-container"]');
  await expect(sliceContainer).toBeVisible({ timeout: 15000 });
  await expect(
    sliceContainer.locator('[data-test="loading-indicator"]'),
  ).toHaveCount(0, { timeout: 15000 });

  const saveButton = page.locator('[data-test="query-save-button"]');
  await expect(saveButton).toBeVisible({ timeout: 10000 });
  await saveButton.click();

  const modal = page.locator('.ant-modal-content').filter({
    has: page.locator('[data-test="save-modal-body"]'),
  });
  await expect(modal).toBeVisible({ timeout: 10000 });

  // Open the "Add to dashboard" select and type a new dashboard name so
  // the dropdown surfaces the creatable option.
  const dashboardSelect = page.getByRole('combobox', {
    name: /select a dashboard/i,
  });
  await dashboardSelect.click();
  await page.keyboard.type(NEW_DASHBOARD_NAME);

  // Ant Design portals the visible dropdown with the class
  // `.ant-select-item-option` on each option (distinct from the hidden
  // ARIA listbox options rendered inside the combobox itself).
  const createOption = page
    .locator('.ant-select-item-option')
    .filter({ hasText: NEW_DASHBOARD_NAME });
  await expect(createOption).toBeVisible({ timeout: 10000 });
  await settle(page);

  try {
    // Screenshot 1: save modal + portaled dropdown.
    const modalBox = await modal.boundingBox();
    const optionBox = await createOption.boundingBox();
    if (!modalBox || !optionBox) {
      throw new Error('Could not locate save modal or create-option');
    }
    const padding = 16;
    const top = Math.max(0, modalBox.y - padding);
    const bottom = optionBox.y + optionBox.height + padding;
    await page.screenshot({
      path: path.join(TUTORIAL_DIR, 'tutorial_save_slice.png'),
      type: 'png',
      clip: {
        x: Math.max(0, modalBox.x - padding),
        y: top,
        width: modalBox.width + padding * 2,
        height: bottom - top,
      },
    });

    // Pick the creatable option, then click "Save & go to dashboard" so the
    // backend creates the dashboard + slice and redirects us to the new one.
    await createOption.click();
    const saveAndGotoBtn = page.locator('#btn_modal_save_goto_dash');
    await expect(saveAndGotoBtn).toBeEnabled({ timeout: 5000 });
    await saveAndGotoBtn.click();

    await page.waitForURL(/\/dashboard\/[^/]+\/?/, { timeout: 30000 });
    await expect(
      page.locator('[data-test="dashboard-content-wrapper"]'),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.locator('.dashboard-component-chart-holder').first(),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.locator('.dashboard-component-chart-holder canvas').first(),
    ).toBeVisible({ timeout: 15000 });

    // Dismiss the "Chart [X] has been saved" toast so it doesn't appear in
    // the screenshot. The close button is inside the toast container.
    const toast = page.locator('[data-test="toast-container"]').first();
    if (await toast.isVisible().catch(() => false)) {
      await toast.locator('.toast__close').click();
      await expect(toast).toBeHidden({ timeout: 5000 });
    }
    await settle(page);

    // Screenshot 2: the newly-created single-chart dashboard (title + chart).
    const headerBox = await page
      .locator('[data-test="dashboard-header-wrapper"]')
      .boundingBox();
    const chartBox = await page
      .locator('.dashboard-component-chart-holder')
      .first()
      .boundingBox();
    if (!headerBox || !chartBox) {
      throw new Error('Could not locate dashboard header or chart');
    }
    // Trim right edge to just past the chart so the screenshot isn't padded
    // with empty grid space.
    const rightPadding = 16;
    await page.screenshot({
      path: path.join(TUTORIAL_DIR, 'tutorial_first_dashboard.png'),
      type: 'png',
      clip: {
        x: 0,
        y: headerBox.y,
        width: Math.min(1100, chartBox.x + chartBox.width + rightPadding),
        height: chartBox.y + chartBox.height - headerBox.y + 16,
      },
    });
  } finally {
    await deleteDashboardByTitle(page, NEW_DASHBOARD_NAME);
  }
});
