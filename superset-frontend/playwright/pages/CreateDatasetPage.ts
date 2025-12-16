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

import { Page } from '@playwright/test';
import { Button, Select } from '../components/core';

/**
 * Create Dataset Page object for the dataset creation wizard.
 */
export class CreateDatasetPage {
  readonly page: Page;

  private static readonly PLACEHOLDERS = {
    DATABASE: 'Select database or type to search databases',
    CATALOG: 'Select catalog or type to search catalogs',
    SCHEMA: 'Select schema or type to search schemas',
    TABLE: 'Select table or type to search tables',
  } as const;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Gets the database selector
   */
  getDatabaseSelect(): Select {
    return Select.fromRole(this.page, CreateDatasetPage.PLACEHOLDERS.DATABASE);
  }

  /**
   * Gets the catalog selector
   */
  getCatalogSelect(): Select {
    return Select.fromRole(this.page, CreateDatasetPage.PLACEHOLDERS.CATALOG);
  }

  /**
   * Gets the schema selector
   */
  getSchemaSelect(): Select {
    return Select.fromRole(this.page, CreateDatasetPage.PLACEHOLDERS.SCHEMA);
  }

  /**
   * Gets the table selector
   */
  getTableSelect(): Select {
    return Select.fromRole(this.page, CreateDatasetPage.PLACEHOLDERS.TABLE);
  }

  /**
   * Gets the create and explore button
   */
  getCreateAndExploreButton(): Button {
    return new Button(
      this.page,
      this.page.getByRole('button', { name: /Create and explore dataset/i }),
    );
  }

  /**
   * Navigate to the create dataset page
   */
  async goto(): Promise<void> {
    await this.page.goto('dataset/add/');
  }

  /**
   * Select a database from the dropdown
   * @param databaseName - The name of the database to select
   */
  async selectDatabase(databaseName: string): Promise<void> {
    await this.getDatabaseSelect().selectOption(databaseName);
  }

  /**
   * Select a schema from the dropdown
   * @param schemaName - The name of the schema to select
   */
  async selectSchema(schemaName: string): Promise<void> {
    await this.getSchemaSelect().selectOption(schemaName);
  }

  /**
   * Select a table from the dropdown
   * @param tableName - The name of the table to select
   */
  async selectTable(tableName: string): Promise<void> {
    await this.getTableSelect().selectOption(tableName);
  }

  /**
   * Click the "Create dataset" button (without exploring)
   * Uses the dropdown menu to select "Create dataset" option
   */
  async clickCreateDataset(): Promise<void> {
    // Click the dropdown arrow to open the menu
    const dropdownButton = new Button(
      this.page,
      this.page.locator(
        '.ant-dropdown-trigger, .ant-btn-group .ant-btn:last-child',
      ),
    );
    await dropdownButton.click();

    // Click "Create dataset" option from the dropdown menu
    await this.page.getByText('Create dataset', { exact: true }).click();
  }

  /**
   * Click the "Create and explore dataset" button
   */
  async clickCreateAndExploreDataset(): Promise<void> {
    await this.getCreateAndExploreButton().click();
  }

  /**
   * Wait for the page to load
   */
  async waitForPageLoad(): Promise<void> {
    await this.getDatabaseSelect().element.waitFor({ state: 'visible' });
  }
}
