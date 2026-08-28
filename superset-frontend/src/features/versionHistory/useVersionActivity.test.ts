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
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ActivityRecord } from './types';
import { useVersionActivity } from './useVersionActivity';
import * as api from './api';

jest.mock('./api');

const mockedFetchActivity = api.fetchActivity as jest.MockedFunction<
  typeof api.fetchActivity
>;

const PAGE_SIZE = 25;

const record = (transactionId: number, index: number): ActivityRecord => ({
  version_uuid: `v-${transactionId}`,
  entity_kind: 'chart',
  entity_uuid: 'e-1',
  entity_name: 'My chart',
  entity_deleted: false,
  entity_deletion_state: null,
  source: 'self',
  transaction_id: transactionId,
  action_kind: null,
  issued_at: '2025-12-05T17:18:00',
  changed_by: { id: 1, first_name: 'Ada', last_name: 'Lovelace' },
  kind: 'field',
  operation: 'edit',
  path: ['params', `field_${index}`],
  from_value: null,
  to_value: index,
  summary: '',
  impact: null,
});

/** A full page of records all belonging to one save transaction. */
const pageOf = (transactionId: number, page: number): ActivityRecord[] =>
  Array.from({ length: PAGE_SIZE }, (_, i) =>
    record(transactionId, page * PAGE_SIZE + i),
  );

afterEach(() => {
  jest.resetAllMocks();
});

test('loadMore chases zero-yield pages until a new entry becomes visible', async () => {
  // One huge save (tx 100) spans pages 0-2; the next save (tx 99) only
  // appears on page 3. A single "Load more" click must chain through
  // the zero-yield pages instead of going dead.
  const count = 4 * PAGE_SIZE;
  mockedFetchActivity.mockImplementation(async (_type, _uuid, options) => {
    const page = options?.page ?? 0;
    return {
      count,
      result: page < 3 ? pageOf(100, page) : pageOf(99, page),
    };
  });

  const { result } = renderHook(() =>
    useVersionActivity('chart', 'uuid-1', 'all'),
  );

  await waitFor(() => expect(result.current.timeline).toHaveLength(1));
  // One visible-page fetch plus the newest-self probe.
  expect(mockedFetchActivity).toHaveBeenCalledTimes(2);

  await act(async () => {
    result.current.loadMore();
  });

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.timeline).toHaveLength(2);
  // pages 1 and 2 yielded nothing visible and were auto-chained
  // The newest-self probe (pageSize 1) is not part of the paging sequence.
  const requestedPages = mockedFetchActivity.mock.calls
    .filter(([, , options]) => options?.pageSize !== 1)
    .map(([, , options]) => options?.page);
  expect(requestedPages).toEqual([0, 1, 2, 3]);
  expect(result.current.hasMore).toBe(false);
});

test('loadMore stops chaining after the per-click page cap', async () => {
  // Endless zero-yield pages must not fetch forever: one click is
  // capped at 8 chained pages.
  mockedFetchActivity.mockImplementation(async (_type, _uuid, options) => {
    const page = options?.page ?? 0;
    return {
      count: 100 * PAGE_SIZE,
      result: pageOf(100, page),
    };
  });

  const { result } = renderHook(() =>
    useVersionActivity('chart', 'uuid-1', 'all'),
  );
  await waitFor(() => expect(result.current.timeline).toHaveLength(1));

  await act(async () => {
    result.current.loadMore();
  });

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  // The newest-self probe (pageSize 1) is not part of the paging sequence.
  const requestedPages = mockedFetchActivity.mock.calls
    .filter(([, , options]) => options?.pageSize !== 1)
    .map(([, , options]) => options?.page);
  expect(requestedPages).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  expect(result.current.timeline).toHaveLength(1);
  // still more raw pages on the server; the button stays available
  expect(result.current.hasMore).toBe(true);
});

test('surfaces the server truncation flag instead of dropping it', async () => {
  // The server marks a clipped history with truncated ("count is a floor").
  // Consuming it is what lets the panel say the history was cut rather than
  // presenting the last loaded page as the beginning of time.
  mockedFetchActivity.mockResolvedValue({
    count: 1,
    truncated: true,
    result: [record(100, 0)],
  });

  const { result } = renderHook(() =>
    useVersionActivity('chart', 'uuid-1', 'all'),
  );

  await waitFor(() => expect(result.current.timeline).toHaveLength(1));
  expect(result.current.truncated).toBe(true);
  expect(result.current.hasMore).toBe(false);
});

test('a response without the truncation flag reads as complete', async () => {
  mockedFetchActivity.mockResolvedValue({
    count: 1,
    result: [record(100, 0)],
  });

  const { result } = renderHook(() =>
    useVersionActivity('chart', 'uuid-1', 'all'),
  );

  await waitFor(() => expect(result.current.timeline).toHaveLength(1));
  expect(result.current.truncated).toBe(false);
});

test('changing the search term refetches from page 0 with q', async () => {
  mockedFetchActivity.mockImplementation(async (_type, _uuid, options) => ({
    count: 1,
    result: options?.q ? [record(50, 0)] : [record(100, 0)],
  }));

  const { result, rerender } = renderHook(
    ({ q }: { q: string }) => useVersionActivity('chart', 'uuid-1', 'all', q),
    { initialProps: { q: '' } },
  );

  await waitFor(() => expect(result.current.timeline).toHaveLength(1));
  expect(mockedFetchActivity).toHaveBeenCalledWith('chart', 'uuid-1', {
    include: 'all',
    page: 0,
    pageSize: PAGE_SIZE,
    q: '',
  });

  rerender({ q: 'revenue' });

  await waitFor(() =>
    expect(mockedFetchActivity).toHaveBeenCalledWith('chart', 'uuid-1', {
      include: 'all',
      page: 0,
      pageSize: PAGE_SIZE,
      q: 'revenue',
    }),
  );
});

test('newestGroup comes from a self probe, not the visible page', async () => {
  // Page 0 filled entirely by newer related records — the newest self save is
  // beyond it. Deriving "Current" from the page would drop the tag (or, with
  // a search active, freeze it on a stale save after a restore).
  mockedFetchActivity.mockImplementation(async (_type, _uuid, options) => {
    if (options?.pageSize === 1) {
      // The dedicated include='self' probe.
      return { count: 1, result: [record(77, 0)] };
    }
    return {
      count: PAGE_SIZE,
      result: Array.from({ length: PAGE_SIZE }, (_, i) => ({
        ...record(200, i),
        source: 'related' as const,
        entity_kind: 'dataset' as const,
      })),
    };
  });

  const { result } = renderHook(() =>
    useVersionActivity('chart', 'uuid-1', 'all'),
  );

  await waitFor(() =>
    expect(result.current.newestGroup?.transactionId).toBe(77),
  );
  expect(mockedFetchActivity).toHaveBeenCalledWith('chart', 'uuid-1', {
    include: 'self',
    page: 0,
    pageSize: 1,
  });
  expect(result.current.currentVersionStatus).toBe('known');
});

test('a failed initial newest-self probe makes current identity unavailable', async () => {
  mockedFetchActivity.mockImplementation(async (_type, _uuid, options) => {
    if (options?.pageSize === 1) {
      throw new Error('probe failed');
    }
    return { count: 1, result: [record(10, 0)] };
  });

  const { result } = renderHook(() =>
    useVersionActivity('chart', 'uuid-1', 'all'),
  );

  await waitFor(() =>
    expect(result.current.currentVersionStatus).toBe('unavailable'),
  );
  expect(result.current.timeline).toHaveLength(1);
  expect(result.current.newestGroup).toBeNull();
});

test('a failed refresh invalidates a previously known current version', async () => {
  let failProbe = false;
  mockedFetchActivity.mockImplementation(async (_type, _uuid, options) => {
    if (options?.pageSize === 1) {
      if (failProbe) {
        throw new Error('probe failed');
      }
      return { count: 1, result: [record(10, 0)] };
    }
    return { count: 1, result: [record(10, 0)] };
  });

  const { result } = renderHook(() =>
    useVersionActivity('chart', 'uuid-1', 'all'),
  );
  await waitFor(() =>
    expect(result.current.currentVersionStatus).toBe('known'),
  );

  failProbe = true;
  act(() => result.current.refresh());

  await waitFor(() => expect(mockedFetchActivity).toHaveBeenCalledTimes(4));
  await waitFor(() =>
    expect(result.current.currentVersionStatus).toBe('unavailable'),
  );
  expect(result.current.newestGroup).toBeNull();
});

test('a reset fails closed before its requests resolve', async () => {
  let deferRefresh = false;
  const releases: Array<
    (value: { count: number; result: ActivityRecord[] }) => void
  > = [];
  mockedFetchActivity.mockImplementation(async () => {
    if (!deferRefresh) {
      return { count: 1, result: [record(10, 0)] };
    }
    return new Promise(resolve => {
      releases.push(resolve);
    });
  });

  const { result } = renderHook(() =>
    useVersionActivity('chart', 'uuid-1', 'all'),
  );
  await waitFor(() =>
    expect(result.current.currentVersionStatus).toBe('known'),
  );

  deferRefresh = true;
  act(() => result.current.refresh());

  expect(result.current.currentVersionStatus).toBe('loading');
  expect(result.current.newestGroup).toBeNull();

  await act(async () => {
    releases.forEach(release => release({ count: 1, result: [record(11, 0)] }));
  });
});

test('a failed timeline refresh does not suppress the independent probe', async () => {
  let refresh = false;
  mockedFetchActivity.mockImplementation(async (_type, _uuid, options) => {
    if (!refresh) {
      return { count: 1, result: [record(10, 0)] };
    }
    if (options?.pageSize === 1) {
      return { count: 1, result: [record(11, 0)] };
    }
    throw new Error('timeline failed');
  });

  const { result } = renderHook(() =>
    useVersionActivity('chart', 'uuid-1', 'all'),
  );
  await waitFor(() =>
    expect(result.current.newestGroup?.transactionId).toBe(10),
  );

  refresh = true;
  act(() => result.current.refresh());

  await waitFor(() =>
    expect(result.current.newestGroup?.transactionId).toBe(11),
  );
  expect(result.current.currentVersionStatus).toBe('known');
  expect(result.current.error).not.toBeNull();
});

test("switching entities discards the previous entity's in-flight probe", async () => {
  // uuid A's probe resolving after the hook moved to uuid B must not write
  // A's newest save into B's Current marker.
  let releaseProbeA: (value: unknown) => void = () => {};
  mockedFetchActivity.mockImplementation(async (_type, uuid, options) => {
    if (options?.pageSize === 1) {
      if (uuid === 'uuid-A') {
        return new Promise(resolve => {
          releaseProbeA = () => resolve({ count: 1, result: [record(111, 0)] });
        });
      }
      return { count: 1, result: [record(222, 0)] };
    }
    return { count: 1, result: [record(5, 0)] };
  });

  const { result, rerender } = renderHook(
    ({ uuid }: { uuid: string }) => useVersionActivity('chart', uuid, 'all'),
    { initialProps: { uuid: 'uuid-A' } },
  );
  await waitFor(() => expect(result.current.timeline).toHaveLength(1));

  rerender({ uuid: 'uuid-B' });
  await waitFor(() =>
    expect(result.current.newestGroup?.transactionId).toBe(222),
  );

  // A's probe finally lands; it must be discarded, not adopted by B.
  await act(async () => {
    releaseProbeA(undefined);
  });
  expect(result.current.newestGroup?.transactionId).toBe(222);
});

test('a refresh while a search is active still refreshes newestGroup', async () => {
  // After a restore made from a filtered timeline, the newest self save
  // changed; the probe must move with it even though the visible fetch
  // carries the q filter.
  let newestTx = 10;
  mockedFetchActivity.mockImplementation(async (_type, _uuid, options) => {
    if (options?.pageSize === 1) {
      return { count: 1, result: [record(newestTx, 0)] };
    }
    return { count: 1, result: [record(5, 0)] };
  });

  const { result } = renderHook(() =>
    useVersionActivity('chart', 'uuid-1', 'all', 'revenue'),
  );
  await waitFor(() =>
    expect(result.current.newestGroup?.transactionId).toBe(10),
  );

  newestTx = 11; // a restore created a newer self save
  act(() => {
    result.current.refresh();
  });

  await waitFor(() =>
    expect(result.current.newestGroup?.transactionId).toBe(11),
  );
});

test('clearing the uuid ignores an in-flight response', async () => {
  let resolveActivity: (value: {
    count: number;
    result: ActivityRecord[];
  }) => void = () => {};
  mockedFetchActivity.mockReturnValue(
    new Promise(resolve => {
      resolveActivity = resolve;
    }),
  );
  const { result, rerender } = renderHook(
    ({ uuid }: { uuid: string | undefined }) =>
      useVersionActivity('chart', uuid, 'all'),
    { initialProps: { uuid: 'uuid-1' as string | undefined } },
  );
  await waitFor(() => expect(mockedFetchActivity).toHaveBeenCalledTimes(2));

  rerender({ uuid: undefined });
  await act(async () => {
    resolveActivity({ count: 1, result: [record(100, 0)] });
  });

  expect(result.current.records).toEqual([]);
  expect(result.current.count).toBe(0);
});
