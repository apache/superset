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

import { Page, expect } from '@playwright/test';
import { minimatch } from 'minimatch';

export enum InterceptItemCategory {
  Dashboard = 'Dashboard',
  Chart = 'Chart',
  Other = 'Other',
}

export const InterceptType = {
  [InterceptItemCategory.Chart]: {
    Get: {
      method: 'GET',
      endpoint: '**/api/v1/chart/*',
    },
    Filtering: {
      method: 'GET',
      endpoint: '**/api/v1/chart/?q=*',
    },
    BulkDelete: {
      method: 'DELETE',
      endpoint: '**/api/v1/chart/?q=*',
    },
    Delete: {
      method: 'DELETE',
      endpoint: '**/api/v1/chart/*',
    },
    SelectFavoriteChart: {
      method: 'POST',
      endpoint: '**/api/v1/chart/*/favorites/',
    },
    UnselectFavoriteChart: {
      method: 'DELETE',
      endpoint: '**/api/v1/chart/*/favorites/',
    },
    FavoriteStatus: {
      method: 'GET',
      endpoint: '**/api/v1/chart/favorite_status/*',
    },
    Update: {
      method: 'PUT',
      endpoint: '**/api/v1/chart/*',
    },
    V1ChartData: {
      method: 'GET',
      endpoint: '**/api/v1/chart/data*',
    },
  },
  [InterceptItemCategory.Dashboard]: {
    Get: {
      method: 'GET',
      endpoint: '**/api/v1/dashboard/*',
    },
    Filtering: {
      method: 'GET',
      endpoint: '**/api/v1/dashboard/?q=*',
    },
  },
  [InterceptItemCategory.Other]: {
    ExploreJson: {
      method: 'POST',
      endpoint: '**/superset/explore_json/**',
    },
    FormDataKey: {
      method: 'POST',
      endpoint: '**/api/v1/explore/form_data',
    },
    ExploreGet: {
      method: 'GET',
      endpoint:
        /api\/v1\/explore\/\?(form_data_key|dashboard_page_id|slice_id)=.*/,
    },
  },
};

export const intercept = (
  page: Page,
  interceptType: { endpoint: string | RegExp; method: string },
) =>
  page.waitForResponse(response => {
    const urlIsMatched =
      typeof interceptType.endpoint === 'string'
        ? minimatch(response.url(), interceptType.endpoint)
        : interceptType.endpoint.test(response.url());
    const healthyResponse = response.status() < 299 && response.status() >= 200;
    const methodIsMatched =
      response.request().method() === interceptType.method;
    return urlIsMatched && healthyResponse && methodIsMatched;
  });

export const setFilter = async (
  page: Page,
  filter: string,
  option: string,
  category: InterceptItemCategory.Chart | InterceptItemCategory.Dashboard,
) => {
  const interceptedFiltering = intercept(
    page,
    InterceptType[category].Filtering,
  );

  await page.getByLabel(filter).first().click();
  await page.getByLabel(filter).getByTitle(option, { exact: true }).click();

  await interceptedFiltering;
};

export const saveChartToDashboard = async (
  page: Page,
  dashboardName: string,
) => {
  const querySaveButton = page.getByTestId('query-save-button');
  await expect(querySaveButton).toBeEnabled();
  await expect(querySaveButton).not.toBeDisabled();
  await querySaveButton.click();

  const chartModals = [];
  for (const chartModal of await page
    .locator('[data-test*=chart-modal]')
    .all()) {
    chartModals.push(expect(chartModal).toBeVisible());
  }
  await Promise.all(chartModals);
  await page
    .getByTestId('save-chart-modal-select-dashboard-form')
    .getByLabel('Select a dashboard')
    .first()
    .click();
  await page
    .getByRole('combobox', { name: 'Select a dashboard' })
    .fill(dashboardName);
  await page
    .locator(`.ant-select-item-option[title="${dashboardName}"]`)
    .click();
  await page.getByTestId('btn-modal-save').click();

  await expect(
    page.getByText(`was added to dashboard [${dashboardName}]`),
  ).toBeVisible();
  await expect(
    page.getByText(`was added to dashboard [${dashboardName}]`),
  ).not.toBeVisible();
};

export const visitSampleChartFromList = async (
  page: Page,
  chartName: string,
) => {
  await page.getByTestId('table-row').getByText(chartName).first().click();
};
