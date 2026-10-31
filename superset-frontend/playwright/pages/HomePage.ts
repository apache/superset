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
import { gotoWithRetry } from '../helpers/navigation';
import { URL } from '../utils/urls';
import { DeleteConfirmationModal } from '../components/modals';

/** The two card lists on Home that this page object can drive. */
export type HomeAssetKind = 'Dashboards' | 'Charts';

/** The three list tabs shared by both the Dashboards and Charts sections. */
export type HomeListTab = 'Favorite' | 'Mine' | 'All';

/**
 * Home/welcome page object.
 *
 * Covers the "Recents" activity panel and the Dashboards/Charts card lists,
 * including the card kebab menu's delete (or, with SOFT_DELETE on, archive)
 * action -- used to verify that deleting a dashboard/chart promptly refreshes
 * the Recents panel (see recent-activity-refresh.spec.ts).
 */
export class HomePage {
  private readonly page: Page;

  private static readonly SECTION_NAMES = {
    RECENTS: 'Recents',
  } as const;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigates to the Home/welcome page.
   */
  async goto(): Promise<void> {
    await gotoWithRetry(this.page, URL.WELCOME);
  }

  /**
   * Gets the Recents content section.
   */
  getRecentsSection(): Locator {
    return this.page.getByText(HomePage.SECTION_NAMES.RECENTS, { exact: true });
  }

  /**
   * Expands the Recents panel if it is currently collapsed.
   *
   * Collapse state persists across sessions (it is saved to localStorage),
   * so a prior run/test can leave it collapsed, hiding its content -- and
   * with it, the "Viewed" tab {@link getRecentsViewedCount} depends on.
   */
  async expandRecents(): Promise<void> {
    const header = this.page.getByRole('button', { name: 'Recents' });
    if ((await header.getAttribute('aria-expanded')) === 'false') {
      await header.click();
    }
  }

  /**
   * Gets the collapsible panel for a given card list ("Dashboards" or
   * "Charts"). Scoping to this panel (rather than matching card/tab text
   * loosely on the whole page) is what keeps lookups from also matching the
   * visually-similar cards in the Recents panel above it.
   */
  getPanel(kind: HomeAssetKind): Locator {
    return this.page
      .locator('.ant-collapse-item')
      .filter({ has: this.page.getByText(kind, { exact: true }) });
  }

  /**
   * Switches a card list's Favorite/Mine/All tab.
   */
  async switchTab(kind: HomeAssetKind, tab: HomeListTab): Promise<void> {
    await this.getPanel(kind)
      .getByRole('tab', { name: tab, exact: true })
      .click();
  }

  /**
   * Gets a specific card by its title within a card list panel.
   */
  getCard(kind: HomeAssetKind, title: string): Locator {
    return this.getPanel(kind)
      .locator('[data-test="styled-card"]')
      .filter({ hasText: title });
  }

  /**
   * Gets the count of a title's occurrences within the Recents "Viewed" tab
   * specifically -- used to assert that a just-deleted item's Recents entry
   * has (or has not yet) disappeared.
   */
  async getRecentsViewedCount(title: string): Promise<number> {
    const recentsPanel = this.page
      .locator('.ant-collapse-item')
      .filter({ has: this.getRecentsSection() });
    const viewedTab = recentsPanel.getByRole('tab', {
      name: 'Viewed',
      exact: true,
    });
    if (await viewedTab.count()) {
      await viewedTab.click();
    }
    return recentsPanel.getByText(title, { exact: true }).count();
  }

  /**
   * Deletes (or, with SOFT_DELETE on, archives) a card via its kebab menu.
   *
   * The kebab button is only revealed on hover, so a plain `.click()` -- no
   * actionability wait sees it as interactable until the hover state is
   * actually entered -- needs a real `.hover()` first, not `force: true`.
   *
   * @param kind - Which card list the card belongs to.
   * @param title - The card's title.
   * @param menuTestId - The kebab menu's `data-test` (differs between
   *   dashboard and chart cards).
   * @param deleteOptionTestId - The delete/archive menu item's `data-test`
   *   (also differs between dashboard and chart cards).
   */
  async deleteCardViaMenu(
    kind: HomeAssetKind,
    title: string,
    menuTestId: string,
    deleteOptionTestId: string,
  ): Promise<void> {
    const card = this.getCard(kind, title).first();
    await card.hover();
    await card.locator(`[data-test="${menuTestId}"]`).click();
    await this.page.locator(`[data-test="${deleteOptionTestId}"]`).click();

    const deleteModal = new DeleteConfirmationModal(this.page);
    await deleteModal.waitForVisible();
    await deleteModal.confirmDeletion();
    await deleteModal.waitForHidden();
  }
}
