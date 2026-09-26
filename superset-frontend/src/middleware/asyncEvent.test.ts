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
import { isFeatureEnabled } from '@superset-ui/core';
import * as asyncEvent from 'src/middleware/asyncEvent';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

// Mutable tab-id mock (overrides the global shim) so a test can change the tab id
// between submit and cancel. `var` + lazy init sidesteps jest.mock hoisting/TDZ.
/* eslint-disable no-var, vars-on-top */
var mockTabId: string;
/* eslint-enable no-var, vars-on-top */
jest.mock('src/hooks/useTabId', () => {
  mockTabId = 'test-tab-id';
  return {
    getTabId: () => mockTabId,
    subscribeTabIdChange: () => () => {},
  };
});

// Mock the shared realtime client so no real socket is opened and we can drive
// the "socket (re)connected" event that triggers the WS-mode catch-up.
/* eslint-disable no-var, vars-on-top */
var mockRealtimeOpenListener: (() => void) | undefined;
var mockRealtimeStateListener: ((state: string) => void) | undefined;
/* eslint-enable no-var, vars-on-top */
jest.mock('src/middleware/realtime', () => ({
  connectRealtime: jest.fn(),
  subscribeRealtime: jest.fn(() => () => {}),
  subscribeRealtimeOpen: (listener: () => void) => {
    mockRealtimeOpenListener = listener;
    return () => {
      mockRealtimeOpenListener = undefined;
    };
  },
  subscribeRealtimeState: (listener: (state: string) => void) => {
    mockRealtimeStateListener = listener;
    return () => {
      mockRealtimeStateListener = undefined;
    };
  },
}));

// Bootstrap can carry no `conf` (e.g. a component test with no data-bootstrap);
// init() runs at module load, so it must not throw when conf is undefined.
/* eslint-disable no-var, vars-on-top */
var mockBootstrapConf: object | undefined;
/* eslint-enable no-var, vars-on-top */
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({ common: { conf: mockBootstrapConf } }),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const STATUS_CHANGES_ENDPOINT = 'glob:*/api/v1/task/status_changes*';
const CANCEL_ENDPOINT = 'glob:*/api/v1/task/*/cancel';

const config = { GLOBAL_ASYNC_QUERIES_POLLING_DELAY: 20 };

// Queue of status_changes responses the polling loop drains in order. The first
// is an empty no-progress poll, then each poll consumes the next.
let statusResponses: { statuses: Record<string, unknown>; cursor: string }[];

const queueStatuses = (
  ...batches: Record<string, { status: string }>[]
): void => {
  statusResponses = [
    { statuses: {}, cursor: '2020-01-01T00:00:00' },
    ...batches.map((statuses, i) => ({
      statuses,
      cursor: `2020-01-01T00:00:0${i + 1}`,
    })),
  ];
};

beforeEach(() => {
  mockedIsFeatureEnabled.mockImplementation(
    featureFlag => featureFlag === 'GLOBAL_ASYNC_QUERIES',
  );
  fetchMock.get(STATUS_CHANGES_ENDPOINT, () => {
    const next = statusResponses.shift();
    return { status: 200, body: next ?? { statuses: {}, cursor: null } };
  });
  fetchMock.post(CANCEL_ENDPOINT, { status: 200, body: { action: 'aborted' } });
});

afterEach(() => {
  jest.useRealTimers();
  fetchMock.clearHistory().removeRoutes();
  mockedIsFeatureEnabled.mockRestore();
  mockTabId = 'test-tab-id';
});

test('re-issues the request once every query task succeeds', async () => {
  queueStatuses({
    'task-1': { status: 'success' },
    'task-2': { status: 'success' },
  });
  asyncEvent.init(config);

  const refetch = jest.fn().mockResolvedValue([{ rows: 1 }]);
  const result = await asyncEvent.waitForAsyncData(
    { task_ids: ['task-1', 'task-2'] },
    refetch,
  );

  expect(refetch).toHaveBeenCalledTimes(1);
  expect(result).toEqual([{ rows: 1 }]);
});

test('does not poll status changes until a chart is awaiting async data', () => {
  queueStatuses();
  asyncEvent.init(config);

  expect(fetchMock.callHistory.calls(STATUS_CHANGES_ENDPOINT)).toHaveLength(0);
});

test('init does not throw when bootstrap carries no conf', () => {
  // Regression: init() runs at module load; reading WEBSOCKET_ENABLE off an
  // undefined conf (async off, no data-bootstrap) must not crash the module —
  // which would break every test file that transitively imports it.
  mockedIsFeatureEnabled.mockReturnValue(false);
  mockBootstrapConf = undefined;
  expect(() => asyncEvent.init()).not.toThrow();
});

test('waits for every task before re-issuing', async () => {
  // task-2 only succeeds in the second poll batch.
  queueStatuses(
    { 'task-1': { status: 'success' } },
    { 'task-2': { status: 'success' } },
  );
  asyncEvent.init(config);

  const refetch = jest.fn().mockResolvedValue([{ rows: 2 }]);
  await asyncEvent.waitForAsyncData(
    { task_ids: ['task-1', 'task-2'] },
    refetch,
  );

  expect(refetch).toHaveBeenCalledTimes(1);
});

test('rejects and does not re-issue when a task fails', async () => {
  queueStatuses({
    'task-1': { status: 'success' },
    'task-2': { status: 'failure' },
  });
  asyncEvent.init(config);

  const refetch = jest.fn();
  await expect(
    asyncEvent.waitForAsyncData({ task_ids: ['task-1', 'task-2'] }, refetch),
  ).rejects.toThrow();
  expect(refetch).not.toHaveBeenCalled();
});

test('resolves immediately for an empty task list', async () => {
  queueStatuses();
  asyncEvent.init(config);

  const refetch = jest.fn().mockResolvedValue([]);
  await asyncEvent.waitForAsyncData({ task_ids: [] }, refetch);
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('aborting cancels the tasks and rejects with AbortError', async () => {
  queueStatuses(); // tasks never resolve on their own
  asyncEvent.init(config);

  const controller = new AbortController();
  const refetch = jest.fn();
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    refetch,
    controller.signal,
  );
  controller.abort();

  await expect(promise).rejects.toThrow('Aborted');
  expect(refetch).not.toHaveBeenCalled();
  const cancelCalls = fetchMock.callHistory.calls(CANCEL_ENDPOINT);
  expect(cancelCalls).toHaveLength(1);
  // The cancel carries this tab's id so the backend detaches only this tab.
  const cancelBody = JSON.parse(String(cancelCalls[0].options.body));
  expect(typeof cancelBody.tab_id).toBe('string');
  expect(cancelBody.tab_id.length).toBeGreaterThan(0);
});

test('aborting one chart does not cancel a shared task another chart still awaits', async () => {
  // Two charts for the same principal join one deduplicated SHARED task (one
  // backend subscriber). Aborting one must NOT cancel the task while the other
  // still awaits it — otherwise the server sees the last subscriber leave and
  // aborts work the surviving chart needs. Cancellation is deferred until the
  // last local waiter goes away.
  queueStatuses(); // task never resolves on its own
  asyncEvent.init(config);

  const controllerA = new AbortController();
  const controllerB = new AbortController();
  const a = asyncEvent.waitForAsyncData(
    { task_ids: ['shared'] },
    jest.fn(),
    controllerA.signal,
  );
  const b = asyncEvent.waitForAsyncData(
    { task_ids: ['shared'] },
    jest.fn(),
    controllerB.signal,
  );

  // First abort: the other chart still awaits 'shared', so nothing is cancelled.
  controllerA.abort();
  await expect(a).rejects.toThrow('Aborted');
  expect(fetchMock.callHistory.calls(CANCEL_ENDPOINT)).toHaveLength(0);

  // Second abort: now the last waiter is gone, so the task is cancelled once.
  controllerB.abort();
  await expect(b).rejects.toThrow('Aborted');
  expect(fetchMock.callHistory.calls(CANCEL_ENDPOINT)).toHaveLength(1);
});

test('cancel uses the tab id the backend recorded (echoed in the 202)', async () => {
  // The 202 echoes the tab id the backend recorded as this tab's consumer.
  // Cancel must use that value, not the tab id read fresh at cancel time — a
  // duplicate-tab collision could otherwise reassign getTabId() and detach the
  // wrong subscription.
  queueStatuses(); // task never resolves on its own
  asyncEvent.init(config);

  const controller = new AbortController();
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'], tab_id: 'tab-A' },
    jest.fn(),
    controller.signal,
  );

  mockTabId = 'tab-B'; // reassigned after submit — must NOT be used for cancel
  controller.abort();

  await expect(promise).rejects.toThrow('Aborted');
  const cancelCalls = fetchMock.callHistory.calls(CANCEL_ENDPOINT);
  expect(cancelCalls).toHaveLength(1);
  const body = JSON.parse(String(cancelCalls[0].options.body));
  expect(body.tab_id).toBe('tab-A');
});

test('cancel falls back to the current tab id when the 202 carried none', async () => {
  queueStatuses();
  asyncEvent.init(config);

  mockTabId = 'tab-current';
  const controller = new AbortController();
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] }, // no tab_id echoed
    jest.fn(),
    controller.signal,
  );
  controller.abort();

  await expect(promise).rejects.toThrow('Aborted');
  const cancelCalls = fetchMock.callHistory.calls(CANCEL_ENDPOINT);
  const body = JSON.parse(String(cancelCalls[0].options.body));
  expect(body.tab_id).toBe('tab-current');
});

test('settles every request awaiting a deduplicated shared task', async () => {
  // Two concurrent chart requests share the same (deduplicated) task uuid; both
  // must resolve when it completes — the later waiter must not overwrite the first.
  queueStatuses({ shared: { status: 'success' } });
  asyncEvent.init(config);

  const refetchA = jest.fn().mockResolvedValue([{ chart: 'a' }]);
  const refetchB = jest.fn().mockResolvedValue([{ chart: 'b' }]);
  const [a, b] = await Promise.all([
    asyncEvent.waitForAsyncData({ task_ids: ['shared'] }, refetchA),
    asyncEvent.waitForAsyncData({ task_ids: ['shared'] }, refetchB),
  ]);

  expect(refetchA).toHaveBeenCalledTimes(1);
  expect(refetchB).toHaveBeenCalledTimes(1);
  expect(a).toEqual([{ chart: 'a' }]);
  expect(b).toEqual([{ chart: 'b' }]);
});

test('polls from the pre-task cursor returned in the 202', async () => {
  // The 202 carries a cursor captured before the tasks existed; the poll must
  // use it so an early terminal status can't be skipped.
  queueStatuses({ 'task-1': { status: 'success' } });
  asyncEvent.init(config);

  const refetch = jest.fn().mockResolvedValue([{ rows: 1 }]);
  await asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'], cursor: '2019-06-06T00:00:00' },
    refetch,
  );

  const polled = fetchMock.callHistory
    .calls(STATUS_CHANGES_ENDPOINT)
    .some(call => decodeURIComponent(call.url).includes('2019-06-06T00:00:00'));
  expect(polled).toBe(true);
});

test('stops polling once all awaited tasks settle', async () => {
  queueStatuses({ 'task-1': { status: 'success' } });
  asyncEvent.init(config);

  await asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    jest.fn().mockResolvedValue([]),
  );

  // The loop must go fully idle — no heartbeat polling after everything settled.
  const pollsAtSettle = fetchMock.callHistory.calls(
    STATUS_CHANGES_ENDPOINT,
  ).length;
  await new Promise(resolve => {
    setTimeout(resolve, config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY * 12);
  });
  expect(fetchMock.callHistory.calls(STATUS_CHANGES_ENDPOINT).length).toBe(
    pollsAtSettle,
  );
});

test('restarts polling for a new job after going idle', async () => {
  queueStatuses({ 'task-1': { status: 'success' } });
  asyncEvent.init(config);

  await asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    jest.fn().mockResolvedValue([]),
  );
  // Loop is idle now. A second job must wake it and resolve.
  statusResponses.push({
    statuses: { 'task-2': { status: 'success' } },
    cursor: '2020-01-01T00:00:09',
  });
  const refetch = jest.fn().mockResolvedValue([{ rows: 9 }]);
  const result = await asyncEvent.waitForAsyncData(
    { task_ids: ['task-2'] },
    refetch,
  );

  expect(result).toEqual([{ rows: 9 }]);
});

test('gives up (rejects) after the stale timeout with no progress', async () => {
  queueStatuses(); // no terminal status for the awaited task
  asyncEvent.init({
    ...config,
    GLOBAL_ASYNC_QUERIES_POLLING_STALE_TIMEOUT: 40, // ms
  });

  const refetch = jest.fn();
  await expect(
    asyncEvent.waitForAsyncData({ task_ids: ['stuck-task'] }, refetch),
  ).rejects.toThrow('Timed out waiting for chart-data query results');
  expect(refetch).not.toHaveBeenCalled();
});

test('poll mode gives up (rejects) on a persistent status_changes error', async () => {
  // A sustained fetch error must age toward the give-up too — not spin forever.
  // Use a 400 (client error, not retried by SupersetClient) so it rejects fast
  // and deterministically rather than retrying over real timers.
  fetchMock.removeRoutes().clearHistory();
  fetchMock.get(STATUS_CHANGES_ENDPOINT, {
    status: 400,
    body: { message: 'bad' },
  });
  fetchMock.post(CANCEL_ENDPOINT, { status: 200, body: { action: 'aborted' } });
  asyncEvent.init({
    ...config,
    GLOBAL_ASYNC_QUERIES_POLLING_STALE_TIMEOUT: 40, // ms
  });

  const refetch = jest.fn();
  await expect(
    asyncEvent.waitForAsyncData({ task_ids: ['stuck-task'] }, refetch),
  ).rejects.toThrow('Timed out waiting for chart-data query results');
  expect(refetch).not.toHaveBeenCalled();
});

test('backs off while awaited tasks stay quiet, then polls eagerly again on progress', async () => {
  jest.useFakeTimers();
  queueStatuses(); // every poll comes back empty: no progress
  asyncEvent.init({
    ...config, // 20ms eager interval
    GLOBAL_ASYNC_QUERIES_POLLING_MAX_DELAY: 80,
    GLOBAL_ASYNC_QUERIES_POLLING_STALE_TIMEOUT: 60_000,
  });

  const polls = () =>
    fetchMock.callHistory.calls(STATUS_CHANGES_ENDPOINT).length;
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1', 'task-2'] },
    jest.fn().mockResolvedValue([]),
  );

  // Registering a waiter polls immediately; that first poll is quiet, so the
  // next one is scheduled at twice the eager interval (40ms, not 20ms).
  await jest.advanceTimersByTimeAsync(0);
  expect(polls()).toBe(1);
  await jest.advanceTimersByTimeAsync(20);
  expect(polls()).toBe(1);
  await jest.advanceTimersByTimeAsync(20);
  expect(polls()).toBe(2);

  // Still quiet: the delay doubles again to 80ms.
  await jest.advanceTimersByTimeAsync(40);
  expect(polls()).toBe(2);
  await jest.advanceTimersByTimeAsync(40);
  expect(polls()).toBe(3);

  // Capped at GLOBAL_ASYNC_QUERIES_POLLING_MAX_DELAY: 80ms, never 160ms.
  await jest.advanceTimersByTimeAsync(80);
  expect(polls()).toBe(4);

  // A change for an awaited task snaps the delay back to the eager interval
  // (the other task is still pending, so the loop keeps running).
  statusResponses.push({
    statuses: { 'task-1': { status: 'success' } },
    cursor: '2020-01-01T00:01:00',
  });
  await jest.advanceTimersByTimeAsync(80);
  expect(polls()).toBe(5);
  await jest.advanceTimersByTimeAsync(20);
  expect(polls()).toBe(6);

  // Complete the second task so the waiter settles and the loop goes idle.
  statusResponses.push({
    statuses: { 'task-2': { status: 'success' } },
    cursor: '2020-01-01T00:01:01',
  });
  await jest.advanceTimersByTimeAsync(80);
  await expect(promise).resolves.toEqual([]);
});

// The shared realtime client passes a `task.status` message's payload straight to
// the handler (the topic already matched), so tests call the handler with just
// the payload.
const taskStatusPayload = (taskId: string, status: string) => ({
  task_id: taskId,
  status,
});

test('a realtime message settles a waiting chart without a poll', async () => {
  // No terminal status batches are queued, so completion can ONLY come from
  // the socket message — proving the WS path settles on its own.
  queueStatuses();
  asyncEvent.init(config);

  const refetch = jest.fn().mockResolvedValue([{ rows: 1 }]);
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    refetch,
  );

  // Deliver the completion in the SAME tick, with no wait: waitForAsyncData
  // registers its waiter synchronously (before any await), so a fast task
  // whose event arrives immediately after the 202 is never missed. (Regression
  // guard: registration must not sit behind an awaited baseline fetch.)
  asyncEvent.handleTaskStatus(taskStatusPayload('task-1', 'success'));

  expect(await promise).toEqual([{ rows: 1 }]);
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('a realtime failure message rejects the waiting chart', async () => {
  queueStatuses();
  asyncEvent.init(config);

  const refetch = jest.fn();
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    refetch,
  );

  asyncEvent.handleTaskStatus(taskStatusPayload('task-1', 'failure'));

  await expect(promise).rejects.toThrow();
  expect(refetch).not.toHaveBeenCalled();
});

test('ignores a payload without task_id/status', async () => {
  queueStatuses();
  asyncEvent.init(config);

  const refetch = jest.fn().mockResolvedValue([{ rows: 1 }]);
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    refetch,
  );

  // A non-task-status payload (e.g. an entity-change nudge shape) must not
  // settle a chart.
  asyncEvent.handleTaskStatus({ entity_type: 'task', id: 'task-1' });
  expect(refetch).not.toHaveBeenCalled();

  // The task is still pending; complete it so the test doesn't leak a waiter.
  asyncEvent.handleTaskStatus(taskStatusPayload('task-1', 'success'));
  await promise;
});

test('a realtime message is a no-op when async queries are disabled', () => {
  // The shared socket connects whenever WEBSOCKET_ENABLE, independent of the
  // GLOBAL_ASYNC_QUERIES flag, so a realtime message can arrive with no active
  // async flow — it must not throw (waiter registry stays an empty map).
  mockedIsFeatureEnabled.mockReturnValue(false);
  asyncEvent.init(config);

  expect(() =>
    asyncEvent.handleTaskStatus(taskStatusPayload('task-1', 'success')),
  ).not.toThrow();
});

// --- WebSocket mode: no interval polling; catch-up on registration/reconnect ---

const wsConfig = {
  WEBSOCKET_ENABLE: true,
  WEBSOCKET_URL: 'ws://localhost:8080/',
  GLOBAL_ASYNC_QUERIES_POLLING_DELAY: 20,
  GLOBAL_ASYNC_QUERIES_POLLING_STALE_TIMEOUT: 600_000,
};

test('WEBSOCKET_ENABLE without a URL keeps polling (never disables the poll)', async () => {
  // A socket can never open without a URL, so the transport must not be treated
  // as enabled — otherwise the poll is disabled and completion never arrives.
  queueStatuses({ 'task-1': { status: 'success' } });
  asyncEvent.init({
    WEBSOCKET_ENABLE: true,
    GLOBAL_ASYNC_QUERIES_POLLING_DELAY: 20,
  });

  const refetch = jest.fn().mockResolvedValue([{ rows: 1 }]);
  // Resolves via the interval poll (no socket message is delivered).
  expect(
    await asyncEvent.waitForAsyncData({ task_ids: ['task-1'] }, refetch),
  ).toEqual([{ rows: 1 }]);
});

test('WS mode: settles via the socket without any status_changes polling', async () => {
  queueStatuses(); // registration catch-up sees no change
  asyncEvent.init(wsConfig);

  const refetch = jest.fn().mockResolvedValue([{ rows: 1 }]);
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    refetch,
  );

  // Completion arrives over the socket, not a poll.
  asyncEvent.handleTaskStatus(taskStatusPayload('task-1', 'success'));

  expect(await promise).toEqual([{ rows: 1 }]);
  // At most the single one-shot registration catch-up ran — never a loop. (It
  // no-ops if the socket settled the waiter before its microtask ran.)
  expect(
    fetchMock.callHistory.calls(STATUS_CHANGES_ENDPOINT).length,
  ).toBeLessThanOrEqual(1);
});

test('WS mode: does not start an interval poll loop', async () => {
  jest.useFakeTimers();
  queueStatuses();
  asyncEvent.init(wsConfig);

  const controller = new AbortController();
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    jest.fn(),
    controller.signal,
  );

  // Advance well past several poll intervals; a poll loop would fire repeatedly.
  await jest.advanceTimersByTimeAsync(5000);
  // Only the single registration catch-up ran — no recurring polling.
  expect(fetchMock.callHistory.calls(STATUS_CHANGES_ENDPOINT)).toHaveLength(1);

  controller.abort(); // clean up the pending waiter + give-up timer
  await expect(promise).rejects.toThrow('Aborted');
  jest.useRealTimers();
});

test('WS mode: registration catch-up settles a task that completed pre-registration', async () => {
  // The very first (registration) catch-up fetch returns the task as already
  // succeeded — no empty baseline in front of it.
  statusResponses = [
    {
      statuses: { 'task-1': { status: 'success' } },
      cursor: '2020-01-01T00:00:01',
    },
  ];
  asyncEvent.init(wsConfig);

  const refetch = jest.fn().mockResolvedValue([{ rows: 2 }]);
  // No socket message is delivered; the registration catch-up alone settles it.
  const result = await asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    refetch,
  );

  expect(result).toEqual([{ rows: 2 }]);
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('WS mode: a reconnect runs one catch-up that reconciles the gap', async () => {
  // queueStatuses prepends an empty baseline (consumed by the registration
  // catch-up); the success batch is served to the reconnect catch-up.
  queueStatuses({ 'task-1': { status: 'success' } });
  asyncEvent.init(wsConfig);

  const refetch = jest.fn().mockResolvedValue([{ rows: 3 }]);
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    refetch,
  );

  // Let the registration catch-up run and finish (consuming the empty baseline)
  // so the reconnect below is a distinct, non-coalesced catch-up.
  await new Promise(resolve => {
    setTimeout(resolve, 0);
  });

  // Simulate the socket reconnecting: the shared client fires its open-listener.
  mockRealtimeOpenListener?.();

  expect(await promise).toEqual([{ rows: 3 }]);
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('WS mode: a reconnecting transition runs a catch-up that reconciles the gap', async () => {
  queueStatuses({ 'task-1': { status: 'success' } });
  asyncEvent.init(wsConfig);

  const refetch = jest.fn().mockResolvedValue([{ rows: 4 }]);
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    refetch,
  );

  // Let the registration catch-up consume the empty baseline first.
  await new Promise(resolve => {
    setTimeout(resolve, 0);
  });

  // The socket dropped: reconcile via the socket-independent status_changes fetch.
  mockRealtimeStateListener?.('reconnecting');

  expect(await promise).toEqual([{ rows: 4 }]);
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('WS mode: an unhealthy socket settles pending waiters with a bounded error', async () => {
  queueStatuses(); // no completion is ever delivered
  asyncEvent.init(wsConfig);

  const refetch = jest.fn();
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    refetch,
  );

  // Let the registration catch-up run (finding nothing) so the waiter is pending.
  await new Promise(resolve => {
    setTimeout(resolve, 0);
  });

  // The socket has failed to reconnect enough times to be considered down: rather
  // than hang until the long give-up, the waiter is settled with a clear error.
  mockRealtimeStateListener?.('unhealthy');

  await expect(promise).rejects.toThrow('Realtime connection unavailable');
  expect(refetch).not.toHaveBeenCalled();
});

test('WS mode: coalesces many same-tick registrations into one catch-up', async () => {
  jest.useFakeTimers();
  queueStatuses(); // all catch-ups see no change
  asyncEvent.init(wsConfig);

  // Three charts register in the same tick (a dashboard loading async charts).
  const controllers = [
    new AbortController(),
    new AbortController(),
    new AbortController(),
  ];
  const promises = controllers.map((c, i) =>
    asyncEvent.waitForAsyncData(
      { task_ids: [`task-${i}`] },
      jest.fn(),
      c.signal,
    ),
  );

  await jest.advanceTimersByTimeAsync(0); // flush the coalescing microtask + fetch
  // A single status_changes request reconciles all three (waitersByTaskId is
  // global) — not one request per chart.
  expect(fetchMock.callHistory.calls(STATUS_CHANGES_ENDPOINT)).toHaveLength(1);

  controllers.forEach(c => c.abort());
  await Promise.allSettled(promises);
  jest.useRealTimers();
});

test('WS mode: an in-flight catch-up does not clobber a cursor rewound mid-flight', async () => {
  asyncEvent.init(wsConfig);

  // Control the first catch-up's resolution so a second waiter can register
  // (rewinding the cursor to an earlier watermark) while it is in flight.
  let resolveFirst: () => void = () => {};
  const firstInFlight = new Promise<void>(res => {
    resolveFirst = res;
  });
  let calls = 0;
  fetchMock.removeRoutes().clearHistory();
  fetchMock.get(STATUS_CHANGES_ENDPOINT, () => {
    calls += 1;
    // First catch-up (from T2) stays in flight, then returns a later cursor T3.
    if (calls === 1) {
      return firstInFlight.then(() => ({
        status: 200,
        body: { statuses: {}, cursor: '2020-01-01T00:00:03' },
      }));
    }
    return {
      status: 200,
      body: { statuses: {}, cursor: '2020-01-01T00:00:09' },
    };
  });
  fetchMock.post(CANCEL_ENDPOINT, { status: 200, body: { action: 'aborted' } });

  // Waiter 1 (202 cursor T2) → global cursor T2 → first catch-up fetches from T2.
  const c1 = new AbortController();
  const p1 = asyncEvent.waitForAsyncData(
    { task_ids: ['t1'], cursor: '2020-01-01T00:00:02' },
    jest.fn(),
    c1.signal,
  );
  // Let the first catch-up actually start its (deferred) fetch.
  await new Promise(resolve => {
    setTimeout(resolve, 0);
  });
  expect(calls).toBe(1);

  // Waiter 2 (earlier 202 cursor T1) registers while the first is in flight →
  // rewinds the global cursor to T1 and queues a follow-up catch-up.
  const c2 = new AbortController();
  const p2 = asyncEvent.waitForAsyncData(
    { task_ids: ['t2'], cursor: '2020-01-01T00:00:01' },
    jest.fn(),
    c2.signal,
  );

  // The first catch-up resolves (returns T3); it must NOT overwrite the rewound T1.
  resolveFirst();
  await new Promise(resolve => {
    setTimeout(resolve, 0);
  });

  // The queued follow-up must fetch from T1 (the rewound watermark), not T3.
  const secondCall = fetchMock.callHistory.calls(STATUS_CHANGES_ENDPOINT)[1];
  expect(decodeURIComponent(secondCall.url)).toContain('2020-01-01T00:00:01');
  expect(decodeURIComponent(secondCall.url)).not.toContain(
    '2020-01-01T00:00:03',
  );

  c1.abort();
  c2.abort();
  await Promise.allSettled([p1, p2]);
});

test('WS mode: a genuinely lost completion gives up after the timeout', async () => {
  jest.useFakeTimers();
  queueStatuses(); // nothing ever reports success (neither catch-up finds it)
  asyncEvent.init({
    ...wsConfig,
    GLOBAL_ASYNC_QUERIES_POLLING_STALE_TIMEOUT: 1000,
  });

  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    jest.fn(),
  );
  // Attach the rejection handler before the give-up timer fires.
  const expectation = expect(promise).rejects.toThrow('Timed out');

  // Past the jittered deadline (+ up to GIVE_UP_JITTER_MS); the awaited last-chance
  // catch-up finds nothing, so the waiter is rejected.
  await jest.advanceTimersByTimeAsync(1000 + 5000 + 200);
  await expectation;
  jest.useRealTimers();
});

test('WS mode: the last-chance catch-up before give-up recovers a missed completion', async () => {
  jest.useFakeTimers();
  // Registration catch-up consumes the empty baseline; by give-up time the task
  // has completed, so the give-up's one-shot catch-up picks it up and the waiter
  // resolves instead of rejecting (the "message missed but socket stayed open" case).
  queueStatuses({ 'task-1': { status: 'success' } });
  asyncEvent.init({
    ...wsConfig,
    GLOBAL_ASYNC_QUERIES_POLLING_STALE_TIMEOUT: 1000,
  });

  const refetch = jest.fn().mockResolvedValue([{ rows: 1 }]);
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    refetch,
  );

  // Reach the give-up deadline (+ jitter); its catch-up finds the completion.
  await jest.advanceTimersByTimeAsync(1000 + 5000 + 200);
  expect(await promise).toEqual([{ rows: 1 }]);
  expect(refetch).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});
