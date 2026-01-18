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

/**
 * Tabs component for Ant Design tab navigation.
 */
export class Tabs {
  readonly page: Page;
  private readonly locator: Locator;

  constructor(page: Page, locator?: Locator) {
    this.page = page;
    // Default to the tablist role if no specific locator provided
    this.locator = locator ?? page.getByRole('tablist');
  }

  /**
   * Gets the tablist element locator
   */
  get element(): Locator {
    return this.locator;
  }

  /**
   * Gets a tab by name
   * @param tabName - The name/label of the tab
   */
  getTab(tabName: string): Locator {
    return this.page.getByRole('tab', { name: tabName });
  }

  /**
   * Clicks a tab by name
   * @param tabName - The name/label of the tab to click
   */
  async clickTab(tabName: string): Promise<void> {
    await this.getTab(tabName).click();
  }

  /**
   * Gets the tab panel content for a given tab
   * @param tabName - The name/label of the tab
   */
  getTabPanel(tabName: string): Locator {
    return this.page.getByRole('tabpanel', { name: tabName });
  }

  /**
   * Checks if a tab is selected
   * @param tabName - The name/label of the tab
   */
  async isSelected(tabName: string): Promise<boolean> {
    const tab = this.getTab(tabName);
    const ariaSelected = await tab.getAttribute('aria-selected');
    return ariaSelected === 'true';
  }
}
