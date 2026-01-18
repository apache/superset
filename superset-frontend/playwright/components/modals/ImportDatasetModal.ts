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

import { Modal, Input } from '../core';

/**
 * Import dataset modal for uploading dataset export files.
 * Handles file upload, overwrite confirmation, and import submission.
 */
export class ImportDatasetModal extends Modal {
  private static readonly SELECTORS = {
    FILE_INPUT: '[data-test="model-file-input"]',
    OVERWRITE_INPUT: 'input[placeholder*="OVERWRITE"]',
  };

  /**
   * Upload a file to the import modal
   * @param filePath - Absolute path to the file to upload
   */
  async uploadFile(filePath: string): Promise<void> {
    await this.page
      .locator(ImportDatasetModal.SELECTORS.FILE_INPUT)
      .setInputFiles(filePath);
  }

  /**
   * Fill the overwrite confirmation input (only needed if dataset exists)
   */
  async fillOverwriteConfirmation(): Promise<void> {
    const input = new Input(
      this.page,
      this.body.locator(ImportDatasetModal.SELECTORS.OVERWRITE_INPUT),
    );
    await input.fill('OVERWRITE');
  }

  /**
   * Get the overwrite confirmation input locator
   */
  getOverwriteInput() {
    return this.body.locator(ImportDatasetModal.SELECTORS.OVERWRITE_INPUT);
  }

  /**
   * Check if overwrite confirmation is visible
   */
  async isOverwriteVisible(): Promise<boolean> {
    return this.getOverwriteInput().isVisible();
  }

  /**
   * Click the Import button in the footer
   */
  async clickImport(): Promise<void> {
    await this.clickFooterButton('Import');
  }
}
