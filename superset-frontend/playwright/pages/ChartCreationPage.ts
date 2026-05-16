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

import { expect, Locator, Page } from '@playwright/test';
import { Button, Select } from '../components/core';

/**
 * Chart Creation Page object for the "Create a new chart" wizard.
 * This page appears after creating a dataset via the wizard.
 */
export class ChartCreationPage {
  readonly page: Page;

  private static readonly SELECTORS = {
    VIZ_GALLERY: '.viz-gallery',
    VIZ_TYPE_ITEM: '[data-test="viz-type-gallery__item"]',
  } as const;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Gets the dataset selector container (includes the displayed selection value)
   */
  getDatasetSelectContainer(): Locator {
    return this.page.getByLabel('Dataset', { exact: false }).first();
  }

  /**
   * Gets the dataset selector for interactions
   */
  getDatasetSelect(): Select {
    return new Select(
      this.page,
      this.page.getByRole('combobox', { name: /dataset/i }),
    );
  }

  /**
   * Gets the visualization gallery container
   */
  getVizGallery(): Locator {
    return this.page.locator(ChartCreationPage.SELECTORS.VIZ_GALLERY);
  }

  /**
   * Gets the "Create new chart" button
   */
  getCreateChartButton(): Button {
    return new Button(
      this.page,
      this.page.getByRole('button', { name: /create new chart/i }),
    );
  }

  /**
   * Navigate to the chart creation page
   */
  async goto(): Promise<void> {
    await this.page.goto('chart/add');
  }

  /**
   * Wait for the page to load (dataset selector visible)
   */
  async waitForPageLoad(): Promise<void> {
    await expect(this.getDatasetSelect().element).toBeVisible({
      timeout: 10000,
    });
  }

  /**
   * Select a dataset from the dropdown
   * @param datasetName - The name of the dataset to select
   */
  async selectDataset(datasetName: string): Promise<void> {
    await this.getDatasetSelect().selectOption(datasetName);
  }

  /**
   * Select a visualization type from the gallery
   * @param vizType - The visualization type to select (e.g., 'Table', 'Bar Chart')
   */
  async selectVizType(vizType: string): Promise<void> {
    const vizGallery = this.getVizGallery();
    await expect(vizGallery).toBeVisible();

    // Button names in the gallery are duplicated (e.g., "Table Table", "Bar Chart Bar Chart")
    // because they include both the image alt text and the label text.
    // Use exact match with the duplicated pattern to avoid matching similar names.
    const vizTypeItem = vizGallery.getByRole('button', {
      name: `${vizType} ${vizType}`,
      exact: true,
    });
    await vizTypeItem.click();
  }

  /**
   * Click the "Create new chart" button to navigate to Explore
   */
  async clickCreateNewChart(): Promise<void> {
    await this.getCreateChartButton().click();
  }

  /**
   * Verify the dataset is pre-selected (shown in the selector)
   * @param datasetName - The expected dataset name
   */
  async expectDatasetSelected(datasetName: string): Promise<void> {
    // For Ant Design selects, the selected value is displayed in a sibling element,
    // not in the combobox input. Check the container for the displayed text.
    await expect(this.getDatasetSelectContainer()).toContainText(datasetName);
  }

  /**
   * Check if the "Create new chart" button is enabled
   */
  async isCreateButtonEnabled(): Promise<boolean> {
    return this.getCreateChartButton().isEnabled();
  }
}
