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
import { URL } from '../utils/urls';

/**
 * Page Object for SQL Lab.
 * Encapsulates tab management, editor interactions, running queries, and results access.
 * Assertions live in test files, not here.
 */
export class SqlLabPage {
    private readonly page: Page;

    // Centralized selectors (match Cypress patterns to ease migration)
    private static readonly SELECTORS = {
        TABLIST: '[data-test="sql-editor-tabs"] > [role="tablist"]',
        TABS: '[data-test="sql-editor-tabs"] > [role="tablist"] [role="tab"]:not([type="button"])',
        ADD_TAB_ICON: '[data-test="add-tab-icon"]',
        TAB_DROPDOWN_TRIGGER: '[data-test="dropdown-trigger"]',
        CLOSE_TAB_OPTION: '[data-test="close-tab-menu-option"]',
        REMOVE_ICON: '[aria-label="remove"]',
        EDITOR_TEXTAREA: '#ace-editor textarea, #brace-editor textarea',
        EDITOR_CONTENT: '#ace-editor .ace_content, #brace-editor .ace_content',
        RUN_QUERY_BUTTON: '#js-sql-toolbar button, .sql-toolbar button', // filter later
        LIMIT_DROPDOWN: '#js-sql-toolbar .limitDropdown',
        DROPDOWN_MENU_LAST: '.ant-dropdown-menu:last-child',
        RESULTS_TABLE: '.SouthPane .ReactVirtualized__Table',
        TIMER_LABEL: '.sql-toolbar .label-success',
        CREATE_CHART_BUTTON:
            '.SouthPane .ant-tabs-content > .ant-tabs-tabpane-active > div button:first-of-type',
        DATASOURCE_CONTROL_TITLE: '[data-test="datasource-control"] .title-select',
        COLUMN_OPTION_LABEL: '.column-option-label',
        ALL_COLUMNS_FIRST: '[data-test="all_columns"] [data-test="dnd-labels-container"] > div:first-child',
        ALL_COLUMNS_SECOND: '[data-test="all_columns"] [data-test="dnd-labels-container"] > div:nth-child(2)',
        SLICE_CONTAINER_HEADERS: '[data-test="slice-container"] table > thead th',
    } as const;

    constructor(page: Page) {
        this.page = page;
    }

    /** Navigate to SQL Lab */
    async goto(): Promise<void> {
        await this.page.goto(URL.SQLLAB);
    }

    /** Locator for all tabs */
    getTabs(): Locator {
        return this.page.locator(SqlLabPage.SELECTORS.TABS);
    }

    /** Locator for add tab icons (multiple may exist; last is used) */
    getAddTabIcons(): Locator {
        return this.page.locator(SqlLabPage.SELECTORS.ADD_TAB_ICON);
    }

    /** Ensure at least one real query tab exists (handles empty state tab) */
    async ensureQueryTabExists(): Promise<void> {
        const tabs = this.getTabs();
        let tabCount = await tabs.count();
        if (tabCount === 0) {
            await this.addTabViaButton();
            return;
        }

        const firstTabText = await tabs.first().innerText();
        if (firstTabText.includes('Add a new tab')) {
            await this.addTabViaButton();
        }
    }

    /** Click add tab icon (uses last visible) */
    async addTabViaButton(): Promise<void> {
        // Match Cypress pattern: [data-test="add-tab-icon"]:visible:last
        // Get current count before clicking
        const currentCount = await this.getTabs().count();
        const icon = this.page.locator(`${SqlLabPage.SELECTORS.ADD_TAB_ICON}:visible`).last();
        await icon.waitFor({ state: 'visible', timeout: 10000 });
        await icon.click({ force: true });
        // Wait for new tab to appear
        await this.getTabs().nth(currentCount).waitFor({ state: 'attached', timeout: 5000 });
    }

    /** Add tab via keyboard shortcut (Ctrl+T) */
    async addTabViaShortcut(): Promise<void> {
        await this.page.keyboard.press('Control+T');
    }

    /** Open tab dropdown (menu) for last tab */
    async openLastTabDropdown(): Promise<void> {
        const tabs = this.getTabs();
        const count = await tabs.count();
        if (count === 0) throw new Error('No tabs available');
        await tabs
            .nth(count - 1)
            .locator(SqlLabPage.SELECTORS.TAB_DROPDOWN_TRIGGER)
            .click({ force: true });
    }

    /** Close last tab via dropdown menu option */
    async closeLastTabViaMenu(): Promise<void> {
        await this.openLastTabDropdown();
        await this.page
            .locator(SqlLabPage.SELECTORS.CLOSE_TAB_OPTION)
            .click({ force: true });
    }

    /** Click remove icon for last tab (alternative close) */
    async clickLastRemoveIcon(): Promise<void> {
        const icons = this.page.locator(`${SqlLabPage.SELECTORS.TABLIST} ${SqlLabPage.SELECTORS.REMOVE_ICON}`);
        const icon = icons.last();
        await icon.waitFor({ state: 'visible', timeout: 5000 });
        await icon.click({ force: true });
    }

    /** Set editor content (replace existing) */
    async setEditorContent(query: string): Promise<void> {
        const textarea = this.page.locator(SqlLabPage.SELECTORS.EDITOR_TEXTAREA).first();
        await textarea.focus();
        // Select all + delete then type
        await textarea.press('Control+A');
        await textarea.press('Delete');
        await textarea.type(query, { delay: 5 });
    }

    /** Get editor content locator */
    getEditorContent(): Locator {
        return this.page.locator(SqlLabPage.SELECTORS.EDITOR_CONTENT).first();
    }

    /** Configure row limit (open dropdown and select first item) */
    async configureRowLimit(): Promise<void> {
        // The limitDropdown is inside a Button - click the button to open dropdown
        // Match Cypress: queryLimitSelector.parent().click()
        const dropdownButton = this.page.locator(`${SqlLabPage.SELECTORS.LIMIT_DROPDOWN}`).locator('..');
        await dropdownButton.click({ force: true });
        // Wait for menu to appear and click first item
        const menuItem = this.page.locator('.ant-dropdown-menu .ant-dropdown-menu-item').first();
        await menuItem.waitFor({ state: 'visible', timeout: 5000 });
        await menuItem.click();
    }

    /** Run current query (click first run button) */
    async runQuery(): Promise<Response> {
        const runButton = this.page.locator(SqlLabPage.SELECTORS.RUN_QUERY_BUTTON).first();
        const executePromise = this.waitForQueryExecute();
        await runButton.click();
        return executePromise;
    }

    /** Wait for POST /api/v1/sqllab/execute/ */
    async waitForQueryExecute(): Promise<Response> {
        return this.page.waitForResponse(
            r =>
                r.request().method() === 'POST' &&
                r.url().includes('/api/v1/sqllab/execute/'),
        );
    }

    /** Timer label locator */
    getTimerLabel(): Locator {
        return this.page.locator(SqlLabPage.SELECTORS.TIMER_LABEL).first();
    }

    /** Results table locator(s) */
    getResultsTables(): Locator {
        return this.page.locator(SqlLabPage.SELECTORS.RESULTS_TABLE);
    }

    /** Create chart from current query */
    async createChartFromQuery(): Promise<void> {
        // Button appears after query run in active SouthPane tab
        const button = this.page.locator(SqlLabPage.SELECTORS.CREATE_CHART_BUTTON);
        await button.click({ timeout: 10000 });
    }

    /** Datasource control title selector */
    getDatasourceTitle(): Locator {
        return this.page.locator(SqlLabPage.SELECTORS.DATASOURCE_CONTROL_TITLE);
    }

    /** Column option labels */
    getColumnOptionLabels(): Locator {
        return this.page.locator(SqlLabPage.SELECTORS.COLUMN_OPTION_LABEL);
    }

    /** All columns (first and second) */
    getAllColumnsFirst(): Locator {
        return this.page.locator(SqlLabPage.SELECTORS.ALL_COLUMNS_FIRST);
    }
    getAllColumnsSecond(): Locator {
        return this.page.locator(SqlLabPage.SELECTORS.ALL_COLUMNS_SECOND);
    }

    /** Slice container header columns */
    getSliceContainerHeaders(): Locator {
        return this.page.locator(SqlLabPage.SELECTORS.SLICE_CONTAINER_HEADERS);
    }
}
