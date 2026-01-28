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

import { Page, Download } from '@playwright/test';
import { Menu } from '../components/core';
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
  } as const;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a dashboard by its slug
   * @param slug - The dashboard slug (e.g., 'world_health')
   */
  async gotoBySlug(slug: string): Promise<void> {
    await this.page.goto(`superset/dashboard/${slug}/`);
  }

  /**
   * Navigate to a dashboard by its ID
   * @param id - The dashboard ID
   */
  async gotoById(id: number): Promise<void> {
    await this.page.goto(`superset/dashboard/${id}/`);
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
   * Waits until no loading indicators remain in the DOM.
   */
  async waitForChartsToLoad(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? TIMEOUT.PAGE_LOAD;

    await this.page.waitForFunction(
      selector => document.querySelectorAll(selector).length === 0,
      '[aria-label="Loading"]',
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
}
