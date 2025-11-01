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
import { Filter, NativeFilterType } from '@superset-ui/core';
import nativeFilterReducer from './nativeFilters';
import { SET_NATIVE_FILTERS_CONFIG_COMPLETE } from '../actions/nativeFilters';

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
