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

export class Button {
  private readonly locator: Locator;

  constructor(page: Page, selector: string);

  constructor(page: Page, locator: Locator);

  constructor(page: Page, selectorOrLocator: string | Locator) {
    if (typeof selectorOrLocator === 'string') {
      this.locator = page.locator(selectorOrLocator);
    } else {
      this.locator = selectorOrLocator;
    }
  }

  /**
   * Gets the button element locator
   */
  get element(): Locator {
    return this.locator;
  }

  /**
   * Clicks the button
   * @param options - Optional click options
   */
  async click(options?: {
    timeout?: number;
    force?: boolean;
    delay?: number;
    button?: 'left' | 'right' | 'middle';
  }): Promise<void> {
    await this.element.click(options);
  }

  /**
   * Gets the button text content
   */
  async getText(): Promise<string> {
    return (await this.element.textContent()) ?? '';
  }

  /**
   * Gets a specific attribute value from the button
   * @param attribute - The attribute name to retrieve
   */
  async getAttribute(attribute: string): Promise<string | null> {
    return this.element.getAttribute(attribute);
  }

  /**
   * Checks if the button is visible
   */
  async isVisible(): Promise<boolean> {
    return this.element.isVisible();
  }

  /**
   * Checks if the button is enabled
   */
  async isEnabled(): Promise<boolean> {
    return this.element.isEnabled();
  }

  /**
   * Checks if the button is disabled
   */
  async isDisabled(): Promise<boolean> {
    return this.element.isDisabled();
  }

  /**
   * Hovers over the button
   * @param options - Optional hover options
   */
  async hover(options?: { timeout?: number; force?: boolean }): Promise<void> {
    await this.element.hover(options);
  }

  /**
   * Focuses on the button
   */
  async focus(): Promise<void> {
    await this.element.focus();
  }

  /**
   * Double clicks the button
   * @param options - Optional click options
   */
  async doubleClick(options?: {
    timeout?: number;
    force?: boolean;
    delay?: number;
  }): Promise<void> {
    await this.element.dblclick(options);
  }
}
