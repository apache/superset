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
import { useActivity } from '../hooks/useActivity';
import { ActivityRecord } from '../types';

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

function makeRecord(over: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    version_uuid: 'v1',
    entity_kind: 'dashboard',
    entity_uuid: 'e1',
    entity_name: 'Sample',
    entity_deleted: false,
    entity_deletion_state: null,
    source: 'self',
    transaction_id: 1,
    issued_at: '2026-05-29T10:00:00Z',
    changed_by: null,
    kind: 'field',
    path: ['dashboard_title'],
    from_value: 'Old',
    to_value: 'New',
    summary: '',
    impact: null,
    ...over,
  };
}

beforeEach(() => {
  mockGet.mockReset();
});

test('useActivity unwraps the envelope and surfaces records + count', async () => {
  mockGet.mockResolvedValueOnce({
    json: { result: [makeRecord({ version_uuid: 'a' })], count: 42 },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.get>>);

  const { result } = renderHook(() => useActivity('dashboard', 'abc'));

  await waitFor(() => {
    expect(result.current.records).not.toBeNull();
  });
  expect(result.current.records?.[0].version_uuid).toBe('a');
  expect(result.current.count).toBe(42);
});

test('useActivity defaults to include=all when no option is passed', async () => {
  mockGet.mockResolvedValueOnce({
    json: { result: [], count: 0 },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.get>>);

  renderHook(() => useActivity('chart', 'abc'));

  await waitFor(() => {
    expect(mockGet).toHaveBeenCalled();
  });
  const { endpoint } = mockGet.mock.calls[0][0] as { endpoint: string };
  expect(endpoint).toContain('/api/v1/chart/abc/activity/');
  // ``include`` and pagination are flat query params (NOT inside rison ``q``).
  expect(endpoint).toContain('include=all');
  expect(endpoint).toContain('page=0');
  expect(endpoint).toContain('page_size=25');
});

test('useActivity propagates include / page / pageSize to the endpoint', async () => {
  mockGet.mockResolvedValueOnce({
    json: { result: [], count: 0 },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.get>>);

  renderHook(() =>
    useActivity('dashboard', 'abc', {
      include: 'self',
      page: 2,
      pageSize: 100,
    }),
  );

  await waitFor(() => {
    expect(mockGet).toHaveBeenCalled();
  });
  const { endpoint } = mockGet.mock.calls[0][0] as { endpoint: string };
  expect(endpoint).toContain('include=self');
  expect(endpoint).toContain('page=2');
  expect(endpoint).toContain('page_size=100');
});

test('useActivity exposes the error when the API call fails', async () => {
  mockGet.mockRejectedValueOnce(new Error('boom'));

  const { result } = renderHook(() => useActivity('chart', 'abc'));

  await waitFor(() => {
    expect(result.current.error).not.toBeNull();
  });
  expect(result.current.records).toEqual([]);
  expect(result.current.count).toBe(0);
});

test('useActivity ignores stale responses when refetch is called twice', async () => {
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

  const { result } = renderHook(() => useActivity('dashboard', 'abc'));
  const second = result.current.refetch();
  resolveSecond({
    json: { result: [makeRecord({ version_uuid: 'winner' })], count: 1 },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.get>>);
  await second;
  await waitFor(() => {
    expect(result.current.records?.[0]?.version_uuid).toBe('winner');
  });

  resolveFirst({
    json: { result: [makeRecord({ version_uuid: 'loser' })], count: 1 },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.get>>);
  await new Promise(res => {
    setTimeout(res, 0);
  });
  expect(result.current.records?.[0]?.version_uuid).toBe('winner');
});
