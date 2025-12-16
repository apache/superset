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
 * Duplicate dataset modal that requires entering a new dataset name.
 * Used for duplicating virtual datasets with custom SQL.
 */
export class DuplicateDatasetModal extends Modal {
  private static readonly SELECTORS = {
    NAME_INPUT: '[data-test="duplicate-modal-input"]',
  };

  /**
   * Gets the new dataset name input component
   */
  private get nameInput(): Input {
    return new Input(
      this.page,
      this.body.locator(DuplicateDatasetModal.SELECTORS.NAME_INPUT),
    );
  }

  /**
   * Fills the new dataset name input
   *
   * @param datasetName - The new name for the duplicated dataset
   * @param options - Optional fill options (timeout, force)
   *
   * @example
   * const duplicateModal = new DuplicateDatasetModal(page);
   * await duplicateModal.waitForVisible();
   * await duplicateModal.fillDatasetName('my_dataset_copy');
   * await duplicateModal.clickDuplicate();
   * await duplicateModal.waitForHidden();
   */
  async fillDatasetName(
    datasetName: string,
    options?: { timeout?: number; force?: boolean },
  ): Promise<void> {
    await this.nameInput.fill(datasetName, options);
  }

  /**
   * Clicks the Duplicate button in the footer
   *
   * @param options - Optional click options (timeout, force, delay)
   */
  async clickDuplicate(options?: {
    timeout?: number;
    force?: boolean;
    delay?: number;
  }): Promise<void> {
    await this.clickFooterButton('Duplicate', options);
  }
}
