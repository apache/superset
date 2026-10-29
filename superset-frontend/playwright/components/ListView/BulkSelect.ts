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
  ROW_CHECKBOX: '[data-test="row-select-checkbox"]',
} as const;

/**
 * Stable keys for ListView bulk actions, matching `action.key` in the
 * `bulkActions` prop passed to `ListView` (see `src/pages/*List`). Using
 * the key — not the localized button text — keeps selectors valid across
 * locales.
 */
export type BulkSelectActionKey = 'delete' | 'export';

/**
 * BulkSelect component for Superset ListView bulk operations.
 * Provides a reusable interface for bulk selection and actions across list pages.
 *
 * @example
 * const bulkSelect = new BulkSelect(page, table);
 * await bulkSelect.enable();
 * await bulkSelect.selectRow('my-dataset');
 * await bulkSelect.selectRow('another-dataset');
 * await bulkSelect.clickAction('delete');
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
   * Waits for the bulk-select column header to render so the next row
   * interaction does not race the table re-render that adds the checkbox
   * column. The `data-test="header-toggle-all"` attribute is on the
   * select-all `<th>` itself (see `TableCollection`'s `components.header.cell`
   * slot, which keys on antd's `ant-table-selection-column` className).
   * It deliberately is NOT injected via `rowSelection.columnTitle` because
   * rc-table's measure row in `<tbody>` clones `columnTitle` and any
   * `data-test` would duplicate, breaking Playwright strict mode.
   */
  async enable(): Promise<void> {
    await this.getToggleButton().click();
    await this.page.locator(BULK_SELECT_SELECTORS.HEADER_TOGGLE).waitFor();
  }

  /**
   * Gets the bulk-select checkbox for a row by name.
   *
   * The `data-test="row-select-checkbox"` attribute is on the `<span>`
   * wrapper that `TableCollection`'s `rowSelection.renderCell` puts around
   * antd's checkbox originNode (the attribute can't be moved directly
   * onto antd's `<input>` from `renderCell` because the originNode is
   * opaque). We drill into `input[type="checkbox"]` so Playwright's
   * `.check()` operates on the real input — `.check()` on the wrapper
   * `<span>` throws "Not a checkbox or radio button".
   *
   * @param rowName - The name/text identifying the row
   */
  getRowCheckbox(rowName: string): Checkbox {
    const row = this.table.getRow(rowName);
    return new Checkbox(
      this.page,
      row.locator(
        `${BULK_SELECT_SELECTORS.ROW_CHECKBOX} input[type="checkbox"]`,
      ),
    );
  }

  /**
   * Selects a row's checkbox in bulk select mode.
   * Asserts the checkbox is checked afterwards so any state-update race
   * surfaces here rather than as a missing bulk-action button later.
   * @param rowName - The name/text identifying the row to select
   */
  async selectRow(rowName: string): Promise<void> {
    const checkbox = this.getRowCheckbox(rowName);
    await checkbox.check();
    await expect(checkbox.element).toBeChecked();
  }

  /**
   * Deselects a row's checkbox in bulk select mode.
   * Mirrors selectRow: asserts the unchecked state so any lingering selection
   * surfaces here rather than as a stale bulk-action count later.
   * @param rowName - The name/text identifying the row to deselect
   */
  async deselectRow(rowName: string): Promise<void> {
    const checkbox = this.getRowCheckbox(rowName);
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
   * Gets a bulk action button by its stable action key.
   *
   * Scoping by `data-test-action-key` (rendered from `action.key`) instead
   * of visible text keeps this selector valid across locales — the
   * button's label is localized via i18n, but the action key is not.
   *
   * @param actionKey - The stable key of the bulk action (e.g., "delete", "export")
   */
  getActionButton(actionKey: BulkSelectActionKey): Button {
    const controls = this.getControls();
    return new Button(
      this.page,
      controls.locator(
        `${BULK_SELECT_SELECTORS.ACTION}[data-test-action-key="${actionKey}"]`,
      ),
    );
  }

  /**
   * Clicks a bulk action button by its stable action key.
   * @param actionKey - The stable key of the bulk action to click
   */
  async clickAction(actionKey: BulkSelectActionKey): Promise<void> {
    const button = this.getActionButton(actionKey);
    await button.click();
  }
}
