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
import { Input, Modal, Tabs } from '../core';

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
    this.tabs = new Tabs(page);
    // Use getByRole with specific name to target Edit Dataset dialog
    // The dialog has aria-labelledby that resolves to "edit Edit Dataset"
    this.specificLocator = page.getByRole('dialog', { name: /edit.*dataset/i });
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
}
