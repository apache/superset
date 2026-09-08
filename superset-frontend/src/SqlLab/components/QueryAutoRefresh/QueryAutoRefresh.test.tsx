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
import { act } from 'react';
import { QueryState } from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { render, waitFor } from 'spec/helpers/testing-library';
import { cleanup } from '@testing-library/react';
import { LOG_ACTIONS_SQLLAB_FETCH_FAILED_QUERY } from 'src/logger/LogUtils';
import {
  CLEAR_INACTIVE_QUERIES,
  REFRESH_QUERIES,
} from 'src/SqlLab/actions/sqlLab';
import QueryAutoRefresh, {
  isQueryRunning,
  shouldCheckForQueries,
  QUERY_UPDATE_FREQ,
} from 'src/SqlLab/components/QueryAutoRefresh';
import { subscribeRealtime } from 'src/middleware/realtime';
import { TASK_STATUS_TOPIC } from 'src/middleware/asyncEvent';
import { successfulQuery, runningQuery } from 'src/SqlLab/fixtures';
import { QueryDictionary } from 'src/SqlLab/types';
import mockDatabases from 'spec/fixtures/mockDatabases';

// The realtime transport is a pure accelerator; mock it so a `task.status`
// message can be emitted deterministically without a real socket.
jest.mock('src/middleware/realtime', () => ({
  subscribeRealtime: jest.fn(() => jest.fn()),
  connectRealtime: jest.fn(),
  subscribeRealtimeOpen: jest.fn(() => jest.fn()),
  subscribeRealtimeState: jest.fn(() => jest.fn()),
}));

const subscribeRealtimeMock = subscribeRealtime as jest.Mock;

// Return the `task.status` handler the component registered after render.
const getTaskStatusHandler = (): ((payload: unknown) => void) => {
  const call = subscribeRealtimeMock.mock.calls
    .filter(([topic]) => topic === TASK_STATUS_TOPIC)
    .pop();
  return call?.[1] as (payload: unknown) => void;
};

const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const mockState = {
  databases: mockDatabases,
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('QueryAutoRefresh', () => {
  const runningQueries: QueryDictionary = { [runningQuery.id]: runningQuery };
  const successfulQueries: QueryDictionary = {
    [successfulQuery.id]: successfulQuery,
  };
  const queriesLastUpdate = Date.now();
  const refreshApi = 'glob:*/api/v1/query/updated_since?*';

  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
    subscribeRealtimeMock.mockClear();
  });

  afterEach(() => {
    fetchMock.clearHistory().removeRoutes();
    cleanup();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('isQueryRunning returns true for valid running query', () => {
    expect(isQueryRunning(runningQuery)).toBe(true);
  });

  test('isQueryRunning returns false for valid not-running query', () => {
    expect(isQueryRunning(successfulQuery)).toBe(false);
  });

  test('isQueryRunning returns false for invalid query', () => {
    // @ts-expect-error
    expect(isQueryRunning(null)).toBe(false);
    // @ts-expect-error
    expect(isQueryRunning(undefined)).toBe(false);
    // @ts-expect-error
    expect(isQueryRunning('I Should Be An Object')).toBe(false);
    // @ts-expect-error
    expect(isQueryRunning({ state: { badFormat: true } })).toBe(false);
  });

  test('shouldCheckForQueries is true for valid running query', () => {
    expect(shouldCheckForQueries(runningQueries)).toBe(true);
  });

  test('shouldCheckForQueries is false for valid completed query', () => {
    expect(shouldCheckForQueries(successfulQueries)).toBe(false);
  });

  test('shouldCheckForQueries is false for invalid inputs', () => {
    // @ts-expect-error
    expect(shouldCheckForQueries(null)).toBe(false);
    // @ts-expect-error
    expect(shouldCheckForQueries(undefined)).toBe(false);
    expect(
      shouldCheckForQueries({
        // @ts-expect-error
        '1234': null,
        // @ts-expect-error
        '23425': 'hello world',
        // @ts-expect-error
        '345': [],
        // @ts-expect-error
        '57346': undefined,
      }),
    ).toBe(false);
  });

  test('Attempts to refresh when given pending query', async () => {
    const store = mockStore({ sqlLab: { ...mockState } });

    fetchMock.get(refreshApi, {
      result: [{ id: runningQuery.id, status: 'success' }],
    });

    render(
      <QueryAutoRefresh
        queries={runningQueries}
        queriesLastUpdate={queriesLastUpdate}
      />,
      { useRedux: true, store },
    );

    await act(async () => {
      jest.advanceTimersByTime(QUERY_UPDATE_FREQ + 100);
    });

    await waitFor(() =>
      expect(store.getActions()).toContainEqual(
        expect.objectContaining({ type: REFRESH_QUERIES }),
      ),
    );
  });

  test('Attempts to clear inactive queries when updated queries are empty', async () => {
    const store = mockStore({ sqlLab: { ...mockState } });

    fetchMock.get(refreshApi, { result: [] });

    render(
      <QueryAutoRefresh
        queries={runningQueries}
        queriesLastUpdate={queriesLastUpdate}
      />,
      { useRedux: true, store },
    );

    await act(async () => {
      jest.advanceTimersByTime(QUERY_UPDATE_FREQ + 100);
    });

    await waitFor(() =>
      expect(store.getActions()).toContainEqual(
        expect.objectContaining({ type: CLEAR_INACTIVE_QUERIES }),
      ),
    );

    expect(
      store.getActions().filter(({ type }) => type === REFRESH_QUERIES),
    ).toHaveLength(0);
    expect(fetchMock.callHistory.calls(refreshApi)).toHaveLength(1);
  });

  test('Does not fail and attempts to refresh with mixed valid/invalid queries', async () => {
    const store = mockStore({ sqlLab: { ...mockState } });

    fetchMock.get(refreshApi, {
      result: [{ id: runningQuery.id, status: 'success' }],
    });

    render(
      <QueryAutoRefresh
        // @ts-expect-error
        queries={{ ...runningQueries, g324t: null }}
        queriesLastUpdate={queriesLastUpdate}
      />,
      { useRedux: true, store },
    );

    await act(async () => {
      jest.advanceTimersByTime(QUERY_UPDATE_FREQ + 100);
    });

    await waitFor(() =>
      expect(store.getActions()).toContainEqual(
        expect.objectContaining({ type: REFRESH_QUERIES }),
      ),
    );
  });

  test('Does NOT Attempt to refresh when given only completed queries', async () => {
    const store = mockStore({ sqlLab: { ...mockState } });

    fetchMock.get(refreshApi, {
      result: [{ id: runningQuery.id, status: 'success' }],
    });

    render(
      <QueryAutoRefresh
        queries={successfulQueries}
        queriesLastUpdate={queriesLastUpdate}
      />,
      { useRedux: true, store },
    );

    await act(async () => {
      jest.advanceTimersByTime(QUERY_UPDATE_FREQ + 100);
    });

    await waitFor(() =>
      expect(store.getActions()).toContainEqual(
        expect.objectContaining({ type: CLEAR_INACTIVE_QUERIES }),
      ),
    );

    expect(fetchMock.callHistory.calls(refreshApi)).toHaveLength(0);
  });

  test('logs the failed error for async queries', async () => {
    const store = mockStore({ sqlLab: { ...mockState } });

    fetchMock.get(refreshApi, {
      result: [
        {
          id: runningQuery.id,
          dbId: 1,
          state: QueryState.Failed,
          extra: {
            errors: [
              {
                error_type: 'TEST_ERROR',
                level: 'error',
                message: 'Syntax invalid',
                extra: {
                  issue_codes: [
                    {
                      code: 102,
                      message: 'DB failed',
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    });

    render(
      <QueryAutoRefresh
        queries={runningQueries}
        queriesLastUpdate={queriesLastUpdate}
      />,
      { useRedux: true, store },
    );

    await act(async () => {
      jest.advanceTimersByTime(QUERY_UPDATE_FREQ + 100);
    });

    await waitFor(() =>
      expect(store.getActions()).toContainEqual(
        expect.objectContaining({
          payload: expect.objectContaining({
            eventName: LOG_ACTIONS_SQLLAB_FETCH_FAILED_QUERY,
            eventData: expect.objectContaining({
              error_type: 'TEST_ERROR',
              error_details: 'Syntax invalid',
              issue_codes: [102],
            }),
          }),
        }),
      ),
    );
  });

  test('refreshes immediately on a terminal task.status for a tracked query', async () => {
    const store = mockStore({ sqlLab: { ...mockState } });
    const trackedQueries: QueryDictionary = {
      [runningQuery.id]: { ...runningQuery, taskId: 'task-abc' },
    };

    fetchMock.get(refreshApi, {
      result: [{ id: runningQuery.id, status: 'success' }],
    });

    render(
      <QueryAutoRefresh
        queries={trackedQueries}
        queriesLastUpdate={queriesLastUpdate}
      />,
      { useRedux: true, store },
    );

    await act(async () => {
      getTaskStatusHandler()({ task_id: 'task-abc', status: 'success' });
    });

    // The immediate refresh fires without advancing the 2s poll interval.
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(refreshApi)).toHaveLength(1),
    );
    await waitFor(() =>
      expect(store.getActions()).toContainEqual(
        expect.objectContaining({ type: REFRESH_QUERIES }),
      ),
    );
  });

  test('ignores a task.status for an untracked task id', async () => {
    const store = mockStore({ sqlLab: { ...mockState } });
    const trackedQueries: QueryDictionary = {
      [runningQuery.id]: { ...runningQuery, taskId: 'task-abc' },
    };

    fetchMock.get(refreshApi, {
      result: [{ id: runningQuery.id, status: 'success' }],
    });

    render(
      <QueryAutoRefresh
        queries={trackedQueries}
        queriesLastUpdate={queriesLastUpdate}
      />,
      { useRedux: true, store },
    );

    await act(async () => {
      getTaskStatusHandler()({ task_id: 'other-task', status: 'success' });
    });

    // No accelerated refresh; the untracked message is dropped (the 2s poll
    // remains the backstop and is not advanced here).
    expect(fetchMock.callHistory.calls(refreshApi)).toHaveLength(0);
  });
});
