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
import { renderHook, waitFor } from '@testing-library/react';
import { SupersetClient } from '@superset-ui/core';
import { useVersionList } from '../hooks/useVersionList';

jest.mock('@superset-ui/core', () => {
  const actual = jest.requireActual('@superset-ui/core');
  return {
    ...actual,
    SupersetClient: { get: jest.fn() },
  };
});

const mockGet = SupersetClient.get as jest.MockedFunction<
  typeof SupersetClient.get
>;

beforeEach(() => {
  mockGet.mockReset();
});

test('useVersionList reverses the API response so the newest version is first', async () => {
  mockGet.mockResolvedValueOnce({
    json: {
      result: [
        {
          version_uuid: 'old',
          version_number: 1,
          transaction_id: 1,
          operation_type: 'create',
          issued_at: '2026-01-01T00:00:00Z',
          changed_by: null,
          changes: [],
        },
        {
          version_uuid: 'new',
          version_number: 2,
          transaction_id: 2,
          operation_type: 'update',
          issued_at: '2026-02-01T00:00:00Z',
          changed_by: null,
          changes: [],
        },
      ],
    },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.get>>);

  const { result } = renderHook(() => useVersionList('chart', 'abc'));

  await waitFor(() => {
    expect(result.current.versions).not.toBeNull();
  });

  expect(result.current.versions?.[0].version_uuid).toBe('new');
  expect(result.current.versions?.[1].version_uuid).toBe('old');
  expect(mockGet).toHaveBeenCalledWith({
    endpoint: '/api/v1/chart/abc/versions/',
  });
});

test('useVersionList exposes the error when the API call fails', async () => {
  mockGet.mockRejectedValueOnce(new Error('boom'));

  const { result } = renderHook(() => useVersionList('dashboard', 'xyz'));

  await waitFor(() => {
    expect(result.current.error).not.toBeNull();
  });
  expect(result.current.versions).toEqual([]);
});

test('useVersionList ignores stale responses when refetch is called twice', async () => {
  // Race: the first request (kicked off by the initial useEffect) resolves
  // AFTER the explicit refetch() request. Without the requestId guard the
  // stale, first response would clobber the later (newer) one and the
  // list would silently rewind.
  let resolveFirst!: (
    value: Awaited<ReturnType<typeof SupersetClient.get>>,
  ) => void;
  let resolveSecond!: (
    value: Awaited<ReturnType<typeof SupersetClient.get>>,
  ) => void;
  const firstPromise = new Promise<
    Awaited<ReturnType<typeof SupersetClient.get>>
  >(res => {
    resolveFirst = res;
  });
  const secondPromise = new Promise<
    Awaited<ReturnType<typeof SupersetClient.get>>
  >(res => {
    resolveSecond = res;
  });
  mockGet.mockReturnValueOnce(
    firstPromise as unknown as ReturnType<typeof SupersetClient.get>,
  );
  mockGet.mockReturnValueOnce(
    secondPromise as unknown as ReturnType<typeof SupersetClient.get>,
  );

  const { result } = renderHook(() => useVersionList('chart', 'abc'));

  // Trigger the second refetch WITHOUT awaiting — the in-flight first
  // request hasn't resolved yet, so awaiting refetch() would deadlock.
  const secondRefetch = result.current.refetch();
  // Resolve the SECOND request first (the one we care about — the latest).
  resolveSecond({
    json: {
      result: [
        {
          version_uuid: 'winner',
          version_number: 99,
          transaction_id: 99,
          operation_type: 'update',
          issued_at: '2026-03-01T00:00:00Z',
          changed_by: null,
          changes: [],
        },
      ],
    },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.get>>);
  await secondRefetch;
  await waitFor(() => {
    expect(result.current.versions?.[0]?.version_uuid).toBe('winner');
  });

  // Now resolve the FIRST request (stale). It must NOT clobber the winner.
  resolveFirst({
    json: {
      result: [
        {
          version_uuid: 'loser',
          version_number: 1,
          transaction_id: 1,
          operation_type: 'create',
          issued_at: '2026-01-01T00:00:00Z',
          changed_by: null,
          changes: [],
        },
      ],
    },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.get>>);
  // Give the stale promise a chance to land — if the guard fails the
  // versions would flip to ``loser`` after this microtask.
  await new Promise(res => {
    setTimeout(res, 0);
  });
  expect(result.current.versions?.[0]?.version_uuid).toBe('winner');
});
