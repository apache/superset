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

import { Page } from '@playwright/test';
import { Modal } from '../core/Modal';

/**
 * Confirm Dialog component for Ant Design Modal.confirm dialogs.
 * These are the "OK" / "Cancel" confirmation dialogs used throughout Superset.
 */
export class ConfirmDialog extends Modal {
  constructor(page: Page) {
    // Modal.confirm uses the same [role="dialog"] selector
    super(page);
  }

  /**
   * Clicks the OK button to confirm
   */
  async clickOk(): Promise<void> {
    await this.clickFooterButton('OK');
  }

  /**
   * Clicks the Cancel button to dismiss
   */
  async clickCancel(): Promise<void> {
    await this.clickFooterButton('Cancel');
  }
}
