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
import { Modal } from '../core';

/**
 * Chart properties edit modal.
 * Opened by clicking the edit icon on a chart row in the chart list.
 * General section is expanded by default (defaultActiveKey="general").
 */
export class ChartPropertiesModal extends Modal {
  private static readonly SELECTORS = {
    NAME_INPUT: '[data-test="properties-modal-name-input"]',
  };

  constructor(page: Page) {
    super(page, '[data-test="properties-edit-modal"]');
  }

  /**
   * Fills the chart name input field
   * @param name - The new chart name
   */
  async fillName(name: string): Promise<void> {
    const input = this.body.locator(ChartPropertiesModal.SELECTORS.NAME_INPUT);
    await input.fill(name);
  }

  /**
   * Clicks the Save button in the modal footer
   */
  async clickSave(): Promise<void> {
    await this.clickFooterButton('Save');
  }
}
