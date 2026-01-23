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
import { Modal } from '../core/Modal';

/**
 * Confirm Dialog component for Ant Design Modal.confirm dialogs.
 * These are the "OK" / "Cancel" confirmation dialogs used throughout Superset.
 * Uses getByRole with name to target specific confirm dialogs when multiple are open.
 */
export class ConfirmDialog extends Modal {
  private readonly specificLocator: Locator;

  constructor(page: Page, dialogName = 'Confirm save') {
    super(page);
    // Use getByRole with specific name to avoid strict mode violations
    // when multiple dialogs are open (e.g., Edit Dataset modal + Confirm save dialog)
    this.specificLocator = page.getByRole('dialog', { name: dialogName });
  }

  /**
   * Override element getter to use specific locator
   */
  override get element(): Locator {
    return this.specificLocator;
  }

  /**
   * Clicks the OK button to confirm
   * Waits for element to be visible before clicking
   */
  async clickOk(): Promise<void> {
    // Wait for modal to be visible before clicking
    await this.element.waitFor({ state: 'visible' });
    await this.clickFooterButton('OK');
  }

  /**
   * Clicks the Cancel button to dismiss
   */
  async clickCancel(): Promise<void> {
    await this.clickFooterButton('Cancel');
  }

  /**
   * Clicks OK if dialog appears within timeout, otherwise silently returns.
   * Use when dialog appearance is conditional (e.g., depends on dataset settings).
   * @param timeout - How long to wait for dialog (default 2000ms)
   */
  async clickOkIfVisible(timeout = 2000): Promise<void> {
    try {
      await this.element.waitFor({ state: 'visible', timeout });
      await this.clickOk();
      await this.waitForHidden();
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'TimeoutError') {
        throw error;
      }
    }
  }
}
