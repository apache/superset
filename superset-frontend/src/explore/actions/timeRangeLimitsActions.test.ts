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
import { ControlStateMapping } from '@superset-ui/chart-controls';
import {
  FeatureFlag,
  isFeatureEnabled,
  QueryFormData,
  SupersetClient,
} from '@superset-ui/core';
import { triggerQuery } from 'src/components/Chart/chartAction';
import exploreReducer, {
  ExploreState,
} from 'src/explore/reducers/exploreReducer';
import { ChartRange, ChartRangeFailure } from 'src/utils/timeRangeLimits';
import {
  exploreCheckKey,
  exploreLimitsState,
  exploreLimitsOn,
  exploreRunAllowed,
  ExploreTimeRangeLimits,
  fetchExploreDashboardLimits,
  LimitsRootState,
  refreshExploreTimeRangeLimits,
  requestTimeRangeFocus,
  retryExploreQuery,
  setTimeRangeCheck,
  setTimeRangeRunOnValid,
  timeRangeCheckErrors,
  timeRangeCheckKey,
} from './timeRangeLimitsActions';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const SPAN_30 = {
  max_span: { quantity: 30, time_grain: 'P1D' },
  max_look_back: null,
  max_look_forward: null,
};

const LOADED: ExploreTimeRangeLimits = {
  status: 'loaded',
  levels: [
    { source: 'global', policy: SPAN_30 },
    { source: 'dataset', policy: null },
  ],
  timezone: 'UTC',
  datasetId: 1,
};

beforeAll(() => {
  SupersetClient.configure({ appRoot: '' }).init();
});

beforeEach(() => {
  mockIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.TimeRangeLimits,
  );
});

afterEach(() => {
  fetchMock.clearHistory();
  fetchMock.removeRoutes();
});

const range = (
  since: string | null,
  until: string | null,
  source: ChartRange['source'],
  timeOffset: string | null = null,
): ChartRange => ({ since, until, time_offset: timeOffset, source });

const failure = (
  chartRange: ChartRange,
  message = "Range can't be longer than 30 days. This one is 45 days.",
  reason: ChartRangeFailure['reason'] = 'MAX_SPAN_EXCEEDED',
): ChartRangeFailure => ({
  reason,
  rule: reason === 'UNBOUNDED_RANGE' ? null : 'max_span',
  field: 'range',
  limit: null,
  message,
  range: chartRange,
});

const controls = (...names: string[]): ControlStateMapping =>
  Object.fromEntries(
    names.map(name => [name, { value: null }]),
  ) as unknown as ControlStateMapping;

test('exploreLimitsState: the payload as levels, failed on an error, nothing with the flag off', () => {
  expect(
    exploreLimitsState({ global: SPAN_30, dataset: null, timezone: 'UTC' }, 7),
  ).toEqual({
    status: 'loaded',
    levels: [
      { source: 'global', policy: SPAN_30 },
      { source: 'dataset', policy: null },
    ],
    timezone: 'UTC',
    datasetId: 7,
  });
  expect(exploreLimitsState({ error: { message: 'x' } }, 7)).toEqual({
    status: 'failed',
  });
  expect(exploreLimitsState(undefined, 7)).toBeUndefined();
  mockIsFeatureEnabled.mockReturnValue(false);
  expect(
    exploreLimitsState({ global: SPAN_30, dataset: null }, 7),
  ).toBeUndefined();
});

test('exploreLimitsOn: a rule, a dashboard id or a failed policy', () => {
  const none: ExploreTimeRangeLimits = {
    ...LOADED,
    levels: [
      { source: 'global', policy: null },
      { source: 'dataset', policy: null },
    ],
  };
  expect(exploreLimitsOn(undefined, 5)).toBe(false);
  expect(exploreLimitsOn(LOADED, undefined)).toBe(true);
  expect(exploreLimitsOn(none, undefined)).toBe(false);
  expect(exploreLimitsOn(none, 5)).toBe(true);
  expect(exploreLimitsOn({ status: 'failed' }, undefined)).toBe(true);
});

test('timeRangeCheckKey: follows the stale rule, the own state and the dashboard id', () => {
  const base: ControlStateMapping = {
    adhoc_filters: { value: [{ comparator: 'Last week' }] },
    color_scheme: { value: 'a', renderTrigger: true },
    row_limit: { value: 10, dontRefreshOnChange: true },
  } as unknown as ControlStateMapping;
  const key = timeRangeCheckKey(base, undefined, undefined);
  const withControl = (name: string, value: unknown) =>
    ({
      ...base,
      [name]: { ...base[name], value },
    }) as ControlStateMapping;
  expect(
    timeRangeCheckKey(withControl('color_scheme', 'b'), undefined, undefined),
  ).toBe(key);
  expect(
    timeRangeCheckKey(withControl('row_limit', 20), undefined, undefined),
  ).toBe(key);
  expect(
    timeRangeCheckKey(
      withControl('adhoc_filters', [{ comparator: 'Last year' }]),
      undefined,
      undefined,
    ),
  ).not.toBe(key);
  expect(timeRangeCheckKey(base, { pageIndex: 1 }, undefined)).not.toBe(key);
  expect(
    timeRangeCheckKey(
      base,
      { clientView: { a: 1 }, chartState: { b: 2 } },
      undefined,
    ),
  ).toBe(key);
  expect(timeRangeCheckKey(base, {}, undefined)).toBe(key);
  expect(timeRangeCheckKey(base, { clientView: { a: 1 } }, undefined)).toBe(
    timeRangeCheckKey(base, {}, undefined),
  );
  expect(timeRangeCheckKey(base, undefined, 3)).not.toBe(key);
});

test('exploreCheckKey: the key of the store equals the key of the page', () => {
  const state: LimitsRootState = {
    explore: {
      controls: {
        slice_id: { value: 4 },
        adhoc_filters: { value: [] },
      } as unknown as ControlStateMapping,
      form_data: { dashboardId: 9 } as unknown as QueryFormData,
    },
    dataMask: { 4: { ownState: { pageIndex: 2 } } },
  };
  expect(exploreCheckKey(state)).toBe(
    timeRangeCheckKey(state.explore.controls!, { pageIndex: 2 }, 9),
  );
});

test('exploreRunAllowed: only a valid (or error) check for this key, with the policy loaded', () => {
  const check = (status: 'valid' | 'error' | 'pending' | 'invalid') =>
    setTimeRangeCheck({ key: 'k', status }).check;
  expect(exploreRunAllowed(LOADED, check('valid'), 'k')).toBe(true);
  expect(exploreRunAllowed(LOADED, check('error'), 'k')).toBe(true);
  expect(exploreRunAllowed(LOADED, check('valid'), 'other')).toBe(false);
  expect(exploreRunAllowed(LOADED, check('pending'), 'k')).toBe(false);
  expect(exploreRunAllowed(LOADED, check('invalid'), 'k')).toBe(false);
  expect(
    exploreRunAllowed({ ...LOADED, refreshing: true }, check('valid'), 'k'),
  ).toBe(false);
  expect(
    exploreRunAllowed(
      { ...LOADED, dashboard: { id: 3, status: 'loading' } },
      check('valid'),
      'k',
    ),
  ).toBe(false);
  expect(
    exploreRunAllowed(
      { ...LOADED, dashboard: { id: 3, status: 'failed' } },
      check('valid'),
      'k',
    ),
  ).toBe(false);
  expect(exploreRunAllowed({ status: 'failed' }, check('valid'), 'k')).toBe(
    false,
  );
});

test('timeRangeCheckErrors: an adhoc filter, its Mixed Timeseries twin and a comparison', () => {
  const all = controls(
    'adhoc_filters',
    'adhoc_filters_b',
    'time_compare',
    'time_compare_b',
    'start_date_offset',
  );
  const errors = timeRangeCheckErrors(
    [
      failure(
        range('2025-04-16T00:00:00', '2025-05-31T00:00:00', [
          { kind: 'adhoc_filter', query_index: 0, index: 1 },
        ]),
        'A',
      ),
      failure(
        range('2025-04-16T00:00:00', '2025-05-31T00:00:00', [
          { kind: 'adhoc_filter', query_index: 1, index: 0 },
        ]),
        'B',
      ),
      failure(
        range(
          '2024-04-16T00:00:00',
          '2024-05-31T00:00:00',
          [{ kind: 'time_comparison', query_index: 0, index: 0 }],
          'inherit',
        ),
        'C',
      ),
      failure(
        range(
          '2024-04-16T00:00:00',
          '2024-05-31T00:00:00',
          [{ kind: 'time_comparison', query_index: 1, index: 0 }],
          '2024-04-16',
        ),
        'D',
      ),
    ],
    { controls: all, formData: {} as QueryFormData },
  );
  expect(errors).toEqual({
    controlErrors: {
      adhoc_filters: ['A'],
      adhoc_filters_b: ['B'],
      time_compare: ['C'],
      time_compare_b: ['D'],
    },
    buttonErrors: [],
  });
});

test('timeRangeCheckErrors: a modern main range goes on its filter, a native time range on time_range', () => {
  const errors = timeRangeCheckErrors(
    [
      failure(
        range('a', 'b', [{ kind: 'granularity', query_index: 0, index: null }]),
        'main',
      ),
      failure(
        range('c', 'd', [{ kind: 'time_range', query_index: 0, index: 0 }]),
        'native',
      ),
    ],
    {
      controls: controls('adhoc_filters', 'time_range'),
      formData: {} as QueryFormData,
    },
  );
  expect(errors.controlErrors).toEqual({
    adhoc_filters: ['main'],
    time_range: ['native'],
  });
});

const OPEN = failure(
  range(null, null, null),
  'This chart requires a bounded time range. Ask a dashboard editor to add or scope a time range filter.',
  'UNBOUNDED_RANGE',
);
const OPEN_TEXT = 'Choose a start and an end date. Time range limits are on.';

test('timeRangeCheckErrors: never on start_date_offset; an unnamed or unmapped source goes on the filters of a modern chart', () => {
  const errors = timeRangeCheckErrors(
    [
      failure(
        range(
          'a',
          'b',
          [{ kind: 'time_comparison', query_index: 0, index: 0 }],
          '2024-01-01',
        ),
        'shift',
      ),
      OPEN,
    ],
    {
      controls: controls('adhoc_filters', 'start_date_offset'),
      formData: {} as QueryFormData,
    },
  );
  expect(errors.controlErrors).toEqual({ adhoc_filters: ['shift', OPEN_TEXT] });
  expect(errors.buttonErrors).toEqual([]);
});

test("timeRangeCheckErrors: an unnamed source on Mixed Timeseries, on both queries' filters", () => {
  expect(
    timeRangeCheckErrors([OPEN], {
      controls: controls('adhoc_filters', 'adhoc_filters_b', 'time_compare'),
      formData: {} as QueryFormData,
    }),
  ).toEqual({
    controlErrors: { adhoc_filters: [OPEN_TEXT], adhoc_filters_b: [OPEN_TEXT] },
    buttonErrors: [],
  });
});

test('timeRangeCheckErrors: a named source with no control goes on time_range', () => {
  const errors = timeRangeCheckErrors(
    [
      failure(
        range(
          'a',
          'b',
          [{ kind: 'time_comparison', query_index: 0, index: 0 }],
          '1 year ago',
        ),
        'shift',
      ),
    ],
    {
      controls: controls('time_range', 'adhoc_filters'),
      formData: {} as QueryFormData,
    },
  );
  expect(errors).toEqual({
    controlErrors: { time_range: ['shift'] },
    buttonErrors: [],
  });
});

// Guard test: passes on the base too.
test('timeRangeCheckErrors: a chart with neither time_range nor filters keeps the Update chart fallback', () => {
  expect(
    timeRangeCheckErrors([OPEN], {
      controls: controls('selected_chart'),
      formData: {} as QueryFormData,
    }),
  ).toEqual({ controlErrors: {}, buttonErrors: [OPEN_TEXT] });
});

test('timeRangeCheckErrors: a series limit range of a chart with no series limit is shown once, on time_range', () => {
  const main = range('2025-04-16T00:00:00', '2025-05-31T00:00:00', [
    { kind: 'granularity', query_index: 0, index: null },
  ]);
  const inner = range('2025-04-16T00:00:00', '2025-05-31T00:00:00', [
    { kind: 'series_limit', query_index: 0, index: null },
  ]);
  const options = {
    controls: controls('time_range', 'limit'),
  };
  expect(
    timeRangeCheckErrors([failure(main), failure(inner)], {
      ...options,
      formData: {} as QueryFormData,
    }),
  ).toEqual({
    controlErrors: {
      time_range: ["Range can't be longer than 30 days. This one is 45 days."],
    },
    buttonErrors: [],
  });
  expect(
    timeRangeCheckErrors([failure(inner, 'inner only')], {
      ...options,
      formData: {} as QueryFormData,
    }).controlErrors,
  ).toEqual({ time_range: ['inner only'] });
  expect(
    timeRangeCheckErrors(
      [failure(range('x', 'y', inner.source), 'inner with a limit')],
      { ...options, formData: { limit: 5 } as unknown as QueryFormData },
    ).controlErrors,
  ).toEqual({ limit: ['inner with a limit'] });
});

test('timeRangeCheckErrors: with a series limit, a series limit range equal to the flagged main range is not shown again on the series limit', () => {
  const main = range('2025-04-16T00:00:00', '2025-05-31T00:00:00', [
    { kind: 'granularity', query_index: 0, index: null },
  ]);
  const inner = range('2025-04-16T00:00:00', '2025-05-31T00:00:00', [
    { kind: 'series_limit', query_index: 0, index: null },
  ]);
  expect(
    timeRangeCheckErrors([failure(main), failure(inner)], {
      controls: controls('adhoc_filters', 'series_limit'),
      formData: { series_limit: 5 } as unknown as QueryFormData,
    }),
  ).toEqual({
    controlErrors: {
      adhoc_filters: [
        "Range can't be longer than 30 days. This one is 45 days.",
      ],
    },
    buttonErrors: [],
  });
});

test('timeRangeCheckErrors: an open end reads as the picker words it in Explore', () => {
  const errors = timeRangeCheckErrors(
    [
      failure(
        range('2025-04-16T00:00:00', null, [
          { kind: 'adhoc_filter', query_index: 0, index: 0 },
        ]),
        'dashboard text',
        'UNBOUNDED_RANGE',
      ),
    ],
    {
      controls: controls('adhoc_filters'),
      formData: {} as QueryFormData,
    },
  );
  expect(errors.controlErrors).toEqual({
    adhoc_filters: ['An end date is required.'],
  });
});

const exploreState = (extra: Partial<ExploreState> = {}): ExploreState =>
  ({
    form_data: {} as QueryFormData,
    controls: {
      adhoc_filters: {
        value: [],
        validators: [],
        validationErrors: ['own error'],
        externalValidationErrors: ['plugin error'],
      },
      time_range: { value: 'Last week', validationErrors: [] },
    },
    ...extra,
  }) as unknown as ExploreState;

test('setTimeRangeCheck sets and clears the errors on the named controls, keeping the others', () => {
  const invalid = exploreReducer(
    exploreState(),
    setTimeRangeCheck({
      key: 'k',
      status: 'invalid',
      controlErrors: { adhoc_filters: ['too long'], time_range: ['too early'] },
    }) as never,
  );
  expect(invalid.controls.adhoc_filters).toMatchObject({
    externalValidationErrors: ['plugin error', 'too long'],
    validationErrors: ['own error', 'too long'],
  });
  expect(invalid.controls.time_range).toMatchObject({
    externalValidationErrors: ['too early'],
    validationErrors: ['too early'],
  });
  expect(invalid.timeRangeCheck).toMatchObject({ key: 'k', status: 'invalid' });

  const pending = exploreReducer(
    invalid,
    setTimeRangeCheck({ key: 'k2', status: 'pending' }) as never,
  );
  expect(pending.controls.adhoc_filters).toMatchObject({
    externalValidationErrors: ['plugin error'],
    validationErrors: ['own error'],
  });
  expect(pending.controls.time_range).toMatchObject({
    externalValidationErrors: [],
    validationErrors: [],
  });

  const valid = exploreReducer(
    invalid,
    setTimeRangeCheck({ key: 'k', status: 'valid' }) as never,
  );
  expect(valid.controls.time_range.validationErrors).toEqual([]);
});

test('setTimeRangeCheck keeps the controls object when neither check has control errors', () => {
  const pending = exploreReducer(
    exploreState(),
    setTimeRangeCheck({ key: 'k', status: 'pending' }) as never,
  );
  const valid = exploreReducer(
    pending,
    setTimeRangeCheck({ key: 'k', status: 'valid' }) as never,
  );
  expect(valid.controls).toBe(pending.controls);
  expect(valid.timeRangeCheck).toMatchObject({ key: 'k', status: 'valid' });
});

test('setTimeRangeRunOnValid stores the held run', () => {
  expect(
    exploreReducer(exploreState(), setTimeRangeRunOnValid('mount') as never)
      .timeRangeRunOnValid,
  ).toBe('mount');
});

const store = (explore: LimitsRootState['explore']) => {
  let state: LimitsRootState = { explore };
  const dispatch = jest.fn((action: unknown): unknown => {
    if (typeof action === 'function') {
      return action(dispatch, () => state);
    }
    state = {
      ...state,
      explore: exploreReducer(
        state.explore as ExploreState,
        action as never,
      ) as LimitsRootState['explore'],
    };
    return action;
  });
  return { dispatch, getState: () => state };
};

const DASHBOARD_URL = 'glob:*/api/v1/dashboard/3/time_range_limits/';

test('fetchExploreDashboardLimits: one GET, 10 s and no retry, the dashboard policy kept', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get');
  fetchMock.get(DASHBOARD_URL, {
    result: { dashboard: SPAN_30, global: null, datasets: [] },
  });
  const { dispatch, getState } = store({ timeRangeLimits: LOADED });
  await fetchExploreDashboardLimits(3)(dispatch as never, getState);
  await fetchExploreDashboardLimits(3)(dispatch as never, getState);
  expect(fetchMock.callHistory.calls(DASHBOARD_URL)).toHaveLength(1);
  expect(getSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      timeout: 10000,
      fetchRetryOptions: { retries: 0 },
    }),
  );
  expect(getState().explore.timeRangeLimits?.dashboard).toEqual({
    id: 3,
    status: 'loaded',
    policy: SPAN_30,
  });
  getSpy.mockRestore();
});

test.each([
  [403, 'absent'],
  [404, 'absent'],
  [503, 'failed'],
  [500, 'failed'],
])('fetchExploreDashboardLimits: %i gives %s', async (status, expected) => {
  fetchMock.get(DASHBOARD_URL, status);
  const { dispatch, getState } = store({ timeRangeLimits: LOADED });
  await fetchExploreDashboardLimits(3)(dispatch as never, getState);
  expect(getState().explore.timeRangeLimits?.dashboard).toEqual({
    id: 3,
    status: expected,
  });
});

const EXPLORE_URL = 'glob:*/api/v1/explore/?datasource_id=*';

test('refreshExploreTimeRangeLimits: one GET for the current dataset (and the named dashboard), 10 s, no retry', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get');
  fetchMock.get(EXPLORE_URL, {
    result: {
      time_range_limits: {
        global: SPAN_30,
        dataset: SPAN_30,
        timezone: 'UTC',
      },
    },
  });
  fetchMock.get(DASHBOARD_URL, {
    result: { dashboard: null, global: null, datasets: [] },
  });
  const { dispatch, getState } = store({
    datasource: { id: 22, type: 'table' },
    timeRangeLimits: {
      ...LOADED,
      dashboard: { id: 3, status: 'loaded', policy: SPAN_30 },
    },
  });
  await refreshExploreTimeRangeLimits()(dispatch as never, getState);
  const [call] = fetchMock.callHistory.calls(EXPLORE_URL);
  expect(fetchMock.callHistory.calls(EXPLORE_URL)).toHaveLength(1);
  expect(call.url).toContain('datasource_id=22&datasource_type=table');
  expect(fetchMock.callHistory.calls(DASHBOARD_URL)).toHaveLength(1);
  expect(getSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      timeout: 10000,
      fetchRetryOptions: { retries: 0 },
    }),
  );
  expect(getState().explore.timeRangeLimits).toEqual({
    status: 'loaded',
    levels: [
      { source: 'global', policy: SPAN_30 },
      { source: 'dataset', policy: SPAN_30 },
    ],
    timezone: 'UTC',
    datasetId: 22,
    refreshing: false,
    dashboard: { id: 3, status: 'loaded', policy: null },
  });
  getSpy.mockRestore();
});

test('refreshExploreTimeRangeLimits: a failed GET fails closed; flag off sends nothing', async () => {
  fetchMock.get(EXPLORE_URL, 503);
  const { dispatch, getState } = store({
    datasource: { id: 1, type: 'table' },
    timeRangeLimits: LOADED,
  });
  await refreshExploreTimeRangeLimits()(dispatch as never, getState);
  expect(getState().explore.timeRangeLimits).toEqual({
    status: 'failed',
    refreshing: false,
  });

  mockIsFeatureEnabled.mockReturnValue(false);
  fetchMock.clearHistory();
  await refreshExploreTimeRangeLimits()(dispatch as never, getState);
  expect(fetchMock.callHistory.calls()).toHaveLength(0);
});

test('refreshExploreTimeRangeLimits: a response of an older call is dropped', async () => {
  const slow: { release: () => void } = { release: () => {} };
  let calls = 0;
  fetchMock.get(EXPLORE_URL, () => {
    calls += 1;
    if (calls === 1) {
      return new Promise(resolve => {
        slow.release = () =>
          resolve({
            result: {
              time_range_limits: { global: null, timezone: 'UTC' },
            },
          });
      });
    }
    return {
      result: {
        time_range_limits: { global: SPAN_30, timezone: 'UTC' },
      },
    };
  });
  const { dispatch, getState } = store({
    datasource: { id: 22, type: 'table' },
    timeRangeLimits: LOADED,
  });
  const first = refreshExploreTimeRangeLimits()(dispatch as never, getState);
  await refreshExploreTimeRangeLimits()(dispatch as never, getState);
  slow.release();
  await first;
  expect(getState().explore.timeRangeLimits).toMatchObject({
    status: 'loaded',
    levels: [{ source: 'global', policy: SPAN_30 }, expect.anything()],
    refreshing: false,
  });
});

test('refreshExploreTimeRangeLimits: a response for a dataset that is no longer current is dropped', async () => {
  const slow: { release: () => void } = { release: () => {} };
  fetchMock.get(
    EXPLORE_URL,
    () =>
      new Promise(resolve => {
        slow.release = () =>
          resolve({
            result: {
              time_range_limits: { global: SPAN_30, timezone: 'UTC' },
            },
          });
      }),
  );
  const { dispatch, getState } = store({
    datasource: { id: 22, type: 'table' },
    timeRangeLimits: LOADED,
  });
  let switched = false;
  const getStateNow = () => {
    const state = getState();
    return switched
      ? {
          explore: { ...state.explore, datasource: { id: 23, type: 'table' } },
        }
      : state;
  };
  const pending = refreshExploreTimeRangeLimits()(
    dispatch as never,
    getStateNow as never,
  );
  switched = true;
  await new Promise(done => setTimeout(done, 0));
  slow.release();
  await pending;
  expect(getState().explore.timeRangeLimits).toMatchObject({
    datasetId: LOADED.datasetId,
    refreshing: false,
  });
});

const oauthState = (
  extra: Partial<LimitsRootState['explore']> = {},
): LimitsRootState['explore'] => ({
  controls: { slice_id: { value: 5 } } as unknown as ControlStateMapping,
  form_data: {} as QueryFormData,
  ...extra,
});

test('retryExploreQuery: limits off runs at once', () => {
  const { dispatch, getState } = store(oauthState());
  retryExploreQuery(5)(dispatch as never, getState);
  expect(dispatch).toHaveBeenCalledWith(triggerQuery(true, 5));
});

test('retryExploreQuery: limits on runs only on a valid check for the current request', () => {
  const pending = store(oauthState({ timeRangeLimits: LOADED }));
  retryExploreQuery(5)(pending.dispatch as never, pending.getState);
  expect(pending.dispatch).not.toHaveBeenCalledWith(triggerQuery(true, 5));
  expect((pending.getState().explore as ExploreState).timeRangeRunOnValid).toBe(
    'mount',
  );

  const base = oauthState({ timeRangeLimits: LOADED });
  const key = exploreCheckKey({ explore: base });
  const valid = store({
    ...base,
    timeRangeCheck: setTimeRangeCheck({ key, status: 'valid' }).check,
  });
  retryExploreQuery(5)(valid.dispatch as never, valid.getState);
  expect(valid.dispatch).toHaveBeenCalledWith(triggerQuery(true, 5));

  const stale = store({
    ...base,
    timeRangeCheck: setTimeRangeCheck({ key: 'old', status: 'valid' }).check,
  });
  retryExploreQuery(5)(stale.dispatch as never, stale.getState);
  expect(stale.dispatch).not.toHaveBeenCalledWith(triggerQuery(true, 5));
});

test('requestTimeRangeFocus stores a new request each time, and null clears it', () => {
  const first = exploreReducer(
    {} as ExploreState,
    requestTimeRangeFocus(['adhoc_filters']),
  );
  const second = exploreReducer(
    first,
    requestTimeRangeFocus(['adhoc_filters']),
  );

  expect(first.timeRangeFocusRequest?.controls).toEqual(['adhoc_filters']);
  expect(second.timeRangeFocusRequest?.id).not.toBe(
    first.timeRangeFocusRequest?.id,
  );
  expect(
    exploreReducer(second, requestTimeRangeFocus(null)).timeRangeFocusRequest,
  ).toBeNull();
});

test.each([
  null,
  { max_span: null, max_look_back: null, max_look_forward: null },
])(
  'exploreLimitsOn: a loaded dashboard with no rules needs no checks (%s)',
  policy => {
    const none: ExploreTimeRangeLimits = {
      ...LOADED,
      levels: [
        { source: 'global', policy: null },
        { source: 'dataset', policy: null },
      ],
      dashboard: { id: 7, status: 'loaded', policy },
    };
    expect(exploreLimitsOn(none, 7)).toBe(false);
    expect(exploreLimitsOn({ ...none, refreshing: true }, 7)).toBe(false);
    expect(
      exploreLimitsOn({ ...none, dashboard: { id: 7, status: 'loading' } }, 7),
    ).toBe(true);
    expect(
      exploreLimitsOn({ ...none, dashboard: { id: 7, status: 'failed' } }, 7),
    ).toBe(true);
    expect(
      exploreLimitsOn({ ...none, dashboard: { id: 7, status: 'absent' } }, 7),
    ).toBe(false);
    expect(
      exploreLimitsOn(
        { ...none, dashboard: { id: 7, status: 'loaded', policy: SPAN_30 } },
        7,
      ),
    ).toBe(true);
    expect(exploreLimitsOn(none, 8)).toBe(true);
  },
);

test('refreshing keeps checks only when the last loaded levels require them', () => {
  const none: ExploreTimeRangeLimits = {
    status: 'loaded',
    datasetId: 1,
    refreshing: true,
    levels: [
      { source: 'global', policy: null },
      { source: 'dataset', policy: null },
    ],
  };
  expect(exploreLimitsOn(none, undefined)).toBe(false);
  expect(exploreLimitsOn({ ...LOADED, refreshing: true }, undefined)).toBe(
    true,
  );
  expect(
    exploreLimitsOn(
      { ...none, levels: [{ source: 'dataset', policy: SPAN_30 }] },
      undefined,
    ),
  ).toBe(true);
  expect(
    exploreLimitsOn(
      { ...none, dashboard: { id: 7, status: 'loaded', policy: SPAN_30 } },
      7,
    ),
  ).toBe(true);
});
