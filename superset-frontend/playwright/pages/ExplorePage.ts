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
import { TIMEOUT } from '../utils/constants';

/**
 * Explore Page object
 */
export class ExplorePage {
  private readonly page: Page;

  private static readonly SELECTORS = {
    // Core controls
    DATASOURCE_CONTROL: '[data-test="datasource-control"]',
    VIZ_SWITCHER: '[data-test="fast-viz-switcher"]',
    // Metrics editing
    METRICS_CONTROL: '[data-test="metrics"]',
    REMOVE_CONTROL_BUTTON: '[data-test="remove-control-button"]',
    METRIC_OPTION: '[data-test="metric-option"]',
    METRIC_EDIT_SIMPLE_TAB: '#adhoc-metric-edit-tabs-tab-SIMPLE',
    METRIC_EDIT_SQL_TAB: '#adhoc-metric-edit-tabs-tab-SQL',
    METRIC_EDIT_TITLE_TRIGGER: '[data-test="AdhocMetricEditTitle#trigger"]',
    METRIC_EDIT_TITLE_INPUT: '[data-test="AdhocMetricEditTitle#input"]',
    METRIC_EDIT_SAVE: '[data-test="AdhocMetricEdit#save"]',
    CONTROL_LABEL: '[data-test="control-label"]',
    RUN_QUERY_BUTTON: 'button[data-test="run-query-button"]',
    // Advanced analytics
    ADVANCED_ANALYTICS_HEADER: '.ant-collapse-header:has-text("Advanced analytics")',
    TIME_COMPARE_CONTROL: '[data-test="time_compare"]',
    // Annotations
    ANNOTATIONS_AND_LAYERS_TRIGGER: 'span:has-text("Annotations and Layers")',
    ANNOTATION_LAYERS_CONTROL: '[data-test="annotation_layers"]',
    POPOVER_CONTENT: '[data-test="popover-content"]',
    // Menu actions & popovers
    MENU_ACTIONS_TRIGGER: '[aria-label="Menu actions trigger"]',
    VIEW_QUERY_MENU_ITEM: 'span:has-text("View query")',
    SHARE_MENU_ITEM: 'div[role="menuitem"]:has-text("Share")',
    EMBED_CODE_BUTTON: '[data-test="embed-code-button"]',
    EMBED_CODE_POPOVER: '#embed-code-popover',
    // Save chart modal
    SAVE_CHART_BUTTON: '[data-test="query-save-button"]',
    SAVE_MODAL_BODY: '[data-test="save-modal-body"]',
    SAVE_AS_RADIO: '[data-test="saveas-radio"]',
    SAVE_OVERWRITE_RADIO: '[data-test="save-overwrite-radio"]',
    NEW_CHART_NAME_INPUT: '[data-test="new-chart-name"]',
    SAVE_MODAL_DASHBOARD_SELECT_FORM: '[data-test="save-chart-modal-select-dashboard-form"]',
    MODAL_SAVE_BUTTON: '[data-test="btn-modal-save"]',
    METADATA_BAR: '[data-test="metadata-bar"]',
    // Dashboards submenu search
    DASHBOARDS_SUBMENU_TITLE: '.ant-dropdown-menu-submenu-title:has-text("On dashboards")',
    DASHBOARDS_SUBMENU_POPUP: '.ant-dropdown-menu-submenu-popup',
    DASHBOARD_SEARCH_INPUT: '.ant-dropdown-menu-submenu-popup input[placeholder="Search"]',
    DASHBOARD_SEARCH_NO_RESULTS: '.ant-dropdown-menu-submenu-popup:has-text("No results found")',
  } as const;

  constructor(page: Page) {
    this.page = page;
  }

  /** Expose underlying page only when absolutely necessary (e.g., full reload) */
  get rawPage(): Page {
    return this.page;
  }

  /**
   * Waits for the Explore page to load.
   * Validates URL contains /explore/ and datasource control is visible.
   *
   * @param options - Optional wait options
   */
  async waitForPageLoad(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout || TIMEOUT.PAGE_LOAD;

    await this.page.waitForURL('**/explore/**', { timeout });

    await this.page.waitForSelector(ExplorePage.SELECTORS.DATASOURCE_CONTROL, {
      state: 'visible',
      timeout,
    });
  }

  /**
   * Gets the datasource control locator.
   * Returns a Locator that tests can use with expect() or to read text.
   *
   * @returns Locator for the datasource control
   *
   * @example
   * const name = await explorePage.getDatasourceControl().textContent();
   */
  getDatasourceControl(): Locator {
    return this.page.locator(ExplorePage.SELECTORS.DATASOURCE_CONTROL);
  }

  /**
   * Gets the currently selected dataset name from the datasource control
   */
  async getDatasetName(): Promise<string> {
    const text = await this.getDatasourceControl().textContent();
    return text?.trim() || '';
  }

  /**
   * Gets the visualization switcher locator.
   * Returns a Locator that tests can use with expect().toBeVisible(), etc.
   *
   * @returns Locator for the viz switcher
   *
   * @example
   * await expect(explorePage.getVizSwitcher()).toBeVisible();
   */
  getVizSwitcher(): Locator {
    return this.page.locator(ExplorePage.SELECTORS.VIZ_SWITCHER);
  }

  /** Navigate to chart list */
  async gotoChartList(): Promise<void> {
    await this.page.goto(URL.CHART_LIST);
    // Wait for chart list filtering request to finish if triggered
    await this.waitForOptionalResponse(r =>
      r.url().includes('/api/v1/chart/?q=') && r.request().method() === 'GET',
    );
  }

  /** Visit chart by name from list (similar to Cypress visitSampleChartFromList) */
  async clickChartInList(chartName: string): Promise<void> {
    const row = this.page
      .locator('[data-test="table-row"]')
      .filter({ hasText: chartName })
      .first();
    await row.click();
  }

  /** Wait helper that does not throw if response never appears (YAGNI safe) */
  private async waitForOptionalResponse(predicate: (r: Response) => boolean, timeout = 4000): Promise<void> {
    try {
      await this.page.waitForResponse(predicate, { timeout });
    } catch {
      // swallow timeout – request may be cached/not fired
    }
  }

  /** Wait for v1 chart data response */
  async waitForV1ChartData(aliasMatch?: string): Promise<Response> {
    return this.page.waitForResponse(r =>
      r.url().includes('/api/v1/chart/data') && r.request().method() === 'GET',
    );
  }

  /** Run query */
  async runQuery(): Promise<Response> {
    const runPromise = this.waitForV1ChartData();
    await this.page.locator(ExplorePage.SELECTORS.RUN_QUERY_BUTTON).click();
    return runPromise;
  }

  /** Remove all metrics (single remove button click) */
  async clearMetrics(): Promise<void> {
    const removeBtn = this.page
      .locator(ExplorePage.SELECTORS.METRICS_CONTROL)
      .locator(ExplorePage.SELECTORS.REMOVE_CONTROL_BUTTON)
      .first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
    }
  }

  /** Open metrics editor (click placeholder) */
  async openMetricsEditor(): Promise<void> {
    const placeholder = this.page
      .locator(ExplorePage.SELECTORS.METRICS_CONTROL)
      .locator('text=Drop columns/metrics here or click')
      .first();
    await placeholder.click();
  }

  async switchToSimpleMetricTab(): Promise<void> {
    await this.page.locator(ExplorePage.SELECTORS.METRIC_EDIT_SIMPLE_TAB).click();
  }
  async switchToSqlMetricTab(): Promise<void> {
    await this.page.locator(ExplorePage.SELECTORS.METRIC_EDIT_SQL_TAB).click();
  }

  /** Set adhoc metric simple form */
  async setSimpleAdhocMetric(metricName: string, column: string, aggregate: string): Promise<void> {
    await this.page.locator(ExplorePage.SELECTORS.METRIC_EDIT_TITLE_TRIGGER).click();
    const titleInput = this.page.locator(ExplorePage.SELECTORS.METRIC_EDIT_TITLE_INPUT);
    await titleInput.fill(metricName);
    const colInput = this.page.locator('input[aria-label="Select column"]');
    await colInput.click();
    await colInput.fill(`${column}`);
    await colInput.press('Enter');
    const aggInput = this.page.locator('input[aria-label="Select aggregate options"]');
    await aggInput.click();
    await aggInput.fill(`${aggregate}`);
    await aggInput.press('Enter');
    await this.page.locator(ExplorePage.SELECTORS.METRIC_EDIT_SAVE).click();
  }

  /** Locator for saved metric label */
  getMetricLabel(metricName: string): Locator {
    return this.page.locator(ExplorePage.SELECTORS.CONTROL_LABEL).filter({ hasText: metricName });
  }

  /** Expand advanced analytics section */
  async expandAdvancedAnalytics(): Promise<void> {
    await this.page.locator(ExplorePage.SELECTORS.ADVANCED_ANALYTICS_HEADER).click({ force: true });
  }

  /** Add time compare entries */
  async addTimeCompare(values: string[]): Promise<void> {
    const control = this.page.locator(ExplorePage.SELECTORS.TIME_COMPARE_CONTROL);
    const search = control.locator('input[type=search]').first();
    for (const v of values) {
      await control.locator('.ant-select').click();
      await search.fill('');
      await search.type(`${v}`);
      await search.press('Enter');
    }
  }

  /** Open annotations layers popover */
  async openAnnotationsLayers(): Promise<void> {
    await this.page.locator(ExplorePage.SELECTORS.ANNOTATIONS_AND_LAYERS_TRIGGER).click();
    await this.page.locator(ExplorePage.SELECTORS.ANNOTATION_LAYERS_CONTROL).click();
  }

  /** Add formula annotation */
  async addFormulaAnnotation(name: string, formula: string): Promise<void> {
    const popover = this.page.locator(ExplorePage.SELECTORS.POPOVER_CONTENT);
    await popover.locator('[aria-label=Name]').fill(name);
    await popover.locator('[aria-label=Formula]').fill(formula);
    await popover.locator('button:has-text("OK")').click();
  }

  /** Open menu actions trigger */
  async openMenuActions(): Promise<void> {
    await this.page.locator(ExplorePage.SELECTORS.MENU_ACTIONS_TRIGGER).click();
  }

  async openViewQueryModal(): Promise<void> {
    await this.openMenuActions();
    await this.page.locator(ExplorePage.SELECTORS.VIEW_QUERY_MENU_ITEM).click();
    // modal depends on data fetch; wait for chart response optionally
    await this.waitForOptionalResponse(r =>
      r.url().includes('/api/v1/chart/data') && r.request().method() === 'GET',
    );
  }

  async openSharePopover(): Promise<void> {
    await this.openMenuActions();
    await this.page.locator(ExplorePage.SELECTORS.SHARE_MENU_ITEM).click();
  }

  async openEmbedCode(): Promise<void> {
    await this.page.locator(ExplorePage.SELECTORS.EMBED_CODE_BUTTON).click();
  }

  /** Start save as flow */
  async startSaveChart(): Promise<void> {
    await this.page.locator(ExplorePage.SELECTORS.SAVE_CHART_BUTTON).click();
    await this.page.locator(ExplorePage.SELECTORS.SAVE_MODAL_BODY).waitFor();
  }

  async chooseSaveAs(): Promise<void> {
    await this.page.locator(ExplorePage.SELECTORS.SAVE_AS_RADIO).check();
  }
  async chooseOverwrite(): Promise<void> {
    await this.page.locator(ExplorePage.SELECTORS.SAVE_OVERWRITE_RADIO).check();
  }

  async setNewChartName(name: string): Promise<void> {
    const input = this.page.locator(ExplorePage.SELECTORS.NEW_CHART_NAME_INPUT);
    await input.click();
    await input.fill(name);
  }

  async selectDashboardInSaveModal(dashboardTitle: string): Promise<void> {
    const form = this.page.locator(ExplorePage.SELECTORS.SAVE_MODAL_DASHBOARD_SELECT_FORM);
    const dashInput = form.locator('input[aria-label^="Select a dashboard"]');
    await dashInput.fill(dashboardTitle);
    await dashInput.press('Enter');
    const option = this.page.locator(`.ant-select-item[title="${dashboardTitle}"]`).first();
    if (await option.isVisible()) {
      await option.click({ force: true });
    }
  }

  async confirmSave(): Promise<void> {
    const savePromise = this.waitForOptionalResponse(r =>
      r.url().includes('/api/v1/explore/') && r.request().method() === 'PUT',
      8000,
    );
    await this.page.locator(ExplorePage.SELECTORS.MODAL_SAVE_BUTTON).click();
    await savePromise;
    await this.page
      .locator(ExplorePage.SELECTORS.SAVE_MODAL_BODY)
      .waitFor({ state: 'hidden' });
  }

  getMetadataBar(): Locator {
    return this.page.locator(ExplorePage.SELECTORS.METADATA_BAR);
  }

  async openDashboardsSubmenu(): Promise<void> {
    await this.page.locator('[data-test="actions-trigger"]').click();
    const title = this.page.locator(ExplorePage.SELECTORS.DASHBOARDS_SUBMENU_TITLE);
    await title.hover({ force: true });
  }

  async searchDashboardsSubmenu(term: string): Promise<void> {
    const popup = this.page.locator(ExplorePage.SELECTORS.DASHBOARDS_SUBMENU_POPUP);
    await popup.hover();
    const input = popup.locator('input[placeholder="Search"]');
    await input.fill(term);
  }
}
