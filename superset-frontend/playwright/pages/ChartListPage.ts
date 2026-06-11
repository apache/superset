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
import { BulkSelect, BulkSelectActionKey } from '../components/ListView';
import { gotoWithRetry } from '../helpers/navigation';
import { URL } from '../utils/urls';

/**
 * Chart List Page object.
 */
export class ChartListPage {
  private readonly page: Page;
  private readonly table: Table;
  readonly bulkSelect: BulkSelect;

  /**
   * Stable data-test keys for the row action buttons in ChartList.
   */
  private static readonly ACTION_TEST_IDS = {
    DELETE: 'chart-row-delete',
    EDIT: 'chart-row-edit',
    EXPORT: 'chart-row-export',
  } as const;

  constructor(page: Page) {
    this.page = page;
    this.table = new Table(page);
    this.bulkSelect = new BulkSelect(page, this.table);
  }

  /**
   * Navigate to the chart list page in table view.
   * Forces table view via URL parameter to avoid card view default
   * (ListviewsDefaultCardView feature flag may enable card view).
   */
  async goto(): Promise<void> {
    await gotoWithRetry(this.page, `${URL.CHART_LIST}?viewMode=table`);
  }

  /**
   * Navigate to the chart list page in card view.
   */
  async gotoCardView(): Promise<void> {
    await gotoWithRetry(this.page, `${URL.CHART_LIST}?viewMode=card`);
  }

  /**
   * Wait for the table to load
   * @param options - Optional wait options
   */
  async waitForTableLoad(options?: { timeout?: number }): Promise<void> {
    await this.table.waitForVisible(options);
  }

  /**
   * Wait for card view to finish loading.
   */
  async waitForCardLoad(options?: { timeout?: number }): Promise<void> {
    await this.page
      .locator('[data-test="styled-card"]')
      .first()
      .waitFor({ state: 'visible', ...options });
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
    await row.getByTestId(ChartListPage.ACTION_TEST_IDS.DELETE).click();
  }

  /**
   * Clicks the edit action button for a chart
   * @param chartName - The name of the chart to edit
   */
  async clickEditAction(chartName: string): Promise<void> {
    const row = this.table.getRow(chartName);
    await row.getByTestId(ChartListPage.ACTION_TEST_IDS.EDIT).click();
  }

  /**
   * Clicks the export action button for a chart
   * @param chartName - The name of the chart to export
   */
  async clickExportAction(chartName: string): Promise<void> {
    const row = this.table.getRow(chartName);
    await row.getByTestId(ChartListPage.ACTION_TEST_IDS.EXPORT).click();
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
   * Clicks a bulk action button by its stable action key (e.g., "delete", "export").
   * @param actionKey - The stable key of the bulk action to click
   */
  async clickBulkAction(actionKey: BulkSelectActionKey): Promise<void> {
    await this.bulkSelect.clickAction(actionKey);
  }

  // --- Card view methods ---

  /**
   * Gets a chart card locator by name (card view).
   */
  getChartCard(chartName: string): Locator {
    return this.page
      .locator('[data-test="styled-card"]')
      .filter({ hasText: chartName });
  }

  /**
   * Clicks the edit option in a chart card's dropdown menu (card view).
   */
  async clickCardEditAction(chartName: string): Promise<void> {
    const card = this.getChartCard(chartName);
    await card.locator('[aria-label="more"]').click();
    await this.page.locator('[data-test="chart-list-edit-option"]').click();
  }
}
