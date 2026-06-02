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
import { Button, Table } from '../components/core';
import { BulkSelect, BulkSelectActionKey } from '../components/ListView';
import { gotoWithRetry } from '../helpers/navigation';
import { URL } from '../utils/urls';

/**
 * Dashboard List Page object.
 */
export class DashboardListPage {
  private readonly page: Page;
  private readonly table: Table;
  readonly bulkSelect: BulkSelect;

  /**
   * Stable data-test keys for the row action buttons in DashboardList.
   */
  private static readonly ACTION_TEST_IDS = {
    DELETE: 'dashboard-row-delete',
    EDIT: 'dashboard-row-edit',
    EXPORT: 'dashboard-row-export',
  } as const;

  constructor(page: Page) {
    this.page = page;
    this.table = new Table(page);
    this.bulkSelect = new BulkSelect(page, this.table);
  }

  /**
   * Navigate to the dashboard list page.
   * Forces table view via URL parameter to avoid card view default
   * (ListviewsDefaultCardView feature flag may enable card view).
   */
  async goto(): Promise<void> {
    await gotoWithRetry(this.page, `${URL.DASHBOARD_LIST}?viewMode=table`);
  }

  /**
   * Wait for the table to load
   * @param options - Optional wait options
   */
  async waitForTableLoad(options?: { timeout?: number }): Promise<void> {
    await this.table.waitForVisible(options);
  }

  /**
   * Gets a dashboard row locator by name.
   * Returns a Locator that tests can use with expect().toBeVisible(), etc.
   *
   * @param dashboardName - The name of the dashboard
   * @returns Locator for the dashboard row
   */
  getDashboardRow(dashboardName: string): Locator {
    return this.table.getRow(dashboardName);
  }

  /**
   * Clicks the delete action button for a dashboard
   * @param dashboardName - The name of the dashboard to delete
   */
  async clickDeleteAction(dashboardName: string): Promise<void> {
    const row = this.table.getRow(dashboardName);
    await row.getByTestId(DashboardListPage.ACTION_TEST_IDS.DELETE).click();
  }

  /**
   * Clicks the edit action button for a dashboard
   * @param dashboardName - The name of the dashboard to edit
   */
  async clickEditAction(dashboardName: string): Promise<void> {
    const row = this.table.getRow(dashboardName);
    await row.getByTestId(DashboardListPage.ACTION_TEST_IDS.EDIT).click();
  }

  /**
   * Clicks the export action button for a dashboard
   * @param dashboardName - The name of the dashboard to export
   */
  async clickExportAction(dashboardName: string): Promise<void> {
    const row = this.table.getRow(dashboardName);
    await row.getByTestId(DashboardListPage.ACTION_TEST_IDS.EXPORT).click();
  }

  /**
   * Clicks the "Bulk select" button to enable bulk selection mode
   */
  async clickBulkSelectButton(): Promise<void> {
    await this.bulkSelect.enable();
  }

  /**
   * Selects a dashboard's checkbox in bulk select mode
   * @param dashboardName - The name of the dashboard to select
   */
  async selectDashboardCheckbox(dashboardName: string): Promise<void> {
    await this.bulkSelect.selectRow(dashboardName);
  }

  /**
   * Clicks a bulk action button by its stable action key (e.g., "delete", "export").
   * @param actionKey - The stable key of the bulk action to click
   */
  async clickBulkAction(actionKey: BulkSelectActionKey): Promise<void> {
    await this.bulkSelect.clickAction(actionKey);
  }

  /**
   * Clicks the import button on the dashboard list page
   */
  async clickImportButton(): Promise<void> {
    await new Button(this.page, this.page.getByTestId('import-button')).click();
  }
}
