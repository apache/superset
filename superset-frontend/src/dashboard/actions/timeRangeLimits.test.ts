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
import { SupersetClient, type JsonObject } from '@superset-ui/core';
import { createStore } from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import {
  postChartFormData,
  refreshChart,
} from 'src/components/Chart/chartAction';
import { onRefresh } from 'src/dashboard/actions/dashboardState';
import { dashboardInfoChanged } from 'src/dashboard/actions/dashboardInfo';
import { buildV1ChartDataPayload } from 'src/explore/exploreUtils';
import type { ChartRange } from 'src/utils/timeRangeLimits';
import {
  acknowledgeEditorNotice,
  attributeChartFailures,
  chartHoldMode,
  checkChartRanges,
  fetchTimeRangeLimits,
  noteChartRejection,
  refetchTimeRangeLimitsAfterSave,
  timeRangeFilterOfChart,
} from './timeRangeLimits';

jest.mock('src/explore/exploreUtils', () => {
  const actual = jest.requireActual('src/explore/exploreUtils');
  return {
    ...actual,
    buildV1ChartDataPayload: jest.fn(actual.buildV1ChartDataPayload),
  };
});

const DASHBOARD_ID = 9;
const LIMITS_URL = `glob:*/api/v1/dashboard/${DASHBOARD_ID}/time_range_limits/`;
const RANGES_URL = 'glob:*/api/v1/time_range_limits/chart_ranges/';
const CHART_DATA_URL = 'glob:*/api/v1/chart/data*';

const UNSET = { max_span: null, max_look_back: null, max_look_forward: null };
const SPAN_90 = {
  max_span: { quantity: 90, time_grain: 'P1D' },
  max_look_back: null,
  max_look_forward: null,
};
const PAYLOAD = {
  global: UNSET,
  dashboard: SPAN_90,
  datasets: [{ id: 7, name: 'calls', policy: UNSET }],
  timezone: 'UTC',
  needs_review: [],
  eligible_time_grains: [],
};

const LAST_WEEK: ChartRange = {
  since: '2026-10-23T00:00:00',
  until: '2026-10-30T00:00:00',
  time_offset: null,
  source: [{ kind: 'granularity', query_index: 0, index: null }],
};
const LAST_YEAR: ChartRange = {
  since: '2025-10-30T00:00:00',
  until: '2026-10-30T00:00:00',
  time_offset: null,
  source: [{ kind: 'granularity', query_index: 0, index: null }],
};

let ranges: Record<number, ChartRange[]> = {};

const answerRanges = ({ options }: { options: { body?: unknown } }) => ({
  result: {
    now: '2026-10-30T12:00:00',
    today: '2026-10-30T00:00:00',
    timezone: 'UTC',
    charts: JSON.parse(String(options.body)).charts.map((entry: JsonObject) => {
      const formData = (entry.form_data ??
        (entry.query_context as JsonObject).form_data) as JsonObject;
      return {
        key: entry.key,
        status: 'ok',
        ranges: ranges[formData.slice_id as number] ?? [],
        dataset_id: 7,
        dashboard_id: DASHBOARD_ID,
      };
    }),
  },
});

const formDataOf = (chartId: number, extra: JsonObject = {}) => ({
  slice_id: chartId,
  datasource: '7__table',
  viz_type: 'table',
  dashboardId: DASHBOARD_ID,
  ...extra,
});

const chartOf = (chartId: number, extra: JsonObject = {}) => ({
  id: chartId,
  chartStatus: 'rendered',
  triggerQuery: false,
  latestQueryFormData: formDataOf(chartId),
  queriesResponse: [{ data: [] }],
  ...extra,
});

const limitsOf = (overrides: JsonObject = {}) => ({
  status: 'loaded',
  dashboardId: DASHBOARD_ID,
  request: 0,
  payload: PAYLOAD,
  charts: {},
  ...overrides,
});

function setup(state: JsonObject = {}) {
  return createStore(
    {
      charts: {},
      dataMask: {},
      nativeFilters: { filters: {} },
      dashboardInfo: {
        id: DASHBOARD_ID,
        metadata: {},
        common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
      },
      dashboardState: { sliceIds: [1, 2, 3] },
      timeRangeLimits: limitsOf(),
      ...state,
    },
    reducerIndex,
  );
}

type Store = ReturnType<typeof setup>;

const stateOf = (store: Store) => store.getState() as unknown as JsonObject;

const dispatchOn = (store: Store, action: unknown) =>
  store.dispatch(action as Parameters<Store['dispatch']>[0]) as unknown;

const limitsState = (store: Store) =>
  (store.getState() as JsonObject).timeRangeLimits as JsonObject;

const holdOf = (store: Store, chartId: number) =>
  (limitsState(store).charts as JsonObject)[chartId] as JsonObject;

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

const gets = () => fetchMock.callHistory.calls(LIMITS_URL);
const rangeCalls = () => fetchMock.callHistory.calls(RANGES_URL);
const posts = () => fetchMock.callHistory.calls(CHART_DATA_URL);

beforeAll(() => {
  fetchMock.mockGlobal();
  SupersetClient.reset();
  SupersetClient.configure({ protocol: 'http:', host: 'localhost' }).init();
});

afterAll(() => fetchMock.hardReset());

beforeEach(() => {
  jest.mocked(buildV1ChartDataPayload).mockClear();
  window.featureFlags = { TIME_RANGE_LIMITS: true };
  ranges = {};
  fetchMock.post(RANGES_URL, answerRanges);
  fetchMock.post(CHART_DATA_URL, { result: [{ data: [] }] });
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  window.featureFlags = {};
});

test('policy GET: one request with a 10 s timeout and no retry; the full answer is kept', async () => {
  const get = jest.spyOn(SupersetClient, 'get');
  fetchMock.get(LIMITS_URL, { result: PAYLOAD });
  const store = setup({ timeRangeLimits: undefined });

  await dispatchOn(store, fetchTimeRangeLimits(DASHBOARD_ID));

  expect(gets()).toHaveLength(1);
  expect(get).toHaveBeenCalledWith({
    endpoint: `/api/v1/dashboard/${DASHBOARD_ID}/time_range_limits/`,
    timeout: 10000,
    fetchRetryOptions: { retries: 0 },
  });
  expect(limitsState(store)).toMatchObject({
    status: 'loaded',
    dashboardId: DASHBOARD_ID,
    payload: PAYLOAD,
  });
  expect((limitsState(store).payload as typeof PAYLOAD).datasets[0].id).toBe(7);
  get.mockRestore();
});

test('policy GET: loading until it answers; an error or a timeout gives failed', async () => {
  fetchMock.get(LIMITS_URL, { status: 500, body: {} });
  const store = setup({ timeRangeLimits: undefined });

  const pending = dispatchOn(store, fetchTimeRangeLimits(DASHBOARD_ID));
  expect(limitsState(store).status).toBe('loading');
  expect(chartHoldMode(limitsState(store) as never)).toBe('loading');
  await pending;

  expect(limitsState(store).status).toBe('failed');
  expect(chartHoldMode(limitsState(store) as never)).toBe('failed');
  expect(gets()).toHaveLength(1);
});

test('policy GET: Retry is one more dispatch, one more GET', async () => {
  fetchMock.get(LIMITS_URL, { status: 500, body: {} });
  const store = setup({ timeRangeLimits: undefined });
  await dispatchOn(store, fetchTimeRangeLimits(DASHBOARD_ID));
  expect(gets()).toHaveLength(1);

  fetchMock.removeRoutes();
  fetchMock.get(LIMITS_URL, { result: PAYLOAD });
  await dispatchOn(store, fetchTimeRangeLimits(DASHBOARD_ID));

  expect(gets()).toHaveLength(2);
  expect(limitsState(store).status).toBe('loaded');
});

test('policy state: its own store key, reset when the dashboard changes', async () => {
  fetchMock.get('glob:*/api/v1/dashboard/10/time_range_limits/', {
    result: PAYLOAD,
  });
  const store = setup({
    timeRangeLimits: limitsOf({
      charts: { 1: { signature: 'x', status: 'invalid' } },
    }),
  });

  const pending = dispatchOn(store, fetchTimeRangeLimits(10));
  expect(limitsState(store)).toMatchObject({
    status: 'loading',
    dashboardId: 10,
    payload: null,
    charts: {},
  });
  await pending;
  expect(limitsState(store).status).toBe('loaded');
  expect(Object.keys(stateOf(store).dashboardInfo)).not.toContain(
    'timeRangeLimits',
  );
});

test('flag off: no GET and the charts are not held', async () => {
  window.featureFlags = {};
  fetchMock.get(LIMITS_URL, { result: PAYLOAD });
  const store = setup({ timeRangeLimits: undefined });

  await dispatchOn(store, fetchTimeRangeLimits(DASHBOARD_ID));

  expect(gets()).toHaveLength(0);
  expect(limitsState(store).status).toBe('off');
  expect(chartHoldMode(limitsOf() as never)).toBe('off');
});

const NOTICE_URL = 'glob:*/api/v1/time_range_limits/notice/';

test('acknowledging the editor notice is one PUT; a failed one resolves', async () => {
  fetchMock.put(NOTICE_URL, {});
  await expect(acknowledgeEditorNotice()).resolves.toBeUndefined();
  expect(fetchMock.callHistory.calls(NOTICE_URL)).toHaveLength(1);
  expect(fetchMock.callHistory.calls(NOTICE_URL)[0].options.method).toBe('put');

  fetchMock.removeRoutes().clearHistory();
  fetchMock.put(NOTICE_URL, { status: 500, body: {} });
  await expect(acknowledgeEditorNotice()).resolves.toBeUndefined();
  expect(fetchMock.callHistory.calls(NOTICE_URL)).toHaveLength(1);
});

test('flag off: no notice PUT', async () => {
  window.featureFlags = {};
  fetchMock.put(NOTICE_URL, {});
  await acknowledgeEditorNotice();
  expect(fetchMock.callHistory.calls(NOTICE_URL)).toHaveLength(0);
});

test('no level sets a rule: the charts run unchanged', () => {
  expect(
    chartHoldMode(
      limitsOf({
        payload: { ...PAYLOAD, dashboard: UNSET },
      }) as never,
    ),
  ).toBe('off');
  expect(chartHoldMode(limitsOf() as never)).toBe('on');
});

test('save: a changed dashboard limit loads the policy again, an unchanged one does not', async () => {
  fetchMock.get(LIMITS_URL, { result: PAYLOAD });
  const store = setup();

  await dispatchOn(
    store,
    refetchTimeRangeLimitsAfterSave(DASHBOARD_ID, {
      schema_version: 1,
      ...SPAN_90,
    }),
  );
  expect(gets()).toHaveLength(0);

  await dispatchOn(
    store,
    refetchTimeRangeLimitsAfterSave(DASHBOARD_ID, {
      schema_version: 1,
      ...SPAN_90,
      max_span: { quantity: 30, time_grain: 'P1D' },
    }),
  );
  expect(gets()).toHaveLength(1);
});

const CHANGED_RULES = { schema_version: 1, ...SPAN_90, max_span: null };

test.each([
  { status: 'failed', expected: 1 },
  { status: 'loading', expected: 1 },
  { status: 'loaded', expected: 1 },
  { status: 'off', expected: 0 },
])(
  'save with changed rules while $status makes $expected GET',
  async ({ status, expected }) => {
    fetchMock.get(LIMITS_URL, { result: PAYLOAD });
    const store = setup({ timeRangeLimits: limitsOf({ status }) });

    await dispatchOn(
      store,
      refetchTimeRangeLimitsAfterSave(DASHBOARD_ID, CHANGED_RULES),
    );

    expect(gets()).toHaveLength(expected);
  },
);

test('save for another dashboard than the loaded one makes no GET', async () => {
  fetchMock.get(LIMITS_URL, { result: PAYLOAD });
  const store = setup({
    timeRangeLimits: limitsOf({ dashboardId: 99, status: 'loaded' }),
  });

  await dispatchOn(
    store,
    refetchTimeRangeLimitsAfterSave(DASHBOARD_ID, CHANGED_RULES),
  );

  expect(gets()).toHaveLength(0);
});

test('N charts asking in the same tick make one endpoint call', async () => {
  ranges = { 1: [LAST_WEEK], 2: [LAST_WEEK], 3: [LAST_YEAR] };
  const store = setup();

  const results = await Promise.all(
    [1, 2, 3].map(id =>
      dispatchOn(store, checkChartRanges(id, formDataOf(id))),
    ),
  );

  expect(rangeCalls()).toHaveLength(1);
  expect(JSON.parse(String(rangeCalls()[0].options.body)).charts).toHaveLength(
    3,
  );
  expect(results).toEqual([true, true, false]);
  expect(holdOf(store, 1).status).toBe('valid');
  expect(holdOf(store, 3)).toMatchObject({
    status: 'invalid',
    attribution: { filterId: null, filterValue: null, chart: true },
  });
});

test('each chart is judged with its own dataset policy, and the dashboard policy only when the server applies it', async () => {
  const SPAN_3 = { ...SPAN_90, max_span: { quantity: 3, time_grain: 'P1D' } };
  const answers: Record<number, [number, number | null]> = {
    1: [7, null],
    2: [8, null],
    3: [7, DASHBOARD_ID],
    4: [8, DASHBOARD_ID],
  };
  fetchMock.removeRoutes();
  fetchMock.post(
    RANGES_URL,
    ({ options }: { options: { body?: unknown } }) => ({
      result: {
        now: '2026-10-30T12:00:00',
        today: '2026-10-30T00:00:00',
        timezone: 'UTC',
        charts: JSON.parse(String(options.body)).charts.map(
          (entry: JsonObject) => {
            const chartId = (entry.query_context as JsonObject).form_data
              .slice_id as number;
            return {
              key: entry.key,
              status: 'ok',
              ranges: [LAST_WEEK],
              dataset_id: answers[chartId][0],
              dashboard_id: answers[chartId][1],
            };
          },
        ),
      },
    }),
  );
  const store = setup({
    timeRangeLimits: limitsOf({
      payload: {
        ...PAYLOAD,
        dashboard: SPAN_3,
        datasets: [
          { id: 7, name: 'calls', policy: UNSET },
          { id: 8, name: 'agents', policy: SPAN_3 },
        ],
      },
    }),
  });

  const results = await Promise.all(
    [1, 2, 3, 4].map(id =>
      dispatchOn(store, checkChartRanges(id, formDataOf(id))),
    ),
  );

  expect(results).toEqual([true, false, false, false]);
  expect(holdOf(store, 1).status).toBe('valid');
  expect(holdOf(store, 2).status).toBe('invalid');
  expect(holdOf(store, 3).status).toBe('invalid');
  expect(holdOf(store, 4).status).toBe('invalid');
});

test('the hold: checking while the endpoint answers, unavailable when the call fails', async () => {
  fetchMock.removeRoutes();
  fetchMock.post(RANGES_URL, { status: 500, body: {} });
  const store = setup();

  const pending = dispatchOn(store, checkChartRanges(1, formDataOf(1)));
  expect(holdOf(store, 1).status).toBe('checking');

  expect(await pending).toBe(false);
  expect(holdOf(store, 1).status).toBe('unavailable');
});

test('an unavailable check settles a first-load chart', async () => {
  fetchMock.removeRoutes();
  fetchMock.post(RANGES_URL, { status: 500, body: {} });
  const store = setup({
    charts: { 1: { id: 1, chartStatus: 'loading', chartUpdateEndTime: null } },
  });
  await dispatchOn(store, checkChartRanges(1, formDataOf(1)));
  expect(stateOf(store).charts[1].chartStatus).toBe('stopped');
});

test('an open range on a temporal chart is unbounded', async () => {
  ranges = {
    1: [{ since: null, until: null, time_offset: null, source: null }],
  };
  const store = setup();

  expect(await dispatchOn(store, checkChartRanges(1, formDataOf(1)))).toBe(
    false,
  );
  expect(holdOf(store, 1).status).toBe('unbounded');
});

test('a chart the endpoint answers with an error gets that error through the chart and no request', async () => {
  fetchMock.removeRoutes();
  fetchMock.post(RANGES_URL, ({ options }) => ({
    result: {
      now: '2026-10-30T12:00:00',
      today: '2026-10-30T00:00:00',
      timezone: 'UTC',
      charts: [
        {
          key: JSON.parse(String(options.body)).charts[0].key,
          status: 'error',
          error: { status: 400, body: { message: 'Metric not found' } },
        },
      ],
    },
  }));
  const store = setup({ charts: { 1: chartOf(1) } });

  expect(await dispatchOn(store, checkChartRanges(1, formDataOf(1)))).toBe(
    false,
  );

  expect(holdOf(store, 1).status).toBe('error');
  const chart = (stateOf(store).charts as JsonObject)[1] as JsonObject;
  expect(chart.chartStatus).toBe('failed');
  expect(chart.chartAlert).toBe('Metric not found');
  expect(chart.queriesResponse[0]).toMatchObject({ status: 400 });
  expect(posts()).toHaveLength(0);
});

const timeFilter = (id: string, chartsInScope: number[]) => ({
  id,
  filterType: 'filter_time',
  chartsInScope,
  targets: [{}],
});

const filterState = (filters: [string, number[], string | undefined][]) => ({
  nativeFilters: {
    filters: Object.fromEntries(
      filters.map(([id, scope]) => [id, timeFilter(id, scope)]),
    ),
  },
  dataMask: Object.fromEntries(
    filters.map(([id, , value]) => [
      id,
      {
        id,
        filterState: { value },
        extraFormData: value === undefined ? {} : { time_range: value },
      },
    ]),
  ),
});

const failingRange = (kinds: string[] | null): ChartRange => ({
  ...LAST_YEAR,
  source:
    kinds === null
      ? null
      : (kinds.map((kind, index) => ({
          kind,
          query_index: 0,
          index,
        })) as ChartRange['source']),
});

test('attribution: two time range filters with different scopes mark the last one in scope', async () => {
  ranges = { 2: [failingRange(['time_range'])] };
  const store = setup(
    filterState([
      ['NATIVE_FILTER-a', [1, 2], 'Last year'],
      ['NATIVE_FILTER-b', [2, 3], 'Last quarter'],
    ]),
  );

  await dispatchOn(
    store,
    checkChartRanges(
      2,
      formDataOf(2, { extra_form_data: { time_range: 'Last quarter' } }),
    ),
  );

  expect(holdOf(store, 2).attribution).toEqual({
    filterId: 'NATIVE_FILTER-b',
    filterValue: 'Last quarter',
    chart: false,
  });
  expect(
    timeRangeFilterOfChart(
      1,
      formDataOf(1, { extra_form_data: { time_range: 'Last year' } }),
      store.getState() as never,
    ),
  ).toEqual({ filterId: 'NATIVE_FILTER-a', value: 'Last year' });
});

test('attribution: a filter in scope whose value is not the one the chart got leaves the range to the chart', async () => {
  ranges = { 1: [failingRange(['time_range'])] };
  const store = setup(filterState([['NATIVE_FILTER-a', [1], 'Last year']]));

  await dispatchOn(
    store,
    checkChartRanges(
      1,
      formDataOf(1, { extra_form_data: { time_range: 'Last quarter' } }),
    ),
  );

  expect(holdOf(store, 1).attribution).toEqual({
    filterId: null,
    filterValue: null,
    chart: true,
  });
  expect(
    timeRangeFilterOfChart(1, formDataOf(1), store.getState() as never),
  ).toBeNull();
});

test('attribution: a filter set to No filter does not reach the chart', () => {
  const store = setup(
    filterState([
      ['NATIVE_FILTER-a', [2], 'Last year'],
      ['NATIVE_FILTER-b', [2], undefined],
    ]),
  );

  expect(
    timeRangeFilterOfChart(
      2,
      formDataOf(2, { extra_form_data: { time_range: 'Last year' } }),
      store.getState() as never,
    ),
  ).toEqual({ filterId: 'NATIVE_FILTER-a', value: 'Last year' });
});

test('attribution: Time Column + time range filters, the granularity range is the time range filter', async () => {
  ranges = { 1: [failingRange(['granularity'])] };
  const store = setup(filterState([['NATIVE_FILTER-a', [1], 'Last year']]));

  await dispatchOn(
    store,
    checkChartRanges(
      1,
      formDataOf(1, {
        extra_form_data: { time_range: 'Last year', granularity_sqla: 'ds' },
      }),
    ),
  );

  expect(holdOf(store, 1).attribution).toEqual({
    filterId: 'NATIVE_FILTER-a',
    filterValue: 'Last year',
    chart: false,
  });
});

test.each([['adhoc_filter'], ['time_shift'], ['time_comparison'], [null]])(
  'attribution: origin %s is the chart, never the filter',
  kind => {
    const filter = { filterId: 'NATIVE_FILTER-a', value: 'Last year' };
    expect(
      attributeChartFailures(
        [
          {
            reason: 'SPAN',
            field: 'range',
            range: failingRange(kind === null ? null : [kind]),
          } as never,
        ],
        filter,
      ),
    ).toEqual({ filterId: null, filterValue: null, chart: true });
  },
);

test('attribution: a range combining the filter and the chart own filter marks both', () => {
  expect(
    attributeChartFailures(
      [
        {
          reason: 'SPAN',
          field: 'range',
          range: failingRange(['time_range', 'adhoc_filter']),
        } as never,
      ],
      { filterId: 'NATIVE_FILTER-a', value: 'Last year' },
    ),
  ).toEqual({
    filterId: 'NATIVE_FILTER-a',
    filterValue: 'Last year',
    chart: true,
  });
});

const limitError = (status: number, extra: JsonObject = {}) => ({
  status,
  errors: [
    {
      error_type: 'TIME_RANGE_LIMIT_ERROR',
      message:
        'This time range is longer than this dashboard allows (90 days).',
      level: 'error',
      extra,
    },
  ],
});

test('a server 400: one policy GET, the chart is marked rejected, a second note sends nothing', async () => {
  fetchMock.get(LIMITS_URL, { result: PAYLOAD });
  const store = setup({
    charts: {
      1: chartOf(1, {
        chartStatus: 'failed',
        queriesResponse: [limitError(400)],
      }),
    },
  });

  dispatchOn(store, noteChartRejection(1));
  dispatchOn(store, noteChartRejection(1));
  await tick();

  expect(holdOf(store, 1)).toMatchObject({ status: 'rejected' });
  expect(gets()).toHaveLength(1);
});

test('a query 503 POLICY_UNAVAILABLE loads the policy again', async () => {
  fetchMock.get(LIMITS_URL, { result: PAYLOAD });
  const store = setup({
    charts: {
      1: chartOf(1, {
        chartStatus: 'failed',
        queriesResponse: [
          limitError(503, { reason_code: 'POLICY_UNAVAILABLE' }),
        ],
      }),
    },
  });

  dispatchOn(store, noteChartRejection(1));
  await tick();

  expect(gets()).toHaveLength(1);
});

test('other chart errors load nothing', async () => {
  fetchMock.get(LIMITS_URL, { result: PAYLOAD });
  const store = setup({
    charts: {
      1: chartOf(1, {
        chartStatus: 'failed',
        queriesResponse: [{ status: 400, errors: [{ error_type: 'X' }] }],
      }),
    },
  });

  dispatchOn(store, noteChartRejection(1));
  await tick();

  expect(gets()).toHaveLength(0);
  expect(holdOf(store, 1)).toBeUndefined();
});

test('after a 400 a refresh keeps the server message and posts nothing; other charts refresh', async () => {
  ranges = { 1: [LAST_YEAR], 2: [LAST_WEEK] };
  const rejected = chartOf(1, {
    chartStatus: 'failed',
    queriesResponse: [limitError(400)],
  });
  const store = setup({ charts: { 1: rejected, 2: chartOf(2) } });
  fetchMock.get(LIMITS_URL, { result: PAYLOAD });
  dispatchOn(store, noteChartRejection(1));
  await tick();

  await dispatchOn(store, onRefresh([1, 2], true, 0, DASHBOARD_ID));

  expect(holdOf(store, 1).status).toBe('rejected');
  expect(
    ((stateOf(store).charts as JsonObject)[1] as JsonObject).queriesResponse,
  ).toEqual(rejected.queriesResponse);
  const posted = posts().map(
    call => JSON.parse(String(call.options.body)).form_data.slice_id,
  );
  expect(posted).toEqual([2]);
});

test('after a 400 a refresh re-check names the source of the failing range; the chart stays rejected', async () => {
  ranges = { 1: [LAST_YEAR] };
  const rejected = chartOf(1, {
    chartStatus: 'failed',
    queriesResponse: [limitError(400)],
  });
  const store = setup({ charts: { 1: rejected } });
  fetchMock.get(LIMITS_URL, { result: PAYLOAD });
  dispatchOn(store, noteChartRejection(1));
  await tick();

  await dispatchOn(store, onRefresh([1], true, 0, DASHBOARD_ID));

  expect(holdOf(store, 1)).toEqual(
    expect.objectContaining({
      status: 'rejected',
      failures: [expect.objectContaining({ reason: 'MAX_SPAN_EXCEEDED' })],
      attribution: { filterId: null, filterValue: null, chart: true },
    }),
  );
  expect(posts()).toHaveLength(0);
});

const heldCharts = () => ({
  1: chartOf(1),
  2: chartOf(2),
});

test.each([
  [
    'Refresh dashboard',
    (store: Store) => dispatchOn(store, onRefresh([1, 2], true, 0, 9)),
  ],
  [
    'auto-refresh tick',
    (store: Store) => dispatchOn(store, onRefresh([1, 2], false, 0, 9, true)),
  ],
  [
    'Force refresh',
    (store: Store) =>
      Promise.all([
        dispatchOn(store, refreshChart(1, true, 9)),
        dispatchOn(store, refreshChart(2, true, 9)),
      ]),
  ],
  [
    'lazy tab refresh',
    (store: Store) =>
      dispatchOn(store, onRefresh([1, 2], true, 0, 9, false, true)),
  ],
])('%s: a held chart is not posted, a valid one is', async (_, refresh) => {
  ranges = { 1: [LAST_YEAR], 2: [LAST_WEEK] };
  const store = setup({ charts: heldCharts() });

  await refresh(store);

  expect(rangeCalls()).toHaveLength(1);
  const posted = posts().map(
    call => JSON.parse(String(call.options.body)).form_data.slice_id,
  );
  expect(posted).toEqual([2]);
  expect(holdOf(store, 1).status).toBe('invalid');
});

const refreshPaths: [
  string,
  (store: Store, chartIds?: number[]) => Promise<unknown>,
][] = [
  [
    'Refresh dashboard',
    (store, chartIds = [1, 2]) =>
      dispatchOn(store, onRefresh(chartIds, true, 0, 9)) as Promise<void>,
  ],
  [
    'auto-refresh tick',
    (store, chartIds = [1, 2]) =>
      dispatchOn(
        store,
        onRefresh(chartIds, false, 0, 9, true),
      ) as Promise<void>,
  ],
  [
    'Force refresh',
    (store, chartIds = [1, 2]) =>
      Promise.all(
        chartIds.map(chartId =>
          dispatchOn(store, refreshChart(chartId, true, 9)),
        ),
      ),
  ],
  [
    'lazy tab refresh',
    (store, chartIds = [1, 2]) =>
      dispatchOn(
        store,
        onRefresh(chartIds, true, 0, 9, false, true),
      ) as Promise<void>,
  ],
];

const waitingChart = (chartId: number) =>
  chartOf(chartId, {
    chartStatus: 'loading',
    triggerQuery: true,
    latestQueryFormData: {},
    queriesResponse: null,
  });

test.each(refreshPaths)(
  '%s: a chart whose ranges call failed is checked again and released on valid; invalid, unbounded and rejected ones stay skipped',
  async (_, refresh) => {
    ranges = { 1: [LAST_WEEK], 2: [LAST_YEAR] };
    fetchMock.removeRoutes();
    fetchMock.post(RANGES_URL, { status: 500, body: {} });
    const store = setup({
      charts: {
        1: waitingChart(1),
        2: waitingChart(2),
        3: waitingChart(3),
        4: waitingChart(4),
      },
      timeRangeLimits: limitsOf({
        charts: {
          2: { signature: JSON.stringify(formDataOf(2)), status: 'invalid' },
          3: { signature: JSON.stringify(formDataOf(3)), status: 'unbounded' },
          4: { signature: JSON.stringify(formDataOf(4)), status: 'rejected' },
        },
      }),
    });
    await dispatchOn(store, checkChartRanges(1, formDataOf(1)));
    expect(holdOf(store, 1).status).toBe('unavailable');
    fetchMock.removeRoutes();
    fetchMock.post(RANGES_URL, answerRanges);
    fetchMock.post(CHART_DATA_URL, { result: [{ data: [] }] });

    await refresh(store, [1, 2, 3, 4]);

    expect(rangeCalls()).toHaveLength(2);
    const { charts } = JSON.parse(String(rangeCalls()[1].options.body));
    expect(charts).toHaveLength(1);
    expect(charts[0].query_context.form_data.slice_id).toBe(1);
    expect(holdOf(store, 1)).toMatchObject({
      signature: JSON.stringify(formDataOf(1)),
      status: 'valid',
    });
    expect(holdOf(store, 2).status).toBe('invalid');
    expect(holdOf(store, 3).status).toBe('unbounded');
    expect(holdOf(store, 4).status).toBe('rejected');
    expect(posts()).toHaveLength(0);

    await refresh(store, [1, 2, 3, 4]);

    expect(rangeCalls()).toHaveLength(2);
    expect(posts()).toHaveLength(0);
  },
);

test.each(refreshPaths)(
  '%s: a chart still unavailable after the re-check stays held',
  async (_, refresh) => {
    fetchMock.removeRoutes();
    fetchMock.post(RANGES_URL, { status: 500, body: {} });
    const store = setup({ charts: { 1: waitingChart(1), 2: waitingChart(2) } });
    await dispatchOn(store, checkChartRanges(1, formDataOf(1)));

    await refresh(store);

    expect(rangeCalls()).toHaveLength(2);
    expect(holdOf(store, 1).status).toBe('unavailable');
    expect(posts()).toHaveLength(0);
  },
);

test.each(refreshPaths)(
  '%s: a chart that ran keeps its results when the check fails and is posted once when the endpoint is back',
  async (_, refresh) => {
    ranges = { 1: [LAST_WEEK] };
    const ran = chartOf(1);
    fetchMock.removeRoutes();
    fetchMock.post(RANGES_URL, { status: 500, body: {} });
    fetchMock.post(CHART_DATA_URL, { result: [{ data: [] }] });
    const store = setup({ charts: { 1: ran } });

    await refresh(store, [1]);

    expect(holdOf(store, 1).status).toBe('unavailable');
    expect(posts()).toHaveLength(0);
    expect(
      ((stateOf(store).charts as JsonObject)[1] as JsonObject).queriesResponse,
    ).toEqual(ran.queriesResponse);
    fetchMock.removeRoutes();
    fetchMock.post(RANGES_URL, answerRanges);
    fetchMock.post(CHART_DATA_URL, { result: [{ data: [] }] });

    await refresh(store, [1]);

    expect(rangeCalls()).toHaveLength(2);
    const posted = posts().map(
      call => JSON.parse(String(call.options.body)).form_data.slice_id,
    );
    expect(posted).toEqual([1]);
  },
);

test.each([['loading'], ['failed']])(
  'policy %s: a refresh posts no chart and calls no endpoint',
  async status => {
    const store = setup({
      charts: heldCharts(),
      timeRangeLimits: limitsOf({ status, payload: null }),
    });

    await dispatchOn(store, onRefresh([1, 2], true, 0, 9));

    expect(rangeCalls()).toHaveLength(0);
    expect(posts()).toHaveLength(0);
  },
);

test('a chart waiting for its own check is not posted by a refresh', async () => {
  ranges = { 1: [LAST_WEEK] };
  const store = setup({ charts: { 1: chartOf(1, { triggerQuery: true }) } });

  await dispatchOn(store, refreshChart(1, true, 9));

  expect(rangeCalls()).toHaveLength(0);
  expect(posts()).toHaveLength(0);
});

test('flag off: a refresh posts every chart and calls no endpoint', async () => {
  window.featureFlags = {};
  ranges = { 1: [LAST_YEAR], 2: [LAST_WEEK] };
  const store = setup({ charts: heldCharts() });

  await dispatchOn(store, onRefresh([1, 2], true, 0, 9));

  expect(rangeCalls()).toHaveLength(0);
  expect(posts()).toHaveLength(2);
});

test('flag off: a refresh posts a chart with an unavailable hold and calls no endpoint', async () => {
  window.featureFlags = {};
  ranges = { 1: [LAST_WEEK], 2: [LAST_WEEK] };
  const store = setup({
    charts: { 1: chartOf(1, { triggerQuery: true }), 2: chartOf(2) },
    timeRangeLimits: limitsOf({
      charts: {
        1: { signature: JSON.stringify(formDataOf(1)), status: 'unavailable' },
      },
    }),
  });

  await dispatchOn(store, onRefresh([1, 2], true, 0, 9));

  expect(rangeCalls()).toHaveLength(0);
  const posted = posts().map(
    call => JSON.parse(String(call.options.body)).form_data.slice_id,
  );
  expect(posted).toEqual([1, 2]);
});

test('a chart load builds its query context once, for the check and for the request', async () => {
  ranges = { 1: [LAST_WEEK] };
  const store = setup({ charts: { 1: chartOf(1) } });

  await dispatchOn(store, refreshChart(1, false, DASHBOARD_ID));

  expect(buildV1ChartDataPayload).toHaveBeenCalledTimes(1);
  expect(rangeCalls()).toHaveLength(1);
  expect(posts()).toHaveLength(1);
  const [checked] = JSON.parse(String(rangeCalls()[0].options.body)).charts;
  expect(JSON.parse(String(posts()[0].options.body))).toEqual(
    checked.query_context,
  );
});

test('a forced refresh sends the checked query context with force on', async () => {
  ranges = { 1: [LAST_WEEK] };
  const store = setup({ charts: { 1: chartOf(1) } });

  await dispatchOn(store, refreshChart(1, true, DASHBOARD_ID));

  expect(buildV1ChartDataPayload).toHaveBeenCalledTimes(1);
  const sent = JSON.parse(String(posts()[0].options.body));
  expect(sent.force).toBe(true);
  expect(sent.form_data.force).toBe(true);
  const [checked] = JSON.parse(String(rangeCalls()[0].options.body)).charts;
  expect(checked.query_context.force).toBe(false);
});

test('a second request for the same form data builds its own query context', async () => {
  ranges = { 1: [LAST_WEEK] };
  const store = setup({ charts: { 1: chartOf(1) } });

  await dispatchOn(store, refreshChart(1, false, DASHBOARD_ID));
  await dispatchOn(store, postChartFormData(formDataOf(1), false, 60, 1, 9));

  expect(buildV1ChartDataPayload).toHaveBeenCalledTimes(2);
  expect(posts()).toHaveLength(2);
});

test('no rule for the chart: no endpoint call and the chart runs; a chart with a rule is still checked', async () => {
  ranges = { 1: [LAST_WEEK], 2: [LAST_WEEK] };
  const onlyDatasetEight = limitsOf({
    payload: {
      ...PAYLOAD,
      dashboard: UNSET,
      datasets: [
        { id: 7, name: 'calls', policy: UNSET },
        { id: 8, name: 'orders', policy: SPAN_90 },
      ],
    },
  });
  const store = setup({
    charts: {
      1: chartOf(1),
      2: chartOf(2, {
        latestQueryFormData: formDataOf(2, { datasource: '8__table' }),
      }),
    },
    timeRangeLimits: onlyDatasetEight,
  });
  expect(chartHoldMode(onlyDatasetEight as never)).toBe('on');

  expect(await dispatchOn(store, checkChartRanges(1, formDataOf(1)))).toBe(
    true,
  );
  expect(holdOf(store, 1).status).toBe('valid');
  await dispatchOn(store, refreshChart(1, false, DASHBOARD_ID));

  expect(rangeCalls()).toHaveLength(0);
  expect(buildV1ChartDataPayload).toHaveBeenCalledTimes(1);
  expect(posts()).toHaveLength(1);

  await dispatchOn(store, refreshChart(2, false, DASHBOARD_ID));

  expect(rangeCalls()).toHaveLength(1);
  expect(posts()).toHaveLength(2);
});

test('Properties Apply (no save) loads nothing', async () => {
  fetchMock.get(LIMITS_URL, { result: PAYLOAD });
  const store = setup();

  dispatchOn(
    store,
    dashboardInfoChanged({
      metadata: {
        time_range_limits: {
          schema_version: 1,
          ...SPAN_90,
          max_span: { quantity: 30, time_grain: 'P1D' },
        },
      },
    } as never),
  );
  await tick();

  expect(gets()).toHaveLength(0);
});

test('an omitted dataset entry retains global and dashboard checks', async () => {
  ranges = { 1: [LAST_YEAR], 2: [LAST_WEEK] };
  const store = setup({
    charts: { 1: chartOf(1), 2: chartOf(2) },
    timeRangeLimits: limitsOf({
      payload: { ...PAYLOAD, datasets: [] },
    }),
  });
  expect(await dispatchOn(store, checkChartRanges(1, formDataOf(1)))).toBe(
    false,
  );
  expect(holdOf(store, 1).status).toBe('invalid');
  expect(await dispatchOn(store, checkChartRanges(2, formDataOf(2)))).toBe(
    true,
  );
  expect(holdOf(store, 2).status).toBe('valid');
});

test.each([false, true])(
  'an unavailable dataset holds only its charts, with other policies %s',
  async otherPolicies => {
    ranges = { 1: [LAST_WEEK], 2: [LAST_WEEK] };
    fetchMock.removeRoutes();
    fetchMock.post(RANGES_URL, (request: { options: { body?: unknown } }) => {
      const response = answerRanges(request);
      const entries = JSON.parse(String(request.options.body))
        .charts as JsonObject[];
      response.result.charts = response.result.charts.map(
        (
          answer: {
            key: unknown;
            status: string;
            ranges: ChartRange[];
            dataset_id: number;
            dashboard_id: number;
          },
          index: number,
        ) => {
          const form = (entries[index].query_context as JsonObject)
            .form_data as JsonObject;
          return { ...answer, dataset_id: form.slice_id === 1 ? 7 : 8 };
        },
      );
      return response;
    });
    fetchMock.post(CHART_DATA_URL, { result: [{ data: [] }] });
    const store = setup({
      charts: {
        1: chartOf(1),
        2: chartOf(2, {
          latestQueryFormData: formDataOf(2, { datasource: '8__table' }),
        }),
      },
      timeRangeLimits: limitsOf({
        payload: {
          ...PAYLOAD,
          dashboard: otherPolicies ? SPAN_90 : UNSET,
          datasets: [
            {
              id: 7,
              name: 'unavailable',
              policy: null,
              error: {
                message:
                  'Time range limits could not be verified. Retry the request.',
                error_type: 'TIME_RANGE_LIMIT_ERROR',
                extra: { reason_code: 'POLICY_UNAVAILABLE', dataset_id: 7 },
              },
            },
            { id: 8, name: 'healthy', policy: UNSET },
          ],
        },
      }),
    });
    expect(chartHoldMode(limitsState(store) as never)).toBe('on');
    expect(await dispatchOn(store, checkChartRanges(1, formDataOf(1)))).toBe(
      false,
    );
    expect(holdOf(store, 1).status).toBe('unavailable');
    await dispatchOn(store, refreshChart(1, false, DASHBOARD_ID));
    expect(posts()).toHaveLength(0);
    const healthyForm = formDataOf(2, { datasource: '8__table' });
    expect(await dispatchOn(store, checkChartRanges(2, healthyForm))).toBe(
      true,
    );
    await dispatchOn(store, refreshChart(2, false, DASHBOARD_ID));
    expect(posts()).toHaveLength(1);
  },
);

test('omitted and unrestricted datasets run without client holds when dashboard levels are null', async () => {
  fetchMock.removeRoutes();
  fetchMock.post(
    CHART_DATA_URL,
    ({ options }: { options: { body?: unknown } }) => {
      const body = JSON.parse(String(options.body)) as {
        datasource: { id: number };
      };
      return body.datasource.id === 7
        ? {
            status: 403,
            body: {
              errors: [
                {
                  message: 'Dataset access denied',
                  error_type: 'DATASOURCE_SECURITY_ACCESS_ERROR',
                  level: 'warning',
                },
              ],
            },
          }
        : { result: [{ data: [] }] };
    },
  );
  const store = setup({
    charts: {
      1: chartOf(1),
      2: chartOf(2, {
        latestQueryFormData: formDataOf(2, { datasource: '8__table' }),
      }),
    },
    timeRangeLimits: limitsOf({
      payload: { ...PAYLOAD, global: null, dashboard: null, datasets: [] },
    }),
  });
  expect(chartHoldMode(limitsState(store) as never)).toBe('off');
  await dispatchOn(store, refreshChart(1, false, DASHBOARD_ID));
  await dispatchOn(store, refreshChart(2, false, DASHBOARD_ID));
  expect(posts()).toHaveLength(2);
  expect(rangeCalls()).toHaveLength(0);
  expect(limitsState(store).charts).toEqual({});
  const charts = stateOf(store).charts as JsonObject;
  expect((charts[1] as JsonObject).chartStatus).toBe('failed');
  expect((charts[1] as JsonObject).queriesResponse).toMatchObject([
    { errors: [{ error_type: 'DATASOURCE_SECURITY_ACCESS_ERROR' }] },
  ]);
  expect((charts[2] as JsonObject).chartStatus).toBe('success');
});
