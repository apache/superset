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
import { act, renderHook } from '@testing-library/react';
import { SupersetClient } from '@superset-ui/core';
import { createStore, createWrapper } from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import useDashboardTimeRangeLimits from './useDashboardTimeRangeLimits';

const URL = 'glob:*/api/v1/dashboard/1/time_range_limits/';
const UNSET = { max_span: null, max_look_back: null, max_look_forward: null };
const SPAN = {
  max_span: { quantity: 3, time_grain: 'P1M' },
  max_look_back: null,
  max_look_forward: null,
};

const calls = () => fetchMock.callHistory.calls(URL).length;

const sliceOf = (overrides: Record<string, unknown> = {}) => ({
  status: 'off',
  dashboardId: null,
  request: 0,
  payload: null,
  charts: {},
  failedBefore: false,
  ...overrides,
});

function renderLimits(slice: Record<string, unknown> = sliceOf()) {
  const store = createStore({ timeRangeLimits: slice }, reducerIndex);
  const rendered = renderHook(() => useDashboardTimeRangeLimits(1), {
    wrapper: createWrapper({ store }),
  });
  return { ...rendered, store };
}

const sliceStatus = (store: ReturnType<typeof createStore>) =>
  (store.getState() as unknown as { timeRangeLimits: { status: string } })
    .timeRangeLimits.status;

const flushPromises = async () => {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
};

beforeAll(() => {
  fetchMock.mockGlobal();
  SupersetClient.reset();
  SupersetClient.configure({ protocol: 'http:', host: 'localhost' }).init();
});

afterAll(() => fetchMock.hardReset());

beforeEach(() => {
  window.featureFlags = { TIME_RANGE_LIMITS: true };
});

afterEach(() => {
  jest.useRealTimers();
  fetchMock.clearHistory().removeRoutes();
  window.featureFlags = {};
});

test('flag off: no request', async () => {
  window.featureFlags = {};
  fetchMock.get(URL, { result: {} });
  const { result } = renderLimits();
  await flushPromises();

  expect(result.current.status).toBe('off');
  expect(calls()).toBe(0);
});

test('loaded: the levels, the dashboard id and the time zone', async () => {
  fetchMock.get(URL, {
    result: {
      global: UNSET,
      dashboard: SPAN,
      datasets: [{ id: 7, name: 'calls', policy: SPAN }],
      timezone: 'Europe/Warsaw',
    },
  });
  const { result } = renderLimits();
  expect(result.current.status).toBe('loading');
  await flushPromises();

  expect(result.current).toMatchObject({
    status: 'loaded',
    limits: {
      levels: [
        { source: 'global', policy: UNSET },
        { source: 'dataset', policy: SPAN },
        { source: 'dashboard', policy: SPAN },
      ],
      dashboardId: 1,
      timezone: 'Europe/Warsaw',
    },
  });
  expect(calls()).toBe(1);
});

test('a slice already loaded for the dashboard is used with no request', async () => {
  fetchMock.get(URL, { result: {} });
  const { result } = renderLimits(
    sliceOf({
      status: 'loaded',
      dashboardId: 1,
      payload: {
        global: UNSET,
        dashboard: SPAN,
        datasets: [],
        timezone: 'Europe/Warsaw',
      },
    }),
  );
  await flushPromises();

  expect(result.current).toMatchObject({
    status: 'loaded',
    limits: {
      levels: [
        { source: 'global', policy: UNSET },
        { source: 'dashboard', policy: SPAN },
      ],
      dashboardId: 1,
      timezone: 'Europe/Warsaw',
    },
  });
  expect(calls()).toBe(0);
});

test('a slice loading for the dashboard is followed, with no request of its own', async () => {
  fetchMock.get(URL, { result: {} });
  const { result, store } = renderLimits(
    sliceOf({ status: 'loading', dashboardId: 1, request: 5 }),
  );
  await flushPromises();

  expect(result.current.status).toBe('loading');
  expect(calls()).toBe(0);

  act(() => {
    store.dispatch({
      type: 'TIME_RANGE_LIMITS_LOADED',
      request: 5,
      payload: { global: UNSET, dashboard: SPAN, timezone: 'UTC' },
    });
  });
  expect(result.current.status).toBe('loaded');
  expect(calls()).toBe(0);
});

test('a slice that failed shows failed with no request; Retry loads it once through the slice', async () => {
  fetchMock.get(URL, { result: { global: UNSET, dashboard: SPAN } });
  const { result, store } = renderLimits(
    sliceOf({
      status: 'failed',
      dashboardId: 1,
      request: 5,
      failedBefore: true,
    }),
  );
  await flushPromises();

  expect(result.current.status).toBe('failed');
  expect(calls()).toBe(0);

  act(() => result.current.retry());
  expect(result.current).toMatchObject({
    status: 'loading',
    afterFailed: true,
  });
  expect(sliceStatus(store)).toBe('loading');
  await flushPromises();

  expect(calls()).toBe(1);
  expect(result.current.status).toBe('loaded');
  expect(sliceStatus(store)).toBe('loaded');
});

test('a 503 fails at once with one GET; each Retry asks once more', async () => {
  fetchMock.get(URL, { status: 503, body: { errors: [] } });
  const { result } = renderLimits();
  await flushPromises();

  expect(result.current.status).toBe('failed');
  expect(calls()).toBe(1);

  act(() => result.current.retry());
  expect(result.current.status).toBe('loading');
  await flushPromises();
  expect(result.current.status).toBe('failed');
  expect(calls()).toBe(2);

  fetchMock.removeRoutes();
  fetchMock.get(URL, { result: { global: UNSET, dashboard: SPAN } });
  act(() => result.current.retry());
  await flushPromises();
  expect(result.current.status).toBe('loaded');
  expect(calls()).toBe(3);
});

test('no answer in 10 s fails, with no automatic retry', async () => {
  jest.useFakeTimers();
  fetchMock.get(URL, new Promise(() => {}));
  const { result } = renderLimits();
  await flushPromises();

  await act(async () => {
    jest.advanceTimersByTime(9900);
  });
  expect(result.current.status).toBe('loading');

  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  await flushPromises();
  expect(result.current.status).toBe('failed');

  await act(async () => {
    jest.advanceTimersByTime(60000);
  });
  await flushPromises();
  expect(calls()).toBe(1);
});

test('a Retry after a failure loads with afterFailed; the first load has none', async () => {
  fetchMock.get(URL, { status: 503, body: { errors: [] } });
  const { result } = renderLimits();
  expect(result.current).not.toHaveProperty('afterFailed');
  await flushPromises();
  expect(result.current.status).toBe('failed');

  act(() => result.current.retry());
  expect(result.current).toMatchObject({
    status: 'loading',
    afterFailed: true,
  });
  act(() => result.current.retry());
  expect(result.current).toMatchObject({
    status: 'loading',
    afterFailed: true,
  });
  await flushPromises();
  expect(result.current.status).toBe('failed');
});
