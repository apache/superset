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
 * Base Modal component for Ant Design modals.
 * Provides minimal primitives - extend this for specific modal types.
 * Add methods to this class only when multiple modal types need them (YAGNI).
 *
 * @example
 * class DeleteConfirmationModal extends Modal {
 *   async clickDelete(): Promise<void> {
 *     await this.footer.locator('button', { hasText: 'Delete' }).click();
 *   }
 * }
 */
export class Modal {
  protected readonly page: Page;
  protected readonly modalSelector: string;

  // Ant Design modal structure selectors (shared by all modal types)
  protected static readonly BASE_SELECTORS = {
    FOOTER: '.ant-modal-footer',
    BODY: '.ant-modal-body',
  };

  constructor(page: Page, modalSelector = '[role="dialog"]') {
    this.page = page;
    this.modalSelector = modalSelector;
  }

  /**
   * Gets the modal element locator
   */
  get element(): Locator {
    return this.page.locator(this.modalSelector);
  }

  /**
   * Gets the modal footer locator (contains action buttons)
   */
  get footer(): Locator {
    return this.element.locator(Modal.BASE_SELECTORS.FOOTER);
  }

  /**
   * Gets the modal body locator (contains content)
   */
  get body(): Locator {
    return this.element.locator(Modal.BASE_SELECTORS.BODY);
  }

  /**
   * Gets a footer button by text content (private helper)
   * @param buttonText - The text content of the button
   */
  private getFooterButton(buttonText: string): Locator {
    return this.footer.getByRole('button', { name: buttonText, exact: true });
  }

  /**
   * Clicks a footer button by text content
   * @param buttonText - The text content of the button to click
   * @param options - Optional click options
   */
  protected async clickFooterButton(
    buttonText: string,
    options?: { timeout?: number; force?: boolean; delay?: number },
  ): Promise<void> {
    await this.getFooterButton(buttonText).click(options);
  }

  /**
   * Waits for the modal to become visible
   * @param options - Optional wait options
   */
  async waitForVisible(options?: { timeout?: number }): Promise<void> {
    await this.element.waitFor({ state: 'visible', ...options });
  }

  /**
   * Waits for the modal to be fully ready for interaction.
   * This includes waiting for the modal dialog to be visible AND for React to finish
   * rendering the modal content. Use this before interacting with modal elements
   * to avoid race conditions with React state updates.
   *
   * @param options - Optional wait options
   */
  async waitForReady(options?: { timeout?: number }): Promise<void> {
    await this.waitForVisible(options);
    await this.body.waitFor({ state: 'visible', ...options });
  }

  /**
   * Waits for the modal to be hidden
   * @param options - Optional wait options
   */
  async waitForHidden(options?: { timeout?: number }): Promise<void> {
    await this.element.waitFor({ state: 'hidden', ...options });
  }
}
