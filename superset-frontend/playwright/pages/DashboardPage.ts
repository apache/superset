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

import { Page, Download, Locator } from '@playwright/test';
import { Button, Input, Menu, Tabs } from '../components/core';
import { gotoWithRetry } from '../helpers/navigation';
import { html5DragAndDrop } from '../helpers/dnd';
import { TIMEOUT } from '../utils/constants';

/**
 * Dashboard Page object for interacting with dashboards.
 */
export class DashboardPage {
  private readonly page: Page;

  private static readonly SELECTORS = {
    DASHBOARD_HEADER: '[data-test="dashboard-header-container"]',
    DASHBOARD_MENU_TRIGGER: '[data-test="actions-trigger"]',
    // The header-actions-menu is the data-test for the dropdown menu content
    HEADER_ACTIONS_MENU: '[data-test="header-actions-menu"]',
    EDIT_BUTTON: '[data-test="edit-dashboard-button"]',
    BUILDER_PANE: '[data-test="dashboard-builder-sidepane"]',
    CHARTS_SEARCH: '[data-test="dashboard-charts-filter-search-input"]',
    CHART_CARD: '[data-test="chart-card"]',
    GRID_CONTENT: '[data-test="grid-content"]',
    EMPTY_DROPTARGET: '[data-test="grid-content"] .empty-droptarget',
    NEW_COMPONENT: '[data-test="new-component"]',
    CHART_HOLDER: '[data-test="dashboard-component-chart-holder"]',
    DELETE_COMPONENT: '[data-test="dashboard-delete-component-button"]',
    MARKDOWN_EDITOR: '[data-test="dashboard-markdown-editor"]',
  } as const;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a dashboard by its slug
   * @param slug - The dashboard slug (e.g., 'world_health')
   */
  async gotoBySlug(slug: string): Promise<void> {
    await gotoWithRetry(this.page, `superset/dashboard/${slug}/`);
  }

  /**
   * Navigate to a dashboard by its ID
   * @param id - The dashboard ID
   */
  async gotoById(id: number): Promise<void> {
    await gotoWithRetry(this.page, `superset/dashboard/${id}/`);
  }

  /**
   * Wait for the dashboard header to be visible.
   */
  async waitForLoad(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? TIMEOUT.PAGE_LOAD;
    await this.page.waitForSelector(DashboardPage.SELECTORS.DASHBOARD_HEADER, {
      timeout,
    });
  }

  /**
   * Wait for all charts on the dashboard to finish loading.
   * Waits until no loading indicators are visible on the page.
   */
  async waitForChartsToLoad(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? TIMEOUT.API_RESPONSE;

    // Use browser-context evaluation to check visibility directly.
    // Loading indicators ([aria-label="Loading"]) may persist in the DOM as hidden
    // elements after charts finish loading. This checks that none are currently visible,
    // returning immediately when charts are already loaded (no timeout penalty).
    await this.page.waitForFunction(
      () => {
        const loaders = document.querySelectorAll('[aria-label="Loading"]');
        if (loaders.length === 0) return true;
        return Array.from(loaders).every(el => {
          const style = getComputedStyle(el);
          return (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0'
          );
        });
      },
      undefined,
      { timeout },
    );
  }

  /**
   * Open the dashboard header actions menu (three-dot menu)
   */
  async openHeaderActionsMenu(): Promise<void> {
    await this.page.click(DashboardPage.SELECTORS.DASHBOARD_MENU_TRIGGER);
    // Wait for the dropdown menu to appear
    await this.page.waitForSelector(
      DashboardPage.SELECTORS.HEADER_ACTIONS_MENU,
      {
        state: 'visible',
      },
    );
  }

  /**
   * Selects an option from the Download submenu.
   * Opens the header actions menu, navigates to Download submenu,
   * and clicks the specified option.
   *
   * @param optionText - The download option to select (e.g., "Export YAML")
   */
  async selectDownloadOption(optionText: string): Promise<Download> {
    await this.openHeaderActionsMenu();

    const menu = new Menu(
      this.page,
      DashboardPage.SELECTORS.HEADER_ACTIONS_MENU,
    );
    const downloadPromise = this.page.waitForEvent('download');
    await menu.selectSubmenuItem('Download', optionText);
    return downloadPromise;
  }

  /**
   * Enter dashboard edit mode and wait for the builder side pane to appear.
   */
  async enterEditMode(): Promise<void> {
    const editButton = new Button(
      this.page,
      DashboardPage.SELECTORS.EDIT_BUTTON,
    );
    await editButton.click();
    await this.page.waitForSelector(DashboardPage.SELECTORS.BUILDER_PANE, {
      state: 'visible',
    });
  }

  /**
   * The builder side pane's tab bar (Charts / Layout elements).
   */
  private builderTabs(): Tabs {
    return new Tabs(
      this.page,
      this.page
        .locator(`${DashboardPage.SELECTORS.BUILDER_PANE} .ant-tabs`)
        .first(),
    );
  }

  /**
   * Switch the builder side pane to one of its tabs.
   * @param tab - 'Charts' (existing slices) or 'Layout elements' (new components)
   */
  async openBuilderTab(tab: 'Charts' | 'Layout elements'): Promise<void> {
    await this.builderTabs().clickTab(tab);
  }

  /**
   * Locator for chart-holder components currently placed on the grid.
   */
  chartHolders(): Locator {
    return this.page.locator(DashboardPage.SELECTORS.CHART_HOLDER);
  }

  /**
   * Drag an existing chart from the Charts pane onto the dashboard grid.
   * Requires edit mode to be active.
   * @param sliceName - The slice name to search for and drag
   */
  async addChartByName(sliceName: string): Promise<void> {
    await this.openBuilderTab('Charts');
    const search = new Input(this.page, DashboardPage.SELECTORS.CHARTS_SEARCH);
    await search.fill(sliceName);
    const card = this.page
      .locator(DashboardPage.SELECTORS.CHART_CARD)
      .filter({ hasText: sliceName })
      .first();
    await card.waitFor({ state: 'visible' });
    await html5DragAndDrop(this.page, card, this.dropTarget());
  }

  /**
   * Drag a new Layout element (by its label) onto the dashboard grid.
   * Requires edit mode to be active.
   * @param label - The new-component label, e.g. 'Text / Markdown'
   */
  async addLayoutElement(label: string): Promise<void> {
    await this.openBuilderTab('Layout elements');
    const source = this.page
      .locator(DashboardPage.SELECTORS.NEW_COMPONENT)
      .filter({ hasText: label })
      .first();
    await source.waitFor({ state: 'visible' });
    await html5DragAndDrop(this.page, source, this.dropTarget());
  }

  /**
   * The grid drop target. Prefers the empty droptarget (empty grid) and falls
   * back to the grid content container.
   */
  private dropTarget(): Locator {
    return this.page.locator(DashboardPage.SELECTORS.EMPTY_DROPTARGET).first();
  }

  /**
   * Hover a placed chart-holder and click its delete button (edit mode).
   * @param index - Which chart holder to delete (default 0)
   */
  async deleteChartHolder(index = 0): Promise<void> {
    const holder = this.chartHolders().nth(index);
    await holder.hover();
    const deleteButton = new Button(
      this.page,
      holder.locator(DashboardPage.SELECTORS.DELETE_COMPONENT),
    );
    await deleteButton.click();
  }

  /**
   * Locator for markdown editor components on the grid.
   */
  markdownEditors(): Locator {
    return this.page.locator(DashboardPage.SELECTORS.MARKDOWN_EDITOR);
  }
}
