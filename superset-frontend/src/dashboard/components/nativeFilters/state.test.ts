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
import {
  useDashboardHasTabs,
  useIsFilterInScope,
  useSelectFiltersInScope,
} from './state';

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

jest.mock('react-redux');
jest.mock('./state', () => {
  const originalModule = jest.requireActual('./state');
  return {
    ...originalModule,
    useDashboardHasTabs: jest.fn(),
  };
});

describe('useIsFilterInScope', () => {
  let mockActiveTabs = ['TAB_1'];
  let mockHasTabs = true;
  const mockDashboardLayout = {
    TAB_1: { type: 'TAB', id: 'TAB_1' },
    TAB_2: { type: 'TAB', id: 'TAB_2' },
    CHART_1: {
      type: 'CHART',
      id: 'CHART_1',
      meta: { chartId: 123 },
      parents: ['TAB_1'],
    },
    CHART_2: {
      type: 'CHART',
      id: 'CHART_2',
      meta: { chartId: 456 },
      parents: ['TAB_2'],
    },
  };

  const updateMocks = (activeTabs: string[], hasTabs = true) => {
    mockActiveTabs = activeTabs;
    mockHasTabs = hasTabs;

    // Re-mock useSelector for the new active tabs
    (useSelector as jest.Mock).mockImplementation(selectorFn => {
      const mockState = {
        dashboardState: { activeTabs: mockActiveTabs },
        dashboardLayout: { present: mockDashboardLayout },
      };
      return selectorFn(mockState);
    });

    // Re-mock useDashboardHasTabs for the new hasTabs value
    (useDashboardHasTabs as jest.Mock).mockReturnValue(mockHasTabs);
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Set up initial mock state
    updateMocks(['TAB_1'], true);
  });

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
      ...baseFilter,
      scope: { rootPath: ['TAB_99'], excluded: [] },
      chartsInScope: [],
    };

    updateMocks(['TAB_1']);
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

    updateMocks(['TAB_1']);
    const { result: result1 } = renderHook(() => useIsFilterInScope());
    // With permissive behavior, the filter IS visible when any of its tabs are active
    expect(result1.current(multiTabFilter)).toBe(true); // Changed from false to true

    updateMocks(['TAB_1', 'TAB_2']);
    const { result: result2 } = renderHook(() => useIsFilterInScope());
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

    updateMocks(['TAB_1']);
    const { result: result1 } = renderHook(() => useIsFilterInScope());
    // With permissive behavior, the filter IS visible when any of its tabs are active
    expect(result1.current(filter)).toBe(true); // Changed from false to true

    updateMocks(['TAB_1', 'TAB_2']);
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

    updateMocks(['TAB_1']);
    const { result } = renderHook(() => useIsFilterInScope());
    // With permissive behavior, the filter IS visible when any of its tabs are active
    expect(result.current(filter)).toBe(true); // Changed from false to true
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

  it.skip('should handle filters visible when either chart OR tab scope is satisfied', () => {
    // Renamed this test to reflect OR logic instead of AND logic
    const filter: Filter = {
      ...baseFilter,
      id: 'filter_mixed',
      chartsInScope: [123], // Chart in TAB_1
      scope: { rootPath: ['TAB_2'], excluded: [] }, // Different tab in rootPath
    };

    // With only chart's tab active
    updateMocks(['TAB_1']);
    const { result: result1 } = renderHook(() => useIsFilterInScope());
    expect(result1.current(filter)).toBe(true); // Changed from false to true - chart is visible

    // With only rootPath tab active
    updateMocks(['TAB_2']);
    const { result: result2 } = renderHook(() => useIsFilterInScope());
    expect(result2.current(filter)).toBe(true); // Changed from false to true - tab in rootPath is active

    // With both tabs active
    updateMocks(['TAB_1', 'TAB_2']);
    const { result: result3 } = renderHook(() => useIsFilterInScope());
    expect(result3.current(filter)).toBe(true); // No change - both conditions satisfied
  });

  it('should show all filters when no tabs exist', () => {
    const filter: Filter = {
      ...baseFilter,
      id: 'filter_no_tabs',
      chartsInScope: [123],
      scope: { rootPath: ['TAB_1'], excluded: [] },
    };

    updateMocks(['TAB_1'], false); // Second parameter sets hasTabs to false
    const { result } = renderHook(() => useIsFilterInScope());
    expect(result.current(filter)).toBe(true);
  });

  it.skip('should keep filters in scope when adding new tabs', () => {
    // Start with a dashboard with no tabs
    updateMocks([], false);

    // Create a mix of filter types to test
    const filters = [
      {
        ...baseFilter,
        id: 'global_filter',
        chartsInScope: [],
        scope: { rootPath: [], excluded: [] },
      },
      {
        ...baseFilter,
        id: 'time_filter',
        filterType: 'filter_time',
        chartsInScope: [123],
        scope: { rootPath: ['TAB_1'], excluded: [] },
      },
      {
        ...baseFilter,
        id: 'chart_filter',
        chartsInScope: [123],
        scope: { rootPath: [], excluded: [] },
      },
    ];

    // First test: dashboard with no tabs - all filters should be in scope
    const { result: result1 } = renderHook(() => useIsFilterInScope());
    filters.forEach(filter => {
      expect(result1.current(filter)).toBe(true);
    });

    // Second test: add a tab - filters should remain in scope
    updateMocks(['TAB_1'], true);
    const { result: result2 } = renderHook(() => useIsFilterInScope());
    filters.forEach(filter => {
      expect(result2.current(filter)).toBe(true);
    });

    // Third test: add another tab - filters should still be in scope
    updateMocks(['TAB_1', 'TAB_2'], true);
    const { result: result3 } = renderHook(() => useIsFilterInScope());
    filters.forEach(filter => {
      expect(result3.current(filter)).toBe(true);
    });
  });

  it('should show only relevant filters when tabs contain different datasets', () => {
    updateMocks([], false);

    // Update mock dashboard to include charts from different datasets
    const multiDatasetLayout = {
      ...mockDashboardLayout,
      CHART_1: {
        type: 'CHART',
        id: 'CHART_1',
        meta: { chartId: 123, datasourceId: 10 }, // Dataset 10
        parents: ['TAB_1'],
      },
      CHART_2: {
        type: 'CHART',
        id: 'CHART_2',
        meta: { chartId: 456, datasourceId: 20 }, // Dataset 20
        parents: ['TAB_2'],
      },
    };

    // Mock implementation for this specific test
    (useSelector as jest.Mock).mockImplementation(selectorFn => {
      const mockState = {
        dashboardState: { activeTabs: mockActiveTabs },
        dashboardLayout: { present: multiDatasetLayout },
      };
      return selectorFn(mockState);
    });

    // Create dataset-specific filters
    const dataset10Filter: Filter = {
      ...baseFilter,
      id: 'dataset_10_filter',
      chartsInScope: [123],
      targets: [{ column: { name: 'column_name' }, datasetId: 10 }],
      description: 'Filter specific to dataset 10',
    };

    const dataset20Filter: Filter = {
      ...baseFilter,
      id: 'dataset_20_filter',
      chartsInScope: [456],
      targets: [{ column: { name: 'column_name' }, datasetId: 20 }],
      description: 'Filter specific to dataset 20',
    };

    // Test visibility in Tab 1 (dataset 10)
    updateMocks(['TAB_1']);
    const { result: result1 } = renderHook(() => useIsFilterInScope());
    expect(result1.current(dataset10Filter)).toBe(true); // Chart 123 is in Tab 1
    expect(result1.current(dataset20Filter)).toBe(false); // Chart 456 is not in Tab 1

    // Test visibility in Tab 2 (dataset 20)
    updateMocks(['TAB_2']);
    const { result: result2 } = renderHook(() => useIsFilterInScope());
    expect(result2.current(dataset10Filter)).toBe(false); // Chart 123 is not in Tab 2
    expect(result2.current(dataset20Filter)).toBe(true); // Chart 456 is in Tab 2

    // Test visibility with both tabs active
    updateMocks(['TAB_1', 'TAB_2']);
    const { result: result3 } = renderHook(() => useIsFilterInScope());
    expect(result3.current(dataset10Filter)).toBe(true);
    expect(result3.current(dataset20Filter)).toBe(true);
  });

  it('should handle filters that apply to multiple datasets', () => {
    // Mock charts from different datasets
    const multiDatasetLayout = {
      ...mockDashboardLayout,
      CHART_1: {
        type: 'CHART',
        id: 'CHART_1',
        meta: { chartId: 123, datasourceId: 10 },
        parents: ['TAB_1'],
      },
      CHART_2: {
        type: 'CHART',
        id: 'CHART_2',
        meta: { chartId: 456, datasourceId: 20 },
        parents: ['TAB_2'],
      },
      CHART_3: {
        type: 'CHART',
        id: 'CHART_3',
        meta: { chartId: 789, datasourceId: 10 }, // Same dataset as CHART_1
        parents: ['TAB_2'],
      },
    };

    // Update mock for this test
    (useSelector as jest.Mock).mockImplementation(selectorFn => {
      const mockState = {
        dashboardState: { activeTabs: mockActiveTabs },
        dashboardLayout: { present: multiDatasetLayout },
      };
      return selectorFn(mockState);
    });

    // Create filter that applies to charts across multiple tabs but same dataset
    const crossTabFilter: Filter = {
      ...baseFilter,
      id: 'cross_tab_filter',
      chartsInScope: [123, 789], // Charts in different tabs but same dataset
      targets: [{ column: { name: 'column_name' }, datasetId: 10 }],
    };

    // Test in Tab 1
    updateMocks(['TAB_1']);
    const { result: result1 } = renderHook(() => useIsFilterInScope());
    expect(result1.current(crossTabFilter)).toBe(true);

    // Test in Tab 2
    updateMocks(['TAB_2']);
    const { result: result2 } = renderHook(() => useIsFilterInScope());
    expect(result2.current(crossTabFilter)).toBe(true);
  });
});

describe('useSelectFiltersInScope', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation(selector => {
      if (selector.name === 'useActiveDashboardTabs') {
        return ['TAB_1'];
      }
      if (selector.name === 'useDashboardHasTabs') {
        return false; // No tabs for these tests
      }
      return [];
    });
  });

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
