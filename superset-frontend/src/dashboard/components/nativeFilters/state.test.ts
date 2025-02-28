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
  targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
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
      meta: Record<string, any>;
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
        meta: Record<string, any>;
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

  it('should handle filters with multiple charts in different tabs', () => {
    const filter: Filter = {
      ...baseFilter,
      id: 'filter_multi_charts',
      chartsInScope: [123, 456],
      scope: { rootPath: ['TAB_1', 'TAB_2'], excluded: [] },
      description: 'Filter with multiple charts',
    };

    // Replace updateMocks with setupTest
    setupTest({ activeTabs: ['TAB_1'], hasTabs: true });
    const { result: result1 } = renderHook(() => useIsFilterInScope());
    expect(result1.current(filter)).toBe(true);

    setupTest({ activeTabs: ['TAB_1', 'TAB_2'], hasTabs: true });
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

    setupTest({ activeTabs: ['TAB_1'], hasTabs: true });
    const { result } = renderHook(() => useIsFilterInScope());
    expect(result.current(filter)).toBe(true);
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

  it('should show only relevant filters when tabs contain different datasets', () => {
    const multiDatasetLayout = {
      ...defaultLayout,
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

    const dataset10Filter: Filter = {
      ...baseFilter,
      id: 'dataset_10_filter',
      chartsInScope: [123],
      targets: [{ column: { name: 'column_name' }, datasetId: 10 }],
    };

    const dataset20Filter: Filter = {
      ...baseFilter,
      id: 'dataset_20_filter',
      chartsInScope: [456],
      targets: [{ column: { name: 'column_name' }, datasetId: 20 }],
    };

    // Test visibility in Tab 1
    setupTest({
      activeTabs: ['TAB_1'],
      hasTabs: true,
      layout: multiDatasetLayout,
    });
    const { result: result1 } = renderHook(() => useIsFilterInScope());
    expect(result1.current(dataset10Filter)).toBe(true);
    expect(result1.current(dataset20Filter)).toBe(false);

    // Test visibility in Tab 2
    setupTest({
      activeTabs: ['TAB_2'],
      hasTabs: true,
      layout: multiDatasetLayout,
    });
    const { result: result2 } = renderHook(() => useIsFilterInScope());
    expect(result2.current(dataset10Filter)).toBe(false);
    expect(result2.current(dataset20Filter)).toBe(true);

    // Test visibility with both tabs
    setupTest({
      activeTabs: ['TAB_1', 'TAB_2'],
      hasTabs: true,
      layout: multiDatasetLayout,
    });
    const { result: result3 } = renderHook(() => useIsFilterInScope());
    expect(result3.current(dataset10Filter)).toBe(true);
    expect(result3.current(dataset20Filter)).toBe(true);
  });

  it('should handle filters that apply to multiple datasets', () => {
    const multiDatasetLayout = {
      ...defaultLayout,
      CHART_3: {
        type: 'CHART',
        id: 'CHART_3',
        meta: { chartId: 789, datasourceId: 10 }, // Same dataset as CHART_1
        parents: ['TAB_2'],
        children: [],
      },
    };

    const crossTabFilter: Filter = {
      ...baseFilter,
      id: 'cross_tab_filter',
      chartsInScope: [123, 789], // Charts in different tabs but same dataset (id: 10)
      targets: [{ column: { name: 'column_name' }, datasetId: 10 }],
    };

    // Test in Tab 1 (has chart 123)
    setupTest({
      activeTabs: ['TAB_1'],
      hasTabs: true,
      layout: multiDatasetLayout,
    });
    const { result: result1 } = renderHook(() => useIsFilterInScope());
    expect(result1.current(crossTabFilter)).toBe(true);

    // Test in Tab 2 (has chart 789)
    setupTest({
      activeTabs: ['TAB_2'],
      hasTabs: true,
      layout: multiDatasetLayout,
    });
    const { result: result2 } = renderHook(() => useIsFilterInScope());
    expect(result2.current(crossTabFilter)).toBe(true);
  });

  it('should handle basic filter visibility', () => {
    const filter: Filter = {
      ...baseFilter,
      chartsInScope: [123],
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

    const validFilter = {
      ...baseFilter,
      chartsInScope: [123],
      scope: { rootPath: [], excluded: [] },
    };

    const invalidFilter = {
      ...baseFilter,
      chartsInScope: [999],
      scope: { rootPath: [], excluded: [] },
    };

    const { result } = renderHook(() => useIsFilterInScope());
    expect(result.current(validFilter)).toBe(true);
    expect(result.current(invalidFilter)).toBe(false);
  });

  it('should handle filters across multiple tabs', () => {
    const multiTabLayout = {
      ...defaultLayout,
      CHART_3: {
        type: 'CHART',
        id: 'CHART_3',
        meta: { chartId: 789, datasourceId: 10 },
        parents: ['TAB_2'],
        children: [],
      },
    };

    const multiTabFilter: Filter = {
      ...baseFilter,
      chartsInScope: [123, 456],
      scope: { rootPath: ['TAB_1', 'TAB_2'], excluded: [] },
    };

    // Test with TAB_1 active
    setupTest({
      activeTabs: ['TAB_1'],
      hasTabs: true,
      layout: multiTabLayout,
    });
    const { result: result1 } = renderHook(() => useIsFilterInScope());
    expect(result1.current(multiTabFilter)).toBe(true);

    // Test with TAB_2 active
    setupTest({
      activeTabs: ['TAB_2'],
      hasTabs: true,
      layout: multiTabLayout,
    });
    const { result: result2 } = renderHook(() => useIsFilterInScope());
    expect(result2.current(multiTabFilter)).toBe(true);
  });
});

describe('useSelectFiltersInScope', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set initial state with TAB_1 active
    (useSelector as jest.Mock).mockImplementation(selector =>
      selector({
        dashboardState: { activeTabs: ['TAB_1'] },
        dashboardLayout: { present: defaultLayout },
      }),
    );
    (useDashboardHasTabs as jest.Mock).mockReturnValue(true);
  });

  it('should handle filters based on chart visibility', () => {
    const filters: Filter[] = [
      {
        ...baseFilter,
        id: 'filter_1',
        chartsInScope: [123], // Chart in TAB_1
      },
      {
        ...baseFilter,
        id: 'filter_2',
        chartsInScope: [456], // Chart in TAB_2
      },
    ];

    // Test with TAB_1 active
    const { result: result1 } = renderHook(() =>
      useSelectFiltersInScope(filters),
    );
    expect(result1.current[0]).toContainEqual(filters[0]); // filters in scope
    expect(result1.current[1]).toContainEqual(filters[1]); // filters out of scope

    // Test with TAB_2 active
    (useSelector as jest.Mock).mockImplementation(selector =>
      selector({
        dashboardState: { activeTabs: ['TAB_2'] },
        dashboardLayout: { present: defaultLayout },
      }),
    );

    const { result: result2 } = renderHook(() =>
      useSelectFiltersInScope(filters),
    );
    expect(result2.current[0]).toContainEqual(filters[1]); // filters in scope
    expect(result2.current[1]).toContainEqual(filters[0]); // filters out of scope
  });
});
