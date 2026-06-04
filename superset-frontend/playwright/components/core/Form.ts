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
import { Input } from './Input';
import { Button } from './Button';

export class Form {
  private readonly page: Page;

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
   * Gets the form element locator
   */
  get element(): Locator {
    return this.locator;
  }

  /**
   * Gets an input field within the form (properly scoped)
   * @param inputSelector - Selector for the input field
   */
  getInput(inputSelector: string): Input {
    const scopedLocator = this.locator.locator(inputSelector);
    return new Input(this.page, scopedLocator);
  }

  /**
   * Gets a button within the form (properly scoped)
   * @param buttonSelector - Selector for the button
   */
  getButton(buttonSelector: string): Button {
    const scopedLocator = this.locator.locator(buttonSelector);
    return new Button(this.page, scopedLocator);
  }

  /**
   * Checks if the form is visible
   */
  async isVisible(): Promise<boolean> {
    return this.locator.isVisible();
  }

  /**
   * Submits the form (triggers submit event)
   */
  async submit(): Promise<void> {
    await this.locator.evaluate((form: HTMLElement) => {
      if (form instanceof HTMLFormElement) {
        form.submit();
      }
    });
  }

  /**
   * Waits for the form to be visible
   * @param options - Optional wait options
   */
  async waitForVisible(options?: { timeout?: number }): Promise<void> {
    await this.locator.waitFor({ state: 'visible', ...options });
  }

  /**
   * Gets all form data as key-value pairs
   * Useful for validation and debugging
   */
  async getFormData(): Promise<Record<string, string>> {
    return this.locator.evaluate((form: HTMLElement) => {
      if (form instanceof HTMLFormElement) {
        const formData = new FormData(form);
        const result: Record<string, string> = {};
        formData.forEach((value, key) => {
          result[key] = value.toString();
        });
        return result;
      }
      return {};
    });
  }
}
