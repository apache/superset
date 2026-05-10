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
import { Input, Modal } from '../core';

/**
 * Save Query modal in SQL Lab.
 * Appears when clicking the Save button in the SQL editor toolbar.
 */
export class SaveQueryModal extends Modal {
  constructor(page: Page) {
    super(page, '.save-query-modal');
  }

  private get nameInput(): Input {
    return new Input(
      this.page,
      this.body.locator('input[type="text"]').first(),
    );
  }

  async fillName(name: string): Promise<void> {
    await this.nameInput.clear();
    await this.nameInput.fill(name);
  }
}
