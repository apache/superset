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

const record = (
  transactionId: number,
  index: number,
): ActivityRecord => ({
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
  expect(mockedFetchActivity).toHaveBeenCalledTimes(1);

  await act(async () => {
    result.current.loadMore();
  });

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.timeline).toHaveLength(2);
  // pages 1 and 2 yielded nothing visible and were auto-chained
  const requestedPages = mockedFetchActivity.mock.calls.map(
    ([, , options]) => options?.page,
  );
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
  const requestedPages = mockedFetchActivity.mock.calls.map(
    ([, , options]) => options?.page,
  );
  expect(requestedPages).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  expect(result.current.timeline).toHaveLength(1);
  // still more raw pages on the server; the button stays available
  expect(result.current.hasMore).toBe(true);
});
