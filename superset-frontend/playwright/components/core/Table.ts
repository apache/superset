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

import { Locator, Page } from '@playwright/test';

/**
 * Table component for Superset ListView tables.
 */
export class Table {
  private readonly page: Page;
  private readonly tableSelector: string;

  private static readonly SELECTORS = {
    TABLE_ROW: '[data-test="table-row"]',
  };

  constructor(page: Page, tableSelector = '[data-test="listview-table"]') {
    this.page = page;
    this.tableSelector = tableSelector;
  }

  /**
   * Gets the table element locator
   */
  get element(): Locator {
    return this.page.locator(this.tableSelector);
  }

  /**
   * Gets a table row by text content
   * @param rowText - Text to find in the row
   */
  getRow(rowText: string): Locator {
    return this.element
      .locator(Table.SELECTORS.TABLE_ROW)
      .filter({ hasText: rowText });
  }

  /**
   * Clicks a link within a specific row
   * @param rowText - Text to identify the row
   * @param linkSelector - Selector for the link within the row
   */
  async clickRowLink(rowText: string, linkSelector: string): Promise<void> {
    const row = this.getRow(rowText);
    await row.locator(linkSelector).click();
  }

  /**
   * Waits for the table to be visible
   * @param options - Optional wait options
   */
  async waitForVisible(options?: { timeout?: number }): Promise<void> {
    await this.element.waitFor({ state: 'visible', ...options });
  }

  /**
   * Clicks an action button in a row by selector
   * @param rowText - Text to identify the row
   * @param selector - CSS selector for the action element
   */
  async clickRowAction(rowText: string, selector: string): Promise<void> {
    const row = this.getRow(rowText);
    await row.locator(selector).first().click();
  }
}
