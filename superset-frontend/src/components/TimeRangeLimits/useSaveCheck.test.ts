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
import { act, renderHook } from '@testing-library/react';
import { SupersetClient } from '@superset-ui/core';
import {
  DatasetLimits,
  Policy,
  Rule,
  SaveCheckResult,
} from 'src/utils/timeRangeLimits';
import useSaveCheck, { SAVE_CHECK_DELAY, saveCheckWarns } from './useSaveCheck';
import {
  dashboardSaveCheckEnabled,
  datasetSaveCheckEnabled,
  policyPayload,
  toDraft,
  validateTimeRangeLimits,
} from './policyDraft';

const ENDPOINT = '/api/v1/dashboard/26/time_range_limits/charts/';

const rule = (quantity: number, timeGrain: string): Rule => ({
  quantity,
  time_grain: timeGrain,
});

const policy = (rules: Partial<Policy> = {}): Policy => ({
  max_span: null,
  max_look_back: null,
  max_look_forward: null,
  ...rules,
});

const days = (quantity: number) =>
  policyPayload(toDraft(policy({ max_span: rule(quantity, 'P1D') })));

const RESULT: SaveCheckResult = {
  charts: [],
  filters: [],
  unlimited: [],
  unchecked: [{ id: 7, slice_name: 'Calls', url: '/explore/?slice_id=7' }],
};

type Request = Parameters<typeof SupersetClient.get>[0];
type Call = {
  request: Request;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

/** Mocks `SupersetClient.get`; an abort rejects as `fetch` does unless `ignoreAbort`. */
function mockGet({ ignoreAbort = false } = {}) {
  const calls: Call[] = [];
  jest.spyOn(SupersetClient, 'get').mockImplementation(
    request =>
      new Promise((resolve, reject) => {
        calls.push({ request: request!, resolve, reject });
        if (!ignoreAbort) {
          request?.signal?.addEventListener('abort', () =>
            reject(
              new DOMException('The user aborted a request.', 'AbortError'),
            ),
          );
        }
      }) as ReturnType<typeof SupersetClient.get>,
  );
  return calls;
}

const query = (call: Call) =>
  decodeURIComponent(call.request.endpoint!.split('?q=')[1]);

const pause = () =>
  act(async () => {
    jest.advanceTimersByTime(SAVE_CHECK_DELAY);
  });

const settle = () => act(async () => {});

type Props = Parameters<typeof useSaveCheck>[0];

const renderCheck = (initialProps: Props) =>
  renderHook((props: Props) => useSaveCheck(props), { initialProps });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('disabled sends nothing', async () => {
  const calls = mockGet();
  const { result, rerender } = renderCheck({
    endpoint: ENDPOINT,
    policy: days(90),
    enabled: false,
  });
  await pause();
  rerender({ endpoint: ENDPOINT, policy: days(30), enabled: false });
  await pause();
  expect(calls).toHaveLength(0);
  expect(result.current).toEqual({
    state: 'idle',
    result: null,
    checkedPolicy: null,
  });
});

test('debounce', async () => {
  const calls = mockGet();
  const { result, rerender } = renderCheck({
    endpoint: ENDPOINT,
    policy: days(1),
    enabled: true,
  });
  act(() => {
    jest.advanceTimersByTime(SAVE_CHECK_DELAY - 1);
  });
  expect(calls).toHaveLength(0);
  rerender({ endpoint: ENDPOINT, policy: days(9), enabled: true });
  act(() => {
    jest.advanceTimersByTime(100);
  });
  rerender({ endpoint: ENDPOINT, policy: days(90), enabled: true });
  act(() => {
    jest.advanceTimersByTime(SAVE_CHECK_DELAY - 1);
  });
  expect(calls).toHaveLength(0);
  act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(calls).toHaveLength(1);
  expect(query(calls[0])).toBe(
    '(policy:(max_look_back:!n,max_look_forward:!n,max_span:(quantity:90,time_grain:P1D),schema_version:1))',
  );
  expect(result.current.state).toBe('checking');

  calls[0].resolve({ json: { result: RESULT } });
  await settle();
  expect(result.current).toEqual({
    state: 'done',
    result: RESULT,
    checkedPolicy: days(90),
  });

  // The same policy again sends nothing; a new one keeps the last result.
  rerender({ endpoint: ENDPOINT, policy: days(90), enabled: true });
  await pause();
  expect(calls).toHaveLength(1);
  rerender({ endpoint: ENDPOINT, policy: days(30), enabled: true });
  await pause();
  expect(calls).toHaveLength(2);
  expect(result.current).toEqual({
    state: 'checking',
    result: RESULT,
    checkedPolicy: days(90),
  });
});

test('runs when enabled turns on', async () => {
  const calls = mockGet();
  const { result, rerender } = renderCheck({
    endpoint: ENDPOINT,
    policy: null,
    enabled: false,
  });
  rerender({ endpoint: ENDPOINT, policy: null, enabled: true });
  await pause();
  expect(calls).toHaveLength(1);
  expect(query(calls[0])).toBe('(policy:!n)');
  calls[0].resolve({ json: { result: RESULT } });
  await settle();
  expect(result.current.state).toBe('done');
});

test('encodes null', async () => {
  const calls = mockGet();
  renderCheck({
    endpoint: ENDPOINT,
    policy: policyPayload(toDraft(null)),
    enabled: true,
  });
  await pause();
  expect(calls[0].request.endpoint).toBe(`${ENDPOINT}?q=(policy:!n)`);
});

test('request options', async () => {
  const calls = mockGet();
  renderCheck({
    endpoint: '/api/v1/dataset/7/time_range_limits/charts/',
    policy: days(90),
    enabled: true,
  });
  await pause();
  expect(SupersetClient.get).toHaveBeenCalledTimes(1);
  expect(calls[0].request).toEqual({
    endpoint:
      '/api/v1/dataset/7/time_range_limits/charts/?q=(policy:(max_look_back:!n,max_look_forward:!n,max_span:(quantity:90,time_grain:P1D),schema_version:1))',
    timeout: 10000,
    fetchRetryOptions: { retries: 0 },
    signal: expect.any(AbortSignal),
  });
});

test('failure', async () => {
  const calls = mockGet();
  const { result, rerender } = renderCheck({
    endpoint: ENDPOINT,
    policy: days(90),
    enabled: true,
  });
  await pause();
  calls[0].reject(new Response('{}', { status: 503 }));
  await settle();
  expect(result.current).toEqual({
    state: 'failed',
    result: null,
    checkedPolicy: days(90),
  });

  rerender({ endpoint: ENDPOINT, policy: days(30), enabled: true });
  await pause();
  calls[1].resolve({ json: { result: RESULT } });
  await settle();
  expect(result.current.state).toBe('done');
});

test('aborts the previous request', async () => {
  const calls = mockGet();
  const { rerender } = renderCheck({
    endpoint: ENDPOINT,
    policy: days(90),
    enabled: true,
  });
  await pause();
  rerender({ endpoint: ENDPOINT, policy: days(30), enabled: true });
  expect(calls[0].request.signal!.aborted).toBe(true);
  await pause();
  expect(calls).toHaveLength(2);
  expect(calls[1].request.signal!.aborted).toBe(false);
});

test('ignores a stale response', async () => {
  const calls = mockGet({ ignoreAbort: true });
  const { result, rerender } = renderCheck({
    endpoint: ENDPOINT,
    policy: days(90),
    enabled: true,
  });
  await pause();
  rerender({ endpoint: ENDPOINT, policy: days(30), enabled: true });
  await pause();
  calls[1].resolve({ json: { result: RESULT } });
  await settle();
  calls[0].resolve({ json: { result: { ...RESULT, unchecked: [] } } });
  await settle();
  expect(result.current).toEqual({
    state: 'done',
    result: RESULT,
    checkedPolicy: days(30),
  });
});

test('abort is not a failure', async () => {
  const calls = mockGet();
  const { result, rerender } = renderCheck({
    endpoint: ENDPOINT,
    policy: days(90),
    enabled: true,
  });
  await pause();
  expect(result.current.state).toBe('checking');
  rerender({ endpoint: ENDPOINT, policy: days(90), enabled: false });
  expect(calls[0].request.signal!.aborted).toBe(true);
  await settle();
  expect(result.current).toEqual({
    state: 'idle',
    result: null,
    checkedPolicy: null,
  });
});

test('aborts on unmount', async () => {
  const errors = jest.spyOn(console, 'error');
  const calls = mockGet();
  const { unmount } = renderCheck({
    endpoint: ENDPOINT,
    policy: days(90),
    enabled: true,
  });
  await pause();
  unmount();
  expect(calls[0].request.signal!.aborted).toBe(true);
  await settle();
  expect(errors).not.toHaveBeenCalled();

  // Unmounted during the pause: no request at all.
  const before = renderCheck({
    endpoint: ENDPOINT,
    policy: days(90),
    enabled: true,
  });
  before.unmount();
  await pause();
  expect(calls).toHaveLength(1);
});

test('dashboardSaveCheckEnabled [failed|removing|noUnits|field error|noTimeColumn]', () => {
  const global = policy({ max_span: rule(12, 'P1W') });
  const blank = toDraft(null);
  const dashboard = {
    flag: true,
    state: 'ready' as const,
    errors: {},
    global,
    value: blank,
    datasets: [] as DatasetLimits[],
  };
  expect(dashboardSaveCheckEnabled(dashboard)).toBe(true);
  expect(dashboardSaveCheckEnabled({ ...dashboard, flag: false })).toBe(false);
  // `removing` only exists while the GET has `failed`.
  expect(dashboardSaveCheckEnabled({ ...dashboard, state: 'failed' })).toBe(
    false,
  );
  expect(dashboardSaveCheckEnabled({ ...dashboard, state: 'noUnits' })).toBe(
    false,
  );
  expect(dashboardSaveCheckEnabled({ ...dashboard, state: 'loading' })).toBe(
    false,
  );
  const looser = toDraft(policy({ max_span: rule(20, 'P1W') }));
  const fieldErrors = validateTimeRangeLimits({
    global,
    value: looser,
    stored: null,
  });
  expect(Object.keys(fieldErrors)).toEqual(['max_span.quantity']);
  expect(
    dashboardSaveCheckEnabled({
      ...dashboard,
      value: looser,
      errors: fieldErrors,
    }),
  ).toBe(false);
  // No limit anywhere; then only the edited level, or only a chart dataset.
  expect(dashboardSaveCheckEnabled({ ...dashboard, global: null })).toBe(false);
  expect(
    dashboardSaveCheckEnabled({
      ...dashboard,
      global: null,
      value: toDraft(policy({ max_look_back: rule(6, 'P1M') })),
    }),
  ).toBe(true);
  expect(
    dashboardSaveCheckEnabled({
      ...dashboard,
      global: null,
      datasets: [
        { id: 1, name: 'calls', policy: policy({ max_span: rule(30, 'P1D') }) },
      ],
    }),
  ).toBe(true);
  // A half-filled rule is no limit.
  expect(
    dashboardSaveCheckEnabled({
      ...dashboard,
      global: null,
      value: { ...blank, max_span: { quantity: 5, time_grain: null } },
    }),
  ).toBe(false);

  const dataset = {
    flag: true,
    isSqla: true,
    state: 'ready' as const,
    noTimeColumn: false,
    errors: {},
    global,
    value: blank,
  };
  expect(datasetSaveCheckEnabled(dataset)).toBe(true);
  expect(datasetSaveCheckEnabled({ ...dataset, noTimeColumn: true })).toBe(
    false,
  );
  expect(datasetSaveCheckEnabled({ ...dataset, isSqla: false })).toBe(false);
  expect(datasetSaveCheckEnabled({ ...dataset, flag: false })).toBe(false);
  expect(datasetSaveCheckEnabled({ ...dataset, state: 'failed' })).toBe(false);
  expect(datasetSaveCheckEnabled({ ...dataset, state: 'noUnits' })).toBe(false);
  expect(
    datasetSaveCheckEnabled({
      ...dataset,
      value: looser,
      errors: validateTimeRangeLimits({
        global,
        value: looser,
        stored: null,
      }),
    }),
  ).toBe(false);
  expect(datasetSaveCheckEnabled({ ...dataset, global: null })).toBe(false);
  expect(
    datasetSaveCheckEnabled({
      ...dataset,
      global: null,
      value: toDraft(policy({ max_span: rule(30, 'P1D') })),
    }),
  ).toBe(true);
});

test('saveCheckWarns: only a listed chart, filter or unchecked chart, and no field errors', () => {
  const EMPTY: SaveCheckResult = {
    charts: [],
    filters: [],
    unlimited: [],
    unchecked: [],
  };
  const done = (result: SaveCheckResult | null) => ({
    state: 'done' as const,
    result,
    checkedPolicy: null,
  });
  const chart = {
    id: 7,
    slice_name: 'Calls',
    url: '/explore/?slice_id=7',
    range: 'Last year',
    time_offset: null,
    reason_code: 'MAX_SPAN_EXCEEDED',
    rule: 'max_span' as const,
    source: 'global' as const,
    message: 'Too long.',
  };
  const filter = {
    id: 'NATIVE_FILTER-1',
    name: 'Period',
    range: null,
    no_default: true,
    reason_code: null,
    rule: null,
    source: null,
    message: null,
  };

  expect(saveCheckWarns(undefined, {})).toBe(false);
  expect(saveCheckWarns(done(null), {})).toBe(false);
  expect(saveCheckWarns(done(EMPTY), {})).toBe(false);
  expect(
    saveCheckWarns(
      done({ ...EMPTY, unlimited: [{ id: 1, slice_name: 'A', url: '/a' }] }),
      {},
    ),
  ).toBe(false);
  expect(saveCheckWarns(done(RESULT), {})).toBe(true);
  expect(saveCheckWarns(done({ ...EMPTY, charts: [chart] }), {})).toBe(true);
  expect(saveCheckWarns(done({ ...EMPTY, filters: [filter] }), {})).toBe(true);
  expect(saveCheckWarns({ ...done(RESULT), state: 'checking' }, {})).toBe(true);
  expect(saveCheckWarns({ ...done(RESULT), state: 'idle' }, {})).toBe(false);
  expect(
    saveCheckWarns(done(RESULT), { 'max_span.quantity': 'Too long.' }),
  ).toBe(false);
});
