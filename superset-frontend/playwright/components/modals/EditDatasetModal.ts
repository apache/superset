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
import { AceEditor, Modal, Tabs } from '../core';

/**
 * Edit Dataset Modal component (DatasourceModal).
 * Used for editing dataset properties like description, metrics, columns, etc.
 * Uses specific dialog name to avoid strict mode violations when multiple dialogs are open.
 */
export class EditDatasetModal extends Modal {
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
   * Get the description editor (AceEditor component)
   */
  getDescriptionEditor(): AceEditor {
    return new AceEditor(this.page, '#ace-editor');
  }

  /**
   * Fill in the description field using the Ace Editor
   * @param description - The description text to enter
   */
  async fillDescription(description: string): Promise<void> {
    await this.getDescriptionEditor().setText(description);
  }

  /**
   * Get the current description text from the Ace Editor
   * @returns The description text
   */
  async getDescription(): Promise<string> {
    return this.getDescriptionEditor().getText();
  }

  /**
   * Navigate to a specific tab in the modal
   * @param tabName - The name of the tab (e.g., 'Source', 'Metrics', 'Columns')
   */
  async clickTab(tabName: string): Promise<void> {
    await this.tabs.clickTab(tabName);
  }
}
