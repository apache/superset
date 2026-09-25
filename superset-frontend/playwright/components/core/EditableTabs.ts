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

import { Tabs } from './Tabs';

/**
 * EditableTabs component for Ant Design editable-card tabs.
 *
 * Mirrors the Superset EditableTabs component (type="editable-card")
 * which adds add/remove tab functionality to the base Tabs component.
 *
 * The add button (.ant-tabs-nav-add) is only rendered when
 * type="editable-card". If the host component switches to type="card"
 * (e.g., SQL Lab empty state), use the host page object for that case.
 */
export class EditableTabs extends Tabs {
  /**
   * Clicks the add-tab button rendered by antd in editable-card mode.
   *
   * When the tab strip overflows, antd renders two `Add tab` buttons:
   * one hidden inside `.ant-tabs-nav-list` (visibility: hidden) and one
   * visible inside `.ant-tabs-nav-operations`. Scope the click to the
   * visible operations container so we never match the hidden inline copy.
   */
  async addTab(): Promise<void> {
    const operationsButton = this.element
      .locator('.ant-tabs-nav-operations')
      .getByRole('button', { name: 'Add tab' });
    if ((await operationsButton.count()) > 0) {
      await operationsButton.click();
      return;
    }
    // No overflow yet — the inline nav-list button is the only one rendered.
    await this.element
      .locator('.ant-tabs-nav-list')
      .getByRole('button', { name: 'Add tab' })
      .click();
  }

  /**
   * Clicks the remove button on the last tab.
   */
  async removeLastTab(): Promise<void> {
    await this.nav.locator('.ant-tabs-tab-remove').last().click();
  }
}
