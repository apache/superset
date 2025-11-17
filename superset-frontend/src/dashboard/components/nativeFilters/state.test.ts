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

import { renderHook } from '@testing-library/react-hooks';
import { useSelector } from 'react-redux';
import { NativeFilterType, Filter, Divider } from '@superset-ui/core';
import { useIsFilterInScope, useSelectFiltersInScope } from './state';

jest.mock('react-redux', () => {
  const actual = jest.requireActual('react-redux');
  return {
    ...actual,
    useSelector: jest.fn(),
  };
});

beforeEach(() => {
  (useSelector as jest.Mock).mockImplementation(selector => {
    if (selector.name === 'useActiveDashboardTabs') {
      return ['TAB_1'];
    }
    return [];
  });
});

test('useIsFilterInScope should return true for dividers (always in scope)', () => {
  const divider: Divider = {
    id: 'divider_1',
    type: NativeFilterType.Divider,
    title: 'Sample Divider',
    description: 'Divider description',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(divider)).toBe(true);
});

test('useIsFilterInScope should return true for filters with charts in active tabs', () => {
  const filter: Filter = {
    id: 'filter_1',
    name: 'Test Filter',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [123],
    scope: { rootPath: ['TAB_1'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Sample filter description',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(true);
});

test('useIsFilterInScope should return false for filters with inactive rootPath', () => {
  const filter: Filter = {
    id: 'filter_3',
    name: 'Test Filter 3',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    scope: { rootPath: ['TAB_99'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 3 }],
    description: 'Sample filter description',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(false);
});

test('useSelectFiltersInScope should return all filters in scope when no tabs exist', () => {
  const filters: Filter[] = [
    {
      id: 'filter_1',
      name: 'Filter 1',
      filterType: 'filter_select',
      type: NativeFilterType.NativeFilter,
      scope: { rootPath: [], excluded: [] },
      controlValues: {},
      defaultDataMask: {},
      cascadeParentIds: [],
      targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
      description: 'Sample filter description',
    },
    {
      id: 'filter_2',
      name: 'Filter 2',
      filterType: 'filter_select',
      type: NativeFilterType.NativeFilter,
      scope: { rootPath: [], excluded: [] },
      controlValues: {},
      defaultDataMask: {},
      cascadeParentIds: [],
      targets: [{ column: { name: 'column_name' }, datasetId: 2 }],
      description: 'Sample filter description',
    },
  ];

  const { result } = renderHook(() => useSelectFiltersInScope(filters));
  expect(result.current[0]).toEqual(filters);
  expect(result.current[1]).toEqual([]);
});

// Tests for filter scope persistence when chartsInScope is missing
// (Bug fix: filters incorrectly marked out of scope after editing non-scope properties)
test('filter without chartsInScope should fall back to rootPath check', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: ['TAB_1'] },
      dashboardLayout: { present: {} },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_fallback',
    name: 'Filter Without Charts',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    scope: { rootPath: ['TAB_1'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Filter with missing chartsInScope',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(true);
});

test('filter with empty chartsInScope array should check rootPath', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: ['TAB_1'] },
      dashboardLayout: { present: {} },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_empty_charts',
    name: 'Filter With Empty Charts',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [],
    scope: { rootPath: ['TAB_1'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Filter with empty chartsInScope',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(true);
});

test('filter without chartsInScope and inactive rootPath should be out of scope', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: ['TAB_1'] },
      dashboardLayout: { present: {} },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_inactive',
    name: 'Inactive Filter',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    scope: { rootPath: ['INACTIVE_TAB'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Filter in inactive tab',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(false);
});

test('filter with ROOT_ID in rootPath should be in scope when chartsInScope is missing', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: ['ROOT_ID'] },
      dashboardLayout: { present: {} },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_root',
    name: 'Global Filter',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Global filter with missing chartsInScope',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(true);
});

test('useSelectFiltersInScope correctly categorizes filters with missing chartsInScope', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: ['TAB_1'] },
      dashboardLayout: {
        present: {
          tab1: { type: 'TAB', id: 'TAB_1' },
        },
      },
    };
    return selector(mockState);
  });

  const filters: Filter[] = [
    {
      id: 'filter_in_scope',
      name: 'In Scope Filter',
      filterType: 'filter_select',
      type: NativeFilterType.NativeFilter,
      scope: { rootPath: ['TAB_1'], excluded: [] },
      controlValues: {},
      defaultDataMask: {},
      cascadeParentIds: [],
      targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
      description: 'Filter that should be in scope',
    },
    {
      id: 'filter_out_scope',
      name: 'Out of Scope Filter',
      filterType: 'filter_select',
      type: NativeFilterType.NativeFilter,
      scope: { rootPath: ['TAB_99'], excluded: [] },
      controlValues: {},
      defaultDataMask: {},
      cascadeParentIds: [],
      targets: [{ column: { name: 'column_name' }, datasetId: 2 }],
      description: 'Filter that should be out of scope',
    },
  ];

  const { result } = renderHook(() => useSelectFiltersInScope(filters));

  expect(result.current[0]).toContainEqual(
    expect.objectContaining({ id: 'filter_in_scope' }),
  );
  expect(result.current[1]).toContainEqual(
    expect.objectContaining({ id: 'filter_out_scope' }),
  );
});

test('filter with chartsInScope takes precedence over rootPath', () => {
  const filter: Filter = {
    id: 'filter_priority',
    name: 'Priority Filter',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [123, 456],
    scope: { rootPath: ['INACTIVE_TAB'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Filter with chartsInScope should ignore rootPath',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(true);
});
