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
import { Input, Modal, Radio, Select } from '../core';

/**
 * Save actions offered by the modal's radio group, keyed to their labels.
 */
const SAVE_ACTION_LABELS = {
  overwrite: 'Save (Overwrite)',
  saveas: 'Save as...',
} as const;

export type SaveChartAction = keyof typeof SAVE_ACTION_LABELS;

/**
 * Save chart modal in Explore.
 * Opened by clicking the "Save" button (`query-save-button`) in the chart header.
 * Supports overwriting the current chart, saving as a new chart, and adding the
 * chart to an existing or brand-new dashboard.
 */
export class SaveChartModal extends Modal {
  private static readonly SELECTORS = {
    SAVE_ACTION_RADIO: '[data-test="radio-group"]',
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

  private get saveActionRadio(): Radio {
    return new Radio(
      this.page,
      this.body.locator(SaveChartModal.SELECTORS.SAVE_ACTION_RADIO),
    );
  }

  private get chartNameInput(): Input {
    return new Input(
      this.page,
      this.body.locator(SaveChartModal.SELECTORS.NAME_INPUT),
    );
  }

  private get dashboardSelect(): Select {
    return new Select(
      this.page,
      this.body.locator(SaveChartModal.SELECTORS.DASHBOARD_SELECT),
    );
  }

  /**
   * Chooses whether the save overwrites the current chart or creates a new one.
   */
  async selectSaveAction(action: SaveChartAction): Promise<void> {
    await this.saveActionRadio.select(SAVE_ACTION_LABELS[action]);
  }

  /**
   * Fills the chart name field (only meaningful in "Save as..." mode).
   */
  async fillChartName(name: string): Promise<void> {
    await this.chartNameInput.clear();
    await this.chartNameInput.fill(name);
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
