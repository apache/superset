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
import { TIMEOUT } from '../utils/constants';

/**
 * Dashboard Page object for interacting with dashboards.
 */
export class DashboardPage {
  private readonly page: Page;

  private static readonly SELECTORS = {
    DASHBOARD_HEADER: '[data-test="dashboard-header-container"]',
    DASHBOARD_MENU_TRIGGER: '[data-test="actions-trigger"]',
    DOWNLOAD_SUBMENU:
      '[data-test="header-actions-menu"] li:has-text("Download")',
    // Ant Design renders submenu items in a popup portal, so we need to search globally
    EXPORT_YAML_OPTION: '.ant-menu-submenu-popup li:has-text("Export YAML")',
    EXPORT_AS_EXAMPLE_OPTION:
      '.ant-menu-submenu-popup li:has-text("Export as Example")',
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
   * Wait for the dashboard to load
   */
  async waitForLoad(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? TIMEOUT.PAGE_LOAD;
    await this.page.waitForSelector(DashboardPage.SELECTORS.DASHBOARD_HEADER, {
      timeout,
    });
  }

  /**
   * Open the dashboard header actions menu (three-dot menu)
   */
  async openHeaderActionsMenu(): Promise<void> {
    await this.page.click(DashboardPage.SELECTORS.DASHBOARD_MENU_TRIGGER);
  }

  /**
   * Hover over the Download submenu to open it (Ant Design submenus open on hover)
   */
  async openDownloadMenu(): Promise<void> {
    await this.page.hover(DashboardPage.SELECTORS.DOWNLOAD_SUBMENU);
    // Wait for the submenu popup to appear
    await this.page.waitForSelector('.ant-menu-submenu-popup', {
      state: 'visible',
    });
  }

  /**
   * Click "Export YAML" in the download menu
   * Returns a Promise that resolves when download starts
   */
  async clickExportYaml(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.click(DashboardPage.SELECTORS.EXPORT_YAML_OPTION);
    return downloadPromise;
  }

  /**
   * Click "Export as Example" in the download menu
   * Returns a Promise that resolves when download starts
   */
  async clickExportAsExample(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.click(DashboardPage.SELECTORS.EXPORT_AS_EXAMPLE_OPTION);
    return downloadPromise;
  }
}
