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
import { updateDataMask } from 'src/dataMask/actions';
import { getSelectExtraFormData } from 'src/filters/utils';
import { ReactNode } from 'react';
import { Store } from 'redux';
import { DatasourceType, Filters, NativeFilterType } from '@superset-ui/core';
import { act, render } from 'spec/helpers/testing-library';
import {
  CHART_RENDERING_SUCCEEDED,
  CHART_UPDATE_SUCCEEDED,
  CHART_UPDATE_STARTED,
} from 'src/components/Chart/chartAction';
import { buildActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { FiltersBadge } from 'src/dashboard/components/FiltersBadge';
import {
  getMockStoreWithFilters,
  getMockStoreWithNativeFilters,
  getMockStoreWithNativeFiltersButNoValues,
  stateWithFilters,
  storeWithState,
} from 'spec/fixtures/mockStore';
import { sliceId } from 'spec/fixtures/mockChartQueries';
import { dashboardFilters } from 'spec/fixtures/mockDashboardFilters';
import { dashboardWithFilter } from 'spec/fixtures/mockDashboardLayout';

// Mock for auto-refresh context
let mockIsAutoRefreshing = false;

jest.mock('src/dashboard/contexts/AutoRefreshContext', () => ({
  useIsAutoRefreshing: () => mockIsAutoRefreshing,
}));

jest.mock('src/dashboard/components/FiltersBadge/DetailsPanel', () => {
  const MockDetailsPanel = ({ children }: { children: ReactNode }) => (
    <div data-test="mock-details-panel">{children}</div>
  );
  return MockDetailsPanel;
});

const defaultStore = getMockStoreWithFilters();
function setup(store: Store = defaultStore) {
  return render(<FiltersBadge chartId={sliceId} />, { store });
}

test.each([DatasourceType.Table, DatasourceType.SemanticView])(
  'only shows rejected dashboard filters for semantic views: %s',
  datasourceType => {
    const store = storeWithState({
      ...stateWithFilters,
      charts: {
        ...stateWithFilters.charts,
        [sliceId]: {
          ...stateWithFilters.charts[sliceId],
          form_data: {
            ...stateWithFilters.charts[sliceId].form_data,
            datasource: `1__${datasourceType}`,
          },
        },
      },
    });
    store.dispatch({
      type: CHART_UPDATE_SUCCEEDED,
      key: sliceId,
      queriesResponse: [
        {
          status: 'success',
          applied_filters: [],
          rejected_filters: [{ column: 'region' }],
        },
      ],
      dashboardFilters,
    });
    const { queryByTestId, getByRole } = setup(store);
    if (datasourceType === DatasourceType.SemanticView) {
      expect(getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
    } else {
      expect(queryByTestId('applied-filter-count')).not.toBeInTheDocument();
    }
  },
);

// there's this bizarre "active filters" thing
// that doesn't actually use any kind of state management.
// Have to set variables in there.
buildActiveFilters({
  dashboardFilters,
  components: dashboardWithFilter,
});

beforeEach(() => {
  // Reset auto-refresh state before each test
  mockIsAutoRefreshing = false;
});

// Dashboard filters tests
test('dashboard filters: does not show number when there are no active filters', () => {
  const store = getMockStoreWithFilters();
  store.dispatch({
    type: CHART_UPDATE_SUCCEEDED,
    key: sliceId,
    queriesResponse: [
      {
        status: 'success',
        applied_filters: [],
        rejected_filters: [],
      },
    ],
    dashboardFilters,
  });
  const { queryByTestId } = setup(store);
  expect(queryByTestId('applied-filter-count')).not.toBeInTheDocument();
});

test('dashboard filters: shows the indicator when filters have been applied', () => {
  const store = getMockStoreWithFilters();
  store.dispatch({
    type: CHART_UPDATE_SUCCEEDED,
    key: sliceId,
    queriesResponse: [
      {
        status: 'success',
        applied_filters: [{ column: 'region' }],
        rejected_filters: [],
      },
    ],
    dashboardFilters,
  });
  store.dispatch({ type: CHART_RENDERING_SUCCEEDED, key: sliceId });
  const { getByTestId } = setup(store);
  expect(getByTestId('applied-filter-count')).toHaveTextContent('1');
  expect(getByTestId('mock-details-panel')).toBeInTheDocument();
});

// Native filters tests
test('native filters: does not show number when there are no active filters', () => {
  const store = getMockStoreWithNativeFiltersButNoValues();
  store.dispatch({
    type: CHART_UPDATE_SUCCEEDED,
    key: sliceId,
    queriesResponse: [
      {
        status: 'success',
        applied_filters: [],
        rejected_filters: [],
      },
    ],
  });
  store.dispatch({ type: CHART_RENDERING_SUCCEEDED, key: sliceId });
  const { queryByTestId } = setup(store);
  expect(queryByTestId('applied-filter-count')).not.toBeInTheDocument();
});

test('native filters: shows the indicator when filters have been applied', () => {
  const store = getMockStoreWithNativeFilters();
  store.dispatch({
    type: CHART_UPDATE_SUCCEEDED,
    key: sliceId,
    queriesResponse: [
      {
        status: 'success',
        applied_filters: [{ column: 'region' }],
        rejected_filters: [],
      },
    ],
  });
  store.dispatch({ type: CHART_RENDERING_SUCCEEDED, key: sliceId });
  const { getByTestId } = setup(store);
  expect(getByTestId('applied-filter-count')).toHaveTextContent('1');
  expect(getByTestId('mock-details-panel')).toBeInTheDocument();
});

// Auto-refresh tests
test('auto-refresh: preserves indicator count during loading state', () => {
  const store = getMockStoreWithNativeFilters();

  // First, set up a chart with applied filters in rendered state
  store.dispatch({
    type: CHART_UPDATE_SUCCEEDED,
    key: sliceId,
    queriesResponse: [
      {
        status: 'success',
        applied_filters: [{ column: 'region' }],
        rejected_filters: [],
      },
    ],
  });
  store.dispatch({ type: CHART_RENDERING_SUCCEEDED, key: sliceId });

  // Render with filters applied
  const { getByTestId, rerender } = render(<FiltersBadge chartId={sliceId} />, {
    store,
  });

  // Verify badge is visible with count 1
  expect(getByTestId('applied-filter-count')).toHaveTextContent('1');

  // Now simulate auto-refresh by setting the context
  mockIsAutoRefreshing = true;

  // Dispatch loading state (simulating auto-refresh started)
  store.dispatch({
    type: CHART_UPDATE_STARTED,
    key: sliceId,
  });

  // Re-render to pick up the state changes
  rerender(<FiltersBadge chartId={sliceId} />);

  // Badge should still be visible during auto-refresh loading
  expect(getByTestId('applied-filter-count')).toHaveTextContent('1');
});

test('manual refresh: clears indicators during loading state', () => {
  const store = getMockStoreWithNativeFilters();

  // First, set up a chart with applied filters in rendered state
  store.dispatch({
    type: CHART_UPDATE_SUCCEEDED,
    key: sliceId,
    queriesResponse: [
      {
        status: 'success',
        applied_filters: [{ column: 'region' }],
        rejected_filters: [],
      },
    ],
  });
  store.dispatch({ type: CHART_RENDERING_SUCCEEDED, key: sliceId });

  // Render with filters applied
  const { getByTestId, queryByTestId, rerender } = render(
    <FiltersBadge chartId={sliceId} />,
    { store },
  );

  // Verify badge is visible with count 1
  expect(getByTestId('applied-filter-count')).toHaveTextContent('1');

  // Keep auto-refresh as false (manual refresh)
  mockIsAutoRefreshing = false;

  // Dispatch loading state (simulating manual refresh)
  store.dispatch({
    type: CHART_UPDATE_STARTED,
    key: sliceId,
  });

  // Re-render to pick up the state changes
  rerender(<FiltersBadge chartId={sliceId} />);

  // Badge should disappear during manual refresh loading
  expect(queryByTestId('applied-filter-count')).not.toBeInTheDocument();
});

test('shows skipped ordinary filters even when the server reports none rejected', () => {
  const initial = getMockStoreWithNativeFilters().getState();
  const nativeFilters = Object.fromEntries(
    Object.entries<Filters[string]>(initial.nativeFilters.filters).map(
      ([id, filter]) => [
        id,
        {
          ...filter,
          filterType: 'filter_select',
          targets: [
            {
              datasetId: 12,
              datasourceType: DatasourceType.Table,
              column: { name: 'region' },
            },
          ],
          chartsInScope: [sliceId],
        },
      ],
    ),
  );
  const dataMask = Object.fromEntries(
    Object.keys(nativeFilters).map(id => [
      id,
      {
        id,
        filterState: { value: ['US'] },
        extraFormData: { filters: [{ col: 'region', op: 'IN', val: ['US'] }] },
      },
    ]),
  );
  const store = storeWithState({
    ...initial,
    dataMask,
    nativeFilters: { ...initial.nativeFilters, filters: nativeFilters },
    charts: {
      ...initial.charts,
      [sliceId]: {
        ...initial.charts[sliceId],
        form_data: {
          ...initial.charts[sliceId].form_data,
          datasource: '3__semantic_view',
          semantic_selection_version: 'cube-member-id-v1',
        },
      },
    },
  });
  store.dispatch({
    type: CHART_UPDATE_SUCCEEDED,
    key: sliceId,
    queriesResponse: [
      { status: 'success', applied_filters: [], rejected_filters: [] },
    ],
  });
  const { getByRole } = setup(store);
  expect(
    getByRole('button', {
      name: `Filters (${Object.keys(nativeFilters).length})`,
    }),
  ).toBeInTheDocument();
  expect(getByRole('button')).not.toHaveAccessibleName(/Applied filters/);
});

test.each([
  { semanticSelected: false, requiredEmpty: false, foreign: false },
  { semanticSelected: true, requiredEmpty: false, foreign: false },
  { semanticSelected: false, requiredEmpty: true, foreign: false },
  { semanticSelected: false, requiredEmpty: true, foreign: true },
  { semanticSelected: false, requiredEmpty: false, foreign: true },
])(
  'same-named incompatible filter remains visible: %j',
  ({ semanticSelected, requiredEmpty, foreign }) => {
    const initial = getMockStoreWithNativeFilters().getState();
    const nativeFilters: Filters = Object.fromEntries(
      ['sql', 'semantic'].map(id => [
        id,
        {
          id,
          name: 'Country',
          type: NativeFilterType.NativeFilter,
          filterType: 'filter_select',
          targets: [
            {
              datasetId: id === 'sql' ? (foreign ? 9 : 12) : 3,
              datasourceType:
                id === 'sql' && !foreign
                  ? DatasourceType.Table
                  : DatasourceType.SemanticView,
              column: { name: 'country' },
            },
          ],
          chartsInScope: [sliceId],
          scope: { rootPath: [], excluded: [] },
          cascadeParentIds: [],
          defaultDataMask: {},
          controlValues: {},
          description: '',
        },
      ]),
    );
    const store = storeWithState({
      ...initial,
      nativeFilters: { ...initial.nativeFilters, filters: nativeFilters },
      dataMask: {
        sql: {
          id: 'sql',
          filterState: { value: requiredEmpty ? null : ['US'] },
          extraFormData: {
            ...getSelectExtraFormData(
              'country',
              requiredEmpty ? [] : ['US'],
              requiredEmpty,
            ),
            ...(foreign && {
              semantic_selection_sources: [
                {
                  datasource: '9__semantic_view',
                  version: 'cube-member-id-v1',
                },
              ],
            }),
          },
        },
        semantic: {
          id: 'semantic',
          filterState: { value: semanticSelected ? ['US'] : null },
          extraFormData: {},
        },
      },
      charts: {
        ...initial.charts,
        [sliceId]: {
          ...initial.charts[sliceId],
          form_data: {
            ...initial.charts[sliceId].form_data,
            datasource: '3__semantic_view',
            semantic_selection_version: 'cube-member-id-v1',
          },
        },
      },
    });
    store.dispatch({
      type: CHART_UPDATE_SUCCEEDED,
      key: sliceId,
      queriesResponse: [
        {
          status: 'success',
          applied_filters: semanticSelected ? [{ column: 'country' }] : [],
          rejected_filters: [],
        },
      ],
    });
    const { getByRole } = setup(store);
    expect(
      getByRole('button', { name: `Filters (${semanticSelected ? 2 : 1})` }),
    ).toBeInTheDocument();
  },
);

test.each(['12__table', '9__semantic_view'])(
  'cross-filter badge resolves the incompatible emitter %s from Redux',
  source => {
    const initial = getMockStoreWithNativeFilters().getState();
    const store = storeWithState({
      ...initial,
      nativeFilters: { ...initial.nativeFilters, filters: {} },
      dashboardInfo: {
        ...initial.dashboardInfo,
        metadata: {
          ...initial.dashboardInfo.metadata,
          chart_configuration: {
            999: {
              id: 999,
              crossFilters: { scope: 'global', chartsInScope: [sliceId] },
            },
          },
        },
      },
      dataMask: {
        999: {
          id: '999',
          filterState: { value: ['US'] },
          extraFormData: {
            filters: [{ col: 'country', op: 'IN', val: ['US'] }],
            ...(source.endsWith('__semantic_view') && {
              semantic_selection_sources: [
                { datasource: source, version: 'cube-member-id-v1' },
              ],
            }),
          },
        },
      },
      charts: {
        ...initial.charts,
        999: { form_data: { datasource: source } },
        [sliceId]: {
          ...initial.charts[sliceId],
          form_data: {
            ...initial.charts[sliceId].form_data,
            datasource: '3__semantic_view',
            semantic_selection_version: 'cube-member-id-v1',
          },
        },
      },
    });
    store.dispatch({
      type: CHART_UPDATE_SUCCEEDED,
      key: sliceId,
      queriesResponse: [
        { status: 'success', applied_filters: [], rejected_filters: [] },
      ],
    });
    const { getByRole, queryByRole } = setup(store);
    expect(getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
    const selectedMask = store.getState().dataMask[999];
    act(() => {
      store.dispatch(
        updateDataMask(999, {
          extraFormData: {},
          filterState: { value: null },
        }),
      );
    });
    expect(
      queryByRole('button', { name: 'Filters (1)' }),
    ).not.toBeInTheDocument();
    act(() => {
      store.dispatch(updateDataMask(999, selectedMask));
    });
    expect(getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
  },
);
