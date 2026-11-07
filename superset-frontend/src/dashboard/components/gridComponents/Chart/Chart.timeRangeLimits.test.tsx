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
import {
  act,
  createStore,
  render,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { FeatureFlag, SupersetClient, VizType } from '@superset-ui/core';
import * as redux from 'redux';

import { sliceEntitiesForChart as sliceEntities } from 'spec/fixtures/mockSliceEntities';
import mockDatasource from 'spec/fixtures/mockDatasource';
import chartQueries, {
  sliceId as queryId,
} from 'spec/fixtures/mockChartQueries';
import {
  refreshChart as refreshChartAction,
  triggerQuery as triggerQueryAction,
} from 'src/components/Chart/chartAction';
import { buildV1ChartDataPayload } from 'src/explore/exploreUtils';
import { onRefresh } from 'src/dashboard/actions/dashboardState';
import { HYDRATE_DASHBOARD } from 'src/dashboard/actions/hydrate';
import { clearDataMaskState } from 'src/dataMask/actions';
import type { RootState } from 'src/dashboard/types';
import TimeRangeLimitsAlert from 'src/dashboard/components/DashboardBuilder/TimeRangeLimitsAlert';
import Chart from './Chart';

jest.mock('src/explore/exploreUtils', () => {
  const actual = jest.requireActual('src/explore/exploreUtils');
  return {
    ...actual,
    buildV1ChartDataPayload: jest.fn(actual.buildV1ChartDataPayload),
  };
});

let capturedChartContainerProps: Record<string, unknown> = {};
jest.mock('src/components/Chart/ChartContainer', () => {
  const MockChartContainer = (props: Record<string, unknown>) => {
    capturedChartContainerProps = props;
    return <div data-test="chart-container" />;
  };
  return { __esModule: true, default: MockChartContainer };
});

const props = {
  id: queryId,
  width: 100,
  height: 100,
  updateSliceName() {},
  // from redux
  maxRows: 500, // will be overwritten with SQL_MAX_ROW from conf
  formData: chartQueries[queryId].form_data,
  datasource: (mockDatasource as Record<string, unknown>)[
    sliceEntities.slices[queryId].datasource
  ],
  sliceName: sliceEntities.slices[queryId].slice_name,
  timeout: 60,
  filters: {},
  refreshChart() {},
  toggleExpandSlice() {},
  addFilter() {},
  logEvent() {},
  handleToggleFullSize() {},
  changeFilter() {},
  setFocusedFilterField() {},
  unsetFocusedFilterField() {},
  addSuccessToast() {},
  addDangerToast() {},
  exportCSV() {},
  exportFullCSV() {},
  exportXLSX() {},
  exportFullXLSX() {},
  componentId: 'test',
  dashboardId: 111,
};

const defaultState = {
  charts: chartQueries,
  sliceEntities: {
    ...sliceEntities,
    slices: {
      [queryId]: {
        ...sliceEntities.slices[queryId],
        description_markdown: 'markdown',
        viz_type: VizType.Table,
      },
    },
  },
  datasources: mockDatasource,
  dashboardState: { editMode: false, expandedSlices: {} },
  dashboardInfo: {
    id: props.dashboardId,
    superset_can_explore: false,
    superset_can_share: false,
    superset_can_download: false,
    common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 0, SQL_MAX_ROW: 666 } },
  },
  dashboardLayout: {
    present: {},
    past: [],
    future: [],
  },
};

function setup(
  overrideProps: Record<string, unknown> = {},
  overrideState: Record<string, unknown> = {},
) {
  return render(<Chart {...props} {...overrideProps} />, {
    useRedux: true,
    useRouter: true,
    initialState: { ...defaultState, ...overrideState },
  });
}

const refreshChart = jest.fn();
const logEvent = jest.fn();
const changeFilter = jest.fn();
const addSuccessToast = jest.fn();
const addDangerToast = jest.fn();
const toggleExpandSlice = jest.fn();
const setFocusedFilterField = jest.fn();
const unsetFocusedFilterField = jest.fn();
beforeAll(() => {
  jest.spyOn(redux, 'bindActionCreators').mockImplementation(() => ({
    refreshChart,
    logEvent,
    changeFilter,
    addSuccessToast,
    addDangerToast,
    toggleExpandSlice,
    setFocusedFilterField,
    unsetFocusedFilterField,
  }));
});

afterEach(() => {
  jest.clearAllMocks();
});

const RANGES_URL = 'glob:*/api/v1/time_range_limits/chart_ranges/';
const LIMITS_URL = 'glob:*/api/v1/dashboard/111/time_range_limits/';
const SPAN_90 = {
  max_span: { quantity: 90, time_grain: 'P1D' },
  max_look_back: null,
  max_look_forward: null,
};
const LIMITS_PAYLOAD = {
  global: null,
  dashboard: SPAN_90,
  datasets: [],
  timezone: 'UTC',
  needs_review: [],
  eligible_time_grains: [],
};
const LAST_YEAR = {
  since: '2025-10-30T00:00:00',
  until: '2026-10-30T00:00:00',
  time_offset: null,
  source: [{ kind: 'granularity', query_index: 0, index: null }],
};
const LAST_WEEK = { ...LAST_YEAR, since: '2026-10-23T00:00:00' };

const answerWith =
  (answer: Record<string, unknown>) =>
  ({ options }: { options: { body?: unknown } }) => ({
    result: {
      now: '2026-10-30T12:00:00',
      today: '2026-10-30T00:00:00',
      timezone: 'UTC',
      charts: JSON.parse(String(options.body)).charts.map(
        (entry: { key: string }) => ({
          key: entry.key,
          dataset_id: null,
          dashboard_id: 111,
          ...answer,
        }),
      ),
    },
  });

const limitsState = (overrides: Record<string, unknown> = {}) => ({
  timeRangeLimits: {
    status: 'loaded',
    dashboardId: 111,
    request: 0,
    payload: LIMITS_PAYLOAD,
    charts: {},
    ...overrides,
  },
});

const chartState = (overrides: Record<string, unknown> = {}) => ({
  charts: {
    [queryId]: {
      ...chartQueries[queryId],
      chartStatus: 'loading',
      triggerQuery: true,
      queriesResponse: null,
      ...overrides,
    },
  },
});

function setupHeld(
  stateOverrides: Record<string, unknown> = {},
  answer?: Record<string, unknown>,
  flagOn = true,
) {
  window.featureFlags = flagOn ? { [FeatureFlag.TimeRangeLimits]: true } : {};
  capturedChartContainerProps = {};
  fetchMock.post(
    RANGES_URL,
    answerWith(answer ?? { status: 'ok', ranges: [] }),
  );
  fetchMock.get(LIMITS_URL, { result: LIMITS_PAYLOAD });
  return setup(
    {},
    {
      ...defaultState,
      ...chartState(),
      ...limitsState(),
      ...stateOverrides,
    },
  );
}

const rangeCalls = () => fetchMock.callHistory.calls(RANGES_URL);

const held = (container: HTMLElement) =>
  container.querySelector('[data-test="chart-held"]');

beforeAll(() => {
  fetchMock.mockGlobal();
  SupersetClient.reset();
  SupersetClient.configure({ protocol: 'http:', host: 'localhost' }).init();
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  window.featureFlags = {};
});

afterAll(() => fetchMock.hardReset());

test('limits on, policy loading: the default Loading, the chart is not run', () => {
  const { container, queryByTestId } = setupHeld(
    limitsState({ status: 'loading', payload: null }),
  );

  expect(held(container)).toBeInTheDocument();
  expect(container.querySelector('.loading')).toBeInTheDocument();
  expect(queryByTestId('chart-container')).not.toBeInTheDocument();
  expect(rangeCalls()).toHaveLength(0);
});

test('limits on, policy failed: "Waiting for a valid time range", the chart is not run', () => {
  const { getByText, queryByTestId } = setupHeld(
    limitsState({ status: 'failed', payload: null }),
  );

  expect(getByText('Waiting for a valid time range')).toBeInTheDocument();
  expect(queryByTestId('chart-container')).not.toBeInTheDocument();
  expect(rangeCalls()).toHaveLength(0);
});

test('limits on, invalid range: "Waiting for a valid time range", never run', async () => {
  const { findByText, queryByTestId } = setupHeld(
    {},
    { status: 'ok', ranges: [LAST_YEAR] },
  );

  expect(
    await findByText('Waiting for a valid time range'),
  ).toBeInTheDocument();
  expect(queryByTestId('chart-container')).not.toBeInTheDocument();
  expect(rangeCalls()).toHaveLength(1);
});

test('limits on, unbounded range on a temporal chart: "Waiting for a valid time range"', async () => {
  const { findByText, queryByTestId } = setupHeld(
    {},
    {
      status: 'ok',
      ranges: [{ ...LAST_YEAR, since: null, until: null, source: null }],
    },
  );

  expect(
    await findByText('Waiting for a valid time range'),
  ).toBeInTheDocument();
  expect(queryByTestId('chart-container')).not.toBeInTheDocument();
});

function setupWithStore(stateOverrides: Record<string, unknown> = {}) {
  window.featureFlags = { [FeatureFlag.TimeRangeLimits]: true };
  capturedChartContainerProps = {};
  const store = createStore(
    {
      ...defaultState,
      ...chartState(),
      ...limitsState(),
      ...stateOverrides,
    },
    reducerIndex,
  );
  return {
    store,
    ...render(<Chart {...props} />, { store, useRouter: true }),
  };
}

const finalFormData = () => {
  const { unmount } = setupHeld({}, undefined, false);
  const { formData } = capturedChartContainerProps;
  unmount();
  fetchMock.clearHistory().removeRoutes();
  return JSON.parse(JSON.stringify(formData));
};

test('limits on, endpoint call failed (unavailable): "Waiting for a valid time range", never run', async () => {
  fetchMock.post(RANGES_URL, { status: 500, body: {} });
  const { findByText, queryByTestId } = setupWithStore();

  expect(
    await findByText('Waiting for a valid time range'),
  ).toBeInTheDocument();
  expect(rangeCalls()).toHaveLength(1);
  expect(queryByTestId('chart-container')).not.toBeInTheDocument();
});

test.each([
  ['Refresh dashboard', () => onRefresh([queryId], true, 0, 111)],
  ['auto-refresh tick', () => onRefresh([queryId], false, 0, 111, true)],
  ['Force refresh', () => refreshChartAction(queryId, true, 111)],
  ['Retry', () => refreshChartAction(queryId, false, 111)],
])(
  'limits on, endpoint call failed: %s checks the chart again, which runs on valid',
  async (_, refresh) => {
    fetchMock.post(RANGES_URL, { status: 500, body: {} });
    const { store, findByText, findByTestId } = setupWithStore();
    expect(
      await findByText('Waiting for a valid time range'),
    ).toBeInTheDocument();
    fetchMock.removeRoutes();
    fetchMock.post(
      RANGES_URL,
      answerWith({ status: 'ok', ranges: [LAST_WEEK] }),
    );

    await store.dispatch(refresh() as never);

    expect(await findByTestId('chart-container')).toBeInTheDocument();
    expect(capturedChartContainerProps.triggerQuery).toBe(true);
    expect(rangeCalls()).toHaveLength(2);
  },
);

test.each([
  ['slow', 30],
  ['fast', 0],
])(
  'limits on, endpoint call failed: Retry on the dashboard alert with a %s limits load checks the chart once',
  async (_, delay) => {
    window.featureFlags = { [FeatureFlag.TimeRangeLimits]: true };
    capturedChartContainerProps = {};
    fetchMock.post(RANGES_URL, { status: 500, body: {} });
    const store = createStore(
      { ...defaultState, ...chartState(), ...limitsState() },
      reducerIndex,
    );
    const { findByText, findByTestId, getByRole } = render(
      <>
        <TimeRangeLimitsAlert filterBarOpen={false} />
        <Chart {...props} />
      </>,
      { store, useRouter: true },
    );
    expect(
      await findByText('Waiting for a valid time range'),
    ).toBeInTheDocument();
    fetchMock.removeRoutes();
    fetchMock.get(LIMITS_URL, async () => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return { result: LIMITS_PAYLOAD };
    });
    fetchMock.post(RANGES_URL, async call => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return answerWith({ status: 'ok', ranges: [LAST_WEEK] })(call);
    });

    await userEvent.click(getByRole('button', { name: 'Retry' }));

    expect(await findByTestId('chart-container')).toBeInTheDocument();
    await act(() => new Promise(resolve => setTimeout(resolve, 150)));
    const entriesAfterRetry = rangeCalls()
      .slice(1)
      .flatMap(call => JSON.parse(String(call.options.body)).charts);
    expect(entriesAfterRetry).toHaveLength(1);
    expect(fetchMock.callHistory.calls(LIMITS_URL)).toHaveLength(1);
    expect(capturedChartContainerProps.triggerQuery).toBe(true);
  },
);

test('limits on, a chart asked to run again keeps triggerQuery false until its check is valid', async () => {
  const formData = finalFormData();
  const { findByText } = setupHeld(
    {
      ...chartState({
        chartStatus: 'rendered',
        triggerQuery: true,
        latestQueryFormData: formData,
        queriesResponse: [{ data: [] }],
      }),
      ...limitsState({
        charts: {
          [queryId]: {
            signature: JSON.stringify(formData),
            status: 'queried',
          },
        },
      }),
    },
    { status: 'ok', ranges: [LAST_YEAR] },
  );

  expect(capturedChartContainerProps.triggerQuery).toBe(false);
  expect(
    await findByText('Waiting for a valid time range'),
  ).toBeInTheDocument();
  expect(capturedChartContainerProps.triggerQuery).toBe(false);
  expect(rangeCalls()).toHaveLength(1);
});

test('limits on, a rendered chart asked to run again stays mounted under the spinner while it is checked, then runs', async () => {
  let release: () => void = () => {};
  const answered = new Promise<void>(resolve => {
    release = resolve;
  });
  fetchMock.post(RANGES_URL, async (call: { options: { body?: unknown } }) => {
    await answered;
    return answerWith({ status: 'ok', ranges: [LAST_WEEK] })(call);
  });
  const { store, container, getByTestId } = setupWithStore(
    chartState({
      chartStatus: 'rendered',
      triggerQuery: false,
      queriesResponse: [{ data: [] }],
    }),
  );
  const chartNode = getByTestId('chart-container');
  expect(rangeCalls()).toHaveLength(0);

  act(() => {
    store.dispatch(triggerQueryAction(true, queryId));
  });

  expect(
    (store.getState() as unknown as RootState).charts[queryId].chartStatus,
  ).toBe('loading');
  await waitFor(() => expect(rangeCalls()).toHaveLength(1));
  expect(held(container)?.querySelector('.loading')).toBeInTheDocument();
  expect(getByTestId('chart-container')).toBe(chartNode);
  expect(capturedChartContainerProps.triggerQuery).toBe(false);

  release();

  await waitFor(() =>
    expect(capturedChartContainerProps.triggerQuery).toBe(true),
  );
  expect(getByTestId('chart-container')).toBe(chartNode);
  expect(held(container)).not.toBeInTheDocument();
});

test('limits on, a failed chart asked to run again shows the placeholder while it is checked', async () => {
  fetchMock.post(RANGES_URL, () => new Promise(() => {}));
  const { store, container, getByTestId, queryByTestId } = setupWithStore(
    chartState({
      chartStatus: 'failed',
      triggerQuery: false,
      queriesResponse: [{ error: 'Query failed' }],
    }),
  );
  expect(getByTestId('chart-container')).toBeInTheDocument();

  act(() => {
    store.dispatch(triggerQueryAction(true, queryId));
  });

  await waitFor(() => expect(rangeCalls()).toHaveLength(1));
  expect(held(container)?.querySelector('.loading')).toBeInTheDocument();
  expect(queryByTestId('chart-container')).not.toBeInTheDocument();
});

test('limits on, a dashboard version preview re-hydrates the charts and a held chart stays held', async () => {
  const { store, findByTestId, findByText } = setupWithStore();
  fetchMock.removeRoutes();
  fetchMock.post(RANGES_URL, answerWith({ status: 'ok', ranges: [LAST_WEEK] }));
  expect(await findByTestId('chart-container')).toBeInTheDocument();
  fetchMock.removeRoutes();
  fetchMock.post(RANGES_URL, answerWith({ status: 'ok', ranges: [LAST_YEAR] }));

  const state = store.getState() as unknown as RootState;
  capturedChartContainerProps = {};
  store.dispatch(clearDataMaskState());
  store.dispatch({
    type: HYDRATE_DASHBOARD,
    data: {
      ...state,
      charts: {
        [queryId]: {
          ...state.charts[queryId],
          form_data: {
            ...state.charts[queryId].form_data,
            time_range: 'Last year',
          },
          chartStatus: 'loading',
          triggerQuery: true,
          queriesResponse: null,
        },
      },
    },
  });

  expect(
    await findByText('Waiting for a valid time range'),
  ).toBeInTheDocument();
  expect(capturedChartContainerProps.triggerQuery).toBeUndefined();
  expect(rangeCalls()).toHaveLength(2);
});

test('limits on, valid range: the chart runs once its ranges pass', async () => {
  const { findByTestId } = setupHeld({}, { status: 'ok', ranges: [LAST_WEEK] });

  expect(await findByTestId('chart-container')).toBeInTheDocument();
  expect(capturedChartContainerProps.triggerQuery).toBe(true);
  expect(rangeCalls()).toHaveLength(1);
  const [entry] = JSON.parse(String(rangeCalls()[0].options.body)).charts;
  expect(entry.query_context.form_data).toMatchObject({
    slice_id: queryId,
    dashboardId: 111,
  });
});

test('limits on, the check is built with the own state the chart runs with', async () => {
  const { findByTestId } = setupHeld({}, { status: 'ok', ranges: [LAST_WEEK] });

  await findByTestId('chart-container');

  const [build] = jest.mocked(buildV1ChartDataPayload).mock.calls;
  expect(build[0].formData).toBe(capturedChartContainerProps.formData);
  expect(build[0].ownState).toBe(capturedChartContainerProps.ownState);
});

test('limits on, a chart the endpoint answers with an error shows it with the default display, no request', async () => {
  const { findByTestId } = setupHeld(
    {},
    {
      status: 'error',
      error: { status: 403, body: { message: 'Forbidden here' } },
    },
  );

  expect(await findByTestId('chart-container')).toBeInTheDocument();
  await waitFor(() =>
    expect(capturedChartContainerProps.chartStatus).toBe('failed'),
  );
  expect(capturedChartContainerProps.chartAlert).toBe('Forbidden here');
  expect(capturedChartContainerProps.triggerQuery).toBe(false);
});

test('limits on, a rendered chart whose new form data the endpoint answers with a time range error shows it, without looping', async () => {
  const formData = finalFormData();
  const { container, findByTestId } = setupHeld(
    chartState({
      chartStatus: 'rendered',
      triggerQuery: true,
      latestQueryFormData: { ...formData, time_range: 'Last week' },
      queriesResponse: [{ data: [] }],
    }),
    {
      status: 'error',
      error: {
        status: 503,
        body: {
          errors: [
            {
              error_type: 'TIME_RANGE_LIMIT_ERROR',
              message: 'Time range limits could not be loaded.',
              level: 'error',
              extra: { reason_code: 'POLICY_UNAVAILABLE' },
            },
          ],
        },
      },
    },
  );

  expect(await findByTestId('chart-container')).toBeInTheDocument();
  await waitFor(() =>
    expect(capturedChartContainerProps.chartStatus).toBe('failed'),
  );
  await act(() => new Promise(resolve => setTimeout(resolve, 300)));
  expect(rangeCalls().length).toBeLessThanOrEqual(1);
  expect(fetchMock.callHistory.calls(LIMITS_URL).length).toBeLessThanOrEqual(1);
  expect(held(container)).not.toBeInTheDocument();
  expect(capturedChartContainerProps.chartStatus).toBe('failed');
  expect(capturedChartContainerProps.triggerQuery).toBe(false);
});

test('limits on, after a server 400 the error stays, one policy GET, no re-post', async () => {
  const queriesResponse = [
    {
      status: 400,
      errors: [
        {
          error_type: 'TIME_RANGE_LIMIT_ERROR',
          message: 'Longer than this dashboard allows (90 days).',
          level: 'error',
          extra: {},
        },
      ],
    },
  ];
  const { getByTestId } = setupHeld(
    chartState({
      chartStatus: 'failed',
      triggerQuery: false,
      chartAlert: 'Longer than this dashboard allows (90 days).',
      latestQueryFormData: chartQueries[queryId].form_data,
      queriesResponse,
    }),
  );

  expect(getByTestId('chart-container')).toBeInTheDocument();
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(LIMITS_URL)).toHaveLength(1),
  );
  expect(capturedChartContainerProps.chartStatus).toBe('failed');
  expect(capturedChartContainerProps.queriesResponse).toEqual(queriesResponse);
  expect(capturedChartContainerProps.triggerQuery).toBe(false);
  expect(rangeCalls()).toHaveLength(0);
});

test('limits on, after a server 400 on the final form data the server message stays, not the placeholder', async () => {
  const formData = finalFormData();
  const queriesResponse = [
    {
      status: 400,
      errors: [
        {
          error_type: 'TIME_RANGE_LIMIT_ERROR',
          message: 'Longer than this dashboard allows (90 days).',
          level: 'error',
          extra: {},
        },
      ],
    },
  ];
  fetchMock.get(LIMITS_URL, { result: LIMITS_PAYLOAD });
  const { store, container, getByTestId, queryByText } = setupWithStore(
    chartState({
      chartStatus: 'failed',
      triggerQuery: false,
      chartAlert: 'Longer than this dashboard allows (90 days).',
      latestQueryFormData: formData,
      queriesResponse,
    }),
  );

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(LIMITS_URL)).toHaveLength(1),
  );
  expect(
    (
      store.getState() as unknown as {
        timeRangeLimits: { charts: Record<number, unknown> };
      }
    ).timeRangeLimits.charts[queryId],
  ).toEqual({ signature: JSON.stringify(formData), status: 'rejected' });
  expect(getByTestId('chart-container')).toBeInTheDocument();
  expect(held(container)).not.toBeInTheDocument();
  expect(queryByText('Waiting for a valid time range')).not.toBeInTheDocument();
  expect(capturedChartContainerProps.queriesResponse).toEqual(queriesResponse);
  expect(capturedChartContainerProps.triggerQuery).toBe(false);
});

test('limits on, a chart already showing results keeps them while the policy is loaded again', () => {
  const { getByTestId } = setupHeld({
    ...chartState({
      chartStatus: 'rendered',
      triggerQuery: false,
      queriesResponse: [{ data: [] }],
    }),
    ...limitsState({ status: 'loading' }),
  });

  expect(getByTestId('chart-container')).toBeInTheDocument();
  expect(capturedChartContainerProps.triggerQuery).toBe(false);
});

test('limits loaded with no rule at any level: no endpoint call, triggerQuery passed through', async () => {
  const { global, needs_review, eligible_time_grains } = LIMITS_PAYLOAD;
  const { getByTestId } = setupHeld(
    limitsState({
      payload: { global, dashboard: null, needs_review, eligible_time_grains },
    }),
  );

  expect(getByTestId('chart-container')).toBeInTheDocument();
  expect(capturedChartContainerProps.triggerQuery).toBe(true);
  await act(() => new Promise(resolve => setTimeout(resolve, 50)));
  expect(rangeCalls()).toHaveLength(0);
});

test('limits flag off: no endpoint call, triggerQuery passed through', () => {
  const { getByTestId } = setupHeld({}, undefined, false);

  expect(getByTestId('chart-container')).toBeInTheDocument();
  expect(capturedChartContainerProps.triggerQuery).toBe(true);
  expect(rangeCalls()).toHaveLength(0);
});

test.each([true, false])(
  'renders a missing chart with limits enabled: %s',
  flagOn => {
    window.featureFlags = flagOn ? { [FeatureFlag.TimeRangeLimits]: true } : {};
    const view = setup({}, { charts: {} });
    expect(
      view.getByText(/Delete this container and save to remove this message/),
    ).toBeInTheDocument();
  },
);

type ChartView = ReturnType<typeof setupWithStore>;

test.each<[string, typeof LAST_YEAR, (view: ChartView) => Promise<void>]>([
  [
    'valid',
    LAST_WEEK,
    async ({ findByTestId }) => {
      expect(await findByTestId('chart-container')).toBeInTheDocument();
      expect(capturedChartContainerProps.triggerQuery).toBe(true);
    },
  ],
  [
    'invalid',
    LAST_YEAR,
    async ({ queryByTestId, findByText }) => {
      expect(queryByTestId('chart-container')).not.toBeInTheDocument();
      expect(
        await findByText('Waiting for a valid time range'),
      ).toBeInTheDocument();
    },
  ],
])(
  'Force refresh rechecks a settled first-load chart and keeps a %s range gated',
  async (status, range, expectView) => {
    fetchMock.post(RANGES_URL, { status: 500, body: {} });
    const view = setupWithStore(chartState({ chartUpdateEndTime: null }));
    const { store, getByRole, findByText, queryByTestId } = view;
    refreshChart.mockImplementation(
      (id: number, force: boolean, dashboardId: number) =>
        store.dispatch(refreshChartAction(id, force, dashboardId) as never),
    );
    try {
      expect(
        await findByText('Waiting for a valid time range'),
      ).toBeInTheDocument();
      const settledChart = (store.getState() as unknown as RootState).charts[
        queryId
      ];
      expect(settledChart.chartStatus).toBe('stopped');
      expect(settledChart.chartUpdateEndTime).toEqual(expect.any(Number));
      expect(queryByTestId('chart-container')).not.toBeInTheDocument();
      fetchMock.removeRoutes();
      fetchMock.post(RANGES_URL, answerWith({ status: 'ok', ranges: [range] }));

      await userEvent.click(getByRole('button', { name: 'More Options' }));
      const refreshItem = (await findByText('Force refresh')).closest(
        '[role="menuitem"]',
      );
      expect(refreshItem).not.toHaveAttribute('aria-disabled', 'true');
      await userEvent.click(await findByText('Force refresh'));

      await waitFor(() => expect(rangeCalls()).toHaveLength(2));
      await waitFor(() =>
        expect(
          (store.getState() as unknown as RootState).timeRangeLimits.charts[
            queryId
          ].status,
        ).toBe(status),
      );
      expect(refreshChart).toHaveBeenCalledWith(queryId, true, 111);
      await expectView(view);
    } finally {
      refreshChart.mockReset();
    }
  },
);

test('limits loaded with no rules recover after a server 400 limit error', async () => {
  fetchMock.get(LIMITS_URL, { result: LIMITS_PAYLOAD });
  const { store } = setupWithStore({
    ...limitsState({ payload: { ...LIMITS_PAYLOAD, dashboard: null } }),
    ...chartState({
      chartStatus: 'failed',
      triggerQuery: false,
      latestQueryFormData: chartQueries[queryId].form_data,
      queriesResponse: [
        {
          status: 400,
          errors: [
            {
              error_type: 'TIME_RANGE_LIMIT_ERROR',
              message: 'Longer than this dashboard allows (90 days).',
              level: 'error',
              extra: {},
            },
          ],
        },
      ],
    }),
  });

  await waitFor(() => {
    expect(fetchMock.callHistory.calls(LIMITS_URL)).toHaveLength(1);
    expect(
      (store.getState() as unknown as RootState).timeRangeLimits.charts[queryId]
        ?.status,
    ).toBe('rejected');
  });
  expect(rangeCalls()).toHaveLength(0);
});
