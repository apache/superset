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

import { Locator, Page, expect } from '@playwright/test';
import { Button, Checkbox, Table } from '../core';

const BULK_SELECT_SELECTORS = {
  CONTROLS: '[data-test="bulk-select-controls"]',
  ACTION: '[data-test="bulk-select-action"]',
  HEADER_TOGGLE: '[data-test="header-toggle-all"]',
} as const;

/**
 * BulkSelect component for Superset ListView bulk operations.
 * Provides a reusable interface for bulk selection and actions across list pages.
 *
 * @example
 * const bulkSelect = new BulkSelect(page, table);
 * await bulkSelect.enable();
 * await bulkSelect.selectRow('my-dataset');
 * await bulkSelect.selectRow('another-dataset');
 * await bulkSelect.clickAction('Delete');
 */
export class BulkSelect {
  private readonly page: Page;
  private readonly table: Table;

  constructor(page: Page, table: Table) {
    this.page = page;
    this.table = table;
  }

  /**
   * Gets the "Bulk select" toggle button
   */
  getToggleButton(): Button {
    return new Button(
      this.page,
      this.page.getByRole('button', { name: 'Bulk select' }),
    );
  }

  /**
   * Enables bulk selection mode by clicking the toggle button.
   *
   * Waits for the bulk-select column header checkbox to render so the next
   * row interaction does not race the table re-render that adds the
   * checkbox column.
   */
  async enable(): Promise<void> {
    await this.getToggleButton().click();
    await this.page
      .locator(BULK_SELECT_SELECTORS.HEADER_TOGGLE)
      .waitFor({ state: 'visible' });
  }

  /**
   * Gets the checkbox for a row by name
   * @param rowName - The name/text identifying the row
   */
  getRowCheckbox(rowName: string): Checkbox {
    const row = this.table.getRow(rowName);
    return new Checkbox(this.page, row.getByRole('checkbox'));
  }

  /**
   * Selects a row's checkbox in bulk select mode.
   * Asserts the checkbox is checked afterwards so any state-update race
   * surfaces here rather than as a missing bulk-action button later.
   * @param rowName - The name/text identifying the row to select
   */
  async selectRow(rowName: string): Promise<void> {
    const checkbox = this.getRowCheckbox(rowName);
    await checkbox.element.waitFor({ state: 'visible' });
    await checkbox.check();
    await expect(checkbox.element).toBeChecked();
  }

  /**
   * Deselects a row's checkbox in bulk select mode.
   * Mirrors selectRow: waits for visibility and asserts the unchecked state
   * so any lingering selection surfaces here rather than as a stale bulk-action
   * count later.
   * @param rowName - The name/text identifying the row to deselect
   */
  async deselectRow(rowName: string): Promise<void> {
    const checkbox = this.getRowCheckbox(rowName);
    await checkbox.element.waitFor({ state: 'visible' });
    await checkbox.uncheck();
    await expect(checkbox.element).not.toBeChecked();
  }

  /**
   * Gets the bulk select controls container locator (for assertions)
   */
  getControls(): Locator {
    return this.page.locator(BULK_SELECT_SELECTORS.CONTROLS);
  }

  /**
   * Gets a bulk action button by name
   * @param actionName - The name of the bulk action (e.g., "Export", "Delete")
   */
  getActionButton(actionName: string): Button {
    const controls = this.getControls();
    return new Button(
      this.page,
      controls.locator(BULK_SELECT_SELECTORS.ACTION, { hasText: actionName }),
    );
  }

  /**
   * Clicks a bulk action button by name (e.g., "Export", "Delete").
   *
   * The action buttons only render once a row is selected; waiting for
   * visibility makes that timing contract explicit before the click.
   * @param actionName - The name of the bulk action to click
   */
  async clickAction(actionName: string): Promise<void> {
    const button = this.getActionButton(actionName);
    await button.element.waitFor({ state: 'visible' });
    await button.click();
  }
}
