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
import { Modal } from '../core';

/**
 * Native filters and Display Controls configuration modal.
 */
export class NativeFiltersConfigModal extends Modal {
  private static readonly TEST_IDS = {
    SAVE_BUTTON: 'native-filter-modal-save-button',
  } as const;

  private static readonly LABELS = {
    DIALOG: 'Add or edit display controls',
  } as const;

  private readonly specificLocator: Locator;

  constructor(page: Page) {
    super(page);
    this.specificLocator = page.getByRole('dialog', {
      name: NativeFiltersConfigModal.LABELS.DIALOG,
      exact: true,
    });
  }

  override get element(): Locator {
    return this.specificLocator;
  }

  /**
   * Gets a Display Control row by name.
   * @param name - The Display Control name
   */
  private getDisplayControlRow(name: string): Locator {
    return this.element.getByRole('tab').filter({
      has: this.page.getByText(name, { exact: true }),
    });
  }

  /**
   * Marks a Display Control for removal.
   * @param name - The Display Control name
   */
  async removeDisplayControl(name: string): Promise<void> {
    const controlRow = this.getDisplayControlRow(name);
    await controlRow.hover();
    await controlRow
      .getByRole('button', { name: 'Remove customization' })
      .click();
  }

  /**
   * Gets the marker shown when a Display Control has been removed.
   */
  getRemovedMarker(): Locator {
    return this.element.getByText('(Removed)', { exact: true }).first();
  }

  /**
   * Saves the native filters and Display Controls configuration.
   */
  async clickSave(): Promise<void> {
    await this.element
      .getByTestId(NativeFiltersConfigModal.TEST_IDS.SAVE_BUTTON)
      .click();
  }
}
