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
import { MemoryRouter, Route, RouteComponentProps } from 'react-router-dom';
import type { Store } from 'redux';
import reducerIndex from 'spec/helpers/reducerIndex';
import type { ExploreState } from 'src/explore/reducers/exploreReducer';
import ExploreViewContainer from '.';
import { FeatureFlag, getChartBuildQueryRegistry } from '@superset-ui/core';
import { cachedBuildQuery } from '../../../../plugins/plugin-chart-table/src/buildQuery';
import {
  act,
  createStore,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { updateDataMask } from 'src/dataMask/actions';
import {
  setExploreTimeRangeLimits,
  setTimeRangeRunOnValid,
} from 'src/explore/actions/timeRangeLimitsActions';
import {
  setControlValue,
  setFormData,
  setSaveAction,
} from 'src/explore/actions/exploreActions';
import { createSlice } from 'src/explore/actions/saveModalActions';

import {
  CHART_DATA,
  chartDataCalls,
  chartRangesAnswer,
  checkCalls,
  checked,
  clearServer,
  controls,
  DASHBOARD,
  EXPLORE_GET,
  findUpdateChart,
  LAST_45_DAYS,
  LAST_WEEK,
  lastCheckBody,
  LOADED,
  MODERN,
  mockIsFeatureEnabled,
  mockExploreLocation,
  mockIsMatrixifyEnabled,
  mockRoutes,
  pressEnter,
  registerCharts,
  registerSectionsChart,
  RENDERED,
  renderExplore,
  resetServer,
  restoreUnsavedPrompt,
  sectionsState,
  server,
  settle,
  SPAN_30,
  state,
  updateChart,
  withoutUnsavedPrompt,
} from './ExploreViewContainer.timeRangeLimits.testHelpers';

/*
 * Time range limits in Explore: the check and every run path.
 * Run paths left to the server, which checks before any cache lookup:
 * View query, Results / Samples, exports, Matrixify cells, annotations, Drill to
 * detail, Drill by and the layers a deck_multi chart fetches itself.
 */

jest.mock(
  'src/explore/components/controls/LayerConfigsControl/LayerConfigsControl',
  () => () => null,
);

jest.mock('@superset-ui/core', () => ({
  __esModule: true,
  ...jest.requireActual('@superset-ui/core'),
  isMatrixifyEnabled: jest.fn(() => false),
  isFeatureEnabled: jest.fn(),
}));

jest.mock(
  'src/explore/components/ExploreChartPanel/useResizeDetectorByObserver',
  () => ({
    __esModule: true,
    default: () => ({ height: 100, width: 100 }),
  }),
);

let mockSaveModalFormData: object | undefined;
jest.mock('../SaveModal', () => ({
  __esModule: true,
  default: ({ form_data: formData }: { form_data: object }) => {
    mockSaveModalFormData = formData;
    return <div data-test="save-modal" />;
  },
}));

beforeAll(() => {
  registerCharts();
  registerSectionsChart();
});

beforeEach(() => {
  resetServer();
});

afterEach(() => {
  clearServer();
  restoreUnsavedPrompt();
});

test('page open: waits for the check, then runs once on valid', async () => {
  renderExplore();
  expect(chartDataCalls()).toBe(0);
  expect(await findUpdateChart()).toBeDisabled();
  expect(chartDataCalls()).toBe(0);
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  await settle();
  expect(chartDataCalls()).toBe(1);
  expect(await findUpdateChart()).toBeEnabled();
});

test('page open: an invalid range never runs; the error is on the filter and Update chart and Save are disabled', async () => {
  server.answer = LAST_45_DAYS;
  const { store } = renderExplore();
  await checked();
  expect(chartDataCalls()).toBe(0);
  expect(
    store.getState().explore.controls.adhoc_filters.validationErrors,
  ).toEqual(["Range can't be longer than 30 days. This one is 45 days."]);
  expect(await findUpdateChart()).toBeDisabled();
  expect(screen.getByTestId('query-save-button')).toBeDisabled();
  pressEnter({ ctrlKey: true });
  await settle();
  expect(chartDataCalls()).toBe(0);
});

// Guard test: passes on the base too.
test('flag off: the page-open run at once, no check', async () => {
  mockIsFeatureEnabled.mockReturnValue(false);
  renderExplore(state({ limits: null }));
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  await settle();
  expect(checkCalls()).toHaveLength(0);
  expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(0);
  expect(await findUpdateChart()).toBeEnabled();
});

test('the check sends the chart-data request body, unsaved changes included (modern)', async () => {
  renderExplore(state({ formData: {} }));
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  const [chartData] = fetchMock.callHistory.calls(CHART_DATA);
  const { charts } = lastCheckBody();
  expect(charts).toHaveLength(1);
  expect(charts[0].key).toBe('explore');
  expect(charts[0].query_context).toEqual(
    JSON.parse(String(chartData.options.body)),
  );
});

test('dashboardId: the chart-data body and the check carry it, the URL state gets nothing new', async () => {
  server.dashboardId = 7;
  fetchMock.get(DASHBOARD, {
    result: { dashboard: null, global: null, datasets: [] },
  });
  renderExplore(state({ formData: { dashboardId: 7 } }));
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  expect(lastCheckBody().charts[0].query_context.form_data.dashboardId).toBe(7);
  const [chartData] = fetchMock.callHistory.calls(CHART_DATA);
  expect(JSON.parse(String(chartData.options.body)).form_data.dashboardId).toBe(
    7,
  );
  const urlState = fetchMock.callHistory
    .calls('glob:*/api/v1/explore/form_data*')
    .map(call => JSON.parse(JSON.parse(String(call.options.body)).form_data));
  expect(urlState.every(formData => formData.dashboardId === 7)).toBe(true);
});

const savedParams = async (flagOn: boolean) => {
  mockIsFeatureEnabled.mockImplementation(
    flag => flagOn && flag === FeatureFlag.TimeRangeLimits,
  );
  server.dashboardId = 7;
  fetchMock.get(DASHBOARD, {
    result: { dashboard: null, global: null, datasets: [] },
  });
  fetchMock.post('glob:*/api/v1/chart/', { id: 2, result: {} });
  const initial = state({
    limits: flagOn ? LOADED : null,
    formData: { dashboardId: 7 },
  });
  initial.saveModal = { isVisible: true };
  const { store, unmount } = renderExplore(initial);
  if (flagOn) {
    await checked();
  }
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  // As SaveModal's save: its form_data prop becomes explore.form_data, then posted.
  await act(async () => {
    store.dispatch(setFormData({ ...mockSaveModalFormData } as never) as never);
    await store.dispatch(createSlice('saved', []) as never);
  });
  const formData = store.getState().explore.form_data;
  const [save] = fetchMock.callHistory.calls('glob:*/api/v1/chart/');
  unmount();
  fetchMock.clearHistory();
  fetchMock.removeRoutes();
  mockRoutes();
  return {
    formData,
    params: JSON.parse(JSON.parse(String(save.options.body)).params),
  };
};

test('dashboardId: Save (SaveModal form data → explore.form_data → POST) is the same with the flag on as off', async () => {
  const on = await savedParams(true);
  const off = await savedParams(false);
  expect(on.formData).toEqual(off.formData);
  expect(on.params).toEqual(off.params);
});

// Guard test: passes on the base too.
test('dashboardId: the URL state is the same as with the flag off', async () => {
  mockIsFeatureEnabled.mockReturnValue(false);
  renderExplore(state({ limits: null, formData: { dashboardId: 7 } }));
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  const [chartData] = fetchMock.callHistory.calls(CHART_DATA);
  expect(
    JSON.parse(String(chartData.options.body)).form_data,
  ).not.toHaveProperty('dashboardId');
  const urlState = fetchMock.callHistory
    .calls('glob:*/api/v1/explore/form_data*')
    .map(call => JSON.parse(JSON.parse(String(call.options.body)).form_data));
  expect(urlState.every(formData => formData.dashboardId === 7)).toBe(true);
});

test('dashboard level: the answer names the dashboard, one GET adds its limit', async () => {
  server.dashboardId = 7;
  server.answer = LAST_WEEK;
  const getSpy = jest.spyOn(
    jest.requireActual('@superset-ui/core').SupersetClient,
    'get',
  );
  fetchMock.get(DASHBOARD, {
    result: {
      dashboard: { ...SPAN_30, max_span: { quantity: 5, time_grain: 'P1D' } },
      global: null,
      datasets: [],
    },
  });
  const { store } = renderExplore(state({ formData: { dashboardId: 7 } }));
  await checked();
  await waitFor(() =>
    expect(store.getState().explore.timeRangeCheck?.status).toBe('invalid'),
  );
  expect(fetchMock.callHistory.calls(DASHBOARD)).toHaveLength(1);
  expect(getSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: '/api/v1/dashboard/7/time_range_limits/',
      timeout: 10000,
      fetchRetryOptions: { retries: 0 },
    }),
  );
  expect(
    store.getState().explore.controls.adhoc_filters.validationErrors,
  ).toEqual(["Range can't be longer than 5 days. This one is 7 days."]);
  expect(chartDataCalls()).toBe(0);
  getSpy.mockRestore();
});

test('dashboard level: no dashboard named, no GET', async () => {
  server.dashboardId = null;
  renderExplore(state({ formData: { dashboardId: 7 } }));
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  expect(fetchMock.callHistory.calls(DASHBOARD)).toHaveLength(0);
});

test('dashboard level: a 403 adds no level; a 503 fails closed with Retry', async () => {
  server.dashboardId = 7;
  fetchMock.get(DASHBOARD, 403);
  renderExplore(state({ formData: { dashboardId: 7 } }));
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));

  fetchMock.clearHistory();
  fetchMock.removeRoutes();
  mockRoutes();
  fetchMock.get(DASHBOARD, 503);
  renderExplore(state({ formData: { dashboardId: 7 } }));
  expect(
    await screen.findByText(
      'Time range limits could not be loaded. Queries are paused to protect the database.',
    ),
  ).toBeInTheDocument();
  expect(chartDataCalls()).toBe(0);
});

test('pending while the dashboard GET is in flight', async () => {
  server.dashboardId = 7;
  let release: () => void = () => {};
  fetchMock.get(
    DASHBOARD,
    () =>
      new Promise(resolve => {
        release = () =>
          resolve({ result: { dashboard: null, global: null, datasets: [] } });
      }),
  );
  const { store } = renderExplore(state({ formData: { dashboardId: 7 } }));
  await checked();
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(DASHBOARD)).toHaveLength(1),
  );
  await settle();
  expect(store.getState().explore.timeRangeCheck?.status).toBe('pending');
  expect(chartDataCalls()).toBe(0);
  expect(await findUpdateChart()).toBeDisabled();
  await act(async () => release());
  await waitFor(() => expect(chartDataCalls()).toBe(1));
});

test('an answer for a dataset with no loaded limits stays pending, reads them once, then fails closed', async () => {
  server.datasetId = 2;
  let release: () => void = () => {};
  fetchMock.get(
    EXPLORE_GET,
    () =>
      new Promise(resolve => {
        release = () =>
          resolve({
            result: {
              time_range_limits: { global: SPAN_30, dataset: null },
            },
          });
      }),
  );
  const { store } = renderExplore();
  await checked();
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1),
  );
  expect(store.getState().explore.timeRangeCheck?.status).toBe('pending');
  expect(chartDataCalls()).toBe(0);
  await act(async () => release());
  await checked(2);
  expect(chartDataCalls()).toBe(0);
  expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1);
  expect(
    await screen.findByText(
      'Time range limits could not be loaded. Queries are paused to protect the database.',
    ),
  ).toBeInTheDocument();
});

test('a key change is pending at once; Update chart computes the key at click time', async () => {
  const { store } = renderExplore();
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  const checks = checkCalls().length;
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last year' },
      ]),
    );
  });
  expect(store.getState().explore.timeRangeCheck?.status).toBe('pending');
  expect(updateChart()).toBeDisabled();
  expect(checkCalls()).toHaveLength(checks);
  pressEnter({ ctrlKey: true });
  expect(chartDataCalls()).toBe(1);
  server.answer = LAST_45_DAYS;
  await checked(checks + 1);
  expect(chartDataCalls()).toBe(1);
  expect(updateChart()).toBeDisabled();
});

test('a late answer for an old request is dropped: still pending, no chart request', async () => {
  const held: ((value: object) => void)[] = [];
  fetchMock.removeRoutes();
  mockRoutes(
    undefined,
    () =>
      new Promise(resolve => {
        held.push(resolve);
      }),
  );
  const { store } = renderExplore();
  await waitFor(() => expect(held).toHaveLength(1));
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last day' },
      ]),
    );
  });
  await act(async () => {
    held[0](chartRangesAnswer(LAST_WEEK));
  });
  await settle();
  expect(store.getState().explore.timeRangeCheck?.status).toBe('pending');
  expect(chartDataCalls()).toBe(0);
  expect(await findUpdateChart()).toBeDisabled();

  await waitFor(() => expect(held).toHaveLength(2));
  await act(async () => {
    held[1](chartRangesAnswer(LAST_WEEK));
  });
  await waitFor(() => expect(chartDataCalls()).toBe(1));
});

test('a renderTrigger control keeps the check', async () => {
  const { store } = renderExplore();
  await checked();
  const checks = checkCalls().length;
  act(() => {
    store.dispatch(setControlValue('color_scheme', 'b'));
  });
  await settle();
  expect(checkCalls()).toHaveLength(checks);
  expect(store.getState().explore.timeRangeCheck?.status).toBe('valid');
});

test('Update chart and Ctrl+Enter: no request while invalid, one each when valid', async () => {
  const { store } = renderExplore();
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  await userEvent.click(await findUpdateChart());
  await waitFor(() => expect(chartDataCalls()).toBe(2));
  pressEnter({ ctrlKey: true });
  await waitFor(() => expect(chartDataCalls()).toBe(3));
  pressEnter({ metaKey: true });
  await waitFor(() => expect(chartDataCalls()).toBe(4));

  server.answer = LAST_45_DAYS;
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last 45 days' },
      ]),
    );
  });
  await checked(2);
  await userEvent.click(await findUpdateChart());
  pressEnter({ ctrlKey: true });
  pressEnter({ metaKey: true });
  await settle();
  expect(chartDataCalls()).toBe(4);
});

// The history react-router ships, which Explore's Back / Forward path listens to.
const renderWithRouterHistory = () => {
  mockExploreLocation();
  const store = createStore(sectionsState(), reducerIndex);
  let routerHistory: RouteComponentProps['history'] | undefined;
  render(
    <MemoryRouter initialEntries={['/explore/']}>
      <Route
        render={({ history }) => {
          routerHistory ??= history;
          return <ExploreViewContainer />;
        }}
      />
    </MemoryRouter>,
    { useRedux: true, useDnd: true, store },
  );
  return {
    store: store as unknown as Store<{ explore: ExploreState }>,
    history: routerHistory as RouteComponentProps['history'],
  };
};

// The URL write is debounced by 1000 ms, as long as waitFor's default timeout.
const URL_PUSH_WAIT = 4000;

test('Back to an invalid state sends no chart request; Forward to a valid one runs once', async () => {
  withoutUnsavedPrompt();
  const filter = (comparator: string) => [
    { ...controls().adhoc_filters.value[0], comparator },
  ];
  const { store, history } = renderWithRouterHistory();
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  await waitFor(
    () =>
      expect(history.location.state).toEqual(
        expect.objectContaining({ adhoc_filters: filter('Last week') }),
      ),
    { timeout: URL_PUSH_WAIT },
  );

  act(() => {
    store.dispatch(setControlValue('adhoc_filters', filter('Last day')));
  });
  await checked(2);
  await userEvent.click(await findUpdateChart());
  await waitFor(() => expect(chartDataCalls()).toBe(2));
  await waitFor(
    () =>
      expect(history.location.state).toEqual(
        expect.objectContaining({ adhoc_filters: filter('Last day') }),
      ),
    { timeout: URL_PUSH_WAIT },
  );

  server.answer = LAST_45_DAYS;
  act(() => {
    history.goBack();
  });
  await waitFor(() =>
    expect(store.getState().explore.controls.adhoc_filters?.value).toEqual(
      filter('Last week'),
    ),
  );
  await checked(3);
  expect(store.getState().explore.timeRangeCheck?.status).toBe('invalid');
  await settle();
  expect(chartDataCalls()).toBe(2);
  expect(await findUpdateChart()).toHaveClass('superset-button-primary');

  server.answer = LAST_WEEK;
  act(() => {
    history.goForward();
  });
  await waitFor(() =>
    expect(store.getState().explore.controls.adhoc_filters?.value).toEqual(
      filter('Last day'),
    ),
  );
  await checked(4);
  await waitFor(() => expect(chartDataCalls()).toBe(3));
  await settle();
  expect(chartDataCalls()).toBe(3);
  expect(await findUpdateChart()).not.toHaveClass('superset-button-primary');
});

test('limits turning off clear the last check errors: Update chart and Save are enabled again', async () => {
  server.answer = LAST_45_DAYS;
  const { store } = renderExplore();
  await checked();
  await waitFor(() =>
    expect(
      store.getState().explore.controls.adhoc_filters.validationErrors,
    ).toHaveLength(1),
  );
  expect(await findUpdateChart()).toBeDisabled();

  act(() => {
    store.dispatch(
      setExploreTimeRangeLimits({
        status: 'loaded',
        timezone: 'UTC',
        datasetId: 1,
        levels: [
          { source: 'global', policy: null },
          { source: 'dataset', policy: null },
        ],
      }),
    );
  });
  await waitFor(() =>
    expect(
      store.getState().explore.controls.adhoc_filters.validationErrors,
    ).toEqual([]),
  );
  expect(await findUpdateChart()).toBeEnabled();
  expect(screen.getByTestId('query-save-button')).toBeEnabled();
});

test('a held run does not go while a control has an error', async () => {
  const { store } = renderExplore();
  act(() => {
    store.dispatch(setControlValue('color_scheme', 'b', ['Required']));
  });
  await checked();
  await settle();
  expect(store.getState().explore.timeRangeCheck?.status).toBe('valid');
  expect(chartDataCalls()).toBe(0);
});

test('a control error drops the held run: fixing it sends no request until Run', async () => {
  const held: ((value: object) => void)[] = [];
  fetchMock.removeRoutes();
  mockRoutes(
    undefined,
    () =>
      new Promise(resolve => {
        held.push(resolve);
      }),
  );
  const { store } = renderExplore();
  await waitFor(() => expect(held).toHaveLength(1));
  await act(async () => {
    held[0](chartRangesAnswer(LAST_WEEK));
  });
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last day' },
      ]),
    );
  });
  await waitFor(() => expect(held).toHaveLength(2));
  pressEnter({ ctrlKey: true });
  expect(store.getState().explore.timeRangeRunOnValid).toBe('query');
  act(() => {
    store.dispatch(setControlValue('color_scheme', 'b', ['Required']));
  });
  act(() => {
    store.dispatch(setControlValue('color_scheme', 'a', []));
  });
  await act(async () => {
    held[1](chartRangesAnswer(LAST_WEEK));
  });
  await settle();
  expect(store.getState().explore.timeRangeCheck?.status).toBe('valid');
  expect(chartDataCalls()).toBe(1);

  await userEvent.click(await findUpdateChart());
  await waitFor(() => expect(chartDataCalls()).toBe(2));
});

test('a control error keeps the page-open run: fixing it before the answer sends one request', async () => {
  const held: ((value: object) => void)[] = [];
  fetchMock.removeRoutes();
  mockRoutes(
    undefined,
    () =>
      new Promise(resolve => {
        held.push(resolve);
      }),
  );
  const { store } = renderExplore();
  await waitFor(() => expect(held).toHaveLength(1));
  expect(store.getState().explore.timeRangeRunOnValid).toBe('mount');
  act(() => {
    store.dispatch(setControlValue('color_scheme', 'b', ['Required']));
  });
  act(() => {
    store.dispatch(setControlValue('color_scheme', 'a', []));
  });
  expect(store.getState().explore.timeRangeRunOnValid).toBe('mount');
  await act(async () => {
    held[0](chartRangesAnswer(LAST_WEEK));
  });
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  await settle();
  expect(chartDataCalls()).toBe(1);
});

test('save effect: blocked while invalid, runs once when the saved request is valid', async () => {
  server.answer = LAST_45_DAYS;
  const { store } = renderExplore();
  await checked();
  act(() => {
    store.dispatch(setSaveAction('overwrite'));
  });
  await settle();
  expect(chartDataCalls()).toBe(0);

  server.answer = LAST_WEEK;
  fetchMock.clearHistory();
  const valid = renderExplore();
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  act(() => {
    valid.store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last day' },
      ]),
    );
    valid.store.dispatch(setSaveAction('overwrite'));
  });
  expect(chartDataCalls()).toBe(1);
  await checked(2);
  await waitFor(() => expect(chartDataCalls()).toBe(2));
  await settle();
  expect(chartDataCalls()).toBe(2);
});

test('ownState effect: the new request is checked first, then runs once', async () => {
  const { store } = renderExplore();
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  act(() => {
    store.dispatch(updateDataMask(1, { ownState: { pageIndex: 2 } }));
  });
  expect(chartDataCalls()).toBe(1);
  await checked(2);
  await waitFor(() => expect(chartDataCalls()).toBe(2));
  await settle();
  expect(chartDataCalls()).toBe(2);

  server.answer = LAST_45_DAYS;
  act(() => {
    store.dispatch(updateDataMask(1, { ownState: { pageIndex: 3 } }));
  });
  await checked(3);
  expect(chartDataCalls()).toBe(2);
});

test('a server-paginated table goes back to the first page when the time range changes', async () => {
  getChartBuildQueryRegistry().registerValue(MODERN, cachedBuildQuery());
  const initial = state({
    formData: { query_mode: 'raw', all_columns: ['a'] },
  });
  initial.explore.controls = {
    ...controls(),
    query_mode: { value: 'raw' },
    all_columns: { value: ['a'] },
    server_pagination: { value: true },
    server_page_length: { value: 10 },
  } as never;
  initial.dataMask = {
    1: { ownState: { currentPage: 2, pageSize: 10 } },
  } as never;
  const { store } = renderExplore(initial);
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last day' },
      ]),
    );
  });
  await checked(2);
  await userEvent.click(await findUpdateChart());
  await waitFor(() => expect(chartDataCalls()).toBe(2));
  const [first, second] = fetchMock.callHistory
    .calls(CHART_DATA)
    .map(call => JSON.parse(String(call.options.body)).queries[0]);
  getChartBuildQueryRegistry().remove(MODERN);

  expect(first.row_offset).toBe(20);
  expect(second.row_offset).toBe(0);
});

test('stale link: no request while the check is pending; the held run goes once when valid', async () => {
  const { store } = renderExplore(state({ queriesResponse: RENDERED }));
  await checked();
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last day' },
      ]),
    );
  });
  await userEvent.click(screen.getByText('click here'));
  expect(chartDataCalls()).toBe(1);
  await checked(2);
  await waitFor(() => expect(chartDataCalls()).toBe(2));
  await settle();
  expect(chartDataCalls()).toBe(2);
});

test('Cached pill: no request while the check is not valid, one when valid', async () => {
  server.answer = LAST_45_DAYS;
  const { store } = renderExplore(
    state({ queriesResponse: RENDERED, explore: {} }),
  );
  await checked();
  await userEvent.click(await screen.findByText('Cached'));
  await settle();
  expect(chartDataCalls()).toBe(0);

  server.answer = LAST_WEEK;
  act(() => {
    store.dispatch(
      setControlValue('adhoc_filters', [
        { ...controls().adhoc_filters.value[0], comparator: 'Last day' },
      ]),
    );
  });
  await checked(2);
  await userEvent.click(await screen.findByText('Cached'));
  await waitFor(() => expect(chartDataCalls()).toBe(1));
});

test('Matrixify: the guard comes first', async () => {
  mockIsMatrixifyEnabled.mockReturnValue(true);
  server.answer = LAST_45_DAYS;
  const { store } = renderExplore(state({ queriesResponse: RENDERED }));
  await checked();
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/explore/form_data*'),
    ).toHaveLength(1),
  );
  const urlStates = fetchMock.callHistory.calls(
    'glob:*/api/v1/explore/form_data*',
  ).length;
  pressEnter({ ctrlKey: true });
  await settle();
  expect(store.getState().charts[1].chartStatus).toBe('rendered');
  expect(store.getState().charts[1].queriesResponse).toEqual(RENDERED);
  expect(
    fetchMock.callHistory.calls('glob:*/api/v1/explore/form_data*'),
  ).toHaveLength(urlStates);
});

test.each(['mount', 'query'] as const)(
  'Retry releasing a held %s run when no limits remain sends exactly one query',
  async run => {
    fetchMock.get(EXPLORE_GET, {
      result: { time_range_limits: { global: null, dataset: null } },
    });
    const { store } = renderExplore(state({ limits: { status: 'failed' } }));
    await screen.findByRole('button', { name: 'Retry' });
    act(() => {
      store.dispatch(setTimeRangeRunOnValid(run));
    });
    expect(chartDataCalls()).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(chartDataCalls()).toBe(1));
    expect(store.getState().explore.timeRangeRunOnValid).toBeNull();
    await settle();
    expect(chartDataCalls()).toBe(1);
    expect(checkCalls()).toHaveLength(0);
  },
);

test('Retry re-reads limits after a repeated dataset mismatch and recovers', async () => {
  server.datasetId = 2;
  fetchMock.get(
    EXPLORE_GET,
    {
      result: { time_range_limits: { global: SPAN_30, dataset: null } },
    },
    { delay: 600 },
  );
  const { store } = renderExplore();
  await screen.findByRole(
    'button',
    { name: 'Retry' },
    { timeout: URL_PUSH_WAIT },
  );
  expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(1);
  expect(chartDataCalls()).toBe(0);
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(EXPLORE_GET)).toHaveLength(2),
  );
  expect(chartDataCalls()).toBe(0);
  await screen.findByRole(
    'button',
    { name: 'Retry' },
    { timeout: URL_PUSH_WAIT },
  );
  server.datasetId = 1;
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() =>
    expect(store.getState().explore.timeRangeCheck?.status).toBe('valid'),
  );
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  await settle();
  expect(chartDataCalls()).toBe(1);
});

const emptyLevels = () => ({
  status: 'loaded' as const,
  datasetId: 1,
  timezone: 'UTC',
  levels: [
    { source: 'global' as const, policy: null },
    { source: 'dataset' as const, policy: null },
  ],
});

test('a dashboard with empty hydrated limits loads its level before any range check', async () => {
  let release: () => void = () => {};
  fetchMock.get(
    DASHBOARD,
    () =>
      new Promise(resolve => {
        release = () =>
          resolve({ result: { dashboard: null, global: null, datasets: [] } });
      }),
  );
  const { store } = renderExplore(
    state({
      formData: { dashboardId: 7 },
      limits: emptyLevels(),
    }),
  );
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(DASHBOARD)).toHaveLength(1),
  );
  await settle();
  expect(chartDataCalls()).toBe(0);
  expect(checkCalls()).toHaveLength(0);
  expect(await findUpdateChart()).toBeDisabled();
  await act(async () => release());
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  expect(store.getState().explore.timeRangeLimits?.dashboard).toEqual({
    id: 7,
    status: 'loaded',
    policy: null,
  });
  expect(await findUpdateChart()).toBeEnabled();
  expect(screen.getByTestId('query-save-button')).toBeEnabled();
  await userEvent.click(await findUpdateChart());
  await waitFor(() => expect(chartDataCalls()).toBe(2));
  await settle();
  expect(checkCalls()).toHaveLength(0);
  expect(fetchMock.callHistory.calls(DASHBOARD)).toHaveLength(1);
});

test('a failed dashboard level load holds an empty hydrated policy without range checks', async () => {
  fetchMock.get(DASHBOARD, 503);
  renderExplore(state({ formData: { dashboardId: 7 }, limits: emptyLevels() }));
  await screen.findByRole(
    'button',
    { name: 'Retry' },
    { timeout: URL_PUSH_WAIT },
  );
  await settle();
  expect(chartDataCalls()).toBe(0);
  expect(checkCalls()).toHaveLength(0);
  expect(fetchMock.callHistory.calls(DASHBOARD)).toHaveLength(1);
});

test('a range answer without a dashboard records it absent and releases subsequent runs', async () => {
  fetchMock.get(DASHBOARD, {
    result: { dashboard: SPAN_30, global: null, datasets: [] },
  });
  const { store } = renderExplore(
    state({ formData: { dashboardId: 7 }, limits: emptyLevels() }),
  );
  await checked();
  await waitFor(() =>
    expect(store.getState().explore.timeRangeLimits?.dashboard).toEqual({
      id: 7,
      status: 'absent',
    }),
  );
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  await userEvent.click(await findUpdateChart());
  await waitFor(() => expect(chartDataCalls()).toBe(2));
  await settle();
  expect(checkCalls()).toHaveLength(1);
});

test('refreshing empty limits leaves Explore runs and Save available', async () => {
  renderExplore(state({ limits: { ...emptyLevels(), refreshing: true } }));
  await waitFor(() => expect(chartDataCalls()).toBe(1));
  expect(await findUpdateChart()).toBeEnabled();
  expect(screen.getByTestId('query-save-button')).toBeEnabled();
  await userEvent.click(await findUpdateChart());
  await waitFor(() => expect(chartDataCalls()).toBe(2));
  await settle();
  expect(checkCalls()).toHaveLength(0);
});
