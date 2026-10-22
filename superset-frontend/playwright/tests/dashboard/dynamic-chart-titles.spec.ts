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

import { testWithAssets, expect } from '../../helpers/fixtures';
import { apiGetDashboard, apiPutDashboard } from '../../helpers/api/dashboard';
import { apiGetChart } from '../../helpers/api/chart';
import { DashboardPage } from '../../pages/DashboardPage';
import {
  buildFilterJsonMetadata,
  buildSelectFilter,
  createDashboardWithCharts,
  sliceIdFromChartDataUrl,
} from './dashboard-test-helpers';

testWithAssets(
  'dynamic titles persist per occurrence and follow applied filters',
  async ({ page, testAssets }, testInfo) => {
    testInfo.setTimeout(90000);
    const { dashboardId, charts } = await createDashboardWithCharts(
      page,
      testAssets,
      testInfo,
      {
        datasetName: 'wb_health_population',
        chartNamePrefix: 'dynamic_title',
        chartSpecs: [
          {
            viz_type: 'table',
            params: {
              query_mode: 'raw',
              all_columns: ['country_name'],
              row_limit: 1000,
            },
          },
        ],
        buildLayout: ([chart]) => ({
          DASHBOARD_VERSION_KEY: 'v2',
          ROOT_ID: {
            id: 'ROOT_ID',
            type: 'ROOT',
            children: ['GRID_ID'],
            meta: {},
          },
          GRID_ID: {
            id: 'GRID_ID',
            type: 'GRID',
            parents: ['ROOT_ID'],
            children: ['ROW-1'],
            meta: {},
          },
          HEADER_ID: {
            id: 'HEADER_ID',
            type: 'HEADER',
            children: [],
            meta: { text: 'Dynamic titles' },
          },
          'ROW-1': {
            id: 'ROW-1',
            type: 'ROW',
            parents: ['ROOT_ID', 'GRID_ID'],
            children: ['CHART-first', 'CHART-second'],
            meta: {},
          },
          ...Object.fromEntries(
            ['first', 'second'].map((name, index) => [
              `CHART-${name}`,
              {
                id: `CHART-${name}`,
                type: 'CHART',
                parents: ['ROOT_ID', 'GRID_ID', 'ROW-1'],
                children: [],
                meta: {
                  chartId: chart.id,
                  sliceName: chart.sliceName,
                  sliceNameOverride: index ? 'Comparison' : 'Revenue',
                  width: 6,
                  height: 40,
                },
              },
            ]),
          ),
        }),
        buildJsonMetadata: ({ datasetId, charts: placedCharts }) => {
          const chartIds = placedCharts.map(chart => chart.id);
          return buildFilterJsonMetadata({
            chartsInScope: chartIds,
            nativeFilters: [
              buildSelectFilter({
                datasetId,
                chartsInScope: chartIds,
                column: 'country_name',
                name: 'Country',
                defaultValue: 'Brazil',
              }),
            ],
          });
        },
      },
    );
    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();
    await dashboard.waitForChartsToLoad();
    const holders = page.getByTestId('dashboard-component-chart-holder');
    const first = holders.nth(0);
    const second = holders.nth(1);
    const firstTitle = first.locator('.header-title');
    const secondTitle = second.locator('.header-title');
    await expect(firstTitle).toHaveText('Revenue');
    await expect(secondTitle).toHaveText('Comparison');

    let chartQueries = 0;
    page.on('request', request => {
      if (
        request.method() === 'POST' &&
        request.url().includes('/api/v1/chart/data') &&
        sliceIdFromChartDataUrl(request.url()) === charts[0].id
      ) {
        chartQueries += 1;
      }
    });
    await dashboard.enterEditMode();
    const configureButton = first.getByRole('button', {
      name: 'Configure chart title',
      exact: true,
    });
    const openEditor = async () => {
      await first.hover();
      await first
        .getByRole('button', { name: 'Configure chart title', exact: true })
        .click();
    };
    await openEditor();
    await page.getByLabel('Base title', { exact: true }).fill('Discarded');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByTestId('header-save-button')).toBeDisabled();

    // Reach the action with the keyboard while the pointer is outside the chart.
    await page.mouse.move(0, 0);
    await configureButton.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(configureButton).toBeFocused();
    await expect(first.getByTestId('hover-menu')).toHaveCSS('opacity', '1');
    await page.screenshot({
      path: testInfo.outputPath('keyboard-focus.png'),
      fullPage: true,
    });
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(configureButton).toBeFocused();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(configureButton).toBeFocused();

    await openEditor();
    await page.getByRole('checkbox', { name: 'Use a dynamic title' }).check();
    await page.getByRole('combobox', { name: 'Insert token' }).click();
    await page
      .locator('.ant-select-dropdown:visible')
      .getByText('Country', { exact: true })
      .click();
    await page
      .getByLabel('Title template', { exact: true })
      .fill('{{chart_title}} in {{country}}');
    await page.getByLabel('Base title', { exact: true }).fill('');
    await expect(page.getByTestId('dynamic-title-preview')).toHaveText(
      `${charts[0].sliceName} in Brazil`,
    );
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(configureButton).toBeFocused();
    await openEditor();
    await expect(page.getByLabel('Base title', { exact: true })).toHaveValue(
      charts[0].sliceName,
    );
    await expect(page.getByTestId('dynamic-title-preview')).toHaveText(
      `${charts[0].sliceName} in Brazil`,
    );
    const baseInput = page.getByLabel('Base title', { exact: true });
    await baseInput.click();
    await baseInput.press('End');
    await baseInput.press('x');
    await baseInput.press('Control+z');
    await expect(baseInput).toHaveValue(charts[0].sliceName);
    await baseInput.press('Control+Shift+z');
    await expect(baseInput).toHaveValue(`${charts[0].sliceName}x`);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByTestId('header-save-button')).toBeEnabled();
    await page.getByTestId('undo-action').click();
    await openEditor();
    await page.getByRole('checkbox', { name: 'Use a dynamic title' }).check();
    await page.getByRole('combobox', { name: 'Insert token' }).click();
    await page
      .locator('.ant-select-dropdown:visible')
      .getByText('Country', { exact: true })
      .click();
    await page
      .getByLabel('Title template', { exact: true })
      .fill('{{chart_title}} in {{country}}');
    await page.getByLabel('Base title', { exact: true }).fill('Revenue');
    await expect(page.getByTestId('dynamic-title-preview')).toHaveText(
      'Revenue in Brazil',
    );
    await expect(page.locator('.ant-select-dropdown:visible')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath('title-editor.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.getByTestId('header-save-button')).toBeEnabled();
    await page.getByTestId('undo-action').click();
    await openEditor();
    await expect(
      page.getByRole('checkbox', { name: 'Use a dynamic title' }),
    ).not.toBeChecked();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByTestId('redo-action').click();
    const saved = page.waitForResponse(
      response =>
        response.request().method() === 'PUT' &&
        response.url().endsWith(`/api/v1/dashboard/${dashboardId}`),
    );
    await page.getByTestId('header-save-button').click();
    expect((await saved).ok()).toBe(true);
    await expect(
      page.getByRole('button', { name: 'Edit dashboard', exact: true }),
    ).toBeVisible();
    await expect(firstTitle).toHaveText('Revenue in Brazil');
    await expect(secondTitle).toHaveText('Comparison');
    expect(chartQueries).toBe(0);

    const persisted = (await (await apiGetDashboard(page, dashboardId)).json())
      .result;
    const layout = JSON.parse(persisted.position_json);
    expect(layout['CHART-first'].meta.dynamicTitle.template).toBe(
      '{{chart_title}} in {{country}}',
    );
    expect(layout['CHART-second'].meta.dynamicTitle).toBeUndefined();
    expect(
      (await (await apiGetChart(page, charts[0].id)).json()).result.slice_name,
    ).toBe(charts[0].sliceName);
    await page.reload();
    await expect(firstTitle).toHaveText('Revenue in Brazil');
    await dashboard.waitForChartsToLoad();

    const filterBar = await dashboard.waitForFilterBar();
    await filterBar.selectOption('Portugal');
    await expect(firstTitle).toHaveText('Revenue in Brazil');
    await filterBar.apply();
    await expect(firstTitle).toHaveText('Revenue in Portugal');
    await dashboard.waitForChartsToLoad();
    await expect(first.locator('tbody')).toContainText('Portugal');
    await expect(first.locator('tbody')).not.toContainText('Brazil');
    await expect(secondTitle).toHaveText('Comparison');
    await page.screenshot({
      path: testInfo.outputPath('applied-title.png'),
      fullPage: true,
    });

    await filterBar.clearAll();
    await expect(firstTitle).toHaveText('Revenue in Portugal');
    await filterBar.apply();
    await expect(firstTitle).toHaveText('Revenue');

    const metadata = JSON.parse(persisted.json_metadata);
    metadata.native_filter_configuration[0].scope.excluded = [charts[0].id];
    expect(
      (
        await apiPutDashboard(page, dashboardId, {
          json_metadata: JSON.stringify(metadata),
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await expect(firstTitle).toHaveText('Revenue');
    await dashboard.enterEditMode();
    await openEditor();
    await expect(
      page.getByText('Update or remove invalid tokens: country', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByTestId('dynamic-title-preview')).toHaveText(
      'Revenue',
    );
  },
);
