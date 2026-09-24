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

import { Page, Locator } from '@playwright/test';
import { TIMEOUT } from '../utils/constants';
import { AgGrid } from '../components/core/AgGrid';
import { Menu } from '../components/core';
import { SaveChartModal } from '../components/modals';

/**
 * Explore Page object
 */
export class ExplorePage {
  private readonly page: Page;

  private static readonly SELECTORS = {
    DATASOURCE_CONTROL: '[data-test="datasource-control"]',
    VIZ_SWITCHER: '[data-test="fast-viz-switcher"]',
    CHART_CONTAINER: '[data-test="chart-container"]',
    // The bottom data panel (DataTablesPane / SouthPane) with Results/Samples tabs
    SOUTH_PANE: '[data-test="some-purposeful-instance"]',
    EXPAND_DATA_PANEL: '[aria-label="Expand data panel"]',
    RESULTS_TAB: '[data-node-key="results"]',
    ACTIVE_TABPANE: '.ant-tabs-content-active',
    SAVE_BUTTON: '[data-test="query-save-button"]',
    METADATA_BAR: '[data-test="metadata-bar"]',
    // Ant Design's Dropdown popupRender wraps its content in an OverrideProvider
    // that renames the Menu's CSS prefix to "ant-dropdown-menu", so the chart
    // actions menu (which carries no data-test of its own) is reliably found here.
    ACTIONS_MENU_ROOT: '.ant-dropdown-menu-root',
  } as const;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigates to the Explore page for a given chart and waits for it to load.
   *
   * @param chartId - ID of the chart (slice) to open
   * @param options - Optional wait options
   */
  async goto(chartId: number, options?: { timeout?: number }): Promise<void> {
    await this.page.goto(`explore/?slice_id=${chartId}`);
    await this.waitForPageLoad(options);
  }

  /**
   * Gets the chart container locator (where the rendered viz appears).
   *
   * @returns Locator for the chart container
   */
  getChartContainer(): Locator {
    return this.page.locator(ExplorePage.SELECTORS.CHART_CONTAINER);
  }

  /**
   * Waits for the Explore page to load.
   * Validates URL contains /explore/ and datasource control is visible.
   *
   * @param options - Optional wait options
   */
  async waitForPageLoad(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? TIMEOUT.PAGE_LOAD;

    await this.page.waitForURL('**/explore/**', { timeout });

    await this.page.waitForSelector(ExplorePage.SELECTORS.DATASOURCE_CONTROL, {
      state: 'visible',
      timeout,
    });
  }

  /**
   * Gets the datasource control locator.
   * Returns a Locator that tests can use with expect() or to read text.
   *
   * @returns Locator for the datasource control
   *
   * @example
   * const name = await explorePage.getDatasourceControl().textContent();
   */
  getDatasourceControl(): Locator {
    return this.page.locator(ExplorePage.SELECTORS.DATASOURCE_CONTROL);
  }

  /**
   * Gets the currently selected dataset name from the datasource control
   */
  async getDatasetName(): Promise<string> {
    const text = await this.getDatasourceControl().textContent();
    return text?.trim() || '';
  }

  /**
   * Gets the visualization switcher locator.
   * Returns a Locator that tests can use with expect().toBeVisible(), etc.
   *
   * @returns Locator for the viz switcher
   *
   * @example
   * await expect(explorePage.getVizSwitcher()).toBeVisible();
   */
  getVizSwitcher(): Locator {
    return this.page.locator(ExplorePage.SELECTORS.VIZ_SWITCHER);
  }

  /**
   * Expands the bottom data panel if it is currently collapsed.
   * Safe to call when already expanded (no-op).
   */
  async expandDataPanel(): Promise<void> {
    const expandButton = this.page.locator(
      ExplorePage.SELECTORS.EXPAND_DATA_PANEL,
    );
    if (await expandButton.isVisible().catch(() => false)) {
      await expandButton.click();
    }
  }

  /**
   * Opens the bottom data panel and activates the "Results" tab. Clicking the
   * already-active tab collapses the panel, so the click is guarded.
   */
  async openResultsTab(): Promise<void> {
    await this.expandDataPanel();
    const resultsTab = this.page
      .locator(ExplorePage.SELECTORS.SOUTH_PANE)
      .locator(ExplorePage.SELECTORS.RESULTS_TAB);
    const className = (await resultsTab.getAttribute('class')) ?? '';
    if (!className.includes('ant-tabs-tab-active')) {
      await resultsTab.click();
    }
  }

  /**
   * Returns an AgGrid wrapper around the currently active Results tab grid.
   */
  getResultsGrid(): AgGrid {
    const grid = this.page
      .locator(ExplorePage.SELECTORS.SOUTH_PANE)
      .locator(ExplorePage.SELECTORS.ACTIVE_TABPANE)
      .locator('[role="grid"]')
      .first();
    return new AgGrid(this.page, grid);
  }

  /**
   * Gets the chart header's Save button locator.
   */
  getSaveButton(): Locator {
    return this.page.locator(ExplorePage.SELECTORS.SAVE_BUTTON);
  }

  /**
   * Clicks the Save button and returns a ready-to-use SaveChartModal.
   */
  async openSaveModal(): Promise<SaveChartModal> {
    await this.getSaveButton().click();
    const modal = new SaveChartModal(this.page);
    await modal.waitForReady();
    return modal;
  }

  /**
   * Gets the chart metadata bar locator (dashboard membership, last modified, etc.).
   */
  getMetadataBar(): Locator {
    return this.page.locator(ExplorePage.SELECTORS.METADATA_BAR);
  }

  /**
   * Locator for the metadata bar's dashboard-membership title text, e.g.
   * "Not added to any dashboard" or "Added to 3 dashboards". Assert with
   * `toHaveText` so the check retries until the post-save refresh lands.
   */
  getDashboardsMetadataText(): Locator {
    return this.getMetadataBar()
      .locator('.metadata-text')
      .filter({ hasText: /dashboard/i })
      .first();
  }

  /**
   * Opens the chart's "..." actions menu (the `Menu actions trigger` button)
   * and waits for its popup to render.
   */
  async openActionsMenu(): Promise<void> {
    await this.page
      .getByRole('button', { name: 'Menu actions trigger' })
      .click();
    await this.page
      .locator(ExplorePage.SELECTORS.ACTIONS_MENU_ROOT)
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUT.FORM_LOAD });
  }

  /**
   * Closes the chart's actions menu (and any open submenu) via Escape.
   */
  async closeActionsMenu(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }

  /**
   * Opens the chart actions menu and its "On dashboards" submenu, returning
   * the submenu's popup locator so callers can inspect the listed dashboards.
   */
  async openDashboardsSubmenu(): Promise<Locator> {
    await this.openActionsMenu();
    const menu = new Menu(
      this.page,
      this.page.locator(ExplorePage.SELECTORS.ACTIONS_MENU_ROOT).first(),
    );
    return menu.openSubmenu('On dashboards');
  }
}
