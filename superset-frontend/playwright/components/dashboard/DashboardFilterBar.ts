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
import { Button, Select } from '../core';
import { NativeFiltersConfigModal } from '../modals';

/**
 * Dashboard native-filter bar component.
 */
export class DashboardFilterBar {
  private static readonly SELECTORS = {
    ROOT: '[data-test="filter-bar"]',
    FILTER_VALUE: '[data-test="form-item-value"]',
    APPLY_BUTTON: '[data-test="filter-bar__apply-button"]',
    CLEAR_BUTTON: '[data-test="filter-bar__clear-button"]',
    SETTINGS_BUTTON: '[data-test="filterbar-orientation-icon"]',
  } as const;

  constructor(private readonly page: Page) {}

  /**
   * Waits for the filter bar controls to become interactive.
   */
  async waitForReady(options?: { timeout?: number }): Promise<void> {
    await this.getApplyButton().element.waitFor({
      state: 'visible',
      ...options,
    });
  }

  /**
   * Selects an option in a native filter.
   * @param optionText - The option text to select.
   * @param index - The zero-based position of the filter.
   */
  async selectOption(optionText: string, index = 0): Promise<void> {
    const select = new Select(
      this.page,
      this.root
        .locator(DashboardFilterBar.SELECTORS.FILTER_VALUE)
        .nth(index)
        .getByRole('combobox'),
    );
    await select.open();
    await select.clickOption(optionText);
    await select.close();
  }

  /**
   * Applies pending native-filter changes.
   */
  async apply(): Promise<void> {
    await this.getApplyButton().click();
  }

  /**
   * Applies pending native-filter changes when the Apply button is enabled.
   */
  async applyIfEnabled(): Promise<void> {
    const applyButton = this.getApplyButton();
    await applyButton.element.waitFor({ state: 'visible' });
    if (await applyButton.isDisabled()) {
      return;
    }

    await applyButton.click();
  }

  /**
   * Clears all native-filter values without applying the pending changes.
   */
  async clearAll(): Promise<void> {
    await new Button(
      this.page,
      this.root.locator(DashboardFilterBar.SELECTORS.CLEAR_BUTTON),
    ).click();
  }

  /**
   * Opens the native filters and Display Controls configuration modal.
   */
  async openNativeFiltersConfigModal(): Promise<NativeFiltersConfigModal> {
    await this.root
      .locator(DashboardFilterBar.SELECTORS.SETTINGS_BUTTON)
      .click();
    await this.page
      .getByText('Add or edit filters and controls', { exact: true })
      .click();

    const modal = new NativeFiltersConfigModal(this.page);
    await modal.waitForVisible();
    return modal;
  }

  private getApplyButton(): Button {
    return new Button(
      this.page,
      this.root.locator(DashboardFilterBar.SELECTORS.APPLY_BUTTON),
    );
  }

  private get root(): Locator {
    return this.page.locator(DashboardFilterBar.SELECTORS.ROOT);
  }
}
