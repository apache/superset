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
import { Button, Select } from '../core';

/**
 * Dashboard native-filter bar component.
 */
export class DashboardFilterBar {
  private static readonly SELECTORS = {
    FILTER_VALUE: '[data-test="form-item-value"]',
    APPLY_BUTTON:
      '[data-test="filter-bar__apply-button"], [data-test="filterbar-action-buttons"] button[type="submit"]',
    CLEAR_BUTTON: '[data-test="filter-bar__clear-button"]',
  } as const;

  constructor(private readonly page: Page) {}

  /**
   * Selects an option in a native filter by its zero-based position.
   */
  async selectOption(optionText: string, index = 0): Promise<void> {
    const select = new Select(
      this.page,
      this.page
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
    if (!(await applyButton.isEnabled().catch(() => false))) {
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
      DashboardFilterBar.SELECTORS.CLEAR_BUTTON,
    ).click();
  }

  private getApplyButton(): Button {
    return new Button(
      this.page,
      this.page.locator(DashboardFilterBar.SELECTORS.APPLY_BUTTON).first(),
    );
  }
}
