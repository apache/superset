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
 *
 * Expects the locator to point to the `.ant-tabs` wrapper element
 * (not the inner tablist) so that `nav` can scope to the outer tab bar
 * and exclude nested/inner tabs (e.g. Results / Query history in SQL Lab).
 */
export class Tabs {
  readonly page: Page;
  private readonly locator: Locator;

  constructor(page: Page, locator?: Locator) {
    this.page = page;
    this.locator = locator ?? page.locator('.ant-tabs').first();
  }

  /**
   * The root element locator for this tabs component.
   */
  get element(): Locator {
    return this.locator;
  }

  /**
   * The tab navigation bar for this component.
   * Scoped to the first `.ant-tabs-nav` descendant so that queries
   * only hit this component's tabs, never nested/inner tab bars.
   */
  protected get nav(): Locator {
    return this.locator.locator('.ant-tabs-nav').first();
  }

  /**
   * Returns the number of tabs.
   * Counts `.ant-tabs-tab` wrappers in the nav bar — one per physical tab,
   * regardless of inner role="tab" elements (btn, remove button, etc.).
   */
  async getTabCount(): Promise<number> {
    return this.nav.locator('.ant-tabs-tab').count();
  }

  /**
   * Returns the text content of all tabs.
   */
  async getTabNames(): Promise<string[]> {
    return this.nav.locator('.ant-tabs-tab-btn').allTextContents();
  }

  /**
   * Gets a tab button by name, scoped to this component's nav bar.
   * Anchored at start (^) with negative lookahead (?!\d) to prevent
   * partial matches: "Query" won't match "Query 1", and "Query 1"
   * won't match "Query 10". Trailing icon text (e.g. " circle-solid")
   * is allowed since (?!\d) permits non-digit suffixes.
   * @param tabName - The name/label of the tab
   */
  getTab(tabName: string): Locator {
    const escaped = tabName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.nav
      .locator('.ant-tabs-tab-btn')
      .filter({ hasText: new RegExp(`^${escaped}(?!\\d)`) });
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
   * Returns the name of the currently active tab.
   */
  async getActiveTabName(): Promise<string> {
    const text = await this.nav
      .locator('.ant-tabs-tab-active .ant-tabs-tab-btn')
      .textContent();
    return text?.trim() ?? '';
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
