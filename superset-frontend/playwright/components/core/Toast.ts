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

export type ToastType = 'success' | 'danger' | 'warning' | 'info';

const SELECTORS = {
  CONTAINER: '[data-test="toast-container"][role="alert"]',
  CONTENT: '.toast__content',
  CLOSE_BUTTON: '[data-test="close-button"]',
} as const;

/**
 * Toast notification component
 * Handles success, danger, warning, and info toasts
 */
export class Toast {
  private page: Page;
  private container: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator(SELECTORS.CONTAINER);
  }

  /**
   * Get the toast container locator
   */
  get(): Locator {
    return this.container;
  }

  /**
   * Get the toast message text
   */
  getMessage(): Locator {
    return this.container.locator(SELECTORS.CONTENT);
  }

  /**
   * Wait for a toast to appear
   */
  async waitForVisible(): Promise<void> {
    await this.container.waitFor({ state: 'visible' });
  }

  /**
   * Wait for toast to disappear
   */
  async waitForHidden(): Promise<void> {
    await this.container.waitFor({ state: 'hidden' });
  }

  /**
   * Get a success toast
   */
  getSuccess(): Locator {
    return this.page.locator(`${SELECTORS.CONTAINER}.toast--success`);
  }

  /**
   * Get a danger/error toast
   */
  getDanger(): Locator {
    return this.page.locator(`${SELECTORS.CONTAINER}.toast--danger`);
  }

  /**
   * Get a warning toast
   */
  getWarning(): Locator {
    return this.page.locator(`${SELECTORS.CONTAINER}.toast--warning`);
  }

  /**
   * Get an info toast
   */
  getInfo(): Locator {
    return this.page.locator(`${SELECTORS.CONTAINER}.toast--info`);
  }

  /**
   * Close the toast by clicking the close button
   */
  async close(): Promise<void> {
    await this.container.locator(SELECTORS.CLOSE_BUTTON).click();
  }
}
