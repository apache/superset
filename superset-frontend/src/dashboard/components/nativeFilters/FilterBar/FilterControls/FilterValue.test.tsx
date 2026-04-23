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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { NativeFilterType } from '@superset-ui/core';
import type { Filter } from '@superset-ui/core';
import FilterValue from './FilterValue';

const mockGetChartDataRequest = jest.fn();
jest.mock('src/components/Chart/chartAction', () => ({
  getChartDataRequest: (...args: unknown[]) => mockGetChartDataRequest(...args),
}));

jest.mock('src/middleware/asyncEvent', () => ({
  waitForAsyncData: jest.fn(),
}));

jest.mock('@superset-ui/core', () => {
  const original = jest.requireActual('@superset-ui/core');
  return {
    ...original,
    getChartMetadataRegistry: () => ({
      get: () => ({ enableNoResults: false }),
    }),
    SuperChart: (props: Record<string, unknown>) => (
      <div data-test="mock-super-chart" data-chart-type={props.chartType}>
        SuperChart
      </div>
    ),
    isFeatureEnabled: () => false,
    getClientErrorObject: (err: unknown) =>
      Promise.resolve({
        message: 'Something went wrong',
        errors: [
          { message: 'Test error', error_type: 'GENERIC_BACKEND_ERROR' },
        ],
      }),
  };
});

jest.mock('../useFilterOutlined', () => ({
  useFilterOutlined: () => ({
    outlinedFilterId: undefined,
    lastUpdated: 0,
  }),
}));

const mockUseFilterDependencies = jest.fn().mockReturnValue({});
jest.mock('./state', () => ({
  useFilterDependencies: (...args: unknown[]) =>
    mockUseFilterDependencies(...args),
}));

const mockStore = configureStore([thunk]);

const createMockFilter = (overrides: Partial<Filter> = {}): Filter => ({
  id: 'NATIVE_FILTER-1',
  name: 'Test Filter',
  filterType: 'filter_select',
  targets: [{ datasetId: 1, column: { name: 'country' } }],
  defaultDataMask: {},
  controlValues: {},
  cascadeParentIds: [],
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
  type: NativeFilterType.NativeFilter,
  description: 'Test filter description',
  ...overrides,
});

const getDefaultStoreState = () => ({
  dashboardInfo: { id: 1 },
  dashboardState: {
    isRefreshing: false,
    isFiltersRefreshing: false,
    directPathToChild: [],
    directPathLastUpdated: 0,
  },
  nativeFilters: {
    filters: {
      'NATIVE_FILTER-1': createMockFilter(),
    },
    filterSets: {},
  },
  dataMask: {},
  charts: {},
  dashboardLayout: { present: {} },
});

const defaultProps = {
  filter: createMockFilter(),
  dataMaskSelected: {},
  onFilterSelectionChange: jest.fn(),
  inView: true,
};

function renderFilterValue(
  propOverrides: Record<string, unknown> = {},
  stateOverrides: Record<string, unknown> = {},
) {
  const state = { ...getDefaultStoreState(), ...stateOverrides };
  const store = mockStore(state);
  const mergedProps = { ...defaultProps, ...propOverrides };
  return render(
    <Provider store={store}>
      <FilterValue {...(mergedProps as typeof defaultProps)} />
    </Provider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders loading spinner when filter has a data source', () => {
  mockGetChartDataRequest.mockReturnValue(new Promise(() => {}));

  renderFilterValue();

  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByTestId('mock-super-chart')).not.toBeInTheDocument();
});

test('renders SuperChart after data loads successfully', async () => {
  mockGetChartDataRequest.mockResolvedValue({
    response: { status: 200 },
    json: { result: [{ data: [{ country: 'US' }] }] },
  });

  renderFilterValue();

  await waitFor(() => {
    expect(screen.getByTestId('mock-super-chart')).toBeInTheDocument();
  });

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('renders error state when API call fails', async () => {
  mockGetChartDataRequest.mockRejectedValue(
    new Response(JSON.stringify({ message: 'Server Error' }), { status: 500 }),
  );

  renderFilterValue();

  await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // No ErrorMessageComponent is registered for GENERIC_BACKEND_ERROR in the
  // test environment, so FilterValue renders its fallback ErrorAlert.
  expect(await screen.findByText('Network error')).toBeInTheDocument();
});

test('does not fetch data when filter has not been in view', () => {
  renderFilterValue({ inView: false });

  expect(mockGetChartDataRequest).not.toHaveBeenCalled();
});

test('does not render loading spinner when filter has no data source', () => {
  const filterWithoutDataSource = createMockFilter({
    targets: [{ column: { name: 'country' } }],
  });
  mockGetChartDataRequest.mockReturnValue(new Promise(() => {}));

  renderFilterValue({ filter: filterWithoutDataSource });

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByTestId('mock-super-chart')).toBeInTheDocument();
});

test('skips data fetch when cascade parent filters have no values selected', () => {
  // useFilterDependencies returns dependencies with a filter (from parent defaults),
  // but dataMaskSelected has no extraFormData for the parent -- counts disagree, so
  // the component skips the fetch.
  mockUseFilterDependencies.mockReturnValue({
    filters: [{ col: 'region', op: 'IN', val: ['US'] }],
  });

  const childFilter = createMockFilter({
    id: 'NATIVE_FILTER-CHILD',
    cascadeParentIds: ['NATIVE_FILTER-PARENT'],
  });

  const stateWithParent = {
    nativeFilters: {
      filters: {
        'NATIVE_FILTER-CHILD': childFilter,
        'NATIVE_FILTER-PARENT': createMockFilter({
          id: 'NATIVE_FILTER-PARENT',
        }),
      },
      filterSets: {},
    },
  };

  renderFilterValue(
    {
      filter: childFilter,
      dataMaskSelected: {},
    },
    stateWithParent,
  );

  expect(mockGetChartDataRequest).not.toHaveBeenCalled();
});
