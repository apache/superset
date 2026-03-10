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
import { BulkSelect } from '../components/ListView';
import { URL } from '../utils/urls';

/**
 * Dashboard List Page object.
 */
export class DashboardListPage {
  private readonly page: Page;
  private readonly table: Table;
  readonly bulkSelect: BulkSelect;

  /**
   * Action button names for getByRole('button', { name })
   * DashboardList uses Icons.DeleteOutlined, Icons.UploadOutlined, Icons.EditOutlined
   */
  private static readonly ACTION_BUTTONS = {
    DELETE: 'delete',
    EDIT: 'edit',
    EXPORT: 'upload',
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
    await this.page.goto(`${URL.DASHBOARD_LIST}?viewMode=table`);
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
    await row
      .getByRole('button', { name: DashboardListPage.ACTION_BUTTONS.DELETE })
      .click();
  }

  /**
   * Clicks the edit action button for a dashboard
   * @param dashboardName - The name of the dashboard to edit
   */
  async clickEditAction(dashboardName: string): Promise<void> {
    const row = this.table.getRow(dashboardName);
    await row
      .getByRole('button', { name: DashboardListPage.ACTION_BUTTONS.EDIT })
      .click();
  }

  /**
   * Clicks the export action button for a dashboard
   * @param dashboardName - The name of the dashboard to export
   */
  async clickExportAction(dashboardName: string): Promise<void> {
    const row = this.table.getRow(dashboardName);
    await row
      .getByRole('button', { name: DashboardListPage.ACTION_BUTTONS.EXPORT })
      .click();
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
   * Clicks a bulk action button by name (e.g., "Export", "Delete")
   * @param actionName - The name of the bulk action to click
   */
  async clickBulkAction(actionName: string): Promise<void> {
    await this.bulkSelect.clickAction(actionName);
  }

  /**
   * Clicks the import button on the dashboard list page
   */
  async clickImportButton(): Promise<void> {
    await new Button(this.page, this.page.getByTestId('import-button')).click();
  }
}
