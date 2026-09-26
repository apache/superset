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
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { NativeFilterType } from '@superset-ui/core';
import type { Filter } from '@superset-ui/core';
import FilterValue from './FilterValue';

const mockRequestChartData = jest.fn();
const mockGetClientErrorObject = jest.fn();
jest.mock('src/components/Chart/chartAction', () => ({
  requestChartDataResolved: (...args: unknown[]) =>
    mockRequestChartData(...args),
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
    getClientErrorObject: (...args: unknown[]) =>
      mockGetClientErrorObject(...args),
  };
});

jest.mock('../useFilterOutlined', () => ({
  useFilterOutlined: () => ({
    outlinedFilterId: undefined,
    lastUpdated: 0,
  }),
}));

const mockUseFilterDependencies = jest.fn().mockReturnValue({});
const mockUseTransitiveParentIds = jest.fn().mockReturnValue([]);
jest.mock('./state', () => ({
  useFilterDependencies: (...args: unknown[]) =>
    mockUseFilterDependencies(...args),
  useTransitiveParentIds: (...args: unknown[]) =>
    mockUseTransitiveParentIds(...args),
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
  // Exercise the real parsing so each rejection shape is handled as in
  // production.
  mockGetClientErrorObject.mockImplementation(
    jest.requireActual('@superset-ui/core').getClientErrorObject,
  );
});

test('renders loading spinner when filter has a data source', () => {
  mockRequestChartData.mockReturnValue(new Promise(() => {}));

  renderFilterValue();

  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByTestId('mock-super-chart')).not.toBeInTheDocument();
});

test('renders SuperChart after data loads successfully', async () => {
  mockRequestChartData.mockResolvedValue([{ data: [{ country: 'US' }] }]);

  renderFilterValue();

  await waitFor(() => {
    expect(screen.getByTestId('mock-super-chart')).toBeInTheDocument();
  });

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('forwards the dashboard async override to the request', async () => {
  mockRequestChartData.mockResolvedValue([{ data: [{ country: 'US' }] }]);

  renderFilterValue(
    {},
    { dashboardInfo: { id: 1, metadata: { async_mode: 'force_off' } } },
  );

  await waitFor(() => {
    expect(mockRequestChartData).toHaveBeenCalled();
  });
  // Filter requests carry the dashboard's override so they follow the same async
  // policy as the dashboard's charts.
  expect(mockRequestChartData).toHaveBeenLastCalledWith(
    expect.objectContaining({
      requestParams: { async_mode_override: 'force_off' },
    }),
  );
});

const FRIENDLY_MESSAGE = 'Sorry, something went wrong. Try again later.';
const NETWORK_MESSAGE = 'Network error while attempting to fetch resource';

// The compact ErrorAlert shows only its title inline; the message is in a
// hover tooltip and a click-to-open modal. Open both so every rendered
// surface is checked.
async function expectErrorAlert(title: string, message: string) {
  const trigger = await screen.findByText(title);
  await userEvent.hover(trigger);
  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    `${title}: ${message}`,
  );
  await userEvent.click(trigger);
  expect(await screen.findByRole('dialog')).toHaveTextContent(message);
}

function expectNotInDocument(...fragments: string[]) {
  fragments.forEach(fragment => {
    expect(document.body.textContent).not.toContain(fragment);
  });
}

test('renders error state when API call fails', async () => {
  mockRequestChartData.mockRejectedValue(
    new Response(JSON.stringify({ message: 'Server Error' }), { status: 500 }),
  );

  renderFilterValue();

  await expectErrorAlert('Cannot load filter', FRIENDLY_MESSAGE);
  expectNotInDocument('Server Error', 'Network error');
});

test('does not expose database error details without an error_type', async () => {
  const dbError =
    'Error: Received ClickHouse exception, code: 396, DB::Exception: Limit for temporary files size exceeded. (TOO_MANY_ROWS_OR_BYTES) (for url https://db.internal:8443)';
  mockRequestChartData.mockRejectedValue(
    new Response(JSON.stringify({ errors: [{ message: dbError }] }), {
      status: 500,
    }),
  );

  renderFilterValue();

  await expectErrorAlert('Cannot load filter', FRIENDLY_MESSAGE);
  expectNotInDocument(
    'ClickHouse',
    'DB::Exception',
    'TOO_MANY_ROWS_OR_BYTES',
    '396',
    'db.internal',
    'Network error',
  );
});

test('does not expose the message of a server-side failure without a response body', async () => {
  // e.g. the async query path rejecting after a query task failed
  mockRequestChartData.mockRejectedValue(new Error('some server message'));

  renderFilterValue();

  await expectErrorAlert('Cannot load filter', FRIENDLY_MESSAGE);
  expectNotInDocument('some server message', 'Network error');
});

test.each([
  ['Chromium', 'Failed to fetch'],
  ['Firefox', 'NetworkError when attempting to fetch resource.'],
  ['Safari', 'Load failed'],
])(
  'shows the network error when the request gets no response (%s)',
  async (_browser, fetchMessage) => {
    mockRequestChartData.mockRejectedValue(new TypeError(fetchMessage));

    renderFilterValue();

    await expectErrorAlert('Network error', NETWORK_MESSAGE);
    expectNotInDocument('Cannot load filter', FRIENDLY_MESSAGE);
  },
);

test('does not fetch data when filter has not been in view', () => {
  renderFilterValue({ inView: false });

  expect(mockRequestChartData).not.toHaveBeenCalled();
});

test('does not render loading spinner when filter has no data source', () => {
  const filterWithoutDataSource = createMockFilter({
    targets: [{ column: { name: 'country' } }],
  });
  mockRequestChartData.mockReturnValue(new Promise(() => {}));

  renderFilterValue({ filter: filterWithoutDataSource });

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByTestId('mock-super-chart')).toBeInTheDocument();
});

const defaultFirstItemParentFilter = createMockFilter({
  id: 'NATIVE_FILTER-PARENT',
  controlValues: { defaultToFirstItem: true },
});
const guardChildFilter = createMockFilter({
  id: 'NATIVE_FILTER-CHILD',
  cascadeParentIds: ['NATIVE_FILTER-PARENT'],
});
const stateWithDefaultFirstItemParent = {
  nativeFilters: {
    filters: {
      'NATIVE_FILTER-CHILD': guardChildFilter,
      'NATIVE_FILTER-PARENT': defaultFirstItemParentFilter,
    },
    filterSets: {},
  },
};

test('guard: does not fetch while a defaultToFirstItem parent has not yet auto-selected', () => {
  // Reproduces sc-108451: B should not fetch from unfiltered data before A selects.
  mockUseTransitiveParentIds.mockReturnValue(['NATIVE_FILTER-PARENT']);
  mockUseFilterDependencies.mockReturnValue({});

  renderFilterValue(
    {
      filter: guardChildFilter,
      // Parent entry exists but filterState.value is undefined (no selection yet).
      dataMaskSelected: {
        'NATIVE_FILTER-PARENT': { filterState: {}, extraFormData: {} },
      },
    },
    stateWithDefaultFirstItemParent,
  );

  expect(mockRequestChartData).not.toHaveBeenCalled();
});

test('guard: fetches once a defaultToFirstItem parent has set its first value', async () => {
  mockRequestChartData.mockResolvedValue([{ data: [{ model: 'Corolla' }] }]);
  mockUseTransitiveParentIds.mockReturnValue(['NATIVE_FILTER-PARENT']);
  mockUseFilterDependencies.mockReturnValue({
    filters: [{ col: 'make', op: 'IN', val: ['Toyota'] }],
  });

  renderFilterValue(
    {
      filter: guardChildFilter,
      dataMaskSelected: {
        'NATIVE_FILTER-PARENT': {
          // Parent has auto-selected its first value → guard should pass.
          filterState: { value: ['Toyota'] },
          extraFormData: {
            filters: [{ col: 'make', op: 'IN', val: ['Toyota'] }],
          },
        },
      },
    },
    stateWithDefaultFirstItemParent,
  );

  await waitFor(() => {
    expect(mockRequestChartData).toHaveBeenCalled();
  });
});

test('guard: does not block fetch for a parent without defaultToFirstItem', async () => {
  // Non-defaultToFirstItem parents with values should pass the guard as before.
  mockRequestChartData.mockResolvedValue([{ data: [] }]);
  mockUseTransitiveParentIds.mockReturnValue(['NATIVE_FILTER-PARENT']);
  mockUseFilterDependencies.mockReturnValue({
    filters: [{ col: 'make', op: 'IN', val: ['Toyota'] }],
  });

  const regularParent = createMockFilter({ id: 'NATIVE_FILTER-PARENT' });

  renderFilterValue(
    {
      filter: guardChildFilter,
      dataMaskSelected: {
        'NATIVE_FILTER-PARENT': {
          filterState: { value: ['Toyota'] },
          extraFormData: {
            filters: [{ col: 'make', op: 'IN', val: ['Toyota'] }],
          },
        },
      },
    },
    {
      nativeFilters: {
        filters: {
          'NATIVE_FILTER-CHILD': guardChildFilter,
          'NATIVE_FILTER-PARENT': regularParent,
        },
        filterSets: {},
      },
    },
  );

  await waitFor(() => {
    expect(mockRequestChartData).toHaveBeenCalled();
  });
});

test('skips data fetch when cascade parent filters have no values selected', () => {
  // useFilterDependencies returns dependencies with a filter (from parent defaults),
  // but dataMaskSelected has no extraFormData for the parent -- counts disagree, so
  // the component skips the fetch.
  mockUseFilterDependencies.mockReturnValue({
    filters: [{ col: 'region', op: 'IN', val: ['US'] }],
  });
  mockUseTransitiveParentIds.mockReturnValue(['NATIVE_FILTER-PARENT']);

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

  expect(mockRequestChartData).not.toHaveBeenCalled();
});
