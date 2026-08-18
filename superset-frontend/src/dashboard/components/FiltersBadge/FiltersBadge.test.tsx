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
import { ReactNode } from 'react';
import { Store } from 'redux';
import { render } from 'spec/helpers/testing-library';
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
