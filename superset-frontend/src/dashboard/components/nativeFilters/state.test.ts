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
          'TAB_1': { type: 'TAB', id: 'TAB_1' },
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
