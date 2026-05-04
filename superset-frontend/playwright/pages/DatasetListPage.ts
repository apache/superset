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
 * Dataset List Page object.
 */
export class DatasetListPage {
  private readonly page: Page;
  private readonly table: Table;
  readonly bulkSelect: BulkSelect;

  private static readonly SELECTORS = {
    DATASET_LINK: '[data-test="internal-link"]',
  } as const;

  /**
   * Action button names for getByRole('button', { name })
   */
  private static readonly ACTION_BUTTONS = {
    DELETE: 'delete',
    EDIT: 'edit',
    EXPORT: 'upload', // Export button uses upload icon
    DUPLICATE: 'copy',
  } as const;

  constructor(page: Page) {
    this.page = page;
    this.table = new Table(page);
    this.bulkSelect = new BulkSelect(page, this.table);
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
    const row = this.table.getRow(datasetName);
    await row
      .getByRole('button', { name: DatasetListPage.ACTION_BUTTONS.DELETE })
      .click();
  }

  /**
   * Clicks the edit action button for a dataset
   * @param datasetName - The name of the dataset to edit
   */
  async clickEditAction(datasetName: string): Promise<void> {
    const row = this.table.getRow(datasetName);
    await row
      .getByRole('button', { name: DatasetListPage.ACTION_BUTTONS.EDIT })
      .click();
  }

  /**
   * Clicks the export action button for a dataset
   * @param datasetName - The name of the dataset to export
   */
  async clickExportAction(datasetName: string): Promise<void> {
    const row = this.table.getRow(datasetName);
    await row
      .getByRole('button', { name: DatasetListPage.ACTION_BUTTONS.EXPORT })
      .click();
  }

  /**
   * Clicks the duplicate action button for a dataset (virtual datasets only)
   * @param datasetName - The name of the dataset to duplicate
   */
  async clickDuplicateAction(datasetName: string): Promise<void> {
    const row = this.table.getRow(datasetName);
    await row
      .getByRole('button', { name: DatasetListPage.ACTION_BUTTONS.DUPLICATE })
      .click();
  }

  /**
   * Clicks the "Bulk select" button to enable bulk selection mode
   */
  async clickBulkSelectButton(): Promise<void> {
    await this.bulkSelect.enable();
  }

  /**
   * Selects a dataset's checkbox in bulk select mode
   * @param datasetName - The name of the dataset to select
   */
  async selectDatasetCheckbox(datasetName: string): Promise<void> {
    await this.bulkSelect.selectRow(datasetName);
  }

  /**
   * Clicks a bulk action button by name (e.g., "Export", "Delete")
   * @param actionName - The name of the bulk action to click
   */
  async clickBulkAction(actionName: string): Promise<void> {
    await this.bulkSelect.clickAction(actionName);
  }

  /**
   * Gets the "+ Dataset" button for creating new datasets.
   * Uses specific selector to avoid matching the "Datasets" nav link.
   */
  getAddDatasetButton(): Button {
    return new Button(
      this.page,
      this.page.getByRole('button', { name: /^\+ Dataset$|^plus Dataset$/ }),
    );
  }

  /**
   * Clicks the "+ Dataset" button to navigate to create dataset page
   */
  async clickAddDataset(): Promise<void> {
    await this.getAddDatasetButton().click();
  }

  /**
   * Clicks the import button to open the import modal
   */
  async clickImportButton(): Promise<void> {
    await this.page.getByTestId('import-button').click();
  }
}
