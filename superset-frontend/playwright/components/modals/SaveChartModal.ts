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

import { Page } from '@playwright/test';
import { Modal, Select } from '../core';

/**
 * Save chart modal in Explore.
 * Opened by clicking the "Save" button (`query-save-button`) in the chart header.
 * Supports overwriting the current chart, saving as a new chart, and adding the
 * chart to an existing or brand-new dashboard.
 */
export class SaveChartModal extends Modal {
  private static readonly SELECTORS = {
    OVERWRITE_RADIO: '[data-test="save-overwrite-radio"]',
    SAVEAS_RADIO: '[data-test="saveas-radio"]',
    NAME_INPUT: '[data-test="new-chart-name"]',
    // The AsyncSelect forwards `data-test={ariaLabel || name}`; SaveModal passes
    // ariaLabel={t('Select a dashboard')}, and this stays stable regardless of
    // whether a dashboard is currently selected.
    DASHBOARD_SELECT: '[data-test="Select a dashboard"]',
  } as const;

  constructor(page: Page) {
    // The modal itself carries no data-test; scope by its body's data-test instead.
    super(page, '[role="dialog"]:has([data-test="save-modal-body"])');
  }

  /**
   * Selects the "Save (Overwrite)" radio option.
   */
  async selectOverwrite(): Promise<void> {
    await this.body.locator(SaveChartModal.SELECTORS.OVERWRITE_RADIO).click();
  }

  /**
   * Selects the "Save as..." radio option.
   */
  async selectSaveAsNew(): Promise<void> {
    await this.body.locator(SaveChartModal.SELECTORS.SAVEAS_RADIO).click();
  }

  /**
   * Fills the chart name field (only meaningful in "Save as..." mode).
   */
  async fillChartName(name: string): Promise<void> {
    const input = this.body.locator(SaveChartModal.SELECTORS.NAME_INPUT);
    await input.fill('');
    await input.fill(name);
  }

  private get dashboardSelect(): Select {
    return new Select(
      this.page,
      this.body.locator(SaveChartModal.SELECTORS.DASHBOARD_SELECT),
    );
  }

  /**
   * Adds the chart to a dashboard. When `dashboardTitle` matches an existing
   * dashboard it is selected; otherwise the select's `allowNewOptions`
   * affordance creates a new dashboard with that title.
   */
  async selectDashboard(dashboardTitle: string): Promise<void> {
    await this.dashboardSelect.selectOption(dashboardTitle);
  }

  /**
   * Clicks the primary "Save" footer button (`btn-modal-save`).
   */
  async clickSave(): Promise<void> {
    await this.clickFooterButton('Save');
  }
}
