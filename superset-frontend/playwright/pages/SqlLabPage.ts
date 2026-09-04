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
import { AceEditor } from '../components/core/AceEditor';
import { AgGrid } from '../components/core/AgGrid';
import { Button } from '../components/core/Button';
import { EditableTabs } from '../components/core/EditableTabs';
import { Popover } from '../components/core/Popover';
import { Select } from '../components/core/Select';
import { waitForPost } from '../helpers/api/intercepts';
import { URL } from '../utils/urls';
import { TIMEOUT } from '../utils/constants';

/**
 * Page object for SQL Lab.
 *
 * Selectors verified against source code — see plan for line references.
 */
export class SqlLabPage {
  private readonly page: Page;
  private readonly editorTabs: EditableTabs;

  private static readonly SELECTORS = {
    SQL_EDITOR_TABS: '[data-test="sql-editor-tabs"]',
    ADD_TAB_ICON: '[data-test="add-tab-icon"]',
    RUN_QUERY_BUTTON: '[data-test="run-query-action"]',
    SOUTH_PANE: '[data-test="south-pane"]',
    EXPLORE_RESULTS_BUTTON: '[data-test="explore-results-button"]',
    SAVE_BUTTON: 'button[aria-label="Save"]',
    ACE_EDITOR: '.ace_editor',
    LEFT_BAR: '[data-test="sql-editor-left-bar"]',
    DATABASE_SELECTOR: '[data-test="DatabaseSelector"]',
    LIMIT_DROPDOWN: '.limitDropdown',
    SAVE_DATASET_BUTTON: 'button[aria-label="Save dataset"]',
  } as const;

  constructor(page: Page) {
    this.page = page;
    this.editorTabs = new EditableTabs(
      page,
      page.locator(SqlLabPage.SELECTORS.SQL_EDITOR_TABS),
    );
  }

  // ── Navigation ──

  async goto(): Promise<void> {
    await this.page.goto(URL.SQLLAB, { waitUntil: 'domcontentloaded' });
  }

  async waitForPageLoad(options?: { timeout?: number }): Promise<void> {
    // SQL Lab with dev server can be slow on first load (webpack HMR + React hydration)
    const timeout = options?.timeout ?? TIMEOUT.QUERY_EXECUTION;
    await this.editorTabs.element.waitFor({ state: 'visible', timeout });
  }

  /**
   * Navigate to SQL Lab and wait until the editor is ready.
   * Convenience method combining goto + waitForPageLoad + ensureEditorReady.
   */
  async gotoAndReady(): Promise<void> {
    await this.goto();
    await this.waitForPageLoad();
    await this.ensureEditorReady();
  }

  /**
   * Ensures at least one query editor tab exists. Creates one if SQL Lab
   * is in the empty state ("Add a new tab to create SQL Query").
   * Waits for the ace editor to be ready before returning.
   *
   * Uses a two-stage check to handle three states correctly:
   * 1. Empty state (CI): type="card" with 0 queryEditors, no editor → create tab
   * 2. Loading after reload: real tabs exist, editor hasn't mounted yet → just wait
   * 3. Normal: tabs + editor present → ready immediately
   *
   * Stage 1 checks editor presence (catches empty + loading).
   * Stage 2 checks the Ant Design tabs type to distinguish real tabs
   * (type="editable-card") from the empty state (type="card"). The React
   * source (TabbedSqlEditors) sets type based on queryEditors.length,
   * so this directly reflects whether persisted tabs exist.
   */
  async ensureEditorReady(): Promise<void> {
    // Page-global check: are there ANY editors in the DOM (any tab)?
    const anyEditor = this.page.locator(SqlLabPage.SELECTORS.ACE_EDITOR);
    let tabSyncPromise: Promise<Response> | null = null;

    if ((await anyEditor.count()) === 0) {
      // No editor visible. Check if real query editors exist (editable-card)
      // or if this is the empty state (card type, 0 queryEditors).
      // type="editable-card" → queryEditors.length > 0 (even 1 real tab).
      // type="card" → queryEditors.length === 0 (true empty state).
      const isEditableCard = await this.editorTabs.element.evaluate(el =>
        el.classList.contains('ant-tabs-editable-card'),
      );
      if (!isEditableCard) {
        // Register before clicking — EditorAutoSync POSTs the new tab
        // within its 5 s interval, so capture it before any await.
        tabSyncPromise = waitForPost(this.page, /tabstateview\/?$/, {
          timeout: 10_000,
        });
        // True empty state — click add-tab icon (works in card mode)
        await this.editorTabs.element
          .locator(SqlLabPage.SELECTORS.ADD_TAB_ICON)
          .first()
          .click();
      }
      // If editable-card: real tabs exist, editor is still mounting — just wait
    }

    // Wait for the editor in the ACTIVE panel, not page-global .first().
    // In persisted multi-tab sessions, .first() can resolve to a hidden
    // inactive editor. activePanel scopes to the visible tab panel.
    await this.activePanel
      .locator(SqlLabPage.SELECTORS.ACE_EDITOR)
      .waitFor({ state: 'visible' });
    await this.editor.waitForReady();

    // If we created the initial tab, wait for its backend sync to complete.
    // This prevents later waitForPost calls from accidentally matching
    // this tab's creation POST instead of a subsequent tab's.
    if (tabSyncPromise) {
      await tabSyncPromise;
    }
  }

  // ── Active Tab Panel ──

  /**
   * Gets the active tab panel. Ant Design keeps inactive tab panels mounted
   * but sets aria-hidden="true" on them. Using :not([aria-hidden="true"])
   * is more reliable than :visible during tab-switch animations where both
   * panels may briefly have non-zero dimensions.
   */
  private get activePanel(): Locator {
    return this.page
      .locator('[role="tabpanel"]:not([aria-hidden="true"])')
      .filter({ has: this.page.locator(SqlLabPage.SELECTORS.ACE_EDITOR) });
  }

  // ── Elements ──

  get editor(): AceEditor {
    return new AceEditor(
      this.page,
      this.activePanel.locator(SqlLabPage.SELECTORS.ACE_EDITOR),
    );
  }

  get resultsGrid(): AgGrid {
    return new AgGrid(
      this.page,
      this.activePanel
        .locator(SqlLabPage.SELECTORS.SOUTH_PANE)
        .locator('[role="grid"]'),
    );
  }

  get resultsPane(): Locator {
    return this.activePanel.locator(SqlLabPage.SELECTORS.SOUTH_PANE);
  }

  get errorAlert(): Locator {
    return this.resultsPane.locator('.ant-alert-error');
  }

  get databaseSelector(): Button {
    return new Button(
      this.page,
      this.page.locator(
        `${SqlLabPage.SELECTORS.LEFT_BAR} ${SqlLabPage.SELECTORS.DATABASE_SELECTOR}`,
      ),
    );
  }

  get runQueryButton(): Button {
    return new Button(
      this.page,
      this.activePanel.locator(SqlLabPage.SELECTORS.RUN_QUERY_BUTTON),
    );
  }

  get saveButton(): Button {
    return new Button(
      this.page,
      this.activePanel.locator(SqlLabPage.SELECTORS.SAVE_BUTTON),
    );
  }

  get saveDatasetButton(): Button {
    return new Button(
      this.page,
      this.activePanel.locator(SqlLabPage.SELECTORS.SAVE_DATASET_BUTTON),
    );
  }

  get createChartButton(): Button {
    return new Button(
      this.page,
      this.activePanel.locator(SqlLabPage.SELECTORS.EXPLORE_RESULTS_BUTTON),
    );
  }

  // ── Editor Convenience ──

  async setQuery(sql: string): Promise<void> {
    await this.editor.setText(sql);
  }

  async getQuery(): Promise<string> {
    return this.editor.getText();
  }

  // ── Tab Management ──

  async getTabCount(): Promise<number> {
    return this.editorTabs.getTabCount();
  }

  async getTabNames(): Promise<string[]> {
    return this.editorTabs.getTabNames();
  }

  async getActiveTabName(): Promise<string> {
    return this.editorTabs.getActiveTabName();
  }

  async addTab(): Promise<void> {
    await this.editorTabs.addTab();
  }

  async addTabByShortcut(): Promise<void> {
    const modifier = process.platform === 'win32' ? 'Control+q' : 'Control+t';
    await this.page.keyboard.press(modifier);
  }

  async closeLastTab(): Promise<void> {
    const countBefore = await this.getTabCount();
    await this.editorTabs.removeLastTab();
    // Wait for tab count to decrease
    await this.page.waitForFunction(
      ([selector, expected]) => {
        const container = document.querySelector(selector);
        if (!container) return false;
        const nav = container.querySelector(':scope > .ant-tabs-nav');
        if (!nav) return false;
        return nav.querySelectorAll('.ant-tabs-tab').length === expected;
      },
      [SqlLabPage.SELECTORS.SQL_EDITOR_TABS, countBefore - 1] as const,
      { timeout: TIMEOUT.UI_TRANSITION },
    );
  }

  getTab(name: string): Locator {
    return this.editorTabs.getTab(name);
  }

  // ── Database Selection (Left Sidebar) ──

  async selectDatabase(dbName: string): Promise<void> {
    await this.databaseSelector.click();

    const popover = new Popover(this.page);
    await popover.waitForVisible();

    // Target the .ant-select wrapper (not the combobox input) because the
    // selection-item overlay intercepts pointer events on the input.
    const dbSelect = popover.element
      .locator(SqlLabPage.SELECTORS.DATABASE_SELECTOR)
      .locator('.ant-select')
      .first();
    const select = new Select(this.page, dbSelect);
    await select.selectOption(dbName);

    await popover.getButton('Select').click();
    await popover
      .waitForHidden({ timeout: TIMEOUT.UI_TRANSITION })
      .catch(error => {
        if (!(error instanceof Error) || error.name !== 'TimeoutError') {
          throw error;
        }
      });
  }

  // ── Query Execution ──

  /**
   * Sets SQL, runs the query, and waits for the API response.
   * Also observes the QueryStatusBar (.ant-steps) loading indicator to
   * confirm the UI entered the execution cycle — this unmounts the old
   * results grid, so waitForQueryResults() can trust that any grid it
   * finds afterward contains data from THIS execution.
   */
  async executeQuery(sql: string): Promise<Response> {
    await this.setQuery(sql);
    const responsePromise = waitForPost(this.page, 'api/v1/sqllab/execute/', {
      timeout: TIMEOUT.QUERY_EXECUTION,
    });
    // Start observing the loading indicator BEFORE clicking Run so we
    // catch it even for fast queries. QueryStatusBar (.ant-steps) appears
    // when SQL Lab enters the running state and unmounts the results grid.
    const loadingStarted = this.resultsPane
      .locator('.ant-steps')
      .waitFor({ state: 'visible', timeout: TIMEOUT.QUERY_EXECUTION });
    await this.runQueryButton.click();
    const [, response] = await Promise.all([loadingStarted, responsePromise]);
    return response;
  }

  /**
   * Wait for fresh query results to render in the AG Grid.
   * Waits for the QueryStatusBar to disappear first, proving the execution
   * cycle completed and React rendered the post-query grid.
   * @param expectHeader - A column header that must be visible before returning.
   * @param options.timeout - How long to wait (default: TIMEOUT.QUERY_EXECUTION)
   */
  async waitForQueryResults(
    expectHeader: string,
    options?: { timeout?: number },
  ): Promise<void> {
    const timeout = options?.timeout ?? TIMEOUT.QUERY_EXECUTION;
    // Wait for QueryStatusBar to disappear — proves the loading → ready
    // transition completed. If already hidden (fast query finished before
    // this call), resolves immediately since executeQuery() already observed
    // the loading state appear.
    await this.resultsPane
      .locator('.ant-steps')
      .waitFor({ state: 'hidden', timeout });
    const grid = this.resultsGrid.element;
    await grid.waitFor({ state: 'visible', timeout });
    await grid
      .locator('.ag-header-cell', { hasText: expectHeader })
      .first()
      .waitFor({ state: 'visible', timeout });
  }

  // ── Row Limit ──

  async getRowLimit(): Promise<string> {
    const text = await this.activePanel
      .locator(SqlLabPage.SELECTORS.LIMIT_DROPDOWN)
      .textContent();
    return text?.trim() ?? '';
  }

  /**
   * Set the row limit via the Limit dropdown in the active panel.
   * @param limit - The menu item label to select (e.g., "10", "100")
   */
  async setRowLimit(limit: string): Promise<void> {
    await this.activePanel.locator(SqlLabPage.SELECTORS.LIMIT_DROPDOWN).click();
    await this.page.getByRole('menuitem', { name: limit, exact: true }).click();
  }
}
