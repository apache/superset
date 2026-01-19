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
  Filter,
  NativeFilterType,
  ChartCustomization,
  ChartCustomizationType,
} from '@superset-ui/core';
import nativeFilterReducer from './nativeFilters';
import { SET_NATIVE_FILTERS_CONFIG_COMPLETE } from '../actions/nativeFilters';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';

const createMockFilter = (
  id: string,
  chartsInScope?: number[],
  tabsInScope?: string[],
): Filter => ({
  cascadeParentIds: [],
  id,
  name: `Filter ${id}`,
  filterType: 'filter_select',
  targets: [
    {
      datasetId: 0,
      column: {
        name: 'test column',
        displayName: 'test column',
      },
    },
  ],
  defaultDataMask: {
    filterState: {
      value: null,
    },
  },
  scope: {
    rootPath: [],
    excluded: [],
  },
  controlValues: {
    allowsMultipleValues: true,
    isRequired: false,
  },
  type: NativeFilterType.NativeFilter,
  description: '',
  chartsInScope,
  tabsInScope,
});

const createMockChartCustomization = (
  id: string,
  chartsInScope?: number[],
  tabsInScope?: string[],
): ChartCustomization => ({
  id,
  type: ChartCustomizationType.ChartCustomization,
  name: `Chart Customization ${id}`,
  filterType: 'filter_select',
  targets: [
    {
      datasetId: 0,
      column: {
        name: 'test column',
        displayName: 'test column',
      },
    },
  ],
  scope: {
    rootPath: [],
    excluded: [],
  },
  defaultDataMask: {
    filterState: {
      value: null,
    },
  },
  controlValues: {
    sortAscending: true,
  },
  chartsInScope,
  tabsInScope,
});

test('SET_NATIVE_FILTERS_CONFIG_COMPLETE updates filters with complete scope properties', () => {
  const initialState = {
    filters: {
      filter1: createMockFilter('filter1', [1, 2], ['tab1']),
    },
  };

  const action = {
    type: SET_NATIVE_FILTERS_CONFIG_COMPLETE as typeof SET_NATIVE_FILTERS_CONFIG_COMPLETE,
    filterChanges: [createMockFilter('filter1', [3, 4], ['tab2'])],
  };

  const result = nativeFilterReducer(initialState, action);

  expect(result.filters.filter1.chartsInScope).toEqual([3, 4]);
  expect(result.filters.filter1.tabsInScope).toEqual(['tab2']);
});

test('SET_NATIVE_FILTERS_CONFIG_COMPLETE preserves existing chartsInScope when missing from update', () => {
  const initialState = {
    filters: {
      filter1: createMockFilter('filter1', [1, 2, 3], ['tab1']),
    },
  };

  const filterWithoutChartsInScope: Filter = {
    ...createMockFilter('filter1', undefined, ['tab2']),
    chartsInScope: undefined,
  };

  const action = {
    type: SET_NATIVE_FILTERS_CONFIG_COMPLETE as typeof SET_NATIVE_FILTERS_CONFIG_COMPLETE,
    filterChanges: [filterWithoutChartsInScope],
  };

  const result = nativeFilterReducer(initialState, action);

  expect(result.filters.filter1.chartsInScope).toEqual([1, 2, 3]);
  expect(result.filters.filter1.tabsInScope).toEqual(['tab2']);
});

test('SET_NATIVE_FILTERS_CONFIG_COMPLETE preserves existing tabsInScope when missing from update', () => {
  const initialState = {
    filters: {
      filter1: createMockFilter('filter1', [1, 2], ['tab1', 'tab2']),
    },
  };

  const filterWithoutTabsInScope: Filter = {
    ...createMockFilter('filter1', [3, 4], undefined),
    tabsInScope: undefined,
  };

  const action = {
    type: SET_NATIVE_FILTERS_CONFIG_COMPLETE as typeof SET_NATIVE_FILTERS_CONFIG_COMPLETE,
    filterChanges: [filterWithoutTabsInScope],
  };

  const result = nativeFilterReducer(initialState, action);

  expect(result.filters.filter1.chartsInScope).toEqual([3, 4]);
  expect(result.filters.filter1.tabsInScope).toEqual(['tab1', 'tab2']);
});

test('SET_NATIVE_FILTERS_CONFIG_COMPLETE handles undefined scope properties for new filters', () => {
  const initialState = {
    filters: {},
  };

  const filterWithUndefinedScopes: Filter = {
    ...createMockFilter('filter1', undefined, undefined),
    chartsInScope: undefined,
    tabsInScope: undefined,
  };

  const action = {
    type: SET_NATIVE_FILTERS_CONFIG_COMPLETE as typeof SET_NATIVE_FILTERS_CONFIG_COMPLETE,
    filterChanges: [filterWithUndefinedScopes],
  };

  const result = nativeFilterReducer(initialState, action);

  expect(result.filters.filter1.chartsInScope).toBeUndefined();
  expect(result.filters.filter1.tabsInScope).toBeUndefined();
});

test('SET_NATIVE_FILTERS_CONFIG_COMPLETE treats empty arrays as valid scope properties', () => {
  const initialState = {
    filters: {
      filter1: createMockFilter('filter1', [1, 2, 3], ['tab1', 'tab2']),
    },
  };

  const action = {
    type: SET_NATIVE_FILTERS_CONFIG_COMPLETE as typeof SET_NATIVE_FILTERS_CONFIG_COMPLETE,
    filterChanges: [createMockFilter('filter1', [], [])],
  };

  const result = nativeFilterReducer(initialState, action);

  expect(result.filters.filter1.chartsInScope).toEqual([]);
  expect(result.filters.filter1.tabsInScope).toEqual([]);
});

test('HYDRATE_DASHBOARD preserves existing chartsInScope and tabsInScope from state', () => {
  const initialState = {
    filters: {
      filter1: createMockFilter('filter1', [1, 2, 3], ['tab1', 'tab2']),
    },
  };

  const incomingFilterWithoutScopes: Filter = {
    ...createMockFilter('filter1'),
    chartsInScope: undefined,
    tabsInScope: undefined,
  };

  const action = {
    type: HYDRATE_DASHBOARD as typeof HYDRATE_DASHBOARD,
    data: {
      nativeFilters: {
        filters: {
          filter1: incomingFilterWithoutScopes,
        },
      },
    },
  };

  const result = nativeFilterReducer(initialState, action as any);

  expect(result.filters.filter1.chartsInScope).toEqual([1, 2, 3]);
  expect(result.filters.filter1.tabsInScope).toEqual(['tab1', 'tab2']);
});

test('HYDRATE_DASHBOARD uses incoming scopes when provided', () => {
  const initialState = {
    filters: {
      filter1: createMockFilter('filter1', [1, 2, 3], ['tab1', 'tab2']),
    },
  };

  const action = {
    type: HYDRATE_DASHBOARD as typeof HYDRATE_DASHBOARD,
    data: {
      nativeFilters: {
        filters: {
          filter1: createMockFilter('filter1', [4, 5], ['tab3']),
        },
      },
    },
  };

  const result = nativeFilterReducer(initialState, action as any);

  expect(result.filters.filter1.chartsInScope).toEqual([4, 5]);
  expect(result.filters.filter1.tabsInScope).toEqual(['tab3']);
});

test('HYDRATE_DASHBOARD handles new filters without existing state', () => {
  const initialState = {
    filters: {},
  };

  const action = {
    type: HYDRATE_DASHBOARD as typeof HYDRATE_DASHBOARD,
    data: {
      nativeFilters: {
        filters: {
          filter1: createMockFilter('filter1', [1, 2], ['tab1']),
        },
      },
    },
  };

  const result = nativeFilterReducer(initialState, action as any);

  expect(result.filters.filter1.chartsInScope).toEqual([1, 2]);
  expect(result.filters.filter1.tabsInScope).toEqual(['tab1']);
});

test('SET_NATIVE_FILTERS_CONFIG_COMPLETE removes deleted filters from state', () => {
  const initialState = {
    filters: {
      filter1: createMockFilter('filter1', [1, 2], ['tab1']),
      filter2: createMockFilter('filter2', [3, 4], ['tab2']),
      filter3: createMockFilter('filter3', [5, 6], ['tab3']),
    },
  };

  // Backend response only includes filter1 and filter3 (filter2 was deleted)
  const action = {
    type: SET_NATIVE_FILTERS_CONFIG_COMPLETE as typeof SET_NATIVE_FILTERS_CONFIG_COMPLETE,
    filterChanges: [
      createMockFilter('filter1', [1, 2], ['tab1']),
      createMockFilter('filter3', [5, 6], ['tab3']),
    ],
  };

  const result = nativeFilterReducer(initialState, action);

  // filter2 should be removed from state
  expect(result.filters.filter1).toBeDefined();
  expect(result.filters.filter2).toBeUndefined();
  expect(result.filters.filter3).toBeDefined();
  expect(Object.keys(result.filters)).toHaveLength(2);
});

test('SET_NATIVE_FILTERS_CONFIG_COMPLETE removes all filters when backend returns empty array', () => {
  const initialState = {
    filters: {
      filter1: createMockFilter('filter1', [1, 2], ['tab1']),
      filter2: createMockFilter('filter2', [3, 4], ['tab2']),
    },
  };

  const action = {
    type: SET_NATIVE_FILTERS_CONFIG_COMPLETE as typeof SET_NATIVE_FILTERS_CONFIG_COMPLETE,
    filterChanges: [],
  };

  const result = nativeFilterReducer(initialState, action);

  expect(Object.keys(result.filters)).toHaveLength(0);
  expect(result.filters).toEqual({});
});

test('SET_NATIVE_FILTERS_CONFIG_COMPLETE handles mixed Filter and ChartCustomization types', () => {
  const initialState = {
    filters: {
      filter1: createMockFilter('filter1', [1, 2], ['tab1']),
      customization1: createMockChartCustomization(
        'customization1',
        [3, 4],
        ['tab2'],
      ),
    },
  };

  const action = {
    type: SET_NATIVE_FILTERS_CONFIG_COMPLETE as typeof SET_NATIVE_FILTERS_CONFIG_COMPLETE,
    filterChanges: [
      createMockFilter('filter1', [5, 6], ['tab3']),
      createMockChartCustomization('customization1', [7, 8], ['tab4']),
    ],
  };

  const result = nativeFilterReducer(initialState, action);

  expect(result.filters.filter1.chartsInScope).toEqual([5, 6]);
  expect(result.filters.filter1.tabsInScope).toEqual(['tab3']);
  expect(result.filters.customization1.chartsInScope).toEqual([7, 8]);
  expect(result.filters.customization1.tabsInScope).toEqual(['tab4']);
});

test('SET_NATIVE_FILTERS_CONFIG_COMPLETE adds new filters while removing deleted ones', () => {
  const initialState = {
    filters: {
      filter1: createMockFilter('filter1', [1, 2], ['tab1']),
      filter2: createMockFilter('filter2', [3, 4], ['tab2']),
    },
  };

  // Backend response: keep filter1, delete filter2, add filter3
  const action = {
    type: SET_NATIVE_FILTERS_CONFIG_COMPLETE as typeof SET_NATIVE_FILTERS_CONFIG_COMPLETE,
    filterChanges: [
      createMockFilter('filter1', [1, 2], ['tab1']),
      createMockFilter('filter3', [5, 6], ['tab3']),
    ],
  };

  const result = nativeFilterReducer(initialState, action);

  expect(result.filters.filter1).toBeDefined();
  expect(result.filters.filter2).toBeUndefined();
  expect(result.filters.filter3).toBeDefined();
  expect(result.filters.filter3.chartsInScope).toEqual([5, 6]);
  expect(Object.keys(result.filters)).toHaveLength(2);
});

test('SET_NATIVE_FILTERS_CONFIG_COMPLETE treats backend response as source of truth', () => {
  const initialState = {
    filters: {
      filter1: createMockFilter('filter1', [1, 2], ['tab1']),
      filter2: createMockFilter('filter2', [3, 4], ['tab2']),
      filter3: createMockFilter('filter3', [5, 6], ['tab3']),
      customization1: createMockChartCustomization(
        'customization1',
        [7, 8],
        ['tab4'],
      ),
    },
  };

  // Backend only returns filter2 and customization1
  const action = {
    type: SET_NATIVE_FILTERS_CONFIG_COMPLETE as typeof SET_NATIVE_FILTERS_CONFIG_COMPLETE,
    filterChanges: [
      createMockFilter('filter2', [10, 11], ['tab5']),
      createMockChartCustomization('customization1', [12, 13], ['tab6']),
    ],
  };

  const result = nativeFilterReducer(initialState, action);

  // Only filter2 and customization1 should remain
  expect(result.filters.filter1).toBeUndefined();
  expect(result.filters.filter2).toBeDefined();
  expect(result.filters.filter3).toBeUndefined();
  expect(result.filters.customization1).toBeDefined();
  expect(Object.keys(result.filters)).toHaveLength(2);

  // Values should be from backend response
  expect(result.filters.filter2.chartsInScope).toEqual([10, 11]);
  expect(result.filters.filter2.tabsInScope).toEqual(['tab5']);
  expect(result.filters.customization1.chartsInScope).toEqual([12, 13]);
  expect(result.filters.customization1.tabsInScope).toEqual(['tab6']);
});
