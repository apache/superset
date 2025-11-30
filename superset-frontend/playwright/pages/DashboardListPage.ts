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

import { Page, Locator, Response } from '@playwright/test';
import { Input, Modal } from '../components/core';
import { URL } from '../utils/urls';

/**
 * Dashboard List Page object.
 * Handles both list and card view modes.
 */
export class DashboardListPage {
    private readonly page: Page;

    private static readonly SELECTORS = {
        // View mode
        CARD_VIEW_BUTTON: '[aria-label="appstore"]',
        LIST_VIEW_BUTTON: '[aria-label="unordered-list"]',

        // List view elements
        LISTVIEW_TABLE: '[data-test="listview-table"]',
        SORT_HEADER: '[data-test="sort-header"]',
        TABLE_ROW: '[data-test="table-row"]',
        EDIT_ICON: '[data-test="edit-alt"]',

        // Card view elements
        STYLED_CARD: '[data-test="styled-card"]',

        // Bulk actions
        BULK_SELECT_BUTTON: '[data-test="bulk-select"]',
        BULK_SELECT_COPY: '[data-test="bulk-select-copy"]',
        BULK_SELECT_ACTION: '[data-test="bulk-select-action"]',
        BULK_SELECT_DESELECT_ALL: '[data-test="bulk-select-deselect-all"]',

        // Actions
        MORE_MENU: '[aria-label="more"]',
        DELETE_BUTTON: '[data-test="dashboard-card-option-delete-button"]',
        EDIT_BUTTON: '[data-test="dashboard-card-option-edit-button"]',
        TRASH_ICON: '[data-test="dashboard-list-trash-icon"]',

        // Filters
        FILTER_SELECT: (filterName: string) => `[aria-label^="${filterName}"]`,

        // Common elements
        LOADING_INDICATOR: '[data-test="loading-indicator"]',

        // Favorite
        STARRED_ICON: '[aria-label="starred"]',
        UNSTARRED_ICON: '[aria-label="unstarred"]',

        // Delete modal
        DELETE_MODAL: '[role="dialog"][aria-modal="true"]',
        DELETE_MODAL_INPUT: '[data-test="delete-modal-input"]',
        MODAL_CONFIRM_BUTTON: '[data-test="modal-confirm-button"]',

        // Edit modal
        DASHBOARD_TITLE_INPUT: '[data-test="dashboard-title-input"]',

        // Ant Design components
        ANT_SELECT_CLEAR: '.ant-select-clear',
        ANT_SELECT_OPTION: '.ant-select-item-option',
        ANT_TABLE_SELECT_ALL: 'th.ant-table-cell input[aria-label="Select all"]',
        ANT_CHECKBOX_INPUT: '.ant-checkbox-input',
        ANT_TABLE_CHECKBOX:
            '.ant-checkbox-input:not(th.ant-table-measure-cell .ant-checkbox-input)',
    } as const;

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Navigate to the dashboard list page
     */
    async goto(): Promise<void> {
        await this.page.goto(URL.DASHBOARD_LIST);
    }

    /**
     * Set grid view mode (card or list)
     */
    async setGridMode(mode: 'card' | 'list'): Promise<void> {
        const selector =
            mode === 'card'
                ? DashboardListPage.SELECTORS.CARD_VIEW_BUTTON
                : DashboardListPage.SELECTORS.LIST_VIEW_BUTTON;
        await this.page.locator(selector).click();
    }

    /**
     * Toggle bulk select mode
     */
    async toggleBulkSelect(): Promise<void> {
        await this.page
            .locator(DashboardListPage.SELECTORS.BULK_SELECT_BUTTON)
            .click();
    }

    /**
     * Clear all filter inputs
     */
    async clearAllInputs(): Promise<void> {
        const clearButtons = this.page.locator(
            DashboardListPage.SELECTORS.ANT_SELECT_CLEAR,
        );
        const count = await clearButtons.count();
        if (count > 0) {
            await clearButtons.click({ force: true });
        }
    }

    /**
     * Set a filter value and wait for filtering to complete
     * @param filterName - The filter name (e.g., "Owner", "Status", "Sort")
     * @param optionValue - The option value to select
     */
    async setFilter(filterName: string, optionValue: string): Promise<void> {
        // Wait for filter API call
        const filteringPromise = this.page.waitForResponse(
            response =>
                response.url().includes('/api/v1/dashboard/?q=') &&
                response.request().method() === 'GET',
        );

        // Click filter dropdown
        await this.page
            .locator(DashboardListPage.SELECTORS.FILTER_SELECT(filterName))
            .first()
            .click();

        // Select option
        await this.page
            .locator(
                `${DashboardListPage.SELECTORS.ANT_SELECT_OPTION}[title="${optionValue}"]`,
            )
            .first()
            .click({ force: true });

        // Wait for filtering to complete
        await filteringPromise;
    }

    /**
     * Wait for loading indicator to disappear
     */
    async waitForLoadingComplete(): Promise<void> {
        await this.page
            .locator(DashboardListPage.SELECTORS.LOADING_INDICATOR)
            .waitFor({ state: 'hidden' });
    }

    /**
     * Get all styled cards (card view)
     */
    getCards(): Locator {
        return this.page.locator(DashboardListPage.SELECTORS.STYLED_CARD);
    }

    /**
     * Get a styled card by index
     */
    getCard(index: number): Locator {
        return this.page
            .locator(DashboardListPage.SELECTORS.STYLED_CARD)
            .nth(index);
    }

    /**
     * Get all table rows (list view)
     */
    getTableRows(): Locator {
        return this.page.locator(DashboardListPage.SELECTORS.TABLE_ROW);
    }

    /**
     * Get a table row by index
     */
    getTableRow(index: number): Locator {
        return this.page.locator(DashboardListPage.SELECTORS.TABLE_ROW).nth(index);
    }

    /**
     * Get all sort headers (list view)
     */
    getSortHeaders(): Locator {
        return this.page.locator(DashboardListPage.SELECTORS.SORT_HEADER);
    }

    /**
     * Click a sort header by index
     */
    async clickSortHeader(index: number): Promise<void> {
        await this.page
            .locator(DashboardListPage.SELECTORS.SORT_HEADER)
            .nth(index)
            .click();
    }

    /**
     * Select all items in bulk select mode (list view)
     */
    async selectAllInListView(): Promise<void> {
        await this.page
            .locator(DashboardListPage.SELECTORS.ANT_TABLE_SELECT_ALL)
            .click();
    }

    /**
     * Get all checked checkboxes
     */
    getCheckedCheckboxes(): Locator {
        return this.page.locator('input[type="checkbox"]:checked');
    }

    /**
     * Get bulk select copy text element
     */
    getBulkSelectCopy(): Locator {
        return this.page.locator(DashboardListPage.SELECTORS.BULK_SELECT_COPY);
    }

    /**
     * Get bulk select action buttons
     */
    getBulkSelectActions(): Locator {
        return this.page.locator(DashboardListPage.SELECTORS.BULK_SELECT_ACTION);
    }

    /**
     * Click deselect all button
     */
    async deselectAll(): Promise<void> {
        await this.page
            .locator(DashboardListPage.SELECTORS.BULK_SELECT_DESELECT_ALL)
            .click();
    }

    /**
     * Click multiple cards in card view for bulk selection
     */
    async clickCardsForBulkSelect(count: number): Promise<void> {
        const cards = this.page.locator(DashboardListPage.SELECTORS.STYLED_CARD);
        for (let i = 0; i < count; i++) {
            await cards.nth(i).click();
        }
    }

    /**
     * Click table row checkboxes for bulk selection
     */
    async clickTableRowCheckboxes(indices: number[]): Promise<void> {
        const checkboxes = this.page.locator(
            '[data-test="table-row"] input[type="checkbox"]',
        );
        for (const index of indices) {
            await checkboxes.nth(index).click();
        }
    }

    /**
     * Click the "more" menu on the first card/row
     */
    async openMoreMenu(): Promise<void> {
        await this.page
            .locator(DashboardListPage.SELECTORS.MORE_MENU)
            .first()
            .click();
    }

    /**
     * Click edit button in more menu
     */
    async clickEditButton(): Promise<void> {
        await this.page
            .locator(DashboardListPage.SELECTORS.EDIT_BUTTON)
            .click();
    }

    /**
     * Click delete button in more menu
     */
    async clickDeleteButton(): Promise<void> {
        await this.page
            .locator(DashboardListPage.SELECTORS.DELETE_BUTTON)
            .click();
    }

    /**
     * Click edit icon in list view
     */
    async clickEditIcon(index: number): Promise<void> {
        await this.page
            .locator(DashboardListPage.SELECTORS.EDIT_ICON)
            .nth(index)
            .click();
    }

    /**
     * Click trash icon in list view
     */
    async clickTrashIcon(index: number): Promise<void> {
        await this.page
            .locator(DashboardListPage.SELECTORS.TRASH_ICON)
            .nth(index)
            .click();
    }

    /**
     * Confirm delete action in modal
     * @param bulk - Whether this is a bulk delete operation
     */
    async confirmDelete(bulk = false): Promise<void> {
        // Set up response interceptors
        const deletePromise = bulk
            ? this.page.waitForResponse(
                response =>
                    response.url().includes('/api/v1/dashboard/?q=') &&
                    response.request().method() === 'DELETE',
            )
            : this.page.waitForResponse(
                response =>
                    response.url().includes('/api/v1/dashboard/') &&
                    response.request().method() === 'DELETE',
            );

        // Wait for modal to be visible
        await this.page
            .locator(DashboardListPage.SELECTORS.DELETE_MODAL)
            .waitFor({ state: 'visible' });

        // Type DELETE in the confirmation input
        const deleteInput = this.page.locator(
            DashboardListPage.SELECTORS.DELETE_MODAL_INPUT,
        );
        await deleteInput.waitFor({ state: 'visible' });
        await deleteInput.clear();
        await deleteInput.fill('DELETE');

        // Click confirm button
        await this.page
            .locator(DashboardListPage.SELECTORS.MODAL_CONFIRM_BUTTON)
            .click();

        // Wait for delete to complete
        await deletePromise;
    }

    /**
     * Click favorite/unfavorite star icon on first card
     */
    async clickFavoriteIcon(starred: boolean): Promise<void> {
        const selector = starred
            ? DashboardListPage.SELECTORS.STARRED_ICON
            : DashboardListPage.SELECTORS.UNSTARRED_ICON;

        const favoritePromise = this.page.waitForResponse(response =>
            response.url().includes('/api/v1/dashboard/') &&
                response.url().includes('/favorites/')
                ? response.request().method() === 'POST'
                : false,
        );

        await this.page
            .locator(DashboardListPage.SELECTORS.STYLED_CARD)
            .first()
            .locator(selector)
            .click();

        await favoritePromise;
    }

    /**
     * Edit dashboard title
     * @param newTitle - The new title to set
     */
    async editDashboardTitle(newTitle: string): Promise<void> {
        const updatePromise = this.page.waitForResponse(
            response =>
                response.url().includes('/api/v1/dashboard/') &&
                response.request().method() === 'PUT',
        );

        const titleInput = this.page.locator(
            DashboardListPage.SELECTORS.DASHBOARD_TITLE_INPUT,
        );
        await titleInput.fill(newTitle);

        // Click Save button
        await this.page.getByRole('button', { name: 'Save' }).click();

        await updatePromise;
    }

    /**
     * Append text to dashboard title
     */
    async appendToDashboardTitle(text: string): Promise<void> {
        const updatePromise = this.page.waitForResponse(
            response =>
                response.url().includes('/api/v1/dashboard/') &&
                response.request().method() === 'PUT',
        );

        const titleInput = this.page.locator(
            DashboardListPage.SELECTORS.DASHBOARD_TITLE_INPUT,
        );
        await titleInput.type(text);

        // Click Save button
        await this.page.getByRole('button', { name: 'Save' }).click();

        await updatePromise;
    }

    /**
     * Get the listview table element
     */
    getListViewTable(): Locator {
        return this.page.locator(DashboardListPage.SELECTORS.LISTVIEW_TABLE);
    }

    /**
     * Get ant table checkboxes (excluding header)
     */
    getAntTableCheckboxes(): Locator {
        return this.page.locator(DashboardListPage.SELECTORS.ANT_TABLE_CHECKBOX);
    }
}
