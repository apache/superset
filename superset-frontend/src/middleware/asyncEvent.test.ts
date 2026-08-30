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

test('cancel uses the tab id captured at submit, not a reassigned one', async () => {
  // A duplicate-tab collision can reassign this tab's id after submit. Cancel
  // must carry the id used at submit so the backend detaches the right per-tab
  // subscription (reading getTabId() fresh at cancel would send the new id and
  // orphan the original subscription).
  queueStatuses(); // task never resolves on its own
  asyncEvent.init(config);

  mockTabId = 'tab-A';
  const controller = new AbortController();
  const promise = asyncEvent.waitForAsyncData(
    { task_ids: ['task-1'] },
    jest.fn(),
    controller.signal,
  );

  mockTabId = 'tab-B'; // reassigned after submit
  controller.abort();

  await expect(promise).rejects.toThrow('Aborted');
  const cancelCalls = fetchMock.callHistory.calls(CANCEL_ENDPOINT);
  expect(cancelCalls).toHaveLength(1);
  const body = JSON.parse(String(cancelCalls[0].options.body));
  expect(body.tab_id).toBe('tab-A');
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
