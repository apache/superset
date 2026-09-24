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
 * Core Radio component used in Playwright tests to interact with a set of
 * radio options in the Superset UI.
 *
 * This class wraps a Playwright {@link Locator} pointing to the container that
 * holds the radio options (a `Radio.Group` or a form item with several
 * `Radio`s) and selects options by their accessible label.
 *
 * @example
 * const radio = new Radio(page, page.locator('[data-test="radio-group"]'));
 * await radio.select('Save as...');
 * expect(await radio.isSelected('Save as...')).toBe(true);
 *
 * @param page - The Playwright {@link Page} instance associated with the test.
 * @param locator - The Playwright {@link Locator} targeting the radio container.
 */
export class Radio {
  readonly page: Page;
  private readonly locator: Locator;

  constructor(page: Page, locator: Locator) {
    this.page = page;
    this.locator = locator;
  }

  /**
   * Gets the radio container locator
   */
  get element(): Locator {
    return this.locator;
  }

  /**
   * Gets the locator for a single radio option by its label
   * @param label - The option's visible label
   */
  getOption(label: string): Locator {
    return this.locator.getByRole('radio', { name: label, exact: true });
  }

  /**
   * Selects the option with the given label (ensures it's checked)
   * @param label - The option's visible label
   */
  async select(label: string): Promise<void> {
    await this.getOption(label).check();
  }

  /**
   * Checks if the option with the given label is selected
   * @param label - The option's visible label
   */
  async isSelected(label: string): Promise<boolean> {
    return this.getOption(label).isChecked();
  }

  /**
   * Checks if the option with the given label is enabled
   * @param label - The option's visible label
   */
  async isEnabled(label: string): Promise<boolean> {
    return this.getOption(label).isEnabled();
  }
}
