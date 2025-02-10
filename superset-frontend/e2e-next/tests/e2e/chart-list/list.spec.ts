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
import { test, expect, Page } from '@playwright/test';
import { CHART_LIST } from '../../utils/urls';
import { setGridMode, toggleBulkSelect } from '../../utils';
import {
  setFilter,
  visitSampleChartFromList,
  saveChartToDashboard,
  intercept,
  InterceptType,
  InterceptItemCategory,
} from '../explore/utils';
import {
  cleanCharts,
  createSampleCharts,
  createSampleDashboards,
} from '../../utils/helpers';

const orderAlphabetical = (page: Page) =>
  setFilter(page, 'Sort', 'Alphabetical', InterceptItemCategory.Chart);

// const openMenu = async (page: Page) => {
//   await page.getByLabel('more-vert').first().click();
// };

// const openProperties = async (page: Page) => {
//   await openMenu(page);
//   await page.getByTestId('chart-list-edit-option').click();
// };

const confirmDelete = async (page: Page) => {
  await page.getByTestId('delete-modal-input').fill('DELETE');
  await page.getByTestId('modal-confirm-button').click();
};

const visitChartList = async (page: Page) => {
  const interceptedFiltering = intercept(
    page,
    InterceptType[InterceptItemCategory.Chart].Filtering,
  );
  const interceptedFavoriteStatus = intercept(
    page,
    InterceptType[InterceptItemCategory.Chart].FavoriteStatus,
  );
  await page.goto(CHART_LIST);
  await interceptedFiltering;
  await interceptedFavoriteStatus;
};

test.describe('Charts list', () => {
  test.describe('Cross-referenced dashboards', () => {
    test.beforeEach(async ({ page, request }) => {
      await createSampleDashboards(request, page, [0, 1, 2, 3]);
      await createSampleCharts(request, page, [0]);
      await visitChartList(page);
    });

    test('should show the cross-referenced dashboards in the table cell', async ({
      page,
    }) => {
      const interceptedDashboardGet = intercept(
        page,
        InterceptType[InterceptItemCategory.Dashboard].Get,
      );
      await expect(
        page
          .getByTestId('table-row')
          .first()
          .getByTestId('table-row-cell')
          .getByTestId('crosslinks'),
      ).toHaveCount(1);
      const tenthCrossRef = page
        .getByTestId('table-row')
        .nth(10)
        .getByTestId('table-row-cell')
        .getByTestId('crosslinks');
      await expect(tenthCrossRef).toContainText('Supported Charts Dashboard');

      await tenthCrossRef.click();
      await interceptedDashboardGet;
    });

    test('should show the newly added dashboards in a tooltip', async ({
      page,
    }) => {
      await visitSampleChartFromList(page, '1 - Sample chart');

      await saveChartToDashboard(page, '1 - Sample dashboard');
      await saveChartToDashboard(page, '2 - Sample dashboard');
      await saveChartToDashboard(page, '3 - Sample dashboard');

      await visitChartList(page);
      await expect(page.getByTestId('count-crosslinks')).toBeVisible();
    });
  });

  test.describe('list mode', () => {
    test.beforeEach(async ({ page, request }) => {
      await cleanCharts(request);
      await visitChartList(page);
      await setGridMode(page, 'list');
    });

    test('should load rows in list mode', async ({ page }) => {
      expect(page.getByTestId('listview-table')).toBeVisible();

      const sortHeaders = page.getByTestId('sort-header');
      await expect(sortHeaders.nth(1)).toContainText('Name');
      await expect(sortHeaders.nth(2)).toContainText('Type');
      await expect(sortHeaders.nth(3)).toContainText('Dataset');
      await expect(sortHeaders.nth(4)).toContainText('On dashboards');
      await expect(sortHeaders.nth(5)).toContainText('Owners');
      await expect(sortHeaders.nth(6)).toContainText('Last modified');
      await expect(sortHeaders.nth(7)).toContainText('Actions');
    });

    test('should sort correctly in list mode', async ({ page }) => {
      await page.getByTestId('sort-header').nth(1).click();
      await expect(page.getByTestId('table-row').first()).toContainText(
        /(Area Chart)|(1 - Sample chart)|(% Rural)/,
      );
      await page.getByTestId('sort-header').nth(1).click();
      await expect(page.getByTestId('table-row').first()).toContainText(
        "World's Population",
      );
      await page.getByTestId('sort-header').nth(1).click();
    });

    test('should bulk select in list mode', async ({ page }) => {
      await toggleBulkSelect(page);
      await page.locator('#header-toggle-all').click();
      expect(await page.getByLabel('checkbox-on').all()).toHaveLength(26);
      await expect(page.getByTestId('bulk-select-copy')).toContainText(
        '25 Selected',
      );
      const bulkSelected = page.getByTestId('bulk-select-action');
      expect(await bulkSelected.all()).toHaveLength(2);
      expect(bulkSelected).toContainText(['Delete', 'Export']);

      await page.getByTestId('bulk-select-deselect-all').click();
      expect(await page.getByLabel('checkbox-on').all()).toHaveLength(0);
      await expect(page.getByTestId('bulk-select-copy')).toContainText(
        '0 Selected',
      );
      await expect(page.getByTestId('bulk-select-action')).not.toBeAttached();
    });
  });

  test.describe('card mode', () => {
    test.beforeEach(async ({ page }) => {
      await visitChartList(page);
      await setGridMode(page, 'card');
    });

    test('should load rows in card mode', async ({ page }) => {
      await expect(page.getByTestId('listview-table')).not.toBeAttached();
      expect(await page.getByTestId('styled-card').all()).toHaveLength(25);
    });

    test('should bulk select in card mode', async ({ page }) => {
      await toggleBulkSelect(page);
      const styledCards = await page.getByTestId('styled-card').all();
      /* eslint-disable no-await-in-loop */
      for (const styledCard of styledCards) {
        await styledCard.click();
      }
      await expect(page.getByTestId('bulk-select-copy')).toContainText(
        '25 Selected',
      );
      const bulkSelectOptions = page.getByTestId('bulk-select-action');
      expect(await bulkSelectOptions.all()).toHaveLength(2);
      expect(bulkSelectOptions).toContainText(['Delete', 'Export']);
      await page.getByTestId('bulk-select-deselect-all').click();
      await expect(page.getByTestId('bulk-select-copy')).toContainText(
        '0 Selected',
      );
      await expect(page.getByTestId('bulk-select-action')).not.toBeAttached();
    });

    test('should sort in card mode', async ({ page }) => {
      await orderAlphabetical(page);
      await expect(page.getByTestId('styled-card').first()).toContainText(
        /(1 - Sample chart)|(Area Chart)|(% Rural)/,
      );
    });

    test('should preserve other filters when sorting', async ({ page }) => {
      expect(await page.getByTestId('styled-card').all()).toHaveLength(25);
      await setFilter(page, 'Type', 'Big Number', InterceptItemCategory.Chart);
      await setFilter(
        page,
        'Sort',
        'Least recently modified',
        InterceptItemCategory.Chart,
      );
      expect(await page.getByTestId('styled-card').all()).toHaveLength(3);
    });
  });

  test.describe('common actions', () => {
    test.beforeEach(async ({ page, request }) => {
      await createSampleCharts(request, page, [0, 1, 2, 3]);
      await visitChartList(page);
    });

    test('should allow to favorite/unfavorite', async ({ page }) => {
      const interceptedSelectFavoriteChart = intercept(
        page,
        InterceptType[InterceptItemCategory.Chart].SelectFavoriteChart,
      );
      const interceptedUnselectFavoriteChart = intercept(
        page,
        InterceptType[InterceptItemCategory.Chart].UnselectFavoriteChart,
      );

      await setGridMode(page, 'card');
      await orderAlphabetical(page);

      await expect(page.getByTestId('styled-card').first()).toContainText(
        /(1 - Sample chart)|(Area Chart)|(% Rural)/,
      );

      await page
        .getByTestId('styled-card')
        .first()
        .getByLabel('favorite-unselected')
        .click();
      await interceptedSelectFavoriteChart;
      await page
        .getByTestId('styled-card')
        .first()
        .getByLabel('favorite-selected')
        .click();
      await interceptedUnselectFavoriteChart;
      await expect(
        page.getByTestId('styled-card').first().getByLabel('favorite-selected'),
      ).not.toBeAttached();
    });

    test('should bulk delete correctly', async ({ page }) => {
      const interceptBulkDelete = intercept(
        page,
        InterceptType[InterceptItemCategory.Chart].BulkDelete,
      );
      await toggleBulkSelect(page);

      // bulk deletes in card-view
      await setGridMode(page, 'card');
      await orderAlphabetical(page);

      const firstStyledCard = page.getByTestId('styled-card').nth(0);
      expect(firstStyledCard).toContainText('1 - Sample chart');
      await firstStyledCard.click();

      const secondStyledCard = page.getByTestId('styled-card').nth(1);
      expect(secondStyledCard).toContainText('2 - Sample chart');
      await secondStyledCard.click();

      const bulkSelectAction = page.getByTestId('bulk-select-action').nth(0);
      expect(bulkSelectAction).toContainText('Delete');
      await bulkSelectAction.click();

      await confirmDelete(page);
      await interceptBulkDelete;

      await expect(page.getByTestId('styled-card').nth(0)).not.toContainText(
        '1 - Sample chart',
      );
      await expect(page.getByTestId('styled-card').nth(1)).not.toContainText(
        '2 - Sample chart',
      );

      // bulk deletes in list-view
      await setGridMode(page, 'list');
      await expect(page.getByTestId('table-row').nth(0)).toContainText(
        '3 - Sample chart',
      );
      await expect(page.getByTestId('table-row').nth(1)).toContainText(
        '4 - Sample chart',
      );
      const sampleChartDeleteCheckboxes = page
        .getByTestId('table-row')
        .getByRole('checkbox');
      await sampleChartDeleteCheckboxes.nth(0).click();
      await sampleChartDeleteCheckboxes.nth(1).click();

      const bulkSelectAction2 = page.getByTestId('bulk-select-action').nth(0);
      expect(bulkSelectAction2).toContainText('Delete');
      await bulkSelectAction2.click();

      await confirmDelete(page);
      await interceptBulkDelete;

      await expect(page.getByTestId('table-row').nth(0)).not.toContainText(
        '3 - Sample chart',
      );
      await expect(page.getByTestId('table-row').nth(1)).not.toContainText(
        '4 - Sample chart',
      );
    });

    // it('should delete correctly', () => {
    //   interceptDelete();

    //   // deletes in card-view
    //   setGridMode('card');
    //   orderAlphabetical();

    //   cy.getBySel('styled-card').eq(1).contains('1 - Sample chart');
    //   openMenu();
    //   cy.getBySel('chart-list-delete-option').click();
    //   confirmDelete();
    //   cy.wait('@delete');
    //   cy.getBySel('styled-card')
    //     .eq(1)
    //     .should('not.contain', '1 - Sample chart');

    //   // deletes in list-view
    //   setGridMode('list');
    //   cy.getBySel('table-row').eq(1).contains('2 - Sample chart');
    //   cy.getBySel('trash').eq(1).click();
    //   confirmDelete();
    //   cy.wait('@delete');
    //   cy.getBySel('table-row').eq(1).should('not.contain', '2 - Sample chart');
    // });

    // it('should edit correctly', () => {
    //   interceptUpdate();

    //   // edits in card-view
    //   setGridMode('card');
    //   orderAlphabetical();
    //   cy.getBySel('styled-card').eq(1).contains('1 - Sample chart');

    //   // change title
    //   openProperties();
    //   cy.getBySel('properties-modal-name-input').type(' | EDITED');
    //   cy.get('button:contains("Save")').click();
    //   cy.wait('@update');
    //   cy.getBySel('styled-card').eq(1).contains('1 - Sample chart | EDITED');

    //   // edits in list-view
    //   setGridMode('list');
    //   cy.getBySel('edit-alt').eq(1).click();
    //   cy.getBySel('properties-modal-name-input').clear();
    //   cy.getBySel('properties-modal-name-input').type('1 - Sample chart');
    //   cy.get('button:contains("Save")').click();
    //   cy.wait('@update');
    //   cy.getBySel('table-row').eq(1).contains('1 - Sample chart');
    // });
  });
});
