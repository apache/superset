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
    DASHBOARD_HEADER: '[data-test="dashboard-header"]',
    DASHBOARD_MENU_TRIGGER: '[data-test="header-actions-trigger"]',
    DOWNLOAD_MENU: '[data-test="download-menu-button"]',
    EXPORT_YAML_OPTION: 'li:has-text("Export YAML")',
    EXPORT_AS_EXAMPLE_OPTION: 'li:has-text("Export as Example")',
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
   * Click the Download submenu in the header actions
   */
  async openDownloadMenu(): Promise<void> {
    await this.page.click(DashboardPage.SELECTORS.DOWNLOAD_MENU);
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
