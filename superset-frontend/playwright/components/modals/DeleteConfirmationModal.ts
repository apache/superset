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

import { expect } from '@playwright/test';
import { Modal, Input } from '../core';

/**
 * Delete confirmation modal that requires typing "DELETE" to confirm.
 * Used throughout Superset for destructive delete operations.
 *
 * Provides primitives for tests to compose deletion flows.
 */
export class DeleteConfirmationModal extends Modal {
  private static readonly SELECTORS = {
    CONFIRMATION_INPUT: '[data-test="delete-modal-input"]',
    CONFIRM_BUTTON: '[data-test="modal-confirm-button"]',
  };

  /**
   * Gets the confirmation input component
   */
  private get confirmationInput(): Input {
    return new Input(
      this.page,
      this.element.locator(
        DeleteConfirmationModal.SELECTORS.CONFIRMATION_INPUT,
      ),
    );
  }

  /**
   * Fills the confirmation input with the specified text.
   * Waits for the input to be visible before filling so callers don't race
   * with the modal's open animation / focus effect.
   *
   * @param confirmationText - The text to type
   * @param options - Optional fill options (timeout, force)
   *
   * @example
   * const deleteModal = new DeleteConfirmationModal(page);
   * await deleteModal.waitForVisible();
   * await deleteModal.fillConfirmationInput('DELETE');
   * await deleteModal.clickDelete();
   * await deleteModal.waitForHidden();
   */
  async fillConfirmationInput(
    confirmationText: string,
    options?: { timeout?: number; force?: boolean },
  ): Promise<void> {
    await this.confirmationInput.element.waitFor({
      state: 'visible',
      timeout: options?.timeout,
    });
    await this.confirmationInput.fill(confirmationText, options);
  }

  /**
   * Clicks the Delete button in the footer.
   *
   * Waits for the confirm button to become enabled before clicking. The button
   * is disabled until the confirmation text matches "DELETE", and React's state
   * update from fillConfirmationInput is asynchronous; the explicit
   * toBeEnabled() check makes the timing contract explicit and avoids racing
   * the disabled→enabled transition.
   *
   * @param options - Optional click options (timeout, force, delay)
   */
  async clickDelete(options?: {
    timeout?: number;
    force?: boolean;
    delay?: number;
  }): Promise<void> {
    const confirmButton = this.element.locator(
      DeleteConfirmationModal.SELECTORS.CONFIRM_BUTTON,
    );
    await expect(confirmButton).toBeEnabled({ timeout: options?.timeout });
    await confirmButton.click(options);
  }
}
