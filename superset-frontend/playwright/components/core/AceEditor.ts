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
  private readonly selector: string;
  private readonly locator: Locator;

  constructor(page: Page, selector: string) {
    this.page = page;
    this.selector = selector;
    this.locator = page.locator(selector);
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
    await this.locator.waitFor({ state: 'visible' });
    await this.locator.locator(ACE_EDITOR_SELECTORS.CONTENT).waitFor();
    await this.locator.locator(ACE_EDITOR_SELECTORS.TEXT_LAYER).waitFor();
  }

  /**
   * Sets text in the ace editor using the ace API.
   * @param text - The text to set
   */
  async setText(text: string): Promise<void> {
    await this.waitForReady();
    const editorId = this.extractEditorId();
    await this.page.evaluate(
      ({ id, value }) => {
        const editor = (window as any).ace.edit(id);
        editor.setValue(value, 1);
        editor.session.getUndoManager().reset();
      },
      { id: editorId, value: text },
    );
  }

  /**
   * Gets the text content from the ace editor.
   * @returns The text content
   */
  async getText(): Promise<string> {
    await this.waitForReady();
    const editorId = this.extractEditorId();
    return this.page.evaluate(id => {
      const editor = (window as any).ace.edit(id);
      return editor.getValue();
    }, editorId);
  }

  /**
   * Clears the text in the ace editor.
   */
  async clear(): Promise<void> {
    await this.setText('');
  }

  /**
   * Appends text to the existing content in the ace editor.
   * @param text - The text to append
   */
  async appendText(text: string): Promise<void> {
    await this.waitForReady();
    const editorId = this.extractEditorId();
    await this.page.evaluate(
      ({ id, value }) => {
        const editor = (window as any).ace.edit(id);
        const currentText = editor.getValue();
        const newText = currentText + (currentText ? '\n' : '') + value;
        editor.setValue(newText, 1);
      },
      { id: editorId, value: text },
    );
  }

  /**
   * Focuses the ace editor.
   */
  async focus(): Promise<void> {
    await this.waitForReady();
    const editorId = this.extractEditorId();
    await this.page.evaluate(id => {
      const editor = (window as any).ace.edit(id);
      editor.focus();
    }, editorId);
  }

  /**
   * Checks if the editor is visible.
   */
  async isVisible(): Promise<boolean> {
    return this.locator.isVisible();
  }

  /**
   * Extracts the editor ID from the selector.
   * Handles selectors like '#ace-editor' or '[id="ace-editor"]'
   */
  private extractEditorId(): string {
    // Handle #id format
    if (this.selector.startsWith('#')) {
      return this.selector.slice(1);
    }
    // Handle [id="..."] format
    const idMatch = this.selector.match(/id="([^"]+)"/);
    if (idMatch) {
      return idMatch[1];
    }
    // Handle [data-test="..."] format - use the element's actual id
    // This requires getting it from the DOM
    return this.selector.replace(/[#[\]]/g, '');
  }
}
