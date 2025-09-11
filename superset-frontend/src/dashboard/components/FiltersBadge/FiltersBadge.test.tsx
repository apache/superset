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
} from 'src/components/Chart/chartAction';
import { buildActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { FiltersBadge } from 'src/dashboard/components/FiltersBadge';
import {
  getMockStoreWithFilters,
  getMockStoreWithNativeFilters,
} from 'spec/fixtures/mockStore';
import { sliceId } from 'spec/fixtures/mockChartQueries';
import { dashboardFilters } from 'spec/fixtures/mockDashboardFilters';
import { dashboardWithFilter } from 'spec/fixtures/mockDashboardLayout';

jest.mock(
  'src/dashboard/components/FiltersBadge/DetailsPanel',
  () =>
    ({ children }: { children: ReactNode }) => (
      <div data-test="mock-details-panel">{children}</div>
    ),
);

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

describe('for dashboard filters', () => {
  test('does not show number when there are no active filters', () => {
    const store = getMockStoreWithFilters();
    // start with basic dashboard state, dispatch an event to simulate query completion
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

  test('shows the indicator when filters have been applied', () => {
    const store = getMockStoreWithFilters();
    // start with basic dashboard state, dispatch an event to simulate query completion
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
});

describe('for native filters', () => {
  test('does not show number when there are no active filters', () => {
    const store = getMockStoreWithNativeFilters();
    // start with basic dashboard state, dispatch an event to simulate query completion
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

  test('shows the indicator when filters have been applied', () => {
    const store = getMockStoreWithNativeFilters();
    // start with basic dashboard state, dispatch an event to simulate query completion
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
});
