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

import { renderHook } from '@testing-library/react';
import { useSelector } from 'react-redux';
import {
  NativeFilterType,
  Filter,
  Divider,
  ChartCustomizationType,
  type ChartCustomization,
} from '@superset-ui/core';
import {
  useChartCustomizationConfiguration,
  useIsFilterInScope,
  useSelectFiltersInScope,
} from './state';

jest.mock('react-redux', () => {
  const actual = jest.requireActual('react-redux');
  return {
    ...actual,
    useSelector: jest.fn(),
  };
});

beforeEach(() => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: ['TAB_1'] },
      dashboardLayout: {
        present: {
          'CHART-123': {
            type: 'CHART',
            meta: { chartId: 123 },
            parents: ['ROOT_ID', 'TAB_1'],
          },
          TAB_1: { type: 'TAB', id: 'TAB_1' },
        },
      },
    };
    return selector(mockState);
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
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: [] },
      dashboardLayout: { present: {} },
    };
    return selector(mockState);
  });

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

test('filter should be hidden on excluded nested tab even when parent tab is active', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: ['TAB-Parent1', 'TAB-P1_Child2'] },
      dashboardLayout: {
        present: {
          'CHART-1': {
            type: 'CHART',
            meta: { chartId: 1 },
            parents: ['ROOT_ID', 'TAB-Parent1', 'TAB-P1_Child1'],
          },
          'CHART-2': {
            type: 'CHART',
            meta: { chartId: 2 },
            parents: ['ROOT_ID', 'TAB-Parent1', 'TAB-P1_Child1'],
          },
          'CHART-5': {
            type: 'CHART',
            meta: { chartId: 5 },
            parents: ['ROOT_ID', 'TAB-Parent2'],
          },
          'CHART-6': {
            type: 'CHART',
            meta: { chartId: 6 },
            parents: ['ROOT_ID', 'TAB-Parent2'],
          },
          'TAB-Parent1': { type: 'TAB', id: 'TAB-Parent1' },
          'TAB-P1_Child1': { type: 'TAB', id: 'TAB-P1_Child1' },
          'TAB-P1_Child2': { type: 'TAB', id: 'TAB-P1_Child2' },
          'TAB-Parent2': { type: 'TAB', id: 'TAB-Parent2' },
        },
      },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_nested',
    name: 'Nested Tab Filter',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [1, 2, 5, 6],
    scope: { rootPath: ['TAB-P1_Child1', 'TAB-Parent2'], excluded: [3, 4] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Filter excluding P1_Child2',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(false);
});

test('filter should be visible on included nested tab', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: ['TAB-Parent1', 'TAB-P1_Child1'] },
      dashboardLayout: {
        present: {
          'CHART-1': {
            type: 'CHART',
            meta: { chartId: 1 },
            parents: ['ROOT_ID', 'TAB-Parent1', 'TAB-P1_Child1'],
          },
          'CHART-2': {
            type: 'CHART',
            meta: { chartId: 2 },
            parents: ['ROOT_ID', 'TAB-Parent1', 'TAB-P1_Child1'],
          },
          'TAB-Parent1': { type: 'TAB', id: 'TAB-Parent1' },
          'TAB-P1_Child1': { type: 'TAB', id: 'TAB-P1_Child1' },
          'TAB-P1_Child2': { type: 'TAB', id: 'TAB-P1_Child2' },
        },
      },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_nested_visible',
    name: 'Nested Tab Filter Visible',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [1, 2, 5, 6],
    scope: { rootPath: ['TAB-P1_Child1', 'TAB-Parent2'], excluded: [3, 4] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Filter including P1_Child1',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(true);
});

test('filter should be visible on top-level tab when charts have no nested parents', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: ['TAB-Parent2'] },
      dashboardLayout: {
        present: {
          'CHART-5': {
            type: 'CHART',
            meta: { chartId: 5 },
            parents: ['ROOT_ID', 'TAB-Parent2'],
          },
          'CHART-6': {
            type: 'CHART',
            meta: { chartId: 6 },
            parents: ['ROOT_ID', 'TAB-Parent2'],
          },
          'TAB-Parent2': { type: 'TAB', id: 'TAB-Parent2' },
        },
      },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_top_level',
    name: 'Top Level Tab Filter',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [1, 2, 5, 6],
    scope: { rootPath: ['TAB-P1_Child1', 'TAB-Parent2'], excluded: [3, 4] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Filter including Parent2',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(true);
});

test('filter with chartsInScope referencing non-existent chart should still work', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: ['TAB-Parent1'] },
      dashboardLayout: {
        present: {
          'CHART-1': {
            type: 'CHART',
            meta: { chartId: 1 },
            parents: ['ROOT_ID', 'TAB-Parent1'],
          },
          'TAB-Parent1': { type: 'TAB', id: 'TAB-Parent1' },
        },
      },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_missing_chart',
    name: 'Filter With Missing Chart',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [999],
    scope: { rootPath: ['TAB-Parent1'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Filter referencing non-existent chart',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(true);
});

test('filter with mix of existing and non-existent charts in chartsInScope', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: ['TAB-Parent2'] },
      dashboardLayout: {
        present: {
          'CHART-1': {
            type: 'CHART',
            meta: { chartId: 1 },
            parents: ['ROOT_ID', 'TAB-Parent1'],
          },
          'TAB-Parent1': { type: 'TAB', id: 'TAB-Parent1' },
          'TAB-Parent2': { type: 'TAB', id: 'TAB-Parent2' },
        },
      },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_mixed_charts',
    name: 'Filter With Mixed Charts',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [1, 999],
    scope: { rootPath: ['TAB-Parent1'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Filter with mix of existing and non-existent charts',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(true);
});

test('useChartCustomizationConfiguration ignores null items in metadata', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) =>
    selector({
      dashboardInfo: {
        metadata: {
          chart_customization_config: [
            null,
            {
              id: 'CHART_CUSTOMIZATION-1',
              name: 'Dynamic Group By',
              type: ChartCustomizationType.ChartCustomization,
              filterType: 'chart_customization_dynamic_groupby',
              chartsInScope: [101],
              scope: { rootPath: ['ROOT_ID'], excluded: [] },
              controlValues: { canSelectMultiple: false },
              defaultDataMask: {},
              cascadeParentIds: [],
              targets: [{ column: { name: 'status' }, datasetId: 1 }],
              description: 'valid customization',
            } satisfies ChartCustomization,
          ],
        },
      },
      dashboardLayout: {
        present: {
          'CHART-101': {
            type: 'CHART',
            meta: { chartId: 101 },
          },
        },
      },
    }),
  );

  const { result } = renderHook(() => useChartCustomizationConfiguration());

  expect(result.current).toHaveLength(1);
  expect(result.current[0]).toEqual(
    expect.objectContaining({ id: 'CHART_CUSTOMIZATION-1' }),
  );
});

test('useChartCustomizationConfiguration ignores undefined items in metadata', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) =>
    selector({
      dashboardInfo: {
        metadata: {
          chart_customization_config: [
            undefined,
            {
              id: 'CHART_CUSTOMIZATION-1',
              name: 'Dynamic Group By',
              type: ChartCustomizationType.ChartCustomization,
              filterType: 'chart_customization_dynamic_groupby',
              chartsInScope: [101],
              scope: { rootPath: ['ROOT_ID'], excluded: [] },
              controlValues: { canSelectMultiple: false },
              defaultDataMask: {},
              cascadeParentIds: [],
              targets: [{ column: { name: 'status' }, datasetId: 1 }],
              description: 'valid customization',
            } satisfies ChartCustomization,
          ],
        },
      },
      dashboardLayout: {
        present: {
          'CHART-101': {
            type: 'CHART',
            meta: { chartId: 101 },
          },
        },
      },
    }),
  );

  const { result } = renderHook(() => useChartCustomizationConfiguration());

  expect(result.current).toHaveLength(1);
  expect(result.current[0]).toEqual(
    expect.objectContaining({ id: 'CHART_CUSTOMIZATION-1' }),
  );
});

// --- Embedded / hideTab: activeTabs is empty ---
// When an embedded dashboard uses hideTab:true, the Tabs component never
// mounts, so setActiveTab never fires and activeTabs stays []. The same
// empty state occurs transiently on first render of any tabbed dashboard.
//
// useActiveDashboardTabs derives the default first tab from the layout when
// Redux activeTabs is empty, so scope evaluation uses the correct default
// tab instead of either "no tabs active" (blank filter bar) or "all tabs"
// (showing out-of-scope filters).

// Helper: build a layout with ROOT_ID → TABS container → TAB children
function embeddedLayout(extras: Record<string, Record<string, unknown>> = {}) {
  return {
    ROOT_ID: {
      type: 'ROOT',
      id: 'ROOT_ID',
      children: ['TABS-1'],
    },
    'TABS-1': {
      type: 'TABS',
      id: 'TABS-1',
      children: ['TAB-Company', 'TAB-Desktop'],
    },
    'TAB-Company': {
      type: 'TAB',
      id: 'TAB-Company',
      children: ['CHART-1', 'CHART-2'],
    },
    'TAB-Desktop': {
      type: 'TAB',
      id: 'TAB-Desktop',
      children: ['CHART-3'],
    },
    'CHART-1': {
      type: 'CHART',
      meta: { chartId: 1 },
      parents: ['ROOT_ID', 'TAB-Company'],
    },
    'CHART-2': {
      type: 'CHART',
      meta: { chartId: 2 },
      parents: ['ROOT_ID', 'TAB-Company'],
    },
    'CHART-3': {
      type: 'CHART',
      meta: { chartId: 3 },
      parents: ['ROOT_ID', 'TAB-Desktop'],
    },
    ...extras,
  };
}

test('useIsFilterInScope: filter scoped to default tab is in-scope when activeTabs is empty', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: [] },
      dashboardLayout: { present: embeddedLayout() },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_default_tab',
    name: 'Default Tab Filter',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [1, 2],
    scope: { rootPath: ['TAB-Company'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Filter scoped to default (first) tab',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(true);
});

test('useIsFilterInScope: filter scoped only to non-default tab is out-of-scope when activeTabs is empty', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: [] },
      dashboardLayout: { present: embeddedLayout() },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_other_tab',
    name: 'Other Tab Filter',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [3],
    scope: { rootPath: ['TAB-Desktop'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Filter scoped only to non-default tab',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(false);
});

test('useIsFilterInScope: filter with rootPath to default tab is in-scope when activeTabs is empty', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: [] },
      dashboardLayout: { present: embeddedLayout() },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_rootpath_default',
    name: 'RootPath Filter',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    scope: { rootPath: ['TAB-Company'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'column_name' }, datasetId: 1 }],
    description: 'Filter using rootPath to default tab',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  expect(result.current(filter)).toBe(true);
});

test('useSelectFiltersInScope: only default-tab filters are in scope when activeTabs is empty (embedded hideTab)', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: [] },
      dashboardLayout: { present: embeddedLayout() },
    };
    return selector(mockState);
  });

  const filters: Filter[] = [
    {
      id: 'filter_company',
      name: 'Company Tab Filter',
      filterType: 'filter_select',
      type: NativeFilterType.NativeFilter,
      chartsInScope: [1, 2],
      scope: { rootPath: ['TAB-Company'], excluded: [] },
      controlValues: {},
      defaultDataMask: {},
      cascadeParentIds: [],
      targets: [{ column: { name: 'survey_rating' }, datasetId: 1 }],
      description: 'Filter scoped to default tab',
    },
    {
      id: 'filter_desktop_only',
      name: 'Desktop Only Filter',
      filterType: 'filter_select',
      type: NativeFilterType.NativeFilter,
      chartsInScope: [3],
      scope: { rootPath: ['TAB-Desktop'], excluded: [] },
      controlValues: {},
      defaultDataMask: {},
      cascadeParentIds: [],
      targets: [{ column: { name: 'pool_name' }, datasetId: 2 }],
      description: 'Filter scoped only to non-default tab',
    },
  ];

  const { result } = renderHook(() => useSelectFiltersInScope(filters));
  expect(result.current[0]).toHaveLength(1);
  expect(result.current[0][0]).toEqual(
    expect.objectContaining({ id: 'filter_company' }),
  );
  expect(result.current[1]).toHaveLength(1);
  expect(result.current[1][0]).toEqual(
    expect.objectContaining({ id: 'filter_desktop_only' }),
  );
});

test('useSelectFiltersInScope: dividers are always in scope even when activeTabs is empty', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: [] },
      dashboardLayout: { present: embeddedLayout() },
    };
    return selector(mockState);
  });

  const items: (Filter | Divider)[] = [
    {
      id: 'divider_embedded',
      type: NativeFilterType.Divider,
      title: 'Section',
      description: 'Divider in embedded mode',
    },
    {
      id: 'filter_default',
      name: 'Default Tab Filter',
      filterType: 'filter_select',
      type: NativeFilterType.NativeFilter,
      chartsInScope: [1],
      scope: { rootPath: ['TAB-Company'], excluded: [] },
      controlValues: {},
      defaultDataMask: {},
      cascadeParentIds: [],
      targets: [{ column: { name: 'col' }, datasetId: 1 }],
      description: 'Filter in default tab',
    },
  ];

  const { result } = renderHook(() => useSelectFiltersInScope(items));
  expect(result.current[0]).toHaveLength(2);
  expect(result.current[1]).toHaveLength(0);
});

test('useSelectFiltersInScope: correctly scopes chartsInScope filters when activeTabs is populated', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: ['TAB-Company'] },
      dashboardLayout: { present: embeddedLayout() },
    };
    return selector(mockState);
  });

  const filters: Filter[] = [
    {
      id: 'filter_active_tab',
      name: 'Active Tab Filter',
      filterType: 'filter_select',
      type: NativeFilterType.NativeFilter,
      chartsInScope: [1],
      scope: { rootPath: ['TAB-Company'], excluded: [] },
      controlValues: {},
      defaultDataMask: {},
      cascadeParentIds: [],
      targets: [{ column: { name: 'col' }, datasetId: 1 }],
      description: 'Filter scoped to active tab',
    },
    {
      id: 'filter_inactive_tab',
      name: 'Inactive Tab Filter',
      filterType: 'filter_select',
      type: NativeFilterType.NativeFilter,
      chartsInScope: [3],
      scope: { rootPath: ['TAB-Desktop'], excluded: [] },
      controlValues: {},
      defaultDataMask: {},
      cascadeParentIds: [],
      targets: [{ column: { name: 'col' }, datasetId: 2 }],
      description: 'Filter scoped to inactive tab',
    },
  ];

  const { result } = renderHook(() => useSelectFiltersInScope(filters));
  expect(result.current[0]).toHaveLength(1);
  expect(result.current[0][0]).toEqual(
    expect.objectContaining({ id: 'filter_active_tab' }),
  );
  expect(result.current[1]).toHaveLength(1);
  expect(result.current[1][0]).toEqual(
    expect.objectContaining({ id: 'filter_inactive_tab' }),
  );
});

// Layout-derived default-tab fallback edge cases. These pin behavior of
// useActiveDashboardTabs when activeTabs is empty across structural variants
// of dashboardLayout, so the fallback can't silently regress.

test('useIsFilterInScope: dashboard with no top-level tabs (root child is GRID_ID) treats filters as in-scope', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: [] },
      dashboardLayout: {
        present: {
          ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: ['GRID_ID'] },
          GRID_ID: { type: 'GRID', id: 'GRID_ID', children: ['CHART-1'] },
          'CHART-1': {
            type: 'CHART',
            meta: { chartId: 1 },
            parents: ['ROOT_ID', 'GRID_ID'],
          },
        },
      },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_no_tabs',
    name: 'No-tabs filter',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [1],
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'col' }, datasetId: 1 }],
    description: 'Filter on a no-tabs dashboard',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  // Chart has no TAB ancestors → tabParents is empty → considered in-scope.
  expect(result.current(filter)).toBe(true);
});

test('useIsFilterInScope: missing dashboardLayout falls back without crashing', () => {
  (useSelector as jest.Mock).mockImplementation((selector: Function) => {
    const mockState = {
      dashboardState: { activeTabs: [] },
      dashboardLayout: { present: undefined },
    };
    return selector(mockState);
  });

  const filter: Filter = {
    id: 'filter_no_layout',
    name: 'No layout',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [1],
    scope: { rootPath: ['TAB-A'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'col' }, datasetId: 1 }],
    description: 'Filter when layout is missing',
  };

  // The hook should not throw when layout is missing. Without the
  // useActiveDashboardTabs guard, indexing dashboardLayout[ROOT_ID] would
  // crash here.
  const { result } = renderHook(() => useIsFilterInScope());
  expect(() => result.current(filter)).not.toThrow();
});

// Shared fixture for the two nested-tabs tests below. Layout is identical;
// only the redux activeTabs differs (empty for the default-path test,
// inner-only for the hideTab ancestor-merge test).
const nestedTabsLayout = () => ({
  ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: ['TABS-1'] },
  'TABS-1': {
    type: 'TABS',
    id: 'TABS-1',
    children: ['TAB-Outer1', 'TAB-Outer2'],
  },
  'TAB-Outer1': {
    type: 'TAB',
    id: 'TAB-Outer1',
    children: ['TABS-2'],
  },
  'TAB-Outer2': {
    type: 'TAB',
    id: 'TAB-Outer2',
    children: ['CHART-Outer2'],
  },
  'TABS-2': {
    type: 'TABS',
    id: 'TABS-2',
    children: ['TAB-Inner1', 'TAB-Inner2'],
  },
  'TAB-Inner1': {
    type: 'TAB',
    id: 'TAB-Inner1',
    children: ['CHART-Inner1'],
  },
  'TAB-Inner2': {
    type: 'TAB',
    id: 'TAB-Inner2',
    children: ['CHART-Inner2'],
  },
  'CHART-Inner1': {
    type: 'CHART',
    meta: { chartId: 11 },
    parents: ['ROOT_ID', 'TAB-Outer1', 'TABS-2', 'TAB-Inner1'],
  },
  'CHART-Inner2': {
    type: 'CHART',
    meta: { chartId: 12 },
    parents: ['ROOT_ID', 'TAB-Outer1', 'TABS-2', 'TAB-Inner2'],
  },
  'CHART-Outer2': {
    type: 'CHART',
    meta: { chartId: 20 },
    parents: ['ROOT_ID', 'TAB-Outer2'],
  },
});

const mockNestedTabsState = (activeTabs: string[]) => ({
  dashboardState: { activeTabs },
  dashboardLayout: { present: nestedTabsLayout() },
});

test('useIsFilterInScope: deeply nested tabs — default path includes inner-tab default', () => {
  // ROOT → TABS-1 → [TAB-Outer1, TAB-Outer2]
  //                  └─ TAB-Outer1 → TABS-2 → [TAB-Inner1, TAB-Inner2]
  // Default path should be ['TAB-Outer1', 'TAB-Inner1'].
  (useSelector as jest.Mock).mockImplementation((selector: Function) =>
    selector(mockNestedTabsState([])),
  );

  const innerDefaultFilter: Filter = {
    id: 'filter_inner1',
    name: 'Inner default-tab filter',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [11],
    scope: { rootPath: ['TAB-Inner1'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'col' }, datasetId: 1 }],
    description: 'Filter scoped to inner default tab',
  };

  const innerNonDefaultFilter: Filter = {
    ...innerDefaultFilter,
    id: 'filter_inner2',
    chartsInScope: [12],
    scope: { rootPath: ['TAB-Inner2'], excluded: [] },
  };

  const { result } = renderHook(() => useIsFilterInScope());
  // CHART-Inner1's tab parents [TAB-Outer1, TAB-Inner1] are both in default
  // path → in scope.
  expect(result.current(innerDefaultFilter)).toBe(true);
  // CHART-Inner2's tab parent TAB-Inner2 is not in default path → out of scope.
  expect(result.current(innerNonDefaultFilter)).toBe(false);
});

test('useIsFilterInScope: nested Tabs mounted under hideTab:true — outer ancestor merged so outer-tab scoping is preserved', () => {
  // hideTab:true skips the top-level Tabs but a nested Tabs can still mount
  // and dispatch setActiveTab. activeTabs holds only the inner id; without
  // ancestor merging, filters whose charts have tabParents=[outer, inner]
  // would be marked out-of-scope because the outer id is missing.
  (useSelector as jest.Mock).mockImplementation((selector: Function) =>
    selector(mockNestedTabsState(['TAB-Inner1'])),
  );

  const innerActiveFilter: Filter = {
    id: 'filter_inner1_active',
    name: 'Filter scoped to active inner tab',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [11],
    scope: { rootPath: ['TAB-Inner1'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'col' }, datasetId: 1 }],
    description: 'Filter on the active inner tab',
  };

  const otherOuterFilter: Filter = {
    id: 'filter_other_outer',
    name: 'Filter scoped to non-default outer tab',
    filterType: 'filter_select',
    type: NativeFilterType.NativeFilter,
    chartsInScope: [20],
    scope: { rootPath: ['TAB-Outer2'], excluded: [] },
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    targets: [{ column: { name: 'col' }, datasetId: 2 }],
    description: 'Filter on the other outer tab — must stay out of scope',
  };

  const { result } = renderHook(() => useIsFilterInScope());
  // Outer ancestor TAB-Outer1 is merged into the active path → in scope.
  expect(result.current(innerActiveFilter)).toBe(true);
  // TAB-Outer2 is not in the active path → out of scope, scoping preserved.
  expect(result.current(otherOuterFilter)).toBe(false);
});
