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

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const STATUS_CHANGES_ENDPOINT = 'glob:*/api/v1/task/status_changes*';
const CANCEL_ENDPOINT = 'glob:*/api/v1/task/*/cancel';

const config = { GLOBAL_ASYNC_QUERIES_POLLING_DELAY: 20 };

// Queue of status_changes responses the polling loop drains in order. The first
// is the baseline (empty), then each poll consumes the next.
let statusResponses: { statuses: Record<string, unknown>; cursor: string }[];

const queueStatuses = (
  ...batches: Record<string, { status: string }>[]
): void => {
  statusResponses = [
    { statuses: {}, cursor: '2020-01-01T00:00:00' }, // baseline
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
  fetchMock.clearHistory().removeRoutes();
  mockedIsFeatureEnabled.mockRestore();
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
  expect(fetchMock.callHistory.calls(CANCEL_ENDPOINT)).toHaveLength(1);
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
