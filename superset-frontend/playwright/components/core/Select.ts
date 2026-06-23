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
 * Ant Design Select component selectors
 */
const SELECT_SELECTORS = {
  DROPDOWN: '.ant-select-dropdown',
  OPTION: '.ant-select-item-option',
  SEARCH_INPUT: '.ant-select-selection-search-input',
  CLEAR: '.ant-select-clear',
} as const;

/**
 * Select component for Ant Design Select/Combobox interactions.
 */
export class Select {
  readonly page: Page;
  private readonly locator: Locator;

  constructor(page: Page, selector: string);
  constructor(page: Page, locator: Locator);
  constructor(page: Page, selectorOrLocator: string | Locator) {
    this.page = page;
    if (typeof selectorOrLocator === 'string') {
      this.locator = page.locator(selectorOrLocator);
    } else {
      this.locator = selectorOrLocator;
    }
  }

  /**
   * Creates a Select from a combobox role with the given accessible name
   * @param page - The Playwright page
   * @param name - The accessible name (aria-label or placeholder text)
   */
  static fromRole(page: Page, name: string): Select {
    const locator = page.getByRole('combobox', { name });
    return new Select(page, locator);
  }

  /**
   * Gets the select element locator
   */
  get element(): Locator {
    return this.locator;
  }

  /**
   * Opens the dropdown, types to filter, and selects an option.
   * Handles cases where the option may not be initially visible in the dropdown.
   * Waits for dropdown to close after selection to avoid stale dropdowns.
   * @param optionText - The text of the option to select
   */
  async selectOption(optionText: string): Promise<void> {
    await this.open();
    await this.type(optionText);
    await this.clickOption(optionText);
    // Wait for dropdown to close to avoid multiple visible dropdowns
    await this.waitForDropdownClose();
  }

  /**
   * Waits for dropdown to close after selection
   * This prevents strict mode violations when multiple selects are used sequentially
   */
  private async waitForDropdownClose(): Promise<void> {
    // Wait for dropdown to actually close (become hidden)
    await this.page
      .locator(`${SELECT_SELECTORS.DROPDOWN}:not(.ant-select-dropdown-hidden)`)
      .last()
      .waitFor({ state: 'hidden', timeout: 5000 })
      .catch(error => {
        // Only ignore TimeoutError (dropdown may already be closed); re-throw others
        if (!(error instanceof Error) || error.name !== 'TimeoutError') {
          throw error;
        }
      });
  }

  /**
   * Opens the dropdown
   */
  async open(): Promise<void> {
    await this.locator.click();
  }

  /**
   * Clicks an option in an already-open dropdown by its text content.
   * Uses selector-based approach matching Cypress patterns.
   * Handles multiple dropdowns by targeting only visible, non-hidden ones.
   * @param optionText - The text of the option to click (partial match for filtered results)
   */
  async clickOption(optionText: string): Promise<void> {
    // Target visible dropdown (excludes hidden ones via :not(.ant-select-dropdown-hidden))
    // Use .last() in case multiple dropdowns exist - the most recent one is what we want
    const dropdown = this.page
      .locator(`${SELECT_SELECTORS.DROPDOWN}:not(.ant-select-dropdown-hidden)`)
      .last();
    await dropdown.waitFor({ state: 'visible' });

    // Find option by text content - use partial match since filtered results may have prefixes
    // (e.g., searching for 'main' shows 'examples.main', 'system.main')
    // First try exact match, fall back to partial match
    const exactOption = dropdown
      .locator(SELECT_SELECTORS.OPTION)
      .getByText(optionText, { exact: true });

    if ((await exactOption.count()) > 0) {
      await exactOption.click();
    } else {
      // Fall back to first option containing the text
      const partialOption = dropdown
        .locator(SELECT_SELECTORS.OPTION)
        .filter({ hasText: optionText })
        .first();
      await partialOption.click();
    }
  }

  /**
   * Closes the dropdown by pressing Escape
   */
  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }

  /**
   * Types into the select to filter options (assumes dropdown is open)
   * @param text - The text to type
   */
  async type(text: string): Promise<void> {
    // Find the actual search input inside the select component
    const searchInput = this.locator.locator(SELECT_SELECTORS.SEARCH_INPUT);
    try {
      // Wait for search input in case dropdown is still rendering
      await searchInput.first().waitFor({ state: 'attached', timeout: 1000 });
      await searchInput.first().fill(text);
    } catch (error) {
      // Only handle TimeoutError (search input not found); re-throw other errors
      if (!(error instanceof Error) || error.name !== 'TimeoutError') {
        throw error;
      }
      // Fallback: locator might be the input itself (e.g., from getByRole('combobox'))
      await this.locator.fill(text);
    }
  }

  /**
   * Clears the current selection
   */
  async clear(): Promise<void> {
    await this.locator.clear();
  }

  /**
   * Checks if the select is visible
   */
  async isVisible(): Promise<boolean> {
    return this.locator.isVisible();
  }

  /**
   * Checks if the select is enabled
   */
  async isEnabled(): Promise<boolean> {
    return this.locator.isEnabled();
  }
}
