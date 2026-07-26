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

const AG_GRID_SELECTORS = {
  ROOT: '[role="grid"]',
  HEADER_ROW: '.ag-header-row',
  HEADER_CELL: '.ag-header-cell',
  BODY_ROW: '.ag-row',
  CELL: '.ag-cell',
} as const;

/**
 * AG Grid component wrapper for Playwright.
 * Used by FilterableTable/GridTable in SQL Lab results and elsewhere.
 */
export class AgGrid {
  readonly page: Page;
  private readonly locator: Locator;

  constructor(page: Page, locator: Locator) {
    this.page = page;
    this.locator = locator;
  }

  get element(): Locator {
    return this.locator;
  }

  /**
   * Wait for the grid to render with data rows
   */
  async waitForRows(options?: { timeout?: number }): Promise<void> {
    await this.locator
      .locator(AG_GRID_SELECTORS.BODY_ROW)
      .first()
      .waitFor({ state: 'visible', ...options });
  }

  /**
   * Get header cell texts
   */
  async getHeaderTexts(): Promise<string[]> {
    return this.locator
      .locator(AG_GRID_SELECTORS.HEADER_CELL)
      .allTextContents();
  }

  /**
   * Get the number of visible data rows
   */
  async getRowCount(): Promise<number> {
    return this.locator.locator(AG_GRID_SELECTORS.BODY_ROW).count();
  }

  /**
   * Get cell text at a specific row and column index (0-based)
   */
  async getCellText(row: number, col: number): Promise<string> {
    const text = await this.locator
      .locator(AG_GRID_SELECTORS.BODY_ROW)
      .nth(row)
      .locator(AG_GRID_SELECTORS.CELL)
      .nth(col)
      .textContent();
    return text?.trim() ?? '';
  }
}
