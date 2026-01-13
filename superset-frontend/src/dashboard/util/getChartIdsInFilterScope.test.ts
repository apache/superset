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
import { getChartIdsInFilterScope } from './getChartIdsInFilterScope';
import { CHART_TYPE } from './componentTypes';
import { LayoutItem } from '../types';

interface TestLayoutItem {
  id: string;
  type: string;
  children: string[];
  parents: string[];
  meta?: { chartId?: number; text?: string };
}

const createNestedTabsLayout = (): LayoutItem[] => {
  const layout: Record<string, TestLayoutItem> = {
    ROOT_ID: {
      id: 'ROOT_ID',
      type: 'ROOT',
      children: ['TABS-1'],
      parents: [],
    },
    'TABS-1': {
      id: 'TABS-1',
      type: 'TABS',
      children: ['TAB-Parent1', 'TAB-Parent2'],
      parents: ['ROOT_ID'],
    },
    'TAB-Parent1': {
      id: 'TAB-Parent1',
      type: 'TAB',
      children: ['TABS-nested'],
      parents: ['ROOT_ID', 'TABS-1'],
      meta: { text: 'Parent1' },
    },
    'TABS-nested': {
      id: 'TABS-nested',
      type: 'TABS',
      children: ['TAB-P1_Child1', 'TAB-P1_Child2'],
      parents: ['ROOT_ID', 'TABS-1', 'TAB-Parent1'],
    },
    'TAB-P1_Child1': {
      id: 'TAB-P1_Child1',
      type: 'TAB',
      children: ['CHART-1', 'CHART-2'],
      parents: ['ROOT_ID', 'TABS-1', 'TAB-Parent1', 'TABS-nested'],
      meta: { text: 'P1_Child1' },
    },
    'TAB-P1_Child2': {
      id: 'TAB-P1_Child2',
      type: 'TAB',
      children: ['CHART-3', 'CHART-4'],
      parents: ['ROOT_ID', 'TABS-1', 'TAB-Parent1', 'TABS-nested'],
      meta: { text: 'P1_Child2' },
    },
    'TAB-Parent2': {
      id: 'TAB-Parent2',
      type: 'TAB',
      children: ['CHART-5', 'CHART-6'],
      parents: ['ROOT_ID', 'TABS-1'],
      meta: { text: 'Parent2' },
    },
    'CHART-1': {
      id: 'CHART-1',
      type: CHART_TYPE,
      children: [],
      parents: [
        'ROOT_ID',
        'TABS-1',
        'TAB-Parent1',
        'TABS-nested',
        'TAB-P1_Child1',
      ],
      meta: { chartId: 1 },
    },
    'CHART-2': {
      id: 'CHART-2',
      type: CHART_TYPE,
      children: [],
      parents: [
        'ROOT_ID',
        'TABS-1',
        'TAB-Parent1',
        'TABS-nested',
        'TAB-P1_Child1',
      ],
      meta: { chartId: 2 },
    },
    'CHART-3': {
      id: 'CHART-3',
      type: CHART_TYPE,
      children: [],
      parents: [
        'ROOT_ID',
        'TABS-1',
        'TAB-Parent1',
        'TABS-nested',
        'TAB-P1_Child2',
      ],
      meta: { chartId: 3 },
    },
    'CHART-4': {
      id: 'CHART-4',
      type: CHART_TYPE,
      children: [],
      parents: [
        'ROOT_ID',
        'TABS-1',
        'TAB-Parent1',
        'TABS-nested',
        'TAB-P1_Child2',
      ],
      meta: { chartId: 4 },
    },
    'CHART-5': {
      id: 'CHART-5',
      type: CHART_TYPE,
      children: [],
      parents: ['ROOT_ID', 'TABS-1', 'TAB-Parent2'],
      meta: { chartId: 5 },
    },
    'CHART-6': {
      id: 'CHART-6',
      type: CHART_TYPE,
      children: [],
      parents: ['ROOT_ID', 'TABS-1', 'TAB-Parent2'],
      meta: { chartId: 6 },
    },
  };

  return Object.values(layout).filter(
    item => item.type === CHART_TYPE,
  ) as unknown as LayoutItem[];
};

const allChartIds = [1, 2, 3, 4, 5, 6];

test('filter scoped to all panels should include all charts', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['ROOT_ID'],
    excluded: [],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 2, 3, 4, 5, 6]);
});

test('filter scoped to Parent1 tab should include only charts in Parent1 (including nested tabs)', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['TAB-Parent1'],
    excluded: [],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 2, 3, 4]);
});

test('filter scoped to Parent2 tab should include only charts in Parent2', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['TAB-Parent2'],
    excluded: [],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([5, 6]);
});

test('filter scoped to P1_Child1 nested tab should include only charts in that tab', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['TAB-P1_Child1'],
    excluded: [],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 2]);
});

test('filter excluding P1_Child2 tab should not include charts 3 and 4', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['TAB-P1_Child1', 'TAB-Parent2'],
    excluded: [3, 4],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 2, 5, 6]);
});

test('filter with ROOT_ID rootPath excluding charts 3 and 4 should work correctly', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['ROOT_ID'],
    excluded: [3, 4],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 2, 5, 6]);
});

test('filter scoped to multiple top-level tabs should include charts from all specified tabs', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['TAB-Parent1', 'TAB-Parent2'],
    excluded: [],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 2, 3, 4, 5, 6]);
});

test('filter scoped to nested tab with exclusion should work', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['TAB-P1_Child1'],
    excluded: [2],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope).toEqual([1]);
});
