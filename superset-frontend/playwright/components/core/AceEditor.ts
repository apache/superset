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

const ACE_EDITOR_SELECTORS = {
  TEXT_INPUT: '.ace_text-input',
  TEXT_LAYER: '.ace_text-layer',
  CONTENT: '.ace_content',
  SCROLLER: '.ace_scroller',
} as const;

/**
 * AceEditor component for interacting with Ace Editor instances in Playwright.
 * Uses the ace editor API directly for reliable text manipulation.
 */
export class AceEditor {
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
   * Gets the editor element locator
   */
  get element(): Locator {
    return this.locator;
  }

  /**
   * Waits for the ace editor to be fully loaded and ready for interaction.
   */
  async waitForReady(): Promise<void> {
    // Wait for editor to be attached (outer .ace_editor div may be CSS-hidden)
    await this.locator.waitFor({ state: 'attached' });
    await this.locator
      .locator(ACE_EDITOR_SELECTORS.CONTENT)
      .waitFor({ state: 'attached' });
    // Wait for window.ace library to be fully loaded (may load async)
    await this.page.waitForFunction(
      () =>
        typeof (window as unknown as { ace?: { edit?: unknown } }).ace?.edit ===
        'function',
      { timeout: 10000 },
    );
  }

  /**
   * Sets text in the ace editor using the ace API.
   * Uses element handle to target the specific editor instance (not global ID lookup).
   * @param text - The text to set
   */
  async setText(text: string): Promise<void> {
    await this.waitForReady();
    const elementHandle = await this.locator.elementHandle();
    if (!elementHandle) {
      throw new Error('Could not get element handle for ace editor');
    }
    await this.page.evaluate(
      ({ element, value }) => {
        const windowWithAce = window as unknown as {
          ace?: {
            edit(el: Element): {
              setValue(v: string, c: number): void;
              session: { getUndoManager(): { reset(): void } };
            };
          };
        };
        if (!windowWithAce.ace) {
          throw new Error(
            'Ace editor library not loaded. Ensure the page has finished loading.',
          );
        }
        // ace.edit() accepts either an element ID string or the DOM element itself
        const editor = windowWithAce.ace.edit(element);
        editor.setValue(value, 1);
        editor.session.getUndoManager().reset();
      },
      { element: elementHandle, value: text },
    );
  }

  /**
   * Gets the text content from the ace editor.
   * Uses element handle to target the specific editor instance.
   * @returns The text content
   */
  async getText(): Promise<string> {
    await this.waitForReady();
    const elementHandle = await this.locator.elementHandle();
    if (!elementHandle) {
      throw new Error('Could not get element handle for ace editor');
    }
    return this.page.evaluate(element => {
      const windowWithAce = window as unknown as {
        ace?: { edit(el: Element): { getValue(): string } };
      };
      if (!windowWithAce.ace) {
        throw new Error(
          'Ace editor library not loaded. Ensure the page has finished loading.',
        );
      }
      return windowWithAce.ace.edit(element).getValue();
    }, elementHandle);
  }

  /**
   * Clears the text in the ace editor.
   */
  async clear(): Promise<void> {
    await this.setText('');
  }

  /**
   * Appends text to the existing content in the ace editor.
   * Uses element handle to target the specific editor instance.
   * @param text - The text to append
   */
  async appendText(text: string): Promise<void> {
    await this.waitForReady();
    const elementHandle = await this.locator.elementHandle();
    if (!elementHandle) {
      throw new Error('Could not get element handle for ace editor');
    }
    await this.page.evaluate(
      ({ element, value }) => {
        const windowWithAce = window as unknown as {
          ace?: {
            edit(el: Element): {
              getValue(): string;
              setValue(v: string, c: number): void;
            };
          };
        };
        if (!windowWithAce.ace) {
          throw new Error(
            'Ace editor library not loaded. Ensure the page has finished loading.',
          );
        }
        const editor = windowWithAce.ace.edit(element);
        const currentText = editor.getValue();
        // Only add newline if there's existing text that doesn't already end with one
        const needsNewline = currentText && !currentText.endsWith('\n');
        const newText = currentText + (needsNewline ? '\n' : '') + value;
        editor.setValue(newText, 1);
      },
      { element: elementHandle, value: text },
    );
  }

  /**
   * Focuses the ace editor.
   * Uses element handle to target the specific editor instance.
   */
  async focus(): Promise<void> {
    await this.waitForReady();
    const elementHandle = await this.locator.elementHandle();
    if (!elementHandle) {
      throw new Error('Could not get element handle for ace editor');
    }
    await this.page.evaluate(element => {
      const windowWithAce = window as unknown as {
        ace?: { edit(el: Element): { focus(): void } };
      };
      if (!windowWithAce.ace) {
        throw new Error(
          'Ace editor library not loaded. Ensure the page has finished loading.',
        );
      }
      windowWithAce.ace.edit(element).focus();
    }, elementHandle);
  }

  /**
   * Checks if the editor is visible.
   */
  async isVisible(): Promise<boolean> {
    return this.locator.isVisible();
  }
}
