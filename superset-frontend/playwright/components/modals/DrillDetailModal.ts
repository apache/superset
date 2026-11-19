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
import { Modal } from '../core';

/**
 * The "Drill to detail" modal (`DrillDetailModal.tsx`), opened from a chart's
 * "More Options" menu or its right-click context menu. Renders the chart's
 * underlying sample rows, optionally scoped to a drilled-by value, via the
 * `/datasource/samples` API.
 */
export class DrillDetailModal extends Modal {
  private static readonly SELECTORS = {
    CLOSE_BUTTON: '[data-test="close-drilltodetail-modal"]',
    ROW_COUNT_LABEL: '[data-test="row-count-label"]',
    METADATA_BAR: '[data-test="metadata-bar"]',
    FILTER_COLUMN: '[data-test="filter-col"]',
    FILTER_VALUE: '[data-test="filter-val"]',
    PAGE_ITEM: '.ant-pagination-item',
    ACTIVE_PAGE_ITEM: '.ant-pagination-item-active',
    GRID_CELL: '.virtual-table-cell',
  } as const;

  private readonly specificLocator: Locator;

  constructor(page: Page) {
    super(page);
    // Matched by accessible name rather than a data-test: the antd Modal's own
    // data-test (`${name}-modal`) is derived from this same i18n'd `name`
    // prop, so it isn't a locale-independent alternative. No data-test exists
    // on the dialog root itself.
    this.specificLocator = page.getByRole('dialog', {
      name: /^Drill to detail:/,
    });
  }

  override get element(): Locator {
    return this.specificLocator;
  }

  /**
   * The applied-filter value tags (`<col>=<val>`). Empty when the drill was
   * whole-chart (no row/point-level filter applied).
   */
  get filterValues(): Locator {
    return this.element.locator(DrillDetailModal.SELECTORS.FILTER_VALUE);
  }

  /** The applied-filter chip(s); each is closable via its own "Close" icon. */
  get filterColumns(): Locator {
    return this.element.locator(DrillDetailModal.SELECTORS.FILTER_COLUMN);
  }

  /** Row-count label above the results grid, e.g. "1-50 of 500 rows". */
  get rowCountLabel(): Locator {
    return this.element.locator(DrillDetailModal.SELECTORS.ROW_COUNT_LABEL);
  }

  /** The metadata bar (column/row summary) shown once samples have loaded. */
  get metadataBar(): Locator {
    return this.element.locator(DrillDetailModal.SELECTORS.METADATA_BAR);
  }

  /** Pagination page-number items below the results grid. */
  get pageItems(): Locator {
    return this.element.locator(DrillDetailModal.SELECTORS.PAGE_ITEM);
  }

  /** The currently active pagination page-number item. */
  get activePageItem(): Locator {
    return this.element.locator(DrillDetailModal.SELECTORS.ACTIVE_PAGE_ITEM);
  }

  /** Cells of the virtualized results grid. */
  get gridCells(): Locator {
    return this.element.locator(DrillDetailModal.SELECTORS.GRID_CELL);
  }

  /**
   * Removes the first applied filter by clicking its chip's Close icon,
   * re-fetching the unfiltered samples.
   */
  async clearFirstFilter(): Promise<void> {
    await this.filterColumns.first().getByLabel('Close').click();
  }

  /** Navigates to the given 1-indexed pagination page. */
  async goToPage(pageNumber: number): Promise<void> {
    await this.pageItems.nth(pageNumber - 1).click();
  }

  /**
   * Re-fetches the current samples query, resetting pagination to page 1.
   *
   * Matched by accessible name: the Reload icon carries an i18n'd
   * `aria-label` (`t('Reload')`) and no data-test, so this breaks in
   * non-English locales the same way `DrillDetailModal.tsx`'s dialog `name`
   * does above; the predecessor Cypress test used the same English string.
   */
  async reload(): Promise<void> {
    await this.element.getByRole('button', { name: 'Reload' }).click();
  }

  /**
   * Closes the modal via its footer Close button.
   *
   * Targets the button by data-test rather than Modal.clickFooterButton,
   * which finds buttons by their visible text. The button label is i18n'd
   * ("Close" / "Fermer" / …), so name-based lookups break in non-English
   * locales; see DeleteConfirmationModal.clickDelete for the same rationale.
   */
  async close(): Promise<void> {
    await this.element.locator(DrillDetailModal.SELECTORS.CLOSE_BUTTON).click();
    await this.waitForHidden();
  }
}
