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

import { Page, Download, Locator, expect } from '@playwright/test';
import { Button, Input, Menu, Tabs } from '../components/core';
import { DashboardFilterBar } from '../components/dashboard';
import { gotoWithRetry } from '../helpers/navigation';
import { html5DragAndDrop } from '../helpers/dnd';
import { TIMEOUT } from '../utils/constants';

/** Tabs of the dashboard builder side pane, by their rendered label. */
type BuilderTab = 'Charts' | 'Layout elements';

/**
 * Built-in draggable layout elements, by their rendered label (see
 * `src/dashboard/components/gridComponents/new/`). Extension-provided elements
 * carry dynamic names and are not covered here.
 */
type LayoutElementLabel =
  | 'Tabs'
  | 'Row'
  | 'Column'
  | 'Header'
  | 'Text / Markdown'
  | 'Divider';

/**
 * Dashboard Page object for interacting with dashboards.
 */
export class DashboardPage {
  private readonly page: Page;
  private readonly filterBar: DashboardFilterBar;

  private static readonly SELECTORS = {
    DASHBOARD_HEADER: '[data-test="dashboard-header-container"]',
    CHART_GRID_COMPONENT: '[data-test="chart-grid-component"]',
    // `:visible` so the locator empties out as loaders hide; see
    // waitForLoadersToSettle.
    LOADING_INDICATOR: '[aria-label="Loading"]:visible',
    DASHBOARD_MENU_TRIGGER: '[data-test="actions-trigger"]',
    // The header-actions-menu is the data-test for the dropdown menu content
    HEADER_ACTIONS_MENU: '[data-test="header-actions-menu"]',
    EDIT_BUTTON: '[data-test="edit-dashboard-button"]',
    BUILDER_PANE: '[data-test="dashboard-builder-sidepane"]',
    CHARTS_SEARCH: '[data-test="dashboard-charts-filter-search-input"]',
    CHART_CARD: '[data-test="chart-card"]',
    EMPTY_DROPTARGET: '[data-test="grid-content"] .empty-droptarget',
    NEW_COMPONENT: '[data-test="new-component"]',
    CHART_HOLDER: '[data-test="dashboard-component-chart-holder"]',
    GRID_CONTENT: '[data-test="grid-content"]',
    DELETE_COMPONENT: '[data-test="dashboard-delete-component-button"]',
    MARKDOWN_EDITOR: '[data-test="dashboard-markdown-editor"]',
    EDITABLE_TITLE: '[data-test="editable-title-input"]',
    // Ace exposes no data-test hooks; these are its own stable DOM classes.
    ACE_CONTENT: '.ace_content',
    ACE_TEXT_INPUT: '.ace_text-input',
    RESIZE_HANDLE_BOTTOM: '.resizable-container-handle--bottom',
  } as const;

  constructor(page: Page) {
    this.page = page;
    this.filterBar = new DashboardFilterBar(page);
  }

  /**
   * Navigate to a dashboard by its slug
   * @param slug - The dashboard slug (e.g., 'world_health')
   */
  async gotoBySlug(slug: string): Promise<void> {
    await gotoWithRetry(this.page, `dashboard/${slug}/`);
  }

  /**
   * Navigate to a dashboard by its ID
   * @param id - The dashboard ID
   */
  async gotoById(id: number): Promise<void> {
    await gotoWithRetry(this.page, `dashboard/${id}/`);
  }

  /**
   * Wait for the dashboard header to be visible.
   *
   * The header container renders well before the grid does, so this only
   * establishes that the dashboard route mounted — pair it with
   * {@link waitForChartsToLoad} before asserting on chart content.
   */
  async waitForLoad(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? TIMEOUT.PAGE_LOAD;
    await this.page
      .locator(DashboardPage.SELECTORS.DASHBOARD_HEADER)
      .waitFor({ state: 'visible', timeout });
  }

  /**
   * Get a chart grid component by its chart ID.
   */
  getChart(chartId: number): Locator {
    return this.page.locator(
      `${DashboardPage.SELECTORS.CHART_GRID_COMPONENT}[data-test-chart-id="${chartId}"]`,
    );
  }

  /**
   * Wait for the dashboard's charts to mount and finish loading.
   *
   * Waiting only for loading indicators to clear is not enough: the grid mounts
   * its spinners after the header renders, so a "no visible loader" check
   * called straight after {@link waitForLoad} passes instantly against a
   * dashboard that has not started rendering anything. Waiting for at least one
   * chart grid component first makes the absence of loaders mean "charts
   * finished" rather than "charts have not begun".
   *
   * Only for dashboards that have charts — on an empty one this waits out
   * `timeout` rather than returning. Use {@link waitForGridToLoad} there.
   */
  async waitForChartsToLoad(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? TIMEOUT.API_RESPONSE;

    await this.page
      .locator(DashboardPage.SELECTORS.CHART_GRID_COMPONENT)
      .first()
      .waitFor({ state: 'attached', timeout });

    await this.waitForLoadersToSettle(timeout);
  }

  /**
   * Wait for the dashboard grid to mount and any loading indicators to clear.
   *
   * The counterpart to {@link waitForChartsToLoad} for a dashboard with no
   * charts on it: the grid container renders whatever the grid holds, so it
   * gives the "the page got past the header" evidence that a chart component
   * cannot. Prefer {@link waitForChartsToLoad} whenever charts are expected —
   * this cannot tell a grid that rendered empty from one whose charts have not
   * begun rendering.
   */
  async waitForGridToLoad(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? TIMEOUT.API_RESPONSE;

    // Attached rather than visible: an empty grid collapses to zero height,
    // which Playwright counts as not visible.
    await this.page
      .locator(DashboardPage.SELECTORS.GRID_CONTENT)
      .first()
      .waitFor({ state: 'attached', timeout });

    await this.waitForLoadersToSettle(timeout);
  }

  /**
   * Resolve once no loading indicator is visible.
   *
   * Loading indicators persist in the DOM as hidden elements after charts
   * finish, so this waits for none to be *visible* rather than for none to
   * exist. The `:visible` engine resolves to zero elements when they are all
   * hidden, which is what `detached` then matches — and it returns immediately
   * when they are already settled, with no timeout penalty.
   *
   * Deliberately not a `getComputedStyle` check in an evaluated function:
   * `display` does not inherit, so a loader inside a `display: none` ancestor
   * computes to its own `display: block` and reads as visible, hanging the wait
   * until the timeout. Playwright's visibility check accounts for ancestors.
   *
   * Loader absence is also the state of a dashboard that has not started
   * rendering, which is why every caller pairs this with a wait for the content
   * it expects.
   */
  private async waitForLoadersToSettle(timeout: number): Promise<void> {
    await this.page
      .locator(DashboardPage.SELECTORS.LOADING_INDICATOR)
      .first()
      .waitFor({ state: 'detached', timeout });
  }

  /**
   * Gets the Display controls section heading in the filter bar.
   */
  getDisplayControlsHeader(): Locator {
    return this.page.getByRole('heading', {
      name: 'Display controls',
      exact: true,
    });
  }

  /**
   * Gets a Display Control heading by name.
   * @param name - The Display Control name
   */
  getDisplayControl(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true });
  }

  /**
   * Waits for and returns the dashboard native-filter bar component.
   */
  async waitForFilterBar(): Promise<DashboardFilterBar> {
    await this.filterBar.waitForReady();
    return this.filterBar;
  }

  /**
   * Open the dashboard header actions menu (three-dot menu)
   */
  async openHeaderActionsMenu(): Promise<void> {
    await this.page
      .locator(DashboardPage.SELECTORS.DASHBOARD_MENU_TRIGGER)
      .click();
    // Wait for the dropdown menu to appear
    await this.page
      .locator(DashboardPage.SELECTORS.HEADER_ACTIONS_MENU)
      .waitFor({ state: 'visible' });
  }

  /**
   * The dashboard header actions dropdown menu. Call after
   * {@link openHeaderActionsMenu}, which is what makes the menu visible.
   */
  private headerActionsMenu(): Menu {
    return new Menu(this.page, DashboardPage.SELECTORS.HEADER_ACTIONS_MENU);
  }

  /**
   * Trigger a dashboard-level force refresh via the header actions menu.
   * Re-runs every chart's query with `force=true`, bypassing the cache.
   */
  async forceRefresh(): Promise<void> {
    await this.openHeaderActionsMenu();
    await this.headerActionsMenu().selectItem('Refresh dashboard');
  }

  /**
   * Selects an option from the Download submenu.
   * Opens the header actions menu, navigates to Download submenu,
   * and clicks the specified option.
   *
   * @param optionText - The download option to select (e.g., "Export YAML")
   */
  async selectDownloadOption(optionText: string): Promise<Download> {
    await this.openHeaderActionsMenu();

    const menu = this.headerActionsMenu();
    const downloadPromise = this.page.waitForEvent('download');
    await menu.selectSubmenuItem('Download', optionText);
    return downloadPromise;
  }

  /**
   * Enter dashboard edit mode and wait for the builder side pane to appear.
   */
  async enterEditMode(): Promise<void> {
    const editButton = new Button(
      this.page,
      DashboardPage.SELECTORS.EDIT_BUTTON,
    );
    await editButton.click();
    await this.page
      .locator(DashboardPage.SELECTORS.BUILDER_PANE)
      .waitFor({ state: 'visible' });
  }

  /**
   * The builder side pane's tab bar (Charts / Layout elements).
   */

  /**
   * Switch the builder side pane to one of its tabs.
   * @param tab - 'Charts' (existing slices) or 'Layout elements' (new components)
   */
  private async openBuilderTab(tab: BuilderTab): Promise<void> {
    // Scoped to `.ant-tabs` because that is the root the shared Tabs component
    // expects.
    const builderTabs = new Tabs(
      this.page,
      this.page
        .locator(`${DashboardPage.SELECTORS.BUILDER_PANE} .ant-tabs`)
        .first(),
    );
    await builderTabs.clickTab(tab);
  }

  /**
   * Locator for chart-holder components currently placed on the grid.
   * Markdown components are chart holders too — use
   * {@link getMarkdownEditors} when the assertion must exclude them.
   */
  getChartHolders(): Locator {
    return this.page.locator(DashboardPage.SELECTORS.CHART_HOLDER);
  }

  /**
   * Drag an existing chart from the Charts pane onto the dashboard grid.
   * Requires edit mode to be active.
   * @param sliceName - The slice name to search for and drag
   */
  async addChartByName(sliceName: string): Promise<void> {
    await this.openBuilderTab('Charts');
    const search = new Input(this.page, DashboardPage.SELECTORS.CHARTS_SEARCH);
    await search.fill(sliceName);
    const card = this.page
      .locator(DashboardPage.SELECTORS.CHART_CARD)
      .filter({ hasText: sliceName })
      .first();
    await card.waitFor({ state: 'visible' });
    await html5DragAndDrop(this.page, card, this.dropTarget());
  }

  /**
   * Drag a new Layout element (by its label) onto the dashboard grid.
   * Requires edit mode to be active.
   * @param label - The new-component label, e.g. 'Text / Markdown'
   */
  async addLayoutElement(label: LayoutElementLabel): Promise<void> {
    await this.openBuilderTab('Layout elements');
    const source = this.page
      .locator(DashboardPage.SELECTORS.NEW_COMPONENT)
      .filter({ hasText: label })
      .first();
    await source.waitFor({ state: 'visible' });
    await html5DragAndDrop(this.page, source, this.dropTarget());
  }

  /**
   * The grid's empty drop target, which the grid renders while in edit mode.
   *
   * Only resolves while the grid is still empty. Dropping a second component
   * needs a target relative to the already-placed one, not this.
   */
  private dropTarget(): Locator {
    return this.page.locator(DashboardPage.SELECTORS.EMPTY_DROPTARGET).first();
  }

  /**
   * Hover the first placed chart-holder and click its delete button (edit mode).
   */
  async deleteChartHolder(): Promise<void> {
    const holder = this.getChartHolders().first();
    await holder.hover();
    const deleteButton = new Button(
      this.page,
      holder.locator(DashboardPage.SELECTORS.DELETE_COMPONENT),
    );
    await deleteButton.click();
  }

  /**
   * Locator for markdown editor components on the grid.
   */
  getMarkdownEditors(): Locator {
    return this.page.locator(DashboardPage.SELECTORS.MARKDOWN_EDITOR);
  }

  /**
   * The rendered ace document inside a markdown component. Present only once
   * the component has entered its editing state.
   *
   * Exposed as a locator rather than routed through the `AceEditor` component:
   * that component reads and writes through `ace.edit(...)` in page context,
   * which both bypasses the real keystroke path under test and gives up
   * web-first retries on assertions.
   *
   * @param markdownEditor - A locator from {@link getMarkdownEditors}
   */
  getMarkdownAceContent(markdownEditor: Locator): Locator {
    return markdownEditor.locator(DashboardPage.SELECTORS.ACE_CONTENT);
  }

  /**
   * Ace's hidden textarea inside a markdown component — the element that
   * receives keystrokes.
   *
   * @param markdownEditor - A locator from {@link getMarkdownEditors}
   */
  getMarkdownAceInput(markdownEditor: Locator): Locator {
    return markdownEditor.locator(DashboardPage.SELECTORS.ACE_TEXT_INPUT);
  }

  /**
   * Click the dashboard title, moving focus off whichever grid component holds
   * it. Committing a markdown edit needs a click on some other element, and the
   * title is the one that is always present regardless of what is on the grid.
   *
   * In edit mode the click focuses the title's input. That is a state change,
   * not a no-op — but it edits nothing on its own, so it leaves the component
   * under test untouched.
   */
  async blurToDashboardTitle(): Promise<void> {
    await this.page
      .locator(DashboardPage.SELECTORS.EDITABLE_TITLE)
      .first()
      .click();
  }

  /**
   * Drag a grid component's bottom resize handle down by `deltaY` pixels.
   * Requires edit mode. Uses the mouse because the resize handle is driven by
   * `react-resizable`, which tracks real pointer movement.
   *
   * @param component - The grid component to resize
   * @param deltaY - Pixels to drag downwards (positive grows the component)
   * @returns The component's height before and after the drag
   */
  async resizeComponent(
    component: Locator,
    deltaY: number,
  ): Promise<{ heightBefore: number; heightAfter: number }> {
    const boxBefore = await component.boundingBox();
    if (!boxBefore) {
      throw new Error('Cannot resize a component that is not visible');
    }

    const handle = component
      .locator(DashboardPage.SELECTORS.RESIZE_HANDLE_BOTTOM)
      .last();
    const handleBox = await handle.boundingBox();
    if (!handleBox) {
      throw new Error('Resize handle is not visible');
    }

    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    // Multiple steps so react-resizable sees a drag rather than a teleport.
    await this.page.mouse.move(startX, startY + deltaY, { steps: 10 });
    await this.page.mouse.up();

    await expect
      .poll(async () => (await component.boundingBox())?.height, {
        message: 'Component height did not change after resize',
      })
      .not.toBe(boxBefore.height);

    const boxAfter = await component.boundingBox();
    if (!boxAfter) {
      throw new Error('Component disappeared during resize');
    }

    return { heightBefore: boxBefore.height, heightAfter: boxAfter.height };
  }
}
