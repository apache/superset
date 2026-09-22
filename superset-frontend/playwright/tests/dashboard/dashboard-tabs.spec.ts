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

import getEmptyLayout from '../../../src/dashboard/util/getEmptyLayout';
import {
  BACKGROUND_TRANSPARENT,
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
} from '../../../src/dashboard/util/constants';
import {
  CHART_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from '../../../src/dashboard/util/componentTypes';
import { testWithAssets, expect } from '../../helpers/fixtures';
import type {
  DashboardLayoutChart,
  DashboardPositionJson,
} from '../../helpers/api/dashboard';
import { TIMEOUT } from '../../utils/constants';
import { DashboardPage } from '../../pages/DashboardPage';
import { createDashboardWithCharts } from './dashboard-test-helpers';

const DATASET_NAME = 'birth_names';
const WIDE_VIEWPORT = { width: 1400, height: 900 };
const NARROW_VIEWPORT = { width: 700, height: 900 };
const TABS_ID = 'TABS-TOP';
const FIRST_TAB_ID = 'TAB-A';
const SECOND_TAB_ID = 'TAB-B';
const ROW_ID = 'ROW-A';

function buildTabbedDashboardLayout(
  charts: readonly DashboardLayoutChart[],
): DashboardPositionJson {
  const [treemap] = charts;
  if (!treemap) {
    throw new Error('Tabbed dashboard layout requires a chart');
  }

  const emptyLayout = getEmptyLayout();
  const chartKey = `CHART-${treemap.id}`;

  return {
    ...emptyLayout,
    [DASHBOARD_GRID_ID]: {
      ...emptyLayout[DASHBOARD_GRID_ID],
      children: [TABS_ID],
    },
    [TABS_ID]: {
      type: TABS_TYPE,
      id: TABS_ID,
      children: [FIRST_TAB_ID, SECOND_TAB_ID],
      parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID],
      meta: {},
    },
    [FIRST_TAB_ID]: {
      type: TAB_TYPE,
      id: FIRST_TAB_ID,
      children: [ROW_ID],
      parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, TABS_ID],
      meta: {
        text: 'Tab A',
        defaultText: 'Tab title',
        placeholder: 'Tab title',
      },
    },
    [SECOND_TAB_ID]: {
      type: TAB_TYPE,
      id: SECOND_TAB_ID,
      children: [],
      parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, TABS_ID],
      meta: {
        text: 'Tab B',
        defaultText: 'Tab title',
        placeholder: 'Tab title',
      },
    },
    [ROW_ID]: {
      type: ROW_TYPE,
      id: ROW_ID,
      children: [chartKey],
      parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, TABS_ID, FIRST_TAB_ID],
      meta: { background: BACKGROUND_TRANSPARENT },
    },
    [chartKey]: {
      type: CHART_TYPE,
      id: chartKey,
      children: [],
      parents: [
        DASHBOARD_ROOT_ID,
        DASHBOARD_GRID_ID,
        TABS_ID,
        FIRST_TAB_ID,
        ROW_ID,
      ],
      meta: {
        chartId: treemap.id,
        width: 12,
        height: 50,
        sliceName: treemap.sliceName,
      },
    },
  };
}

testWithAssets(
  'chart in a hidden tab refits its container after the tab is revealed at a new width',
  async ({ page, testAssets }, testInfo) => {
    testWithAssets.setTimeout(TIMEOUT.SLOW_TEST);

    const { dashboardId, charts } = await createDashboardWithCharts(
      page,
      testAssets,
      testInfo,
      {
        datasetName: DATASET_NAME,
        chartNamePrefix: 'tabs',
        dashboardTitlePrefix: 'tabs_resize',
        chartSpecs: [
          {
            viz_type: 'treemap_v2',
            params: {
              metric: 'count',
              groupby: ['gender'],
              row_limit: 100,
            },
          },
        ],
        buildLayout: buildTabbedDashboardLayout,
      },
    );
    const [treemap] = charts;
    if (!treemap) {
      throw new Error('Dashboard setup did not create the treemap');
    }

    await page.setViewportSize(WIDE_VIEWPORT);

    const dashboard = new DashboardPage(page);
    await dashboard.gotoById(dashboardId);
    await dashboard.waitForLoad();

    const treemapContainer = dashboard
      .getChart(treemap.id)
      .locator('[data-test="chart-container"]');
    await treemapContainer.waitFor({
      state: 'visible',
      timeout: TIMEOUT.API_RESPONSE,
    });
    await dashboard.waitForChartsToLoad();

    const echartsHost = treemapContainer.locator('.echarts-host');
    const widthAtWide = await echartsHost.evaluate(
      (element: HTMLElement) => element.offsetWidth,
    );

    await dashboard.switchDashboardTab('Tab B');
    await page.setViewportSize(NARROW_VIEWPORT);
    await dashboard.switchDashboardTab('Tab A');

    await treemapContainer.waitFor({
      state: 'visible',
      timeout: TIMEOUT.API_RESPONSE,
    });
    await dashboard.waitForChartsToLoad();

    await expect
      .poll(
        () =>
          echartsHost.evaluate((element: HTMLElement) => element.offsetWidth),
        {
          timeout: TIMEOUT.API_RESPONSE,
          message: 'treemap should resize after the hidden tab is revealed',
        },
      )
      .toBeLessThan(widthAtWide);

    // Guards against a container that shrinks via CSS while the chart's
    // rendered content stays at its old (wider) size: offsetWidth alone
    // can't tell the two apart, since it reflects the container's CSS box,
    // not what ECharts actually painted. `.echarts-host` renders its
    // content at exact pixel sizes, so any gap beyond sub-pixel rounding
    // means the content is overflowing rather than having resized with it.
    // ECharts' resize is debounced relative to the CSS reflow the poll
    // above waits on, so this needs its own poll rather than a one-shot
    // read right after.
    await expect
      .poll(
        async () => {
          const { offsetWidth, scrollWidth } = await echartsHost.evaluate(
            (element: HTMLElement) => ({
              offsetWidth: element.offsetWidth,
              scrollWidth: element.scrollWidth,
            }),
          );
          return scrollWidth - offsetWidth;
        },
        {
          timeout: TIMEOUT.API_RESPONSE,
          message: "treemap content should not overflow its container's width",
        },
      )
      .toBeLessThanOrEqual(2);
  },
);
