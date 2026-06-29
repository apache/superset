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
import {
  CHART_TYPE,
  ROW_TYPE,
  DASHBOARD_ROOT_TYPE,
  DASHBOARD_GRID_TYPE,
} from 'src/dashboard/util/componentTypes';
import {
  DASHBOARD_ROOT_ID,
  DASHBOARD_GRID_ID,
  DASHBOARD_HEADER_ID,
} from 'src/dashboard/util/constants';
import type { LayoutItem } from 'src/dashboard/types';
import buildDashboardLayout, { HydrateChartData } from './buildDashboardLayout';

jest.mock('src/explore/store', () => ({
  applyDefaultFormData: (formData: unknown) => formData,
}));

const makeChart = (sliceId: number, sliceName: string): HydrateChartData => ({
  slice_id: sliceId,
  slice_url: `/explore/${sliceId}`,
  slice_name: sliceName,
  form_data: { slice_id: sliceId, viz_type: 'table', datasource: '1__table' },
  description: '',
  description_markeddown: '',
  owners: [],
  modified: '',
  changed_on: '2020-01-01T00:00:00',
});

const layoutWithChartNode = (
  sliceId: number,
  staleName: string,
): Record<string, LayoutItem> =>
  ({
    [DASHBOARD_ROOT_ID]: {
      type: DASHBOARD_ROOT_TYPE,
      id: DASHBOARD_ROOT_ID,
      children: [DASHBOARD_GRID_ID],
    },
    [DASHBOARD_GRID_ID]: {
      type: DASHBOARD_GRID_TYPE,
      id: DASHBOARD_GRID_ID,
      children: ['ROW-1'],
      parents: [DASHBOARD_ROOT_ID],
    },
    'ROW-1': {
      type: ROW_TYPE,
      id: 'ROW-1',
      children: ['CHART-1'],
      parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID],
    },
    'CHART-1': {
      type: CHART_TYPE,
      id: 'CHART-1',
      children: [],
      parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, 'ROW-1'],
      meta: { chartId: sliceId, sliceName: staleName },
    },
  }) as unknown as Record<string, LayoutItem>;

test('builds chart data structures keyed by slice id', () => {
  const { chartQueries, slices, sliceIds } = buildDashboardLayout({
    dashboardTitle: 'My dashboard',
    positionData: layoutWithChartNode(18, 'Stale name'),
    charts: [makeChart(18, 'Genders')],
    regularUrlParams: {},
  });

  expect(Array.from(sliceIds)).toEqual([18]);
  expect(chartQueries[18].id).toBe(18);
  expect(slices[18]).toMatchObject({ slice_id: 18, slice_name: 'Genders' });
});

test('adds the dashboard header component carrying the title', () => {
  const { layout } = buildDashboardLayout({
    dashboardTitle: 'My dashboard',
    positionData: layoutWithChartNode(18, 'Genders'),
    charts: [makeChart(18, 'Genders')],
    regularUrlParams: {},
  });

  expect(layout[DASHBOARD_HEADER_ID]).toMatchObject({
    id: DASHBOARD_HEADER_ID,
    meta: { text: 'My dashboard' },
  });
});

test('syncs the layout slice name with the current chart name', () => {
  const { layout } = buildDashboardLayout({
    dashboardTitle: 'My dashboard',
    positionData: layoutWithChartNode(18, 'Stale name'),
    charts: [makeChart(18, 'Fresh name')],
    regularUrlParams: {},
  });

  expect((layout['CHART-1'] as LayoutItem).meta.sliceName).toBe('Fresh name');
});

test('appends slices without a layout node into freshly created rows', () => {
  const { layout } = buildDashboardLayout({
    dashboardTitle: 'My dashboard',
    positionData: {},
    charts: [1, 2, 3, 4].map(id => makeChart(id, `Chart ${id}`)),
    regularUrlParams: {},
  });

  const rows = Object.values(layout).filter(item => item.type === ROW_TYPE);
  const exploreCharts = Object.keys(layout).filter(id =>
    id.startsWith(`${CHART_TYPE}-explore-`),
  );

  // 12-column grid, 4-wide charts => 3 per row => 4 charts span 2 rows
  expect(rows).toHaveLength(2);
  expect(exploreCharts).toHaveLength(4);
});

test('merges regular url params into each chart form_data', () => {
  const { chartQueries } = buildDashboardLayout({
    dashboardTitle: 'My dashboard',
    positionData: layoutWithChartNode(18, 'Genders'),
    charts: [makeChart(18, 'Genders')],
    regularUrlParams: { foo: 'bar' },
  });

  expect(chartQueries[18].form_data.url_params).toEqual({ foo: 'bar' });
});
