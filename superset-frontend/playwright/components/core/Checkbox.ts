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
 * Core Checkbox component used in Playwright tests to interact with checkbox
 * elements in the Superset UI.
 *
 * This class wraps a Playwright {@link Locator} pointing to a checkbox input
 * and provides convenience methods for common interactions such as checking,
 * unchecking, toggling, and asserting checkbox state and visibility.
 *
 * @example
 * const checkbox = new Checkbox(page, page.locator('input[type="checkbox"]'));
 * await checkbox.check();
 * await expect(await checkbox.isChecked()).toBe(true);
 *
 * @param page - The Playwright {@link Page} instance associated with the test.
 * @param locator - The Playwright {@link Locator} targeting the checkbox element.
 */
export class Checkbox {
  readonly page: Page;
  private readonly locator: Locator;

  constructor(page: Page, locator: Locator) {
    this.page = page;
    this.locator = locator;
  }

  /**
   * Gets the checkbox element locator
   */
  get element(): Locator {
    return this.locator;
  }

  /**
   * Checks the checkbox (ensures it's checked)
   */
  async check(): Promise<void> {
    await this.locator.check();
  }

  /**
   * Unchecks the checkbox (ensures it's unchecked)
   */
  async uncheck(): Promise<void> {
    await this.locator.uncheck();
  }

  /**
   * Toggles the checkbox state
   */
  async toggle(): Promise<void> {
    await this.locator.click();
  }

  /**
   * Checks if the checkbox is checked
   */
  async isChecked(): Promise<boolean> {
    return this.locator.isChecked();
  }

  /**
   * Checks if the checkbox is visible
   */
  async isVisible(): Promise<boolean> {
    return this.locator.isVisible();
  }

  /**
   * Checks if the checkbox is enabled
   */
  async isEnabled(): Promise<boolean> {
    return this.locator.isEnabled();
  }
}
