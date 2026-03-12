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
import { TIMEOUT } from '../../utils/constants';

/**
 * Menu component for Ant Design dropdown menus.
 * Uses hover as primary approach (most natural user interaction).
 * Falls back to keyboard navigation, then dispatchEvent if hover fails.
 *
 * This component handles menu content only - not the trigger that opens the menu.
 * The calling page object should open the menu first, then use this component.
 *
 * @example
 * // In a page object
 * async selectDownloadOption(optionText: string): Promise<void> {
 *   await this.openHeaderActionsMenu();
 *   const menu = new Menu(this.page, '[data-test="header-actions-menu"]');
 *   await menu.selectSubmenuItem('Download', optionText);
 * }
 */
export class Menu {
  private readonly page: Page;
  private readonly locator: Locator;

  private static readonly SELECTORS = {
    SUBMENU: '.ant-dropdown-menu-submenu',
    SUBMENU_POPUP: '.ant-dropdown-menu-submenu-popup',
    SUBMENU_TITLE: '.ant-dropdown-menu-submenu-title',
  } as const;

  /**
   * Ant Design animation delay - allows slide-in animation to complete.
   * Without this, elements may be "not stable" and clicks can fail.
   */
  private static readonly ANIMATION_DELAY = 150;

  constructor(page: Page, selector: string);
  constructor(page: Page, locator: Locator);
  constructor(page: Page, selectorOrLocator: string | Locator) {
    this.page = page;
    if (typeof selectorOrLocator === 'string') {
      this.locator = page.locator(selectorOrLocator);
    } else {
      this.locator = selectorOrLocator;
    }
  }

  /**
   * Opens a submenu and selects an item within it.
   * Uses hover as primary approach, falls back to keyboard then dispatchEvent.
   *
   * @param submenuText - The text of the submenu to open (e.g., "Download")
   * @param itemText - The text of the item to select (e.g., "Export YAML")
   * @param options - Optional timeout settings
   */
  async selectSubmenuItem(
    submenuText: string,
    itemText: string,
    options?: { timeout?: number },
  ): Promise<void> {
    const timeout = options?.timeout ?? TIMEOUT.FORM_LOAD;

    // Try hover first (most natural user interaction)
    let popup = await this.openSubmenuWithHover(submenuText, itemText, timeout);

    // Fallback to keyboard navigation
    if (!popup) {
      popup = await this.openSubmenuWithKeyboard(
        submenuText,
        itemText,
        timeout,
      );
    }

    // Last resort: dispatchEvent
    if (!popup) {
      popup = await this.openSubmenuWithDispatchEvent(
        submenuText,
        itemText,
        timeout,
      );
    }

    if (!popup) {
      throw new Error(
        `Failed to open submenu "${submenuText}". Tried hover, keyboard, and dispatchEvent.`,
      );
    }

    // Use dispatchEvent instead of click to bypass viewport and pointer interception
    // issues. Ant Design renders submenu popups in a portal that can be positioned
    // outside the viewport or behind chart content (e.g., large tables with z-index).
    await popup.getByText(itemText, { exact: true }).dispatchEvent('click');
  }

  /**
   * Opens a submenu using native Playwright hover.
   * Returns the popup locator if successful, null otherwise.
   */
  private async openSubmenuWithHover(
    submenuText: string,
    itemText: string,
    timeout: number,
  ): Promise<Locator | null> {
    try {
      const submenuTitle = this.getSubmenuTitle(submenuText);
      await submenuTitle.hover();

      // Find the popup that contains the expected item (scopes to correct popup)
      const popup = this.page
        .locator(Menu.SELECTORS.SUBMENU_POPUP)
        .filter({ hasText: itemText });
      await popup.waitFor({ state: 'visible', timeout });

      // Allow Ant Design's slide-in animation to complete before clicking.
      // Without this, the element may be "not stable" and clicks can fail.
      await this.page.waitForTimeout(Menu.ANIMATION_DELAY);

      return popup;
    } catch {
      return null;
    }
  }

  /**
   * Opens a submenu using keyboard navigation.
   * Returns the popup locator if successful, null otherwise.
   */
  private async openSubmenuWithKeyboard(
    submenuText: string,
    itemText: string,
    timeout: number,
  ): Promise<Locator | null> {
    try {
      const submenuTitle = this.getSubmenuTitle(submenuText);
      await submenuTitle.focus();
      await this.page.keyboard.press('ArrowRight');

      const popup = this.page
        .locator(Menu.SELECTORS.SUBMENU_POPUP)
        .filter({ hasText: itemText });
      await popup.waitFor({ state: 'visible', timeout });

      return popup;
    } catch {
      return null;
    }
  }

  /**
   * Opens a submenu using dispatchEvent to trigger mouseover/mouseenter.
   * Returns the popup locator if successful, null otherwise.
   */
  private async openSubmenuWithDispatchEvent(
    submenuText: string,
    itemText: string,
    timeout: number,
  ): Promise<Locator | null> {
    try {
      const submenuTitle = this.getSubmenuTitle(submenuText);

      await submenuTitle.evaluate(el => {
        el.dispatchEvent(
          new MouseEvent('mouseover', {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
        el.dispatchEvent(
          new MouseEvent('mouseenter', {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
      });

      const popup = this.page
        .locator(Menu.SELECTORS.SUBMENU_POPUP)
        .filter({ hasText: itemText });
      await popup.waitFor({ state: 'visible', timeout });

      return popup;
    } catch {
      return null;
    }
  }

  /**
   * Gets the submenu title element for a submenu containing the given text.
   */
  private getSubmenuTitle(submenuText: string): Locator {
    return this.locator
      .locator(Menu.SELECTORS.SUBMENU)
      .filter({ hasText: submenuText })
      .locator(Menu.SELECTORS.SUBMENU_TITLE);
  }
}
