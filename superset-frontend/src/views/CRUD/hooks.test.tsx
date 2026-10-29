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
import { renderHook, act } from '@testing-library/react';
import rison from 'rison';
import { waitFor } from 'spec/helpers/testing-library';
import { JsonResponse, SupersetClient } from '@superset-ui/core';

import {
  useListViewResource,
  useSingleViewResource,
  useFavoriteStatus,
  useChartEditModal,
  REALTIME_REFETCH_DEBOUNCE_MS,
} from './hooks';
import type Chart from 'src/types/Chart';
import {
  dispatchRealtimeMessage,
  emitRealtimeOpenForTests,
  resetRealtimeForTests,
} from 'src/middleware/realtime';

/** Find the endpoint string from a spy's mock calls that matches a substring. */
function findEndpoint(spy: jest.SpyInstance, substring: string): string {
  const match = spy.mock.calls.find(
    (call: unknown[]) =>
      typeof (call[0] as Record<string, string>)?.endpoint === 'string' &&
      (call[0] as Record<string, string>).endpoint.includes(substring),
  );

  if (!match) {
    throw new Error(`No call found with endpoint containing "${substring}"`);
  }

  return (match[0] as Record<string, string>).endpoint;
}

function deferredJsonResponse() {
  let resolveResponse: ((value: JsonResponse) => void) | undefined;
  let rejectResponse: ((reason?: unknown) => void) | undefined;
  const promise = new Promise<JsonResponse>((resolve, reject) => {
    resolveResponse = resolve;
    rejectResponse = reject;
  });

  if (!resolveResponse || !rejectResponse) {
    throw new Error('Deferred response handlers were not initialized');
  }

  return { promise, resolve: resolveResponse, reject: rejectResponse };
}

beforeEach(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  // Clear the shared realtime client's module-level handlers/socket so a
  // realtime-enabled hook from one test can't leak into the next.
  resetRealtimeForTests();
});

// useListViewResource
test('useListViewResource: initial state has loading true and empty collection', () => {
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { permissions: ['can_read'] },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn()),
  );

  expect(result.current.state.loading).toBe(true);
  expect(result.current.state.resourceCollection).toEqual([]);
  expect(result.current.state.resourceCount).toBe(0);
  expect(result.current.state.bulkSelectEnabled).toBe(false);
});

test('useListViewResource: fetches permissions on mount', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { permissions: ['can_read', 'can_write'] },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn()),
  );

  await waitFor(() => {
    expect(getSpy).toHaveBeenCalledWith({
      endpoint: expect.stringContaining('/api/v1/chart/_info'),
    });
  });

  await waitFor(() => {
    expect(result.current.hasPerm('can_read')).toBe(true);
    expect(result.current.hasPerm('can_write')).toBe(true);
    expect(result.current.hasPerm('can_delete')).toBe(false);
  });
});

test('useListViewResource: skips permissions fetch when infoEnable is false', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { permissions: [] },
  } as unknown as JsonResponse);

  renderHook(() => useListViewResource('chart', 'Charts', jest.fn(), false));

  await act(async () => {});

  // No API call expected
  expect(getSpy).not.toHaveBeenCalled();
});

test('useListViewResource: hasPerm returns false when permissions are empty', async () => {
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {},
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn()),
  );

  expect(result.current.hasPerm('can_read')).toBe(false);
});

test('useListViewResource: fetchData calls correct endpoint and updates state', async () => {
  const mockData = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
  ];
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: mockData, count: 2 },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn()),
  );

  await act(async () => {
    await result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'name', desc: false }],
      filters: [],
    });
  });

  // First call is permissions _info, second is the data fetch
  const endpoint = findEndpoint(getSpy, '/api/v1/chart/?q=');
  expect(endpoint).toContain('order_column:name');
  expect(endpoint).toContain('order_direction:asc');
  expect(endpoint).toContain('page:0');
  expect(endpoint).toContain('page_size:25');

  await waitFor(() => {
    expect(result.current.state.resourceCollection).toEqual(mockData);
    expect(result.current.state.resourceCount).toBe(2);
    expect(result.current.state.loading).toBe(false);
  });
});

test('useListViewResource: fetchData includes selectColumns in query', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [], count: 0 },
  } as unknown as JsonResponse);

  const selectColumns = ['id', 'name'];

  const { result } = renderHook(() =>
    useListViewResource(
      'chart',
      'Charts',
      jest.fn(),
      undefined,
      undefined,
      undefined,
      undefined,
      selectColumns,
    ),
  );

  await act(async () => {
    await result.current.fetchData({
      pageIndex: 0,
      pageSize: 10,
      sortBy: [{ id: 'name' }],
      filters: [],
    });
  });

  const endpoint = findEndpoint(getSpy, '/api/v1/chart/?q=');
  expect(endpoint).toContain('select_columns:!(id,name)');
});

test('useListViewResource: fetchData merges baseFilters with user filters', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [], count: 0 },
  } as unknown as JsonResponse);

  const baseFilters = [{ id: 'published', operator: 'eq', value: true }];

  const { result } = renderHook(() =>
    useListViewResource(
      'dashboard',
      'Dashboards',
      jest.fn(),
      true,
      [],
      baseFilters,
    ),
  );

  await act(async () => {
    await result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'title' }],
      filters: [{ id: 'name', operator: 'ct', value: 'test' }],
    });
  });

  const endpoint = findEndpoint(getSpy, '/api/v1/dashboard/?q=');

  // Both base filter and user filter should be present
  expect(endpoint).toContain('col:published');
  expect(endpoint).toContain('col:name');
});

test('useListViewResource: fetchData filters out empty/null/undefined filter values', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [], count: 0 },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn()),
  );

  await act(async () => {
    await result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'name' }],
      filters: [
        { id: 'name', operator: 'ct', value: 'keep' },
        { id: 'empty', operator: 'eq', value: '' },
        { id: 'nullval', operator: 'eq', value: null },
        { id: 'undef', operator: 'eq', value: undefined },
      ],
    });
  });

  const endpoint = findEndpoint(getSpy, '/api/v1/chart/?q=');

  expect(endpoint).toContain('col:name');
  expect(endpoint).not.toContain('col:empty');
  expect(endpoint).not.toContain('col:nullval');
  expect(endpoint).not.toContain('col:undef');
});

test('useListViewResource: fetchData sets loading to true then false', async () => {
  let resolveGet: ((value: unknown) => void) | undefined;
  jest.spyOn(SupersetClient, 'get').mockImplementation(
    () =>
      new Promise(resolve => {
        resolveGet = resolve;
      }) as Promise<JsonResponse>,
  );

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn(), false),
  );

  // Initial loading
  expect(result.current.state.loading).toBe(true);

  act(() => {
    result.current.fetchData({
      pageIndex: 0,
      pageSize: 10,
      sortBy: [{ id: 'name' }],
      filters: [],
    });
  });

  // Loading should be true while fetching
  expect(result.current.state.loading).toBe(true);

  await act(async () => {
    expect(resolveGet).toBeDefined();
    resolveGet?.({ json: { result: [], count: 0 } });
  });

  await waitFor(() => {
    expect(result.current.state.loading).toBe(false);
  });
});

test('useListViewResource: ignores an older response that resolves last', async () => {
  const older = deferredJsonResponse();
  const newer = deferredJsonResponse();
  const toISOString = jest
    .spyOn(Date.prototype, 'toISOString')
    .mockReturnValueOnce('newer-response-time')
    .mockReturnValueOnce('older-response-time');
  jest
    .spyOn(SupersetClient, 'get')
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn(), false),
  );

  act(() => {
    result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'name' }],
      filters: [],
    });
    result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'name' }],
      filters: [{ id: 'name', operator: 'ct', value: 'newer' }],
    });
  });

  await act(async () => {
    newer.resolve({
      json: { result: [], count: 0 },
    } as unknown as JsonResponse);
  });
  expect(result.current.state.resourceCollection).toEqual([]);
  expect(result.current.state.resourceCount).toBe(0);
  expect(result.current.state.lastFetched).toBe('newer-response-time');

  await act(async () => {
    older.resolve({
      json: { result: [{ id: 1 }, { id: 2 }], count: 2 },
    } as unknown as JsonResponse);
  });

  expect(result.current.state.resourceCollection).toEqual([]);
  expect(result.current.state.resourceCount).toBe(0);
  expect(result.current.state.lastFetched).toBe('newer-response-time');
  expect(toISOString).toHaveBeenCalledTimes(1);
});

test('useListViewResource: stale completion keeps the latest request loading', async () => {
  const older = deferredJsonResponse();
  const newer = deferredJsonResponse();
  jest
    .spyOn(SupersetClient, 'get')
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn(), false),
  );

  act(() => {
    result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'name' }],
      filters: [],
    });
    result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'name' }],
      filters: [{ id: 'name', operator: 'ct', value: 'newer' }],
    });
  });

  await act(async () => {
    older.resolve({
      json: { result: [{ id: 1 }], count: 1 },
    } as unknown as JsonResponse);
  });

  expect(result.current.state.resourceCollection).toEqual([]);
  expect(result.current.state.loading).toBe(true);

  await act(async () => {
    newer.resolve({
      json: { result: [{ id: 2 }], count: 1 },
    } as unknown as JsonResponse);
  });

  expect(result.current.state.resourceCollection).toEqual([{ id: 2 }]);
  expect(result.current.state.loading).toBe(false);
});

test('useListViewResource: only the latest request reports an error', async () => {
  const older = deferredJsonResponse();
  const newer = deferredJsonResponse();
  const handleErrorMsg = jest.fn();
  jest
    .spyOn(SupersetClient, 'get')
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', handleErrorMsg, false),
  );

  act(() => {
    result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'name' }],
      filters: [],
    });
    result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'name' }],
      filters: [{ id: 'name', operator: 'ct', value: 'newer' }],
    });
  });

  await act(async () => {
    older.reject('older request failed');
  });

  expect(handleErrorMsg).not.toHaveBeenCalled();
  expect(result.current.state.loading).toBe(true);

  await act(async () => {
    newer.reject('newer request failed');
  });

  expect(handleErrorMsg).toHaveBeenCalledTimes(1);
  expect(result.current.state.loading).toBe(false);
});

test('useListViewResource: refreshData re-fetches with last config', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [], count: 0 },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn()),
  );

  const config = {
    pageIndex: 2,
    pageSize: 50,
    sortBy: [{ id: 'name', desc: true }],
    filters: [],
  };

  // FetchData to cache the config
  await act(async () => {
    await result.current.fetchData(config);
  });

  getSpy.mockClear();

  // RefreshData should reuse the cached config
  await act(async () => {
    await result.current.refreshData();
  });

  expect(getSpy).toHaveBeenCalledWith({
    endpoint: expect.stringContaining('page:2'),
  });
  expect(getSpy).toHaveBeenCalledWith({
    endpoint: expect.stringContaining('page_size:50'),
  });
});

test('useListViewResource: refreshData returns null when no cached config', () => {
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {},
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn()),
  );

  const returnValue = result.current.refreshData();
  expect(returnValue).toBeNull();
});

test('useListViewResource: toggleBulkSelect toggles bulkSelectEnabled', async () => {
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {},
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn()),
  );

  expect(result.current.state.bulkSelectEnabled).toBe(false);

  act(() => {
    result.current.toggleBulkSelect();
  });

  expect(result.current.state.bulkSelectEnabled).toBe(true);

  act(() => {
    result.current.toggleBulkSelect();
  });

  expect(result.current.state.bulkSelectEnabled).toBe(false);
});

test('useListViewResource: setResourceCollection updates the collection', async () => {
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {},
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn()),
  );

  const newCollection = [{ id: 1 }, { id: 2 }];

  act(() => {
    result.current.setResourceCollection(newCollection);
  });

  expect(result.current.state.resourceCollection).toEqual(newCollection);
});

test('useListViewResource: uses desc sort direction when desc is true', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [], count: 0 },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn()),
  );

  await act(async () => {
    await result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'changed_on', desc: true }],
      filters: [],
    });
  });

  const endpoint = findEndpoint(getSpy, '/api/v1/chart/?q=');
  expect(endpoint).toContain('order_direction:desc');
});

test('useListViewResource: realtime nudge live-patches a displayed row in place', async () => {
  const initial = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
  ];
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValueOnce({
      json: { permissions: [] },
    } as unknown as JsonResponse) // _info
    .mockResolvedValueOnce({
      json: { result: initial, count: 2 },
    } as unknown as JsonResponse) // fetchData
    .mockResolvedValueOnce({
      json: { result: [{ id: 1, name: 'A-updated' }] },
    } as unknown as JsonResponse); // batched realtime refetch

  const { result } = renderHook(() =>
    useListViewResource(
      'chart',
      'Charts',
      jest.fn(),
      true,
      [],
      undefined,
      true,
      undefined,
      true, // enableRealtime
    ),
  );

  await act(async () => {
    await result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'id', desc: false }],
      filters: [],
    });
  });
  expect(result.current.state.resourceCollection).toEqual(initial);

  // A nudge for a displayed row triggers one batched refetch (col:id op:in),
  // and the fetched row is merged in place; the untouched row is unchanged.
  act(() => {
    dispatchRealtimeMessage(
      JSON.stringify({
        topic: 'entity.changed',
        payload: { entity_type: 'chart', id: 1 },
      }),
    );
  });

  await waitFor(
    () => {
      expect(result.current.state.resourceCollection).toEqual([
        { id: 1, name: 'A-updated' },
        { id: 2, name: 'B' },
      ]);
    },
    { timeout: 3000 },
  );
  const endpoint = findEndpoint(getSpy, 'col:id');
  expect(endpoint).toContain('opr:in');
});

test('useListViewResource: realtime ignores nudges for rows not on screen', async () => {
  const initial = [{ id: 1, name: 'A' }];
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: initial, count: 1 },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource(
      'chart',
      'Charts',
      jest.fn(),
      true,
      [],
      undefined,
      true,
      undefined,
      true,
    ),
  );

  await act(async () => {
    await result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'id', desc: false }],
      filters: [],
    });
  });

  const callsBefore = getSpy.mock.calls.length;
  act(() => {
    dispatchRealtimeMessage(
      JSON.stringify({
        topic: 'entity.changed',
        payload: { entity_type: 'chart', id: 999 },
      }),
    );
  });

  // No id=999 row is displayed, so no batched refetch is scheduled: wait past
  // the debounce window, by which point one would have fired.
  await new Promise(resolve =>
    setTimeout(resolve, REALTIME_REFETCH_DEBOUNCE_MS + 100),
  );
  expect(getSpy.mock.calls.length).toBe(callsBefore);
});

test('useListViewResource: realtime reconciles displayed rows on reconnect', async () => {
  // Nudges are lossy and not replayed, so on a socket (re)connect the list
  // refetches its currently-displayed rows once to catch anything missed.
  const initial = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
  ];
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValueOnce({
      json: { permissions: [] },
    } as unknown as JsonResponse) // _info
    .mockResolvedValueOnce({
      json: { result: initial, count: 2 },
    } as unknown as JsonResponse) // fetchData
    .mockResolvedValueOnce({
      json: { result: [{ id: 2, name: 'B-updated' }] },
    } as unknown as JsonResponse); // reconnect reconcile refetch

  const { result } = renderHook(() =>
    useListViewResource(
      'chart',
      'Charts',
      jest.fn(),
      true,
      [],
      undefined,
      true,
      undefined,
      true, // enableRealtime
    ),
  );

  await act(async () => {
    await result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'id', desc: false }],
      filters: [],
    });
  });
  expect(result.current.state.resourceCollection).toEqual(initial);

  // Socket reconnects → one batched refetch of the displayed rows, merged in place.
  act(() => {
    emitRealtimeOpenForTests();
  });

  await waitFor(
    () => {
      expect(result.current.state.resourceCollection).toEqual([
        { id: 1, name: 'A' },
        { id: 2, name: 'B-updated' },
      ]);
    },
    { timeout: 3000 },
  );
  const endpoint = findEndpoint(getSpy, 'col:id');
  expect(endpoint).toContain('opr:in');
});

test('useListViewResource: realtime does NOT reconcile on a keepalive reconnect', async () => {
  // A seamless keepalive token refresh must not trigger a full displayed-row
  // re-fetch every cycle — only a real `reconnect` (drop recovery) reconciles.
  const initial = [{ id: 1, name: 'A' }];
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValueOnce({
      json: { permissions: [] },
    } as unknown as JsonResponse) // _info
    .mockResolvedValueOnce({
      json: { result: initial, count: 1 },
    } as unknown as JsonResponse); // fetchData

  const { result } = renderHook(() =>
    useListViewResource(
      'chart',
      'Charts',
      jest.fn(),
      true,
      [],
      undefined,
      true,
      undefined,
      true, // enableRealtime
    ),
  );

  await act(async () => {
    await result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'id', desc: false }],
      filters: [],
    });
  });

  const callsBefore = getSpy.mock.calls.length;
  act(() => {
    emitRealtimeOpenForTests('keepalive');
  });
  // No reconcile fetch for a keepalive reconnect.
  await new Promise(resolve => {
    setTimeout(resolve, 50);
  });
  expect(getSpy.mock.calls.length).toBe(callsBefore);
});

test('useListViewResource: includes extra list query parameters', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [], count: 0 },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn()),
  );

  await act(async () => {
    await result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'viz_type' }],
      filters: [],
      extraQueryParams: {
        viz_type_order: ['slug_z', 'slug_a'],
      },
    });
  });

  const endpoint = findEndpoint(getSpy, '/api/v1/chart/?q=');
  const query = new URL(endpoint, 'http://localhost').searchParams.get('q');
  expect(rison.decode(query!)).toMatchObject({
    order_column: 'viz_type',
    viz_type_order: ['slug_z', 'slug_a'],
  });
});

test('useListViewResource: refresh reuses extra list query parameters', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [], count: 0 },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn()),
  );

  await act(async () => {
    await result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'viz_type' }],
      filters: [],
      extraQueryParams: { viz_type_order: ['slug_z', 'slug_a'] },
    });
    await result.current.refreshData();
  });

  const listQueries = getSpy.mock.calls
    .map(call => (call[0] as { endpoint: string }).endpoint)
    .filter(endpoint => endpoint.includes('/api/v1/chart/?q='))
    .map(endpoint => {
      const query = new URL(endpoint, 'http://localhost').searchParams.get('q');
      return rison.decode(query!);
    });
  expect(listQueries).toHaveLength(2);
  expect(listQueries).toEqual([
    expect.objectContaining({ viz_type_order: ['slug_z', 'slug_a'] }),
    expect.objectContaining({ viz_type_order: ['slug_z', 'slug_a'] }),
  ]);
});

test('useListViewResource: extra parameters cannot replace list controls', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [], count: 0 },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useListViewResource('chart', 'Charts', jest.fn()),
  );

  await act(async () => {
    await result.current.fetchData({
      pageIndex: 0,
      pageSize: 25,
      sortBy: [{ id: 'viz_type' }],
      filters: [],
      extraQueryParams: {
        custom_param: 'preserved',
        filters: [{ col: 'slice_name', opr: 'eq', value: 'injected' }],
        order_column: 'slice_name',
        order_direction: 'desc',
        page: 99,
        page_size: 1,
        select_columns: ['slice_name'],
      },
    });
  });

  const endpoint = findEndpoint(getSpy, '/api/v1/chart/?q=');
  const query = new URL(endpoint, 'http://localhost').searchParams.get('q');
  expect(rison.decode(query!)).toEqual({
    custom_param: 'preserved',
    order_column: 'viz_type',
    order_direction: 'asc',
    page: 0,
    page_size: 25,
  });
});

// useSingleViewResource
test('useSingleViewResource: initial state has loading false and null resource', () => {
  const { result } = renderHook(() =>
    useSingleViewResource('chart', 'Charts', jest.fn()),
  );

  expect(result.current.state.loading).toBe(false);
  expect(result.current.state.resource).toBeNull();
  expect(result.current.state.error).toBeNull();
});

test('useSingleViewResource: fetchResource calls correct endpoint', async () => {
  const mockResult = { id: 42, name: 'Test Chart' };
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: mockResult },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useSingleViewResource('chart', 'Charts', jest.fn()),
  );

  await act(async () => {
    await result.current.fetchResource(42);
  });

  expect(getSpy).toHaveBeenCalledWith({
    endpoint: '/api/v1/chart/42',
  });

  await waitFor(() => {
    expect(result.current.state.resource).toEqual(mockResult);
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBeNull();
  });
});

test('useSingleViewResource: fetchResource appends pathSuffix', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: {} },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useSingleViewResource('chart', 'Charts', jest.fn(), 'related_objects'),
  );

  await act(async () => {
    await result.current.fetchResource(42);
  });

  expect(getSpy).toHaveBeenCalledWith({
    endpoint: '/api/v1/chart/42/related_objects',
  });
});

test('useSingleViewResource: createResource posts to correct endpoint', async () => {
  const postSpy = jest.spyOn(SupersetClient, 'post').mockResolvedValue({
    json: { id: 99, result: { name: 'New Chart' } },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useSingleViewResource('chart', 'Charts', jest.fn()),
  );

  let createdId: number | undefined;
  await act(async () => {
    createdId = await result.current.createResource({
      name: 'New Chart',
    } as any);
  });

  expect(postSpy).toHaveBeenCalledWith({
    endpoint: '/api/v1/chart/',
    body: JSON.stringify({ name: 'New Chart' }),
    headers: { 'Content-Type': 'application/json' },
  });
  expect(createdId).toBe(99);

  await waitFor(() => {
    expect(result.current.state.loading).toBe(false);
  });
});

test('useSingleViewResource: updateResource puts to correct endpoint', async () => {
  const putSpy = jest.spyOn(SupersetClient, 'put').mockResolvedValue({
    json: { id: 42, result: { name: 'Updated' } },
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useSingleViewResource('chart', 'Charts', jest.fn()),
  );

  await act(async () => {
    await result.current.updateResource(42, { name: 'Updated' } as any);
  });

  expect(putSpy).toHaveBeenCalledWith({
    endpoint: '/api/v1/chart/42',
    body: JSON.stringify({ name: 'Updated' }),
    headers: { 'Content-Type': 'application/json' },
  });

  await waitFor(() => {
    expect(result.current.state.resource).toEqual({ name: 'Updated', id: 42 });
    expect(result.current.state.loading).toBe(false);
  });
});

test('useSingleViewResource: clearError resets error to null', async () => {
  // First make a failing request to get an error state
  jest.spyOn(SupersetClient, 'get').mockRejectedValue('Network error');

  const { result } = renderHook(() =>
    useSingleViewResource('chart', 'Charts', jest.fn()),
  );

  await act(async () => {
    try {
      await result.current.fetchResource(1);
    } catch {
      // expected
    }
  });

  act(() => {
    result.current.clearError();
  });

  expect(result.current.state.error).toBeNull();
});

test('useSingleViewResource: setResource updates the resource', () => {
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {},
  } as unknown as JsonResponse);

  const { result } = renderHook(() =>
    useSingleViewResource('chart', 'Charts', jest.fn()),
  );

  act(() => {
    result.current.setResource({ id: 1, name: 'Manual' } as any);
  });

  expect(result.current.state.resource).toEqual({ id: 1, name: 'Manual' });
});

// useFavoriteStatus
test('useFavoriteStatus: does not fetch when ids array is empty', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [] },
  } as unknown as JsonResponse);

  renderHook(() => useFavoriteStatus('chart', [], jest.fn()));

  await act(async () => {});

  // No API call should have been made
  expect(getSpy).not.toHaveBeenCalled();
});

test('useFavoriteStatus: saveFaveStar posts when not starred', async () => {
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [] },
  } as unknown as JsonResponse);
  const postSpy = jest
    .spyOn(SupersetClient, 'post')
    .mockResolvedValue({} as JsonResponse);

  const { result } = renderHook(() =>
    useFavoriteStatus('chart', [], jest.fn()),
  );

  await act(async () => {
    // isStarred = false --> should POST to add favorite
    result.current[0](42, false);
  });

  expect(postSpy).toHaveBeenCalledWith({
    endpoint: '/api/v1/chart/42/favorites/',
  });
});

test('useFavoriteStatus: saveFaveStar deletes when already starred', async () => {
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [] },
  } as unknown as JsonResponse);
  const deleteSpy = jest
    .spyOn(SupersetClient, 'delete')
    .mockResolvedValue({} as JsonResponse);

  const { result } = renderHook(() =>
    useFavoriteStatus('chart', [], jest.fn()),
  );

  await act(async () => {
    // isStarred = true --> should DELETE to remove favorite
    result.current[0](42, true);
  });

  expect(deleteSpy).toHaveBeenCalledWith({
    endpoint: '/api/v1/chart/42/favorites/',
  });
});

test('useFavoriteStatus: saveFaveStar updates local status on success', async () => {
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [] },
  } as unknown as JsonResponse);
  jest.spyOn(SupersetClient, 'post').mockResolvedValue({} as JsonResponse);

  const { result } = renderHook(() =>
    useFavoriteStatus('chart', [], jest.fn()),
  );

  // Star a chart
  await act(async () => {
    result.current[0](42, false);
  });

  await waitFor(() => {
    expect(result.current[1]).toEqual(expect.objectContaining({ 42: true }));
  });
});

test('useFavoriteStatus: saveFaveStar uses correct endpoint per type', async () => {
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [] },
  } as unknown as JsonResponse);
  const postSpy = jest
    .spyOn(SupersetClient, 'post')
    .mockResolvedValue({} as JsonResponse);

  const { result } = renderHook(() =>
    useFavoriteStatus('dashboard', [], jest.fn()),
  );

  await act(async () => {
    result.current[0](7, false);
  });

  expect(postSpy).toHaveBeenCalledWith({
    endpoint: '/api/v1/dashboard/7/favorites/',
  });
});

// useChartEditModal
test('useChartEditModal: openChartEditModal sets sliceCurrentlyEditing', () => {
  const mockChart: Chart = {
    id: 1,
    slice_name: 'Test Chart',
    description: 'A test',
    cache_timeout: 300,
    certified_by: 'Admin',
    certification_details: 'Certified',
    is_managed_externally: false,
  } as Chart;

  const { result } = renderHook(() =>
    useChartEditModal(jest.fn(), [mockChart]),
  );

  expect(result.current.sliceCurrentlyEditing).toBeNull();

  act(() => {
    result.current.openChartEditModal(mockChart);
  });

  expect(result.current.sliceCurrentlyEditing).toEqual({
    slice_id: 1,
    slice_name: 'Test Chart',
    description: 'A test',
    cache_timeout: 300,
    certified_by: 'Admin',
    certification_details: 'Certified',
    is_managed_externally: false,
  });
});

test('useChartEditModal: closeChartEditModal clears sliceCurrentlyEditing', () => {
  const mockChart: Chart = {
    id: 1,
    slice_name: 'Test Chart',
  } as Chart;

  const { result } = renderHook(() =>
    useChartEditModal(jest.fn(), [mockChart]),
  );

  act(() => {
    result.current.openChartEditModal(mockChart);
  });
  expect(result.current.sliceCurrentlyEditing).not.toBeNull();

  act(() => {
    result.current.closeChartEditModal();
  });
  expect(result.current.sliceCurrentlyEditing).toBeNull();
});

test('useChartEditModal: handleChartUpdated merges edits into chart list', () => {
  const setCharts = jest.fn();
  const charts: Chart[] = [
    { id: 1, slice_name: 'Original' } as Chart,
    { id: 2, slice_name: 'Other' } as Chart,
  ];

  const { result } = renderHook(() => useChartEditModal(setCharts, charts));

  act(() => {
    result.current.handleChartUpdated({
      id: 1,
      slice_name: 'Updated Name',
    } as Chart);
  });

  expect(setCharts).toHaveBeenCalledWith([
    { id: 1, slice_name: 'Updated Name' },
    { id: 2, slice_name: 'Other' },
  ]);
});

test('useChartEditModal: handleChartUpdated leaves non-matching charts unchanged', () => {
  const setCharts = jest.fn();
  const charts: Chart[] = [
    { id: 1, slice_name: 'A' } as Chart,
    { id: 2, slice_name: 'B' } as Chart,
  ];

  const { result } = renderHook(() => useChartEditModal(setCharts, charts));

  act(() => {
    result.current.handleChartUpdated({
      id: 999,
      slice_name: 'Nonexistent',
    } as Chart);
  });

  expect(setCharts).toHaveBeenCalledWith([
    { id: 1, slice_name: 'A' },
    { id: 2, slice_name: 'B' },
  ]);
});
