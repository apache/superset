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
import { Input, Modal, Tabs, AceEditor } from '../core';

/**
 * Edit Dataset Modal component (DatasourceModal).
 * Used for editing dataset properties like description, metrics, columns, etc.
 * Uses specific dialog name to avoid strict mode violations when multiple dialogs are open.
 */
export class EditDatasetModal extends Modal {
  private static readonly SELECTORS = {
    NAME_INPUT: '[data-test="inline-name"]',
    LOCK_ICON: '[data-test="lock"]',
    UNLOCK_ICON: '[data-test="unlock"]',
  };

  private readonly tabs: Tabs;
  private readonly specificLocator: Locator;

  constructor(page: Page) {
    super(page);
    // Use getByRole with specific name to target Edit Dataset dialog
    // The dialog has aria-labelledby that resolves to "edit Edit Dataset"
    this.specificLocator = page.getByRole('dialog', { name: /edit.*dataset/i });
    // Scope tabs to modal's tablist to avoid matching tablists elsewhere on page
    this.tabs = new Tabs(page, this.specificLocator.getByRole('tablist'));
  }

  /**
   * Override element getter to use specific locator
   */
  override get element(): Locator {
    return this.specificLocator;
  }

  /**
   * Click the Save button to save changes
   */
  async clickSave(): Promise<void> {
    await this.clickFooterButton('Save');
  }

  /**
   * Click the Cancel button to discard changes
   */
  async clickCancel(): Promise<void> {
    await this.clickFooterButton('Cancel');
  }

  /**
   * Click the lock icon to enable edit mode
   * The modal starts in read-only mode and requires clicking the lock to edit
   */
  async enableEditMode(): Promise<void> {
    const lockButton = this.body.locator(EditDatasetModal.SELECTORS.LOCK_ICON);
    await lockButton.click();
  }

  /**
   * Gets the dataset name input component
   */
  private get nameInput(): Input {
    return new Input(
      this.page,
      this.body.locator(EditDatasetModal.SELECTORS.NAME_INPUT),
    );
  }

  /**
   * Fill in the dataset name field
   * Note: Call enableEditMode() first if the modal is in read-only mode
   * @param name - The new dataset name
   */
  async fillName(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  /**
   * Navigate to a specific tab in the modal
   * @param tabName - The name of the tab (e.g., 'Source', 'Metrics', 'Columns')
   */
  async clickTab(tabName: string): Promise<void> {
    await this.tabs.clickTab(tabName);
  }

  /**
   * Navigate to the Settings tab
   */
  async clickSettingsTab(): Promise<void> {
    await this.tabs.clickTab('Settings');
  }

  /**
   * Navigate to the Columns tab.
   * Uses regex to avoid matching "Calculated columns" tab, scoped to modal.
   */
  async clickColumnsTab(): Promise<void> {
    // Use regex starting with "Columns" to avoid matching "Calculated columns"
    // Scope to modal element to avoid matching tabs elsewhere on page
    await this.element.getByRole('tab', { name: /^Columns/ }).click();
  }

  /**
   * Gets the description Ace Editor component (Settings tab).
   * The Description button and ace-editor are in the same form item.
   */
  private get descriptionEditor(): AceEditor {
    // Use tabpanel role with name "Settings" for more reliable lookup
    const settingsPanel = this.element.getByRole('tabpanel', { name: 'Settings' });
    // Find the form item that contains the Description button
    const descriptionFormItem = settingsPanel
      .locator('.ant-form-item')
      .filter({
        has: this.page.getByRole('button', { name: 'Description', exact: true }),
      })
      .first();
    // The ace-editor has class .ace_editor within the form item
    const editorElement = descriptionFormItem.locator('.ace_editor');
    return new AceEditor(this.page, editorElement);
  }

  /**
   * Fill the dataset description field (Settings tab).
   * @param description - The description text to set
   */
  async fillDescription(description: string): Promise<void> {
    await this.descriptionEditor.setText(description);
  }

  /**
   * Expand a column row by column name.
   * Uses exact cell match to avoid false positives with short names like "ds".
   * @param columnName - The name of the column to expand
   * @returns The row locator for scoped selector access
   */
  async expandColumn(columnName: string): Promise<Locator> {
    // Find cell with exact column name text, then derive row from that cell
    const cell = this.body.getByRole('cell', { name: columnName, exact: true });
    const row = cell.locator('xpath=ancestor::tr[1]');
    await row.getByRole('button', { name: /expand row/i }).click();
    return row;
  }

  /**
   * Fill column datetime format for a given column.
   * Expands the column row and fills the date format input.
   * Note: Expanded content appears in a sibling row, so we scope to modal body.
   * @param columnName - The name of the column to edit
   * @param format - The python date format string (e.g., '%Y-%m-%d')
   */
  async fillColumnDateFormat(
    columnName: string,
    format: string,
  ): Promise<void> {
    await this.expandColumn(columnName);
    // Expanded content appears in a sibling row, not nested inside the original row.
    // Use modal body scope with placeholder selector to find the datetime format input.
    const dateFormatInput = new Input(
      this.page,
      this.body.getByPlaceholder('%Y-%m-%d'),
    );
    await dateFormatInput.element.waitFor({ state: 'visible' });
    await dateFormatInput.clear();
    await dateFormatInput.fill(format);
  }
}
