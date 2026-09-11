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
import { isFeatureEnabled } from '../../helpers/featureFlags';

/**
 * Delete confirmation modal, used throughout Superset for delete operations.
 *
 * The modal has two modes. Destructive mode demands the user type "DELETE"
 * before the action is enabled. Recoverable mode — what `SOFT_DELETE` turns
 * on — archives instead of removing, so the action reads "Archive" and the
 * type-to-confirm friction is deliberately dropped: reduced friction is what
 * a reversible action earns.
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
   * Targets the confirm button by data-test rather than going through
   * Modal.clickFooterButton, which finds buttons by their visible text. The
   * button label is i18n'd ("Delete" / "Supprimer" / …) so name-based lookups
   * break in non-English locales.
   *
   * Also waits for the button to become enabled before clicking: it is
   * disabled until the confirmation text matches "DELETE", and React's state
   * update from fillConfirmationInput is asynchronous, so an immediate click
   * can race the disabled→enabled transition.
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

  /**
   * Confirms the deletion using whichever interaction the modal is in.
   *
   * Which mode is in force is a property of the instance, not of the caller,
   * so the flag decides rather than the test — the same spec then covers the
   * hard-delete and archive paths without being rewritten when the default
   * flips, and keeps covering hard delete for deployments that turn the
   * toggle back off.
   *
   * Neither branch is merely tolerant: the recoverable branch asserts the
   * confirmation input is genuinely *absent* rather than skipping past it,
   * so a regression that dropped the typed confirmation from destructive
   * mode still fails here instead of quietly passing.
   *
   * Assumes the modal's mode follows `SOFT_DELETE` alone. That holds
   * everywhere except a bulk selection containing semantic views, which
   * stays destructive even with the flag on — such a flow should drive
   * {@link fillConfirmationInput} and {@link clickDelete} directly.
   *
   * @param confirmationText - Text typed in destructive mode
   *
   * @example
   * const deleteModal = new DeleteConfirmationModal(page);
   * await deleteModal.waitForVisible();
   * await deleteModal.confirmDeletion();
   * await deleteModal.waitForHidden();
   */
  async confirmDeletion(confirmationText = 'DELETE'): Promise<void> {
    if (await isFeatureEnabled(this.page, 'SOFT_DELETE')) {
      await expect(this.confirmationInput.element).toHaveCount(0);
    } else {
      await this.fillConfirmationInput(confirmationText);
    }
    await this.clickDelete();
  }
}
