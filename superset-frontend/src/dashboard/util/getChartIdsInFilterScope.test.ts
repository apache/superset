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

/**
 * Creates a minimal valid LayoutItem for testing.
 * Only includes fields required by the type and used by getChartIdsInFilterScope.
 */
const createChartLayoutItem = (
  id: string,
  chartId: number,
  parents: string[],
): LayoutItem => ({
  id,
  type: CHART_TYPE,
  children: [],
  parents,
  meta: {
    chartId,
    height: 100,
    width: 100,
    uuid: `test-uuid-${id}`,
  },
});

const createNestedTabsLayout = (): LayoutItem[] => {
  return [
    createChartLayoutItem('CHART-1', 1, [
      'ROOT_ID',
      'TABS-1',
      'TAB-Parent1',
      'TABS-nested',
      'TAB-P1_Child1',
    ]),
    createChartLayoutItem('CHART-2', 2, [
      'ROOT_ID',
      'TABS-1',
      'TAB-Parent1',
      'TABS-nested',
      'TAB-P1_Child1',
    ]),
    createChartLayoutItem('CHART-3', 3, [
      'ROOT_ID',
      'TABS-1',
      'TAB-Parent1',
      'TABS-nested',
      'TAB-P1_Child2',
    ]),
    createChartLayoutItem('CHART-4', 4, [
      'ROOT_ID',
      'TABS-1',
      'TAB-Parent1',
      'TABS-nested',
      'TAB-P1_Child2',
    ]),
    createChartLayoutItem('CHART-5', 5, ['ROOT_ID', 'TABS-1', 'TAB-Parent2']),
    createChartLayoutItem('CHART-6', 6, ['ROOT_ID', 'TABS-1', 'TAB-Parent2']),
  ];
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

test('filter with selectedLayers should include charts from layer selections', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['ROOT_ID'],
    excluded: [],
    selectedLayers: ['chart-1-layer-0', 'chart-2-layer-1'],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 2, 3, 4, 5, 6]);
});

test('filter with selectedLayers should include both layer-selected charts and regular charts', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['TAB-Parent2'],
    excluded: [],
    selectedLayers: ['chart-1-layer-0'],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 5, 6]);
});

test('filter with selectedLayers should exclude charts that have layer selections from regular filtering', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['TAB-P1_Child1'],
    excluded: [],
    selectedLayers: ['chart-1-layer-0'],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 2]);
});

test('filter with selectedLayers should ignore invalid layer key formats', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['ROOT_ID'],
    excluded: [],
    selectedLayers: [
      'chart-1-layer-0',
      'invalid-format',
      'chart-2-layer-1',
      'chart-invalid-layer-0',
    ],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 2, 3, 4, 5, 6]);
});

test('filter with selectedLayers should handle charts not in chartIds array', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['ROOT_ID'],
    excluded: [],
    selectedLayers: ['chart-1-layer-0', 'chart-999-layer-0'],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 2, 3, 4, 5, 6]);
});

test('filter with selectedLayers should deduplicate chart IDs', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['ROOT_ID'],
    excluded: [],
    selectedLayers: [
      'chart-1-layer-0',
      'chart-1-layer-1',
      'chart-2-layer-0',
      'chart-2-layer-2',
    ],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 2, 3, 4, 5, 6]);
});

test('filter with selectedLayers and rootPath should combine both correctly', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['TAB-Parent2'],
    excluded: [],
    selectedLayers: ['chart-1-layer-0'],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 5, 6]);
});

test('filter with selectedLayers should include charts even if they are in excluded array', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['ROOT_ID'],
    excluded: [1, 2],
    selectedLayers: ['chart-1-layer-0', 'chart-2-layer-0'],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 2, 3, 4, 5, 6]);
});

test('filter with selectedLayers and excluded should exclude regular charts but include layer-selected charts', () => {
  const chartLayoutItems = createNestedTabsLayout();
  const filterScope = {
    rootPath: ['TAB-Parent2'],
    excluded: [5],
    selectedLayers: ['chart-1-layer-0'],
  };

  const chartsInScope = getChartIdsInFilterScope(
    filterScope,
    allChartIds,
    chartLayoutItems,
  );

  expect(chartsInScope.sort()).toEqual([1, 6]);
});
