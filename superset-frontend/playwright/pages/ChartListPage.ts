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
import { Table } from '../components/core';
import { BulkSelect } from '../components/ListView';
import { URL } from '../utils/urls';

/**
 * Chart List Page object.
 */
export class ChartListPage {
  private readonly page: Page;
  private readonly table: Table;
  readonly bulkSelect: BulkSelect;

  /**
   * Action button names for getByRole('button', { name })
   * Verified: ChartList uses Icons.DeleteOutlined, Icons.UploadOutlined, Icons.EditOutlined
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
   * Navigate to the chart list page.
   * Forces table view via URL parameter to avoid card view default
   * (ListviewsDefaultCardView feature flag may enable card view).
   */
  async goto(): Promise<void> {
    await this.page.goto(`${URL.CHART_LIST}?viewMode=table`);
  }

  /**
   * Wait for the table to load
   * @param options - Optional wait options
   */
  async waitForTableLoad(options?: { timeout?: number }): Promise<void> {
    await this.table.waitForVisible(options);
  }

  /**
   * Gets a chart row locator by name.
   * Returns a Locator that tests can use with expect().toBeVisible(), etc.
   *
   * @param chartName - The name of the chart
   * @returns Locator for the chart row
   */
  getChartRow(chartName: string): Locator {
    return this.table.getRow(chartName);
  }

  /**
   * Clicks the delete action button for a chart
   * @param chartName - The name of the chart to delete
   */
  async clickDeleteAction(chartName: string): Promise<void> {
    const row = this.table.getRow(chartName);
    await row
      .getByRole('button', { name: ChartListPage.ACTION_BUTTONS.DELETE })
      .click();
  }

  /**
   * Clicks the edit action button for a chart
   * @param chartName - The name of the chart to edit
   */
  async clickEditAction(chartName: string): Promise<void> {
    const row = this.table.getRow(chartName);
    await row
      .getByRole('button', { name: ChartListPage.ACTION_BUTTONS.EDIT })
      .click();
  }

  /**
   * Clicks the export action button for a chart
   * @param chartName - The name of the chart to export
   */
  async clickExportAction(chartName: string): Promise<void> {
    const row = this.table.getRow(chartName);
    await row
      .getByRole('button', { name: ChartListPage.ACTION_BUTTONS.EXPORT })
      .click();
  }

  /**
   * Clicks the "Bulk select" button to enable bulk selection mode
   */
  async clickBulkSelectButton(): Promise<void> {
    await this.bulkSelect.enable();
  }

  /**
   * Selects a chart's checkbox in bulk select mode
   * @param chartName - The name of the chart to select
   */
  async selectChartCheckbox(chartName: string): Promise<void> {
    await this.bulkSelect.selectRow(chartName);
  }

  /**
   * Clicks a bulk action button by name (e.g., "Export", "Delete")
   * @param actionName - The name of the bulk action to click
   */
  async clickBulkAction(actionName: string): Promise<void> {
    await this.bulkSelect.clickAction(actionName);
  }
}
