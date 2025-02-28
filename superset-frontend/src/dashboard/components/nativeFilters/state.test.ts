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
  Divider,
  Filter,
  NativeFilterTarget,
  NativeFilterType,
} from '@superset-ui/core';
import { renderHook } from '@testing-library/react-hooks';
import { useSelector } from 'react-redux';
import {
  useDashboardHasTabs,
  useIsFilterInScope,
  useSelectFiltersInScope,
} from './state';

// Mock base objects
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
  targets: [
    {
      column: { name: 'column_name' },
      datasetId: 1,
    },
  ] as [Partial<NativeFilterTarget>],
  description: 'Sample filter description',
};
const baseDivider: Divider = {
  id: 'divider_1',
  type: NativeFilterType.Divider,
  title: 'Sample Divider',
  description: 'Divider description',
};

const defaultLayout = {
  TAB_1: {
    type: 'TAB',
    id: 'TAB_1',
    meta: {},
    children: [],
  },
  TAB_2: {
    type: 'TAB',
    id: 'TAB_2',
    meta: {},
    children: [],
  },
  CHART_1: {
    type: 'CHART',
    id: 'CHART_1',
    meta: { chartId: 123, datasourceId: 10 },
    parents: ['TAB_1'],
    children: [],
  },
  CHART_2: {
    type: 'CHART',
    id: 'CHART_2',
    meta: { chartId: 456, datasourceId: 20 },
    parents: ['TAB_2'],
    children: [],
  },
};

type MockState = {
  activeTabs: string[];
  hasTabs: boolean;
  layout: {
    [key: string]: {
      type: string;
      id: string;
      meta: {
        chartId?: number;
        datasourceId?: number;
      };
      children: string[];
      parents?: string[];
    };
  };
};

type MockStateReturn = {
  dashboardState: {
    activeTabs: string[];
    hasTabs: boolean;
  };
  dashboardLayout: {
    present: {
      [key: string]: {
        type: string;
        id: string;
        meta: {
          chartId?: number;
          datasourceId?: number;
        };
        children: string[];
        parents?: string[];
      };
    };
  };
};

const createMockState = ({
  activeTabs,
  hasTabs,
  layout,
}: MockState): MockStateReturn => ({
  dashboardState: {
    activeTabs,
    hasTabs,
  },
  dashboardLayout: {
    present: hasTabs
      ? layout
      : Object.entries(layout)
          .filter(([key]) => key.startsWith('CHART'))
          .reduce(
            (acc, [key, value]) => ({
              ...acc,
              [key]: { ...value, parents: [] },
            }),
            {},
          ),
  },
});

jest.mock('react-redux');
jest.mock('./state', () => ({
  ...jest.requireActual('./state'),
  useDashboardHasTabs: jest.fn(),
}));

describe('useIsFilterInScope', () => {
  const setupTest = (options: Partial<MockState> = {}) => {
    const state = createMockState({
      activeTabs: ['TAB_1'],
      hasTabs: true,
      layout: defaultLayout,
      ...options,
    });

    (useSelector as jest.Mock).mockImplementation(selector => selector(state));
    (useDashboardHasTabs as jest.Mock).mockReturnValue(
      state.dashboardState.hasTabs,
    );
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  it('should return true for dividers (always in scope)', () => {
    setupTest();
    const { result } = renderHook(() => useIsFilterInScope());
    expect(result.current(baseDivider)).toBe(true);
  });

  it('should return false for filters with inactive rootPath', () => {
    const filter: Filter = {
      ...baseFilter,
      scope: { rootPath: ['TAB_99'], excluded: [] },
      chartsInScope: [],
    };

    setupTest({
      activeTabs: ['TAB_1'],
      hasTabs: true,
      layout: defaultLayout,
    });

    const { result } = renderHook(() => useIsFilterInScope());
    expect(result.current(filter)).toBe(false);

    // Additional test case: Filter with existing but inactive tab
    const inactiveTabFilter: Filter = {
      ...baseFilter,
      scope: { rootPath: ['TAB_2'], excluded: [] },
      chartsInScope: [],
    };

    expect(result.current(inactiveTabFilter)).toBe(false);
  });

  it('should handle filters with no charts but multiple tab paths', () => {
    const filter: Filter = {
      ...baseFilter,
      id: 'filter_no_charts',
      chartsInScope: [],
      scope: { rootPath: ['TAB_1', 'TAB_2'], excluded: [] },
      description: 'Filter with no charts',
    };

    setupTest({ activeTabs: ['TAB_1'], hasTabs: true });
    const { result } = renderHook(() => useIsFilterInScope());
    expect(result.current(filter)).toBe(true);
  });

  it('should handle basic filter visibility', () => {
    const filter: Filter = {
      ...baseFilter,
      chartsInScope: [123],
      targets: [
        {
          column: { name: 'column_name' },
          datasetId: 10,
        },
      ] as [Partial<NativeFilterTarget>],
      scope: { rootPath: ['TAB_1'], excluded: [] },
    };

    setupTest({
      activeTabs: ['TAB_1'],
      hasTabs: true,
      layout: defaultLayout,
    });

    const { result } = renderHook(() => useIsFilterInScope());
    expect(result.current(filter)).toBe(true);
  });

  it('should handle no-tabs scenario', () => {
    setupTest({ hasTabs: false });

    const validFilter: Filter = {
      ...baseFilter,
      chartsInScope: [123],
      targets: [
        {
          column: { name: 'column_name' },
          datasetId: 10,
        },
      ] as [Partial<NativeFilterTarget>],
      scope: { rootPath: [], excluded: [] },
    };

    const { result } = renderHook(() => useIsFilterInScope());
    expect(result.current(validFilter)).toBe(true);
  });

  it('should show filters only in tabs where they are relevant', () => {
    const multiTabLayout = {
      ...defaultLayout,
      CHART_3: {
        type: 'CHART',
        id: 'CHART_3',
        meta: { chartId: 789, datasourceId: 30 }, // Different dataset
        parents: ['TAB_2'],
        children: [],
      },
    };

    // Filter that only works with charts in TAB_1
    const tab1Filter: Filter = {
      ...baseFilter,
      id: 'tab1_filter',
      chartsInScope: [123],
      targets: [
        {
          column: { name: 'column_name' },
          datasetId: 10,
        },
      ] as [Partial<NativeFilterTarget>],
    };

    // Filter that only works with charts in TAB_2
    const tab2Filter: Filter = {
      ...baseFilter,
      id: 'tab2_filter',
      chartsInScope: [789],
      targets: [
        {
          column: { name: 'column_name' },
          datasetId: 30,
        },
      ] as [Partial<NativeFilterTarget>],
    };

    // Test TAB_1 active - should only show tab1Filter
    setupTest({
      activeTabs: ['TAB_1'],
      hasTabs: true,
      layout: multiTabLayout,
    });
    const { result: result1 } = renderHook(() => useIsFilterInScope());
    expect(result1.current(tab1Filter)).toBe(true);
    expect(result1.current(tab2Filter)).toBe(false);

    // Test TAB_2 active - should only show tab2Filter
    setupTest({
      activeTabs: ['TAB_2'],
      hasTabs: true,
      layout: multiTabLayout,
    });
    const { result: result2 } = renderHook(() => useIsFilterInScope());
    expect(result2.current(tab1Filter)).toBe(false);
    expect(result2.current(tab2Filter)).toBe(true);

    // Test both tabs active - each filter should still only show in its relevant tab
    setupTest({
      activeTabs: ['TAB_1', 'TAB_2'],
      hasTabs: true,
      layout: multiTabLayout,
    });
    const { result: result3 } = renderHook(() => useIsFilterInScope());
    expect(result3.current(tab1Filter)).toBe(false); // Should be false because not all active tabs contain its charts
    expect(result3.current(tab2Filter)).toBe(false); // Should be false because not all active tabs contain its charts
  });

  it('should maintain filter visibility after dashboard reload', () => {
    const multiDatasetLayout = {
      ...defaultLayout,
      CHART_3: {
        type: 'CHART',
        id: 'CHART_3',
        meta: { chartId: 789, datasourceId: 30 }, // Different dataset
        parents: ['TAB_2'],
        children: [],
      },
    };

    // Filter for dataset 10 (TAB_1)
    const dataset10Filter: Filter = {
      ...baseFilter,
      id: 'dataset_10_filter',
      chartsInScope: [123],
      targets: [
        {
          column: { name: 'column_name' },
          datasetId: 10,
        },
      ] as [Partial<NativeFilterTarget>],
    };

    // Filter for dataset 30 (TAB_2)
    const dataset30Filter: Filter = {
      ...baseFilter,
      id: 'dataset_30_filter',
      chartsInScope: [789],
      targets: [
        {
          column: { name: 'column_name' },
          datasetId: 30,
        },
      ] as [Partial<NativeFilterTarget>],
    };

    // Test initial load with TAB_2 active
    setupTest({
      activeTabs: ['TAB_2'],
      hasTabs: true,
      layout: multiDatasetLayout,
    });
    const { result: result1 } = renderHook(() => useIsFilterInScope());
    expect(result1.current(dataset10Filter)).toBe(false); // Filter for dataset 10 should be hidden
    expect(result1.current(dataset30Filter)).toBe(true); // Filter for dataset 30 should be visible

    // Simulate dashboard reload - same state should be maintained
    setupTest({
      activeTabs: ['TAB_2'],
      hasTabs: true,
      layout: multiDatasetLayout,
    });
    const { result: result2 } = renderHook(() => useIsFilterInScope());
    expect(result2.current(dataset10Filter)).toBe(false); // Should still be hidden
    expect(result2.current(dataset30Filter)).toBe(true); // Should still be visible
  });

  it('should maintain filter visibility when adding new tabs', () => {
    // Initial layout with just TAB_1 and its chart
    const initialLayout = {
      TAB_1: {
        type: 'TAB',
        id: 'TAB_1',
        meta: {},
        children: [],
      },
      CHART_1: {
        type: 'CHART',
        id: 'CHART_1',
        meta: { chartId: 123, datasourceId: 10 },
        parents: ['TAB_1'],
        children: [],
      },
    };

    // Layout after adding TAB_2 with a different dataset
    const updatedLayout = {
      ...initialLayout,
      TAB_2: {
        type: 'TAB',
        id: 'TAB_2',
        meta: {},
        children: [],
      },
      CHART_2: {
        type: 'CHART',
        id: 'CHART_2',
        meta: { chartId: 456, datasourceId: 20 },
        parents: ['TAB_2'],
        children: [],
      },
    };

    const dataset10Filter: Filter = {
      ...baseFilter,
      id: 'dataset_10_filter',
      chartsInScope: [123],
      targets: [
        {
          column: { name: 'column_name' },
          datasetId: 10,
        },
      ] as [Partial<NativeFilterTarget>],
    };

    // Test initial state with just TAB_1
    setupTest({
      activeTabs: ['TAB_1'],
      hasTabs: true,
      layout: initialLayout,
    });
    const { result: result1 } = renderHook(() => useIsFilterInScope());
    expect(result1.current(dataset10Filter)).toBe(true);

    // Test after adding TAB_2 - filter should still only be visible in TAB_1
    setupTest({
      activeTabs: ['TAB_2'],
      hasTabs: true,
      layout: updatedLayout,
    });
    const { result: result2 } = renderHook(() => useIsFilterInScope());
    expect(result2.current(dataset10Filter)).toBe(false);

    // Test with both tabs active - filter should be out of scope
    setupTest({
      activeTabs: ['TAB_1', 'TAB_2'],
      hasTabs: true,
      layout: updatedLayout,
    });
    const { result: result3 } = renderHook(() => useIsFilterInScope());
    expect(result3.current(dataset10Filter)).toBe(false);
  });
});

describe('useSelectFiltersInScope', () => {
  const setupTest = (options: Partial<MockState> = {}) => {
    const state = createMockState({
      activeTabs: ['TAB_1'],
      hasTabs: true,
      layout: defaultLayout,
      ...options,
    });

    (useSelector as jest.Mock).mockImplementation(selector => selector(state));
    (useDashboardHasTabs as jest.Mock).mockReturnValue(
      state.dashboardState.hasTabs,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle filters based on chart visibility', () => {
    const filters: Filter[] = [
      {
        ...baseFilter,
        id: 'filter_1',
        chartsInScope: [123],
        targets: [
          {
            column: { name: 'column_name' },
            datasetId: 10,
          },
        ] as [Partial<NativeFilterTarget>],
      },
      {
        ...baseFilter,
        id: 'filter_2',
        chartsInScope: [456],
        targets: [
          {
            column: { name: 'column_name' },
            datasetId: 20,
          },
        ] as [Partial<NativeFilterTarget>],
      },
    ];

    // Test with TAB_1 active
    setupTest({
      activeTabs: ['TAB_1'],
      hasTabs: true,
      layout: defaultLayout,
    });

    const { result: result1 } = renderHook(() =>
      useSelectFiltersInScope(filters),
    );
    expect(result1.current[0]).toContainEqual(filters[0]); // filter_1 should be in scope
    expect(result1.current[1]).toContainEqual(filters[1]); // filter_2 should be out of scope

    // Test with TAB_2 active
    setupTest({
      activeTabs: ['TAB_2'],
      hasTabs: true,
      layout: defaultLayout,
    });

    const { result: result2 } = renderHook(() =>
      useSelectFiltersInScope(filters),
    );
    expect(result2.current[0]).toContainEqual(filters[1]); // filter_2 should be in scope
    expect(result2.current[1]).toContainEqual(filters[0]); // filter_1 should be out of scope
  });
});
