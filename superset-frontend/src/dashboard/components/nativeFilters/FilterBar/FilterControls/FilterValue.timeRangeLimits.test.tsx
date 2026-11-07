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
import fetchMock from 'fetch-mock';
import rison from 'rison';
import { act } from 'react-dom/test-utils';
import { Preset, type DataMask, type Filter } from '@superset-ui/core';
import {
  createStore,
  render,
  screen,
  waitFor,
  userEvent,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import type { RootState } from 'src/dashboard/types';
import {
  RangeFilterPlugin,
  SelectFilterPlugin,
  TimeFilterPlugin,
} from 'src/filters/components';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import { DateFilterTestKey } from 'src/explore/components/controls/DateFilterControl/utils';
import {
  TIME_RANGE_LIMITS_FAILED,
  TIME_RANGE_LIMITS_LOADED,
  TIME_RANGE_LIMITS_LOADING,
} from 'src/dashboard/actions/timeRangeLimits';
import { ON_FILTERS_REFRESH } from 'src/dashboard/actions/dashboardState';
import type { ChartRange } from 'src/utils/timeRangeLimits';
import FilterValue from './FilterValue';
import FilterControl from './FilterControl';

jest.mock('src/components/Chart/chartAction', () => ({
  ...jest.requireActual('src/components/Chart/chartAction'),
  requestChartDataResolved: jest.fn(),
}));

new Preset({
  name: 'Time filter',
  plugins: [
    new TimeFilterPlugin().configure({ key: 'filter_time' }),
    new SelectFilterPlugin().configure({ key: 'filter_select' }),
    new RangeFilterPlugin().configure({ key: 'filter_range' }),
  ],
}).register();

const FILTER_ID = 'NATIVE_FILTER-time';
const mockedRequest = requestChartDataResolved as jest.Mock;

const SERVER: Record<string, [string, string]> = {
  'today : now': ['2026-10-30T00:00:00', '2026-10-30T12:00:00'],
  'Last year': ['2025-10-30T00:00:00', '2026-10-30T00:00:00'],
  'Last month': ['2026-09-30T00:00:00', '2026-10-30T00:00:00'],
  'Last week': ['2026-10-23T00:00:00', '2026-10-30T00:00:00'],
};

const UNSET = { max_span: null, max_look_back: null, max_look_forward: null };
const SPAN_90 = { ...UNSET, max_span: { quantity: 90, time_grain: 'P1D' } };
const PAYLOAD = {
  global: UNSET,
  dashboard: SPAN_90,
  datasets: [],
  timezone: 'UTC',
};
const GRANULARITY_RANGE: ChartRange = {
  since: '2026-06-30T00:00:00',
  until: '2026-10-30T00:00:00',
  time_offset: null,
  source: [{ kind: 'granularity', query_index: 0, index: null }],
};

const timeFilter = (dataMask: DataMask): Filter & { dataMask: DataMask } =>
  ({
    id: FILTER_ID,
    name: 'Time range',
    filterType: 'filter_time',
    type: 'NATIVE_FILTER',
    targets: [{}],
    controlValues: {},
    cascadeParentIds: [],
    defaultDataMask: {},
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    chartsInScope: [1],
    tabsInScope: [],
    description: '',
    dataMask,
  }) as unknown as Filter & { dataMask: DataMask };

const valueMask = (value: string, filterState = {}): DataMask => ({
  extraFormData: { time_range: value },
  filterState: { value, ...filterState },
});

function storeOf(limits: Record<string, unknown>, applied = 'Last year') {
  return createStore(
    {
      dashboardInfo: { id: 9, metadata: {} },
      dashboardState: { isRefreshing: false, isFiltersRefreshing: false },
      charts: { 1: { id: 1, form_data: { datasource: '7__table' } } },
      dataMask: { [FILTER_ID]: { id: FILTER_ID, ...valueMask(applied) } },
      timeRangeLimits: {
        status: 'loaded',
        dashboardId: 9,
        request: 1,
        payload: PAYLOAD,
        charts: {},
        ...limits,
      },
    },
    reducerIndex,
  );
}

function renderValue(
  store: ReturnType<typeof storeOf>,
  dataMask: DataMask,
  onFilterSelectionChange = jest.fn(),
) {
  const props = { onFilterSelectionChange };
  const { rerender } = render(
    <FilterValue {...props} filter={timeFilter(dataMask)} />,
    { useRedux: true, store },
  );
  return {
    onFilterSelectionChange,
    pick: (next: DataMask) =>
      rerender(<FilterValue {...props} filter={timeFilter(next)} />),
  };
}

beforeAll(() => fetchMock.mockGlobal());
afterAll(() => fetchMock.hardReset());
beforeEach(() => {
  window.featureFlags = { TIME_RANGE_LIMITS: true };
  fetchMock.get('glob:*/api/v1/time_range/*', ({ url }: { url: string }) => {
    const request = rison.decode(new URL(url).searchParams.get('q')!) as
      | string
      | { timeRange: string }[];
    const items =
      typeof request === 'string' ? [{ timeRange: request }] : request;
    return {
      result: items.map(({ timeRange }) => {
        const [since, until] = SERVER[timeRange] ?? ['', ''];
        return { since, until, timeRange, shift: null };
      }),
    };
  });
});
afterEach(() => {
  window.featureFlags = {};
  fetchMock.clearHistory().removeRoutes();
  mockedRequest.mockReset();
});

test('while the limits load, the time range filter shows the default loading and is busy', () => {
  renderValue(
    storeOf({ status: 'loading', payload: null }),
    valueMask('Last year'),
  );

  expect(screen.getByText('Loading filter values')).toBeInTheDocument();
  expect(screen.getByTestId('form-item-value')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect(
    screen.queryByTestId(DateFilterTestKey.PopoverOverlay),
  ).not.toBeInTheDocument();
});

test('a policy answer that comes late reaches the picker, which checks the value', async () => {
  const store = storeOf({ status: 'loading', payload: null });
  const { onFilterSelectionChange } = renderValue(
    store,
    valueMask('Last year'),
  );

  act(() => {
    store.dispatch({
      type: TIME_RANGE_LIMITS_LOADED,
      request: 1,
      payload: PAYLOAD,
    });
  });

  await screen.findByTestId(DateFilterTestKey.PopoverOverlay);
  await waitFor(() =>
    expect(onFilterSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: FILTER_ID }),
      valueMask('Last year', {
        validateStatus: 'error',
        limitInvalid: true,
        validateMessage: 'Longer than 90 days',
      }),
    ),
  );
  expect(screen.getByTestId('form-item-value')).not.toHaveAttribute(
    'aria-busy',
  );
});

test('the filter keeps its error when the bar passes no validateStatus', async () => {
  renderValue(
    storeOf({}),
    valueMask('Last year', {
      validateStatus: 'error',
      limitInvalid: true,
      validateMessage: 'Longer than 90 days',
    }),
  );

  expect(await screen.findByText('Longer than 90 days')).toBeInTheDocument();
  expect(
    document.querySelector('.ant-form-item-has-error'),
  ).toBeInTheDocument();
});

test('FilterControl keeps the error on the filter with a time range error', async () => {
  render(
    <FilterControl
      filter={timeFilter(
        valueMask('Last year', {
          validateStatus: 'error',
          limitInvalid: true,
          validateMessage: 'Longer than 90 days',
        }),
      )}
      onFilterSelectionChange={jest.fn()}
    />,
    { useRedux: true, store: storeOf({}) },
  );

  const title = await screen.findByText('Time range');
  expect(title.closest('.ant-form-item')).toHaveClass(
    'ant-form-item-has-error',
  );
});

test('a chart check marks the applied value; picking another value clears it', async () => {
  const store = storeOf(
    {
      charts: {
        1: {
          signature: '{}',
          status: 'invalid',
          failures: [
            {
              reason: 'MAX_SPAN_EXCEEDED',
              rule: 'max_span',
              field: 'range',
              limit: { source: 'dashboard', quantity: 90, time_grain: 'P1D' },
              message: "Range can't be longer than 90 days.",
              range: GRANULARITY_RANGE,
            },
          ],
          attribution: {
            filterId: FILTER_ID,
            filterValue: 'Last month',
            chart: false,
          },
        },
      },
    },
    'Last month',
  );
  const { pick } = renderValue(store, valueMask('Last month'));

  expect(await screen.findByText('Longer than 90 days')).toBeInTheDocument();

  pick(valueMask('Last week'));

  await waitFor(() =>
    expect(screen.queryByText('Longer than 90 days')).not.toBeInTheDocument(),
  );
  expect(
    (store.getState() as unknown as RootState).dataMask[FILTER_ID].filterState,
  ).toEqual({ value: 'Last month' });
});

test('flag off: the time range filter renders at once and is not busy', async () => {
  window.featureFlags = {};
  const { onFilterSelectionChange } = renderValue(
    storeOf({ status: 'loading', payload: null }),
    valueMask('Last year'),
  );

  expect(
    await screen.findByTestId(DateFilterTestKey.PopoverOverlay),
  ).toBeInTheDocument();
  expect(screen.getByTestId('form-item-value')).not.toHaveAttribute(
    'aria-busy',
  );
  expect(onFilterSelectionChange).toHaveBeenCalledWith(
    expect.objectContaining({ id: FILTER_ID }),
    valueMask('Last year'),
  );
});

const HELD_ERROR_TITLE = 'Cannot load filter';
const LIMITS_MESSAGE =
  'Time range limits could not be loaded. Queries are paused to protect the database.';
const LOAD_ERROR = /Network error|Cannot load filter/;
const OPTION_ID = 'NATIVE_FILTER-queue';

const optionFilter = (filterType: string) =>
  ({
    id: OPTION_ID,
    name: 'Queue',
    filterType,
    type: 'NATIVE_FILTER',
    targets: [{ datasetId: 7, column: { name: 'queue' } }],
    controlValues: {},
    cascadeParentIds: [],
    defaultDataMask: {},
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    chartsInScope: [1],
    tabsInScope: [],
    description: '',
    adhoc_filters: [],
    time_range: 'No filter',
    dataMask: { filterState: {} },
  }) as unknown as Filter;

const answer = () =>
  Promise.resolve([
    { data: [{ queue: 'a', min: 1, max: 9 }], colnames: ['queue'] },
  ]);

const pending = () => {
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise((_, rejectPromise) => {
    reject = rejectPromise;
  });
  mockedRequest.mockReturnValueOnce(promise);
  return { reject };
};

const signalOf = (call: number): AbortSignal =>
  mockedRequest.mock.calls[call][0].requestParams.signal;

function renderOption(
  limits: Record<string, unknown>,
  filterType = 'filter_select',
  refreshing = false,
) {
  const store = storeOf(limits);
  if (refreshing) {
    store.dispatch({ type: ON_FILTERS_REFRESH });
  }
  render(
    <FilterValue
      filter={optionFilter(filterType)}
      onFilterSelectionChange={jest.fn()}
    />,
    { useRedux: true, store },
  );
  return store;
}

const dispatchAll = (
  store: ReturnType<typeof storeOf>,
  ...actions: { type: string }[]
) =>
  act(() => {
    actions.forEach(action => store.dispatch(action));
  });

const loading = (request: number) => ({
  type: TIME_RANGE_LIMITS_LOADING,
  dashboardId: 9,
  request,
});
const loadedAction = (request: number) => ({
  type: TIME_RANGE_LIMITS_LOADED,
  request,
  payload: PAYLOAD,
});
const failedAction = (request: number) => ({
  type: TIME_RANGE_LIMITS_FAILED,
  request,
});

const isFiltersRefreshing = (store: ReturnType<typeof storeOf>) =>
  (store.getState() as unknown as RootState).dashboardState.isFiltersRefreshing;

const FAILED = { status: 'failed', payload: null, failedBefore: true };

test.each(['filter_select', 'filter_range'])(
  '%s sends no option query while the limits failed and shows the limits text',
  async filterType => {
    mockedRequest.mockImplementation(answer);
    renderOption(FAILED, filterType);

    expect(await screen.findByText(HELD_ERROR_TITLE)).toBeInTheDocument();
    expect(mockedRequest).not.toHaveBeenCalled();
    expect(screen.queryByText('Loading filter values')).not.toBeInTheDocument();
    expect(screen.queryByText('Network error')).not.toBeInTheDocument();
    await userEvent.hover(
      screen.getByRole('button', { name: /Cannot load filter/ }),
    );
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      `${HELD_ERROR_TITLE}: ${LIMITS_MESSAGE}`,
    );
  },
);

test('failed, then a Retry, then loaded: no query until the limits load, then exactly one', async () => {
  mockedRequest.mockImplementation(answer);
  const store = renderOption({ ...FAILED, request: 1 });

  dispatchAll(store, loading(2));
  expect(screen.getByText(HELD_ERROR_TITLE)).toBeInTheDocument();
  expect(mockedRequest).not.toHaveBeenCalled();

  dispatchAll(store, loadedAction(2));
  await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(HELD_ERROR_TITLE)).not.toBeInTheDocument();
});

test('failed, then a Retry that fails again: no query', async () => {
  mockedRequest.mockImplementation(answer);
  const store = renderOption({ ...FAILED, request: 1 });

  dispatchAll(store, loading(2), failedAction(2));

  expect(await screen.findByText(HELD_ERROR_TITLE)).toBeInTheDocument();
  expect(mockedRequest).not.toHaveBeenCalled();
});

test('a filter that mounts during a Retry after a failure sends no query', async () => {
  mockedRequest.mockImplementation(answer);
  renderOption({ status: 'loading', payload: null, failedBefore: true });

  expect(await screen.findByText(HELD_ERROR_TITLE)).toBeInTheDocument();
  expect(mockedRequest).not.toHaveBeenCalled();
});

test('a query in flight when the limits fail is aborted, its late error is dropped, and recovery sends one', async () => {
  const { reject } = pending();
  const store = renderOption({ status: 'loading', payload: null });
  await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(1));
  expect(mockedRequest.mock.calls[0][1]).toBe(signalOf(0));

  dispatchAll(store, failedAction(1));
  expect(signalOf(0).aborted).toBe(true);
  expect(screen.getByText(HELD_ERROR_TITLE)).toBeInTheDocument();

  await act(async () => {
    reject(new DOMException('Aborted', 'AbortError'));
  });
  expect(screen.queryByText('Network error')).not.toBeInTheDocument();

  pending();
  dispatchAll(store, loading(2), loadedAction(2));
  await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Loading filter values')).toBeInTheDocument();
  expect(screen.queryByText(LOAD_ERROR)).not.toBeInTheDocument();
});

test('a held Range filter that never loaded shows the loading spinner after recovery until its answer', async () => {
  pending();
  const store = renderOption({ ...FAILED, request: 1 }, 'filter_range');
  expect(await screen.findByText(HELD_ERROR_TITLE)).toBeInTheDocument();

  dispatchAll(store, loading(2), loadedAction(2));
  await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(1));

  expect(screen.getByText('Loading filter values')).toBeInTheDocument();
  expect(screen.queryByText('No results')).not.toBeInTheDocument();
});

test('an errored Select filter shows the loading spinner after recovery until its answer', async () => {
  mockedRequest.mockImplementationOnce(() =>
    Promise.reject(new Response('{}', { status: 500 })),
  );
  const store = renderOption({ status: 'loading', payload: null });
  expect(await screen.findByText('Cannot load filter')).toBeInTheDocument();

  dispatchAll(store, failedAction(1));
  expect(screen.getByText(HELD_ERROR_TITLE)).toBeInTheDocument();

  pending();
  dispatchAll(store, loading(2), loadedAction(2));
  await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Loading filter values')).toBeInTheDocument();
  expect(screen.queryByText(LOAD_ERROR)).not.toBeInTheDocument();
});

test('a filter that loaded, then failed, then recovered sends no new query and gets its control back', async () => {
  mockedRequest.mockImplementation(answer);
  const store = renderOption({});
  await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.queryByText('Loading filter values')).not.toBeInTheDocument(),
  );

  dispatchAll(store, loading(2), failedAction(2));
  expect(screen.getByText(HELD_ERROR_TITLE)).toBeInTheDocument();

  dispatchAll(store, loading(3), loadedAction(3));
  await waitFor(() =>
    expect(screen.queryByText(HELD_ERROR_TITLE)).not.toBeInTheDocument(),
  );
  expect(screen.getByTestId('form-item-value')).toBeInTheDocument();
  expect(screen.queryByText('Loading filter values')).not.toBeInTheDocument();
  expect(mockedRequest).toHaveBeenCalledTimes(1);
});

test('a dashboard refresh while held ends the filters refresh with no query', async () => {
  mockedRequest.mockImplementation(answer);
  const store = renderOption(FAILED, 'filter_select', true);

  await waitFor(() => expect(isFiltersRefreshing(store)).toBe(false));
  expect(mockedRequest).not.toHaveBeenCalled();
});

test('a filter with data, refreshed while held, sends no query on recovery', async () => {
  mockedRequest.mockImplementation(answer);
  const store = renderOption({});
  await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.queryByText('Loading filter values')).not.toBeInTheDocument(),
  );

  dispatchAll(store, loading(2), failedAction(2), {
    type: ON_FILTERS_REFRESH,
  });
  await waitFor(() => expect(isFiltersRefreshing(store)).toBe(false));

  dispatchAll(store, loading(3), loadedAction(3));
  await waitFor(() =>
    expect(screen.queryByText(HELD_ERROR_TITLE)).not.toBeInTheDocument(),
  );
  expect(mockedRequest).toHaveBeenCalledTimes(1);
});

test.each([
  ['the first loading, then on', { status: 'loading', payload: null }, true],
  ['on', {}, false],
])(
  '%s sends the option query as without limits',
  async (_, limits, thenLoad) => {
    mockedRequest.mockImplementation(answer);
    const store = renderOption(limits);
    await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(1));
    if (thenLoad) {
      dispatchAll(store, loadedAction(1));
    }
    await waitFor(() =>
      expect(
        screen.queryByText('Loading filter values'),
      ).not.toBeInTheDocument(),
    );
    expect(mockedRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(HELD_ERROR_TITLE)).not.toBeInTheDocument();
  },
);

test('flag off sends the option query, even on a failed state', async () => {
  window.featureFlags = {};
  mockedRequest.mockImplementation(answer);
  renderOption(FAILED);

  await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(1));
  expect(mockedRequest.mock.calls[0]).toHaveLength(1);
  expect(mockedRequest.mock.calls[0][0].requestParams).not.toHaveProperty(
    'signal',
  );
  expect(screen.queryByText(HELD_ERROR_TITLE)).not.toBeInTheDocument();
});
