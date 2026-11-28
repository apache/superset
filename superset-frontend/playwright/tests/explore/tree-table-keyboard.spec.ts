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
import { Locator, Page } from '@playwright/test';
import { testWithAssets as test, expect } from '../../helpers/fixtures';
import { apiPostChart } from '../../helpers/api/chart';
import {
  apiPostDashboard,
  buildSingleRowDashboardLayout,
} from '../../helpers/api/dashboard';
import { getDatasetByName } from '../../helpers/api/dataset';
import { apiPut } from '../../helpers/api/requests';
import { skipUnlessFeatureEnabled } from '../../helpers/featureFlags';
import { AgGrid } from '../../components/core/AgGrid';
import { ExplorePage } from '../../pages/ExplorePage';
import { DashboardPage } from '../../pages/DashboardPage';

/** Walk real Tab stops, failing if the destination is outside the walk. */
async function tabTo(page: Page, target: Locator, limit = 12): Promise<void> {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate(element => element === document.activeElement))
      return;
  }
  await expect(target).toBeFocused();
}

for (const surface of ['Explore', 'dashboard'] as const) {
  test(`Tree keyboard and Load more scroll in ${surface}`, async ({
    page,
    testAssets,
  }, testInfo) => {
    test.setTimeout(120000);
    await skipUnlessFeatureEnabled(page, 'TABLE_V2_TREE_MODE_ENABLED');
    await skipUnlessFeatureEnabled(page, 'AG_GRID_TABLE_ENABLED');
    const dataset = await getDatasetByName(page, 'video_game_sales');
    expect(
      dataset,
      'video_game_sales is loaded by the E2E examples job',
    ).not.toBeNull();
    const nested = surface === 'dashboard';
    const name = `tree_table_keyboard_${Date.now()}_${testInfo.parallelIndex}`;
    const response = await apiPostChart(page, {
      slice_name: name,
      datasource_id: dataset!.id,
      datasource_type: 'table',
      viz_type: 'ag-grid-table',
      params: JSON.stringify({
        datasource: `${dataset!.id}__table`,
        viz_type: 'ag-grid-table',
        query_mode: 'tree',
        time_range: 'No filter',
        row_limit: 10,
        levels: [
          {
            key: 'platform',
            name: 'Platform',
            id_column: 'platform',
            time_column: 'year',
            columns: ['platform'],
            detail_fields: [],
            sort: ['platform', true],
          },
          ...(nested
            ? [
                {
                  key: 'year',
                  name: 'Year',
                  id_column: 'year',
                  parent_column: 'platform',
                  columns: ['year'],
                  detail_fields: [],
                  children_shown: 2,
                  sort: ['year', true],
                },
              ]
            : []),
          {
            key: 'game',
            name: 'Game',
            name_plural: 'Games',
            id_column: 'name',
            parent_column: nested ? 'year' : 'platform',
            columns: ['name'],
            detail_fields: [],
            children_shown: 2,
            sort: ['name', true],
          },
        ],
      }),
    });
    expect(response.ok()).toBe(true);
    const created: { id: number } = await response.json();
    testAssets.trackChart(created.id);

    let failChild = true;
    let moreRequests = 0;
    await page.route('**/api/v1/chart/data*', async route => {
      const body = route.request().postDataJSON() as {
        result_type?: string;
        queries?: { row_offset?: number; metrics?: { label: string }[] }[];
      };
      if (body.result_type === 'results') {
        if (failChild) {
          failChild = false;
          await route.fulfill({
            status: 500,
            json: { message: 'Forced child query failure' },
          });
          return;
        }
        if (body.queries?.[0]?.row_offset) moreRequests += 1;
        const countIndex =
          body.queries?.findIndex(
            query => query.metrics?.[0]?.label === 'COUNT_DISTINCT(name)',
          ) ?? -1;
        if (countIndex >= 0) {
          const response = await route.fetch();
          if (!response.ok()) {
            await route.fulfill({ response });
            return;
          }
          const json: { result: { data: Record<string, number>[] }[] } =
            await response.json();
          for (const row of json.result[countIndex].data) {
            row['COUNT_DISTINCT(name)'] = Math.min(
              row['COUNT_DISTINCT(name)'],
              6,
            );
          }
          await route.fulfill({ response, json });
          return;
        }
      }
      await route.fallback();
    });
    let chart: Locator;
    if (nested) {
      const dashboard = await apiPostDashboard(page, {
        dashboard_title: name,
        published: true,
        position_json: JSON.stringify(
          buildSingleRowDashboardLayout([
            { id: created.id, sliceName: name, width: 12, height: 48 },
          ]),
        ),
      });
      expect(dashboard.ok()).toBe(true);
      const { id }: { id: number } = await dashboard.json();
      testAssets.trackDashboard(id);
      expect(
        (
          await apiPut(page, `api/v1/chart/${created.id}`, { dashboards: [id] })
        ).ok(),
      ).toBe(true);
      await page.setViewportSize({ width: 1280, height: 460 });
      const dashboardPage = new DashboardPage(page);
      await dashboardPage.gotoById(id);
      chart = dashboardPage.getChart(created.id);
    } else {
      const explore = new ExplorePage(page);
      await explore.goto(created.id);
      chart = explore.getChartContainer();
    }
    const parent = new AgGrid(page, chart.locator('.ag-root-wrapper').first());
    await parent.waitForRows();
    const expand = parent.element
      .locator('[row-index="0"] [col-id="tree_table_expand"] button')
      .first();
    await expand.focus();
    await page.keyboard.press('Enter');
    const area = chart.locator('.ag-full-width-row').first();
    const retry = area.getByRole('button', { name: 'Retry', exact: true });
    await expect(retry).toBeVisible();
    await tabTo(page, retry);
    await expect(retry).toBeFocused();
    await page.keyboard.press('Enter');
    let child = new AgGrid(page, area.locator('.ag-root-wrapper').first());
    await child.waitForRows();
    const header = child.element.getByRole('columnheader').first();
    const parentExpandCell = parent.element
      .locator('[row-index="0"] [col-id="tree_table_expand"]')
      .first();
    await expect(parentExpandCell.locator('button')).toBeFocused();
    await tabTo(page, header);
    await expect(header).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    const parentLastCell = parent.element
      .locator('[row-index="0"] [col-id="platform"]')
      .first();
    await expect(parentLastCell).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(header).toBeFocused();
    let loadMoreArea = area;
    if (nested) {
      await child.element
        .locator('[row-index="0"] [col-id="tree_table_expand"] button')
        .click();
      loadMoreArea = area.locator('.ag-full-width-row').first();
      child = new AgGrid(
        page,
        loadMoreArea.locator('.ag-root-wrapper').first(),
      );
      await child.waitForRows();
    }
    const loadMore = loadMoreArea.getByRole('button', {
      name: 'Load more',
      exact: true,
    });
    await tabTo(page, loadMore, 20);
    await expect(loadMore).toBeFocused();
    const viewport = parent.element.locator('.ag-grid-viewport').first();
    await viewport.evaluate(element => {
      element.style.maxHeight = '130px';
    });
    if (nested) {
      // Position the chart low enough to need both scroll containers.
      await chart.evaluate(element => {
        element.style.marginTop = '350px';
      });
    }
    await loadMore.scrollIntoViewIfNeeded();
    const scrollOffsets = () =>
      viewport.evaluate(element => {
        const offsets = [element.scrollTop];
        for (
          let outer = element.parentElement;
          outer;
          outer = outer.parentElement
        ) {
          offsets.push(outer.scrollTop);
        }
        return offsets;
      });
    const before = await scrollOffsets();
    expect(before[0]).toBeGreaterThan(0);
    if (nested) expect(before.slice(1).some(offset => offset > 0)).toBe(true);
    await expect(loadMore).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => moreRequests).toBe(1);
    await expect.poll(() => child.getRowCount()).toBe(4);
    await expect(loadMore).toBeFocused();
    expect(await scrollOffsets()).toEqual(before);

    const nextParent = (nested ? area : parent.element)
      .locator('[row-index="2"] [col-id="tree_table_expand"] button')
      .first();
    await page.keyboard.press('Tab');
    await expect(nextParent).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(loadMore).toBeFocused();

    // Tab can scroll to reveal its target. Restore the setup for the final batch.
    await viewport.evaluate((element, offsets) => {
      let index = 0;
      for (
        let scroller: Element | null = element;
        scroller;
        scroller = scroller.parentElement
      ) {
        scroller.scrollTop = offsets[index];
        index += 1;
      }
    }, before);
    await loadMore.scrollIntoViewIfNeeded();
    const beforeFinal = await scrollOffsets();
    expect(beforeFinal[0]).toBeGreaterThan(0);
    if (nested)
      expect(beforeFinal.slice(1).some(offset => offset > 0)).toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(() => moreRequests).toBe(2);
    await expect.poll(() => child.getRowCount()).toBe(6);
    const appendedCell = child.element.locator(
      '[row-id="row-4"] [col-id="name"]',
    );
    await expect(appendedCell).toBeFocused();
    expect(await scrollOffsets()).toEqual(beforeFinal);
    await expect(appendedCell).toHaveClass(/\bag-cell-focus\b/);
    await viewport.evaluate(element => {
      element.style.removeProperty('max-height');
    });
    await page.keyboard.press('ArrowUp');
    await expect(
      child.element.locator('[row-id="row-3"] [col-id="name"]'),
    ).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(appendedCell).toBeFocused();
    await tabTo(
      page,
      child.element.locator('[row-id="row-5"] [col-id="name"]'),
    );
    await page.keyboard.press('Tab');
    await expect(nextParent).toBeFocused();
  });
}
