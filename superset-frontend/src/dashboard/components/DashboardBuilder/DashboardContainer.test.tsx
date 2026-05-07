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
import { render, waitFor } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { storeWithState } from 'spec/fixtures/mockStore';
import mockState from 'spec/fixtures/mockState';
import { sliceId } from 'spec/fixtures/mockChartQueries';
import { NativeFilterType } from '@superset-ui/core';
import { CHART_TYPE } from '../../util/componentTypes';
import DashboardContainer from './DashboardContainer';
import * as nativeFiltersActions from '../../actions/nativeFilters';

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});
fetchMock.put('glob:*/api/v1/dashboard/*/colors*', {});
fetchMock.post('glob:*/superset/log/?*', {});

jest.mock('@visx/responsive', () => ({
  ParentSize: ({
    children,
  }: {
    children: (props: { width: number }) => JSX.Element;
  }) => children({ width: 800 }),
}));

jest.mock('src/dashboard/containers/DashboardGrid', () => ({
  __esModule: true,
  default: () => <div data-test="mock-dashboard-grid" />,
}));

function createTestState(overrides = {}) {
  return {
    ...mockState,
    dashboardState: {
      ...mockState.dashboardState,
      sliceIds: [sliceId],
    },
    dashboardLayout: {
      ...mockState.dashboardLayout,
      present: {
        ...mockState.dashboardLayout.present,
        CHART_ID: {
          id: 'CHART_ID',
          type: CHART_TYPE,
          meta: {
            chartId: sliceId,
            width: 4,
            height: 10,
          },
          parents: ['ROOT_ID', 'GRID_ID', 'ROW_ID'],
        },
      },
    },
    nativeFilters: {
      filters: {
        'FILTER-1': {
          id: 'FILTER-1',
          name: 'Test Filter',
          filterType: 'filter_select',
          targets: [
            {
              datasetId: 1,
              column: { name: 'country' },
            },
          ],
          defaultDataMask: {
            filterState: { value: null },
          },
          cascadeParentIds: [],
          scope: {
            rootPath: ['ROOT_ID'],
            excluded: [],
          },
          controlValues: {},
          type: NativeFilterType.NativeFilter,
        },
      },
    },
    ...overrides,
  };
}

function setup(overrideState = {}) {
  const initialState = createTestState(overrideState);
  return render(<DashboardContainer />, {
    useRedux: true,
    store: storeWithState(initialState),
  });
}

function setupWithStore(overrideState = {}) {
  const initialState = createTestState(overrideState);
  const store = storeWithState(initialState);
  const renderResult = render(<DashboardContainer />, {
    useRedux: true,
    store,
  });
  return { store, ...renderResult };
}

let setInScopeStatusMock: jest.SpyInstance;

beforeEach(() => {
  setInScopeStatusMock = jest.spyOn(
    nativeFiltersActions,
    'setInScopeStatusOfFilters',
  );
  setInScopeStatusMock.mockReturnValue(jest.fn());
});

afterEach(() => {
  setInScopeStatusMock.mockRestore();
});

test('calculates chartsInScope correctly for filters', async () => {
  setup();

  await waitFor(() => {
    expect(setInScopeStatusMock).toHaveBeenCalled();
  });

  expect(setInScopeStatusMock).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        filterId: 'FILTER-1',
        chartsInScope: [sliceId],
      }),
    ]),
  );
});

test('recalculates chartsInScope when filter non-scope properties change', async () => {
  const { store } = setupWithStore();

  await waitFor(() => {
    expect(setInScopeStatusMock).toHaveBeenCalled();
  });

  setInScopeStatusMock.mockClear();

  // Bug scenario: Editing non-scope properties (e.g., "Sort filter values")
  // triggers backend save, but response lacks chartsInScope.
  // The fix ensures useEffect recalculates chartsInScope anyway.
  const initialState = store.getState();
  store.dispatch({
    type: 'SET_NATIVE_FILTERS_CONFIG_COMPLETE',
    filterChanges: [
      {
        ...initialState.nativeFilters.filters['FILTER-1'],
        controlValues: {
          ...initialState.nativeFilters.filters['FILTER-1'].controlValues,
          sortAscending: false,
        },
      },
    ],
  });

  await waitFor(() => {
    expect(setInScopeStatusMock).toHaveBeenCalled();
  });
});

test('handles multiple filters with different scopes', async () => {
  const baseDashboardLayout = mockState.dashboardLayout.present;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { CHART_ID: _removed, ...cleanLayout } = baseDashboardLayout;

  const stateWithMultipleFilters = {
    ...mockState,
    dashboardState: {
      ...mockState.dashboardState,
      sliceIds: [18, 19],
    },
    dashboardLayout: {
      ...mockState.dashboardLayout,
      present: {
        ...cleanLayout,
        CHART_ID_1: {
          id: 'CHART_ID_1',
          type: CHART_TYPE,
          meta: { chartId: 18, width: 4, height: 10 },
          parents: ['ROOT_ID', 'GRID_ID', 'ROW_ID'],
        },
        CHART_ID_2: {
          id: 'CHART_ID_2',
          type: CHART_TYPE,
          meta: { chartId: 19, width: 4, height: 10 },
          parents: ['ROOT_ID', 'GRID_ID', 'ROW_ID'],
        },
      },
    },
    nativeFilters: {
      filters: {
        'FILTER-1': {
          id: 'FILTER-1',
          name: 'Filter 1',
          filterType: 'filter_select',
          targets: [{ datasetId: 1, column: { name: 'country' } }],
          scope: { rootPath: ['ROOT_ID'], excluded: [] },
          controlValues: {},
          type: NativeFilterType.NativeFilter,
        },
        'FILTER-2': {
          id: 'FILTER-2',
          name: 'Filter 2',
          filterType: 'filter_select',
          targets: [{ datasetId: 1, column: { name: 'region' } }],
          scope: { rootPath: ['ROOT_ID'], excluded: [19] },
          controlValues: {},
          type: NativeFilterType.NativeFilter,
        },
      },
    },
  };

  setup(stateWithMultipleFilters);

  await waitFor(() => {
    expect(setInScopeStatusMock).toHaveBeenCalled();
  });

  expect(setInScopeStatusMock).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        filterId: 'FILTER-1',
        chartsInScope: expect.arrayContaining([18, 19]),
      }),
      expect.objectContaining({
        filterId: 'FILTER-2',
        chartsInScope: [18],
      }),
    ]),
  );
});

test('handles filters with no charts in scope', async () => {
  const stateWithExcludedFilter = createTestState({
    nativeFilters: {
      filters: {
        'FILTER-1': {
          id: 'FILTER-1',
          name: 'Excluded Filter',
          filterType: 'filter_select',
          targets: [{ datasetId: 1, column: { name: 'country' } }],
          scope: {
            rootPath: ['ROOT_ID'],
            excluded: [sliceId],
          },
          controlValues: {},
          type: NativeFilterType.NativeFilter,
        },
      },
    },
  });

  setup(stateWithExcludedFilter);

  await waitFor(() => {
    expect(setInScopeStatusMock).toHaveBeenCalled();
  });

  expect(setInScopeStatusMock).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        filterId: 'FILTER-1',
        chartsInScope: [],
      }),
    ]),
  );
});

test('does not dispatch when there are no filters', () => {
  const stateWithoutFilters = createTestState({
    nativeFilters: {
      filters: {},
    },
  });

  setup(stateWithoutFilters);

  expect(setInScopeStatusMock).not.toHaveBeenCalled();
});

test('calculates tabsInScope for filters with tab-scoped charts', async () => {
  const baseDashboardLayout = mockState.dashboardLayout.present;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { CHART_ID: _removed, ...cleanLayout } = baseDashboardLayout;

  const stateWithTabs = {
    ...mockState,
    dashboardState: {
      ...mockState.dashboardState,
      sliceIds: [20, 21, 22],
    },
    dashboardLayout: {
      ...mockState.dashboardLayout,
      present: {
        ...cleanLayout,
        ROOT_ID: {
          id: 'ROOT_ID',
          type: 'ROOT',
          children: ['TABS-1'],
        },
        'TABS-1': {
          id: 'TABS-1',
          type: 'TABS',
          children: ['TAB-A', 'TAB-B'],
          parents: ['ROOT_ID'],
        },
        'TAB-A': {
          id: 'TAB-A',
          type: 'TAB',
          children: ['CHART-A1', 'CHART-A2'],
          parents: ['ROOT_ID', 'TABS-1'],
          meta: { text: 'Tab A' },
        },
        'TAB-B': {
          id: 'TAB-B',
          type: 'TAB',
          children: ['CHART-B1'],
          parents: ['ROOT_ID', 'TABS-1'],
          meta: { text: 'Tab B' },
        },
        'CHART-A1': {
          id: 'CHART-A1',
          type: CHART_TYPE,
          meta: { chartId: 20, width: 4, height: 10 },
          parents: ['ROOT_ID', 'TABS-1', 'TAB-A'],
        },
        'CHART-A2': {
          id: 'CHART-A2',
          type: CHART_TYPE,
          meta: { chartId: 21, width: 4, height: 10 },
          parents: ['ROOT_ID', 'TABS-1', 'TAB-A'],
        },
        'CHART-B1': {
          id: 'CHART-B1',
          type: CHART_TYPE,
          meta: { chartId: 22, width: 4, height: 10 },
          parents: ['ROOT_ID', 'TABS-1', 'TAB-B'],
        },
      },
    },
    nativeFilters: {
      filters: {
        'FILTER-TAB-SCOPED': {
          id: 'FILTER-TAB-SCOPED',
          name: 'Tab Scoped Filter',
          filterType: 'filter_select',
          targets: [{ datasetId: 1, column: { name: 'region' } }],
          scope: { rootPath: ['ROOT_ID'], excluded: [22] },
          controlValues: {},
          type: NativeFilterType.NativeFilter,
        },
      },
    },
  };

  setup(stateWithTabs);

  await waitFor(() => {
    expect(setInScopeStatusMock).toHaveBeenCalled();
  });

  expect(setInScopeStatusMock).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        filterId: 'FILTER-TAB-SCOPED',
        chartsInScope: expect.arrayContaining([20, 21]),
        tabsInScope: expect.arrayContaining(['TAB-A']),
      }),
    ]),
  );
});
