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
   * @param optionText - The text of the option to select
   */
  async selectOption(optionText: string): Promise<void> {
    await this.open();
    await this.type(optionText);
    await this.clickOption(optionText);
  }

  /**
   * Opens the dropdown
   */
  async open(): Promise<void> {
    await this.locator.click();
  }

  /**
   * Clicks an option in an already-open dropdown by its exact title/label
   * @param optionText - The exact text of the option to click
   */
  async clickOption(optionText: string): Promise<void> {
    await this.page.getByTitle(optionText, { exact: true }).click();
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
    await this.locator.fill(text);
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
