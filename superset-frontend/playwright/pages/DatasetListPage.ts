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
import { Button, Checkbox, Table } from '../components/core';
import { URL } from '../utils/urls';

/**
 * Dataset List Page object.
 */
export class DatasetListPage {
  private readonly page: Page;
  private readonly table: Table;

  private static readonly SELECTORS = {
    DATASET_LINK: '[data-test="internal-link"]',
    DELETE_ACTION: '.action-button svg[data-icon="delete"]',
    EXPORT_ACTION: '.action-button svg[data-icon="upload"]',
    DUPLICATE_ACTION: '.action-button svg[data-icon="copy"]',
    BULK_SELECT_CONTROLS: '[data-test="bulk-select-controls"]',
    BULK_SELECT_ACTION: '[data-test="bulk-select-action"]',
  } as const;

  constructor(page: Page) {
    this.page = page;
    this.table = new Table(page);
  }

  /**
   * Navigate to the dataset list page
   */
  async goto(): Promise<void> {
    await this.page.goto(URL.DATASET_LIST);
  }

  /**
   * Wait for the table to load
   * @param options - Optional wait options
   */
  async waitForTableLoad(options?: { timeout?: number }): Promise<void> {
    await this.table.waitForVisible(options);
  }

  /**
   * Gets a dataset row locator by name.
   * Returns a Locator that tests can use with expect().toBeVisible(), etc.
   *
   * @param datasetName - The name of the dataset
   * @returns Locator for the dataset row
   *
   * @example
   * await expect(datasetListPage.getDatasetRow('birth_names')).toBeVisible();
   */
  getDatasetRow(datasetName: string): Locator {
    return this.table.getRow(datasetName);
  }

  /**
   * Clicks on a dataset name to navigate to Explore
   * @param datasetName - The name of the dataset to click
   */
  async clickDatasetName(datasetName: string): Promise<void> {
    await this.table.clickRowLink(
      datasetName,
      DatasetListPage.SELECTORS.DATASET_LINK,
    );
  }

  /**
   * Clicks the delete action button for a dataset
   * @param datasetName - The name of the dataset to delete
   */
  async clickDeleteAction(datasetName: string): Promise<void> {
    await this.table.clickRowAction(
      datasetName,
      DatasetListPage.SELECTORS.DELETE_ACTION,
    );
  }

  /**
   * Clicks the export action button for a dataset
   * @param datasetName - The name of the dataset to export
   */
  async clickExportAction(datasetName: string): Promise<void> {
    await this.table.clickRowAction(
      datasetName,
      DatasetListPage.SELECTORS.EXPORT_ACTION,
    );
  }

  /**
   * Clicks the duplicate action button for a dataset (virtual datasets only)
   * @param datasetName - The name of the dataset to duplicate
   */
  async clickDuplicateAction(datasetName: string): Promise<void> {
    await this.table.clickRowAction(
      datasetName,
      DatasetListPage.SELECTORS.DUPLICATE_ACTION,
    );
  }

  /**
   * Gets the "Bulk select" button
   */
  getBulkSelectButton(): Button {
    return new Button(
      this.page,
      this.page.getByRole('button', { name: 'Bulk select' }),
    );
  }

  /**
   * Clicks the "Bulk select" button to enable bulk selection mode
   */
  async clickBulkSelectButton(): Promise<void> {
    await this.getBulkSelectButton().click();
  }

  /**
   * Gets the checkbox for a dataset row
   * @param datasetName - The name of the dataset
   */
  getDatasetCheckbox(datasetName: string): Checkbox {
    const row = this.table.getRow(datasetName);
    return new Checkbox(row.getByRole('checkbox'));
  }

  /**
   * Selects a dataset's checkbox in bulk select mode
   * @param datasetName - The name of the dataset to select
   */
  async selectDatasetCheckbox(datasetName: string): Promise<void> {
    await this.getDatasetCheckbox(datasetName).check();
  }

  /**
   * Gets a bulk action button by name
   * @param actionName - The name of the bulk action (e.g., "Export", "Delete")
   */
  getBulkActionButton(actionName: string): Button {
    const bulkControls = this.page.locator(
      DatasetListPage.SELECTORS.BULK_SELECT_CONTROLS,
    );
    return new Button(
      this.page,
      bulkControls.locator(DatasetListPage.SELECTORS.BULK_SELECT_ACTION, {
        hasText: actionName,
      }),
    );
  }

  /**
   * Clicks a bulk action button by name (e.g., "Export", "Delete")
   * @param actionName - The name of the bulk action to click
   */
  async clickBulkAction(actionName: string): Promise<void> {
    await this.getBulkActionButton(actionName).click();
  }

  /**
   * Gets the bulk select controls locator (for assertions)
   */
  getBulkSelectControls(): Locator {
    return this.page.locator(DatasetListPage.SELECTORS.BULK_SELECT_CONTROLS);
  }
}
