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
import { Modal } from '../core';

/**
 * Translation editor modal for editing content translations.
 * Opened via TranslationButton in entity properties modals (dashboard, chart, filter).
 *
 * Selector targets the dialog containing "Edit Translations" title
 * to disambiguate from other modals open simultaneously.
 */
export class TranslationEditorModal extends Modal {
  constructor(page: Page) {
    super(page, '[role="dialog"]:has-text("Edit Translations")');
  }

  /**
   * Gets the translation input for a locale.
   * Matches aria-label="{localeName} translation" from TranslationField.tsx.
   */
  getTranslationInput(localeName: string): Locator {
    return this.body.getByLabel(`${localeName} translation`);
  }

  /**
   * Gets the remove button for a locale translation.
   * Matches aria-label="Remove {localeName} translation" from TranslationField.tsx.
   */
  getRemoveButton(localeName: string): Locator {
    return this.body.getByLabel(`Remove ${localeName} translation`);
  }

  /**
   * Gets the "Add language" select for a field.
   * Matches aria-label="Add language for {fieldLabel}" from TranslationEditorModal.tsx.
   */
  getAddLanguageSelect(fieldLabel: string): Locator {
    return this.body.getByLabel(`Add language for ${fieldLabel}`);
  }

  /**
   * Fills a translation input for the given locale name.
   */
  async fillTranslation(
    localeName: string,
    value: string,
    options?: { timeout?: number; force?: boolean },
  ): Promise<void> {
    await this.getTranslationInput(localeName).fill(value, options);
  }

  /**
   * Removes a locale translation by clicking its delete button.
   */
  async removeTranslation(localeName: string): Promise<void> {
    await this.getRemoveButton(localeName).click();
  }

  /**
   * Clicks "Save translations" in the footer.
   */
  async clickSave(options?: {
    timeout?: number;
    force?: boolean;
    delay?: number;
  }): Promise<void> {
    await this.clickFooterButton('Save translations', options);
  }

  /**
   * Clicks "Cancel" in the footer.
   */
  async clickCancel(options?: {
    timeout?: number;
    force?: boolean;
    delay?: number;
  }): Promise<void> {
    await this.clickFooterButton('Cancel', options);
  }
}
