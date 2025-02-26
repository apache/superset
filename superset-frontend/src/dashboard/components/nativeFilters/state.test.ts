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

import { Divider, Filter, NativeFilterType } from '@superset-ui/core';
import { renderHook } from '@testing-library/react-hooks';
import { useSelector } from 'react-redux';
import { useIsFilterInScope, useSelectFiltersInScope } from './state';

const baseFilter: Filter = {
  id: 'filter_base',
  name: 'Test Filter',
  filterType: 'filter_select',
  type: NativeFilterType.NativeFilter,
  chartsInScope: [],
  scope: { rootPath: [], excluded: [] },
  controlValues: {},
  defaultDataMask: {},
  cascadeParentIds: [],
  targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
  description: 'Sample filter description',
};

const baseDivider: Divider = {
  id: 'divider_1',
  type: NativeFilterType.Divider,
  title: 'Sample Divider',
  description: 'Divider description',
};

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

describe('useIsFilterInScope', () => {
  it('should return true for dividers (always in scope)', () => {
    const { result } = renderHook(() => useIsFilterInScope());
    expect(result.current(baseDivider)).toBe(true);
  });

  it('should return true for filters with charts in active tabs', () => {
    const filter: Filter = {
      ...baseFilter,
      id: 'filter_1',
      chartsInScope: [123],
      scope: { rootPath: ['TAB_1'], excluded: [] },
    };

    const { result } = renderHook(() => useIsFilterInScope());
    expect(result.current(filter)).toBe(true);
  });

  it('should return false for filters with inactive rootPath', () => {
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

  it('should handle filters in multiple tabs correctly', () => {
    const multiTabFilter: Filter = {
      ...baseFilter,
      id: 'filter_4',
      chartsInScope: [123, 456],
      scope: { rootPath: ['TAB_1', 'TAB_2'], excluded: [] },
    };

    // Mock active tabs - only TAB_1 is active
    (useSelector as jest.Mock).mockImplementation(selector =>
      selector.name === 'useActiveDashboardTabs' ? ['TAB_1'] : [],
    );

    const { result: result1 } = renderHook(() => useIsFilterInScope());
    // This will fail because current implementation shows filter if any tab is active
    expect(result1.current(multiTabFilter)).toBe(false);

    // Update mock to have both tabs active
    (useSelector as jest.Mock).mockImplementation(selector =>
      selector.name === 'useActiveDashboardTabs' ? ['TAB_1', 'TAB_2'] : [],
    );

    const { result: result2 } = renderHook(() => useIsFilterInScope());
    // This should pass - filter should be visible when all its tabs are active
    expect(result2.current(multiTabFilter)).toBe(true);
  });

  it('should handle filters with multiple charts in different tabs', () => {
    const filter: Filter = {
      ...baseFilter,
      id: 'filter_multi_charts',
      chartsInScope: [123, 456],
      scope: { rootPath: ['TAB_1', 'TAB_2'], excluded: [] },
      description: 'Filter with multiple charts',
    };

    // Mock only one tab active
    (useSelector as jest.Mock).mockImplementation(selector =>
      selector.name === 'useActiveDashboardTabs' ? ['TAB_1'] : [],
    );

    const { result: result1 } = renderHook(() => useIsFilterInScope());
    expect(result1.current(filter)).toBe(false);

    // Mock all tabs active
    (useSelector as jest.Mock).mockImplementation(selector =>
      selector.name === 'useActiveDashboardTabs' ? ['TAB_1', 'TAB_2'] : [],
    );

    const { result: result2 } = renderHook(() => useIsFilterInScope());
    expect(result2.current(filter)).toBe(true);
  });

  it('should handle filters with no charts but multiple tab paths', () => {
    const filter: Filter = {
      ...baseFilter,
      id: 'filter_no_charts',
      chartsInScope: [],
      scope: { rootPath: ['TAB_1', 'TAB_2'], excluded: [] },
      description: 'Filter with no charts',
    };

    // Test with partial tab activation
    (useSelector as jest.Mock).mockImplementation(selector =>
      selector.name === 'useActiveDashboardTabs' ? ['TAB_1'] : [],
    );

    const { result } = renderHook(() => useIsFilterInScope());
    expect(result.current(filter)).toBe(false);
  });

  it('should handle filters with no rootPath but charts in tabs', () => {
    const filter: Filter = {
      ...baseFilter,
      id: 'filter_no_rootpath',
      chartsInScope: [123],
      scope: { rootPath: [], excluded: [] },
      description: 'Filter with no rootPath',
    };

    const { result } = renderHook(() => useIsFilterInScope());
    expect(result.current(filter)).toBe(true);
  });
});

describe('useSelectFiltersInScope', () => {
  it('should return all filters in scope when no tabs exist', () => {
    const filters: Filter[] = [
      {
        ...baseFilter,
        id: 'filter_1',
      },
      {
        ...baseFilter,
        id: 'filter_2',
        targets: [{ column: { name: 'column_name' }, datasetId: 2 }],
      },
    ];

    const { result } = renderHook(() => useSelectFiltersInScope(filters));
    expect(result.current[0]).toEqual(filters);
    expect(result.current[1]).toEqual([]);
  });
});
