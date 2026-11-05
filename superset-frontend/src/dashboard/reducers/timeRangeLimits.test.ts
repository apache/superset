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
  REMOVE_CHART,
  CHART_UPDATE_STARTED,
} from 'src/components/Chart/chartAction';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';
import {
  ON_REFRESH,
  SET_ACTIVE_TAB,
  SET_ACTIVE_TABS,
} from '../actions/dashboardState';
import {
  CHART_RANGES_HOLD,
  TIME_RANGE_LIMITS_FAILED,
  TIME_RANGE_LIMITS_LOADED,
  TIME_RANGE_LIMITS_LOADING,
  setTimeRangeUserApply,
} from '../actions/timeRangeLimits';
import { selectOptionQueryHeld } from '../components/nativeFilters/FilterBar/utils';
import type { RootState } from '../types';
import type { DashboardLimitsPayload } from 'src/utils/timeRangeLimits';
import reducer, {
  initialTimeRangeLimitsState,
  type TimeRangeLimitsState,
} from './timeRangeLimits';

const loaded: TimeRangeLimitsState = {
  ...initialTimeRangeLimitsState,
  status: 'loaded',
  dashboardId: 1,
};

const applied = reducer(
  loaded,
  setTimeRangeUserApply({ 'NATIVE_FILTER-1': 'Last week' }),
);

test("the user's Apply is kept with its values, not started", () => {
  expect(applied.userApply).toEqual({
    filters: { 'NATIVE_FILTER-1': 'Last week' },
    started: false,
  });
  expect(reducer(applied, setTimeRangeUserApply(null)).userApply).toBe(
    undefined,
  );
});

test('a chart checked or posted after the Apply starts it', () => {
  expect(
    reducer(applied, {
      type: CHART_RANGES_HOLD,
      dashboardId: 1,
      chartId: 5,
      hold: { signature: '{}', status: 'checking' },
    }).userApply?.started,
  ).toBe(true);
  expect(
    reducer(applied, { type: CHART_UPDATE_STARTED, key: 5 }).userApply?.started,
  ).toBe(true);
  expect(
    reducer(applied, {
      type: CHART_RANGES_HOLD,
      dashboardId: 1,
      chartId: 5,
      hold: { signature: '{}', status: 'valid' },
    }).userApply?.started,
  ).toBe(false);
});

test.each([ON_REFRESH, SET_ACTIVE_TAB, SET_ACTIVE_TABS])(
  "%s forgets the user's Apply",
  type => {
    expect(reducer(applied, { type } as never).userApply).toBe(undefined);
  },
);

test("another dashboard forgets the user's Apply", () => {
  expect(
    reducer(applied, {
      type: TIME_RANGE_LIMITS_LOADING,
      dashboardId: 2,
      request: 3,
    }).userApply,
  ).toBe(undefined);
  expect(
    reducer(applied, {
      type: TIME_RANGE_LIMITS_LOADING,
      dashboardId: 1,
      request: 3,
    }).userApply,
  ).toEqual(applied.userApply);
});

test('without an Apply the refresh and tab actions return the same state', () => {
  expect(reducer(loaded, { type: ON_REFRESH } as never)).toBe(loaded);
  expect(reducer(loaded, setTimeRangeUserApply(null))).toBe(loaded);
});

const failed = reducer(
  { ...loaded, request: 2 },
  { type: TIME_RANGE_LIMITS_FAILED, request: 2 },
);
const SPAN = {
  max_span: { quantity: 90, time_grain: 'P1D' as const },
  max_look_back: null,
  max_look_forward: null,
};
const PAYLOAD: DashboardLimitsPayload = {
  global: { max_span: null, max_look_back: null, max_look_forward: null },
  dashboard: SPAN,
  datasets: [],
  timezone: 'UTC',
  needs_review: [],
  eligible_time_grains: [],
};

test('a failed load sets failedBefore', () => {
  expect(initialTimeRangeLimitsState.failedBefore).toBe(false);
  expect(failed).toMatchObject({ status: 'failed', failedBefore: true });
});

test("a Retry's loading keeps failedBefore, another dashboard clears it", () => {
  expect(
    reducer(failed, {
      type: TIME_RANGE_LIMITS_LOADING,
      dashboardId: 1,
      request: 3,
    }),
  ).toMatchObject({ status: 'loading', failedBefore: true });
  expect(
    reducer(failed, {
      type: TIME_RANGE_LIMITS_LOADING,
      dashboardId: 2,
      request: 3,
    }),
  ).toMatchObject({ status: 'loading', failedBefore: false });
});

test('a loaded answer clears failedBefore', () => {
  const retrying = reducer(failed, {
    type: TIME_RANGE_LIMITS_LOADING,
    dashboardId: 1,
    request: 3,
  });
  expect(
    reducer(retrying, {
      type: TIME_RANGE_LIMITS_LOADED,
      request: 3,
      payload: PAYLOAD,
    }),
  ).toMatchObject({ status: 'loaded', failedBefore: false });
});

afterEach(() => {
  window.featureFlags = {};
});

test.each([
  ['failed', { status: 'failed', failedBefore: true }, true],
  ['loading after a failure', { status: 'loading', failedBefore: true }, true],
  ['the first loading', { status: 'loading', failedBefore: false }, false],
  ['on', { status: 'loaded', payload: PAYLOAD, failedBefore: false }, false],
  ['off', { status: 'off', failedBefore: false }, false],
])('selectOptionQueryHeld, %s', (_, limits, held) => {
  window.featureFlags = { TIME_RANGE_LIMITS: true };
  const state = {
    timeRangeLimits: { ...loaded, payload: null, ...limits },
  } as unknown as RootState;
  expect(selectOptionQueryHeld(state)).toBe(held);
});

test('flag off, option queries are never held', () => {
  window.featureFlags = {};
  expect(
    selectOptionQueryHeld({
      timeRangeLimits: failed,
    } as unknown as RootState),
  ).toBe(false);
});

test('removing a chart clears its range hold', () => {
  const state: TimeRangeLimitsState = {
    ...loaded,
    charts: { 7: { signature: 'range', status: 'invalid' } },
  };
  expect(reducer(state, { type: REMOVE_CHART, key: 7 }).charts).toEqual({});
});

test('each dashboard state hydration is counted, also across a load of another dashboard', () => {
  const hydrated = reducer(reducer(loaded, { type: HYDRATE_DASHBOARD }), {
    type: HYDRATE_DASHBOARD,
  });
  expect(hydrated.hydrations).toBe(2);
  expect(
    reducer(hydrated, {
      type: TIME_RANGE_LIMITS_LOADING,
      dashboardId: 2,
      request: 3,
    }).hydrations,
  ).toBe(2);
});

test('hydration with limits off preserves the slice identity', () => {
  expect(
    reducer(initialTimeRangeLimitsState, { type: HYDRATE_DASHBOARD }),
  ).toBe(initialTimeRangeLimitsState);
});

test('removing a chart without a hold preserves the slice identity', () => {
  expect(reducer(loaded, { type: REMOVE_CHART, key: 7 })).toBe(loaded);
});
