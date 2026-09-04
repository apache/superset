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
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import {
  clearPermissionSearchCache,
  fetchGroupOptions,
  fetchPermissionOptions,
} from './utils';

const getMock = jest.spyOn(SupersetClient, 'get');

afterEach(() => {
  getMock.mockReset();
  clearPermissionSearchCache();
});

test('fetchPermissionOptions fetches all results on page 0 with large page_size', async () => {
  getMock.mockResolvedValue({
    json: {
      count: 1,
      result: [
        {
          id: 10,
          permission: { name: 'can_access' },
          view_menu: { name: 'dataset_one' },
        },
      ],
    },
  } as any);
  const addDangerToast = jest.fn();

  const result = await fetchPermissionOptions('dataset', 0, 50, addDangerToast);

  // Two parallel requests with large page_size for full fetch
  expect(getMock).toHaveBeenCalledTimes(2);

  const calls = getMock.mock.calls.map(
    ([call]) => (call as { endpoint: string }).endpoint,
  );
  const queries = calls.map(ep => rison.decode(ep.split('?q=')[1]));

  expect(queries).toContainEqual({
    page: 0,
    page_size: 1000,
    filters: [{ col: 'view_menu.name', opr: 'ct', value: 'dataset' }],
  });
  expect(queries).toContainEqual({
    page: 0,
    page_size: 1000,
    filters: [{ col: 'permission.name', opr: 'ct', value: 'dataset' }],
  });

  // Duplicates are removed; both calls return id=10 so result has one entry
  expect(result).toEqual({
    data: [{ value: 10, label: 'can access dataset one' }],
    totalCount: 1,
  });
  expect(addDangerToast).not.toHaveBeenCalled();
});

test('fetchPermissionOptions serves cached slices on subsequent pages', async () => {
  // Seed cache with page 0
  let callCount = 0;
  getMock.mockImplementation(() => {
    callCount += 1;
    if (callCount === 1) {
      return Promise.resolve({
        json: {
          count: 3,
          result: [
            { id: 1, permission: { name: 'a' }, view_menu: { name: 'X' } },
            { id: 2, permission: { name: 'b' }, view_menu: { name: 'Y' } },
            { id: 3, permission: { name: 'c' }, view_menu: { name: 'Z' } },
          ],
        },
      } as any);
    }
    return Promise.resolve({ json: { count: 0, result: [] } } as any);
  });
  const addDangerToast = jest.fn();

  // Page 0 populates the cache
  await fetchPermissionOptions('test', 0, 2, addDangerToast);
  expect(getMock).toHaveBeenCalledTimes(2);

  getMock.mockReset();

  // Page 1 should serve from cache with zero API calls
  const page1 = await fetchPermissionOptions('test', 1, 2, addDangerToast);
  expect(getMock).not.toHaveBeenCalled();
  expect(page1).toEqual({
    data: [{ value: 3, label: 'c Z' }],
    totalCount: 3,
  });
});

test('fetchPermissionOptions makes single request when search term is empty', async () => {
  getMock.mockResolvedValue({
    json: { count: 0, result: [] },
  } as any);
  const addDangerToast = jest.fn();

  await fetchPermissionOptions('', 0, 100, addDangerToast);

  expect(getMock).toHaveBeenCalledTimes(1);
  const { endpoint } = getMock.mock.calls[0][0] as { endpoint: string };
  const queryString = endpoint.split('?q=')[1];
  expect(rison.decode(queryString)).toEqual({
    page: 0,
    page_size: 100,
  });
});

test('fetchPermissionOptions fires single toast when both requests fail', async () => {
  getMock.mockRejectedValue(new Error('request failed'));
  const addDangerToast = jest.fn();

  const result = await fetchPermissionOptions(
    'dataset',
    0,
    100,
    addDangerToast,
  );

  expect(addDangerToast).toHaveBeenCalledTimes(1);
  expect(addDangerToast).toHaveBeenCalledWith(
    'There was an error while fetching permissions',
  );
  expect(result).toEqual({ data: [], totalCount: 0 });
});

test('fetchPermissionOptions deduplicates results from both columns', async () => {
  const sharedResult = {
    id: 5,
    permission: { name: 'can_read' },
    view_menu: { name: 'ChartView' },
  };
  const viewMenuOnly = {
    id: 6,
    permission: { name: 'can_write' },
    view_menu: { name: 'ChartView' },
  };
  const permissionOnly = {
    id: 7,
    permission: { name: 'can_read' },
    view_menu: { name: 'DashboardView' },
  };

  let callCount = 0;
  getMock.mockImplementation(() => {
    callCount += 1;
    if (callCount === 1) {
      // view_menu.name search returns shared + viewMenuOnly
      return Promise.resolve({
        json: { count: 2, result: [sharedResult, viewMenuOnly] },
      } as any);
    }
    // permission.name search returns shared + permissionOnly
    return Promise.resolve({
      json: { count: 2, result: [sharedResult, permissionOnly] },
    } as any);
  });

  const addDangerToast = jest.fn();
  const result = await fetchPermissionOptions('chart', 0, 100, addDangerToast);

  // id=5 appears in both results but should be deduplicated
  expect(result.data).toEqual([
    { value: 5, label: 'can read ChartView' },
    { value: 6, label: 'can write ChartView' },
    { value: 7, label: 'can read DashboardView' },
  ]);
  // totalCount reflects deduplicated cache length
  expect(result.totalCount).toBe(3);
});

test('fetchPermissionOptions preserves cache across empty searches', async () => {
  // Populate cache with a search
  getMock.mockResolvedValue({
    json: {
      count: 1,
      result: [{ id: 1, permission: { name: 'a' }, view_menu: { name: 'X' } }],
    },
  } as any);
  const addDangerToast = jest.fn();
  await fetchPermissionOptions('test', 0, 50, addDangerToast);
  expect(getMock).toHaveBeenCalledTimes(2);
  getMock.mockReset();

  // Empty search makes a fresh request but does NOT clear search cache
  getMock.mockResolvedValue({ json: { count: 0, result: [] } } as any);
  await fetchPermissionOptions('', 0, 50, addDangerToast);
  expect(getMock).toHaveBeenCalledTimes(1);
  getMock.mockReset();

  // Previous search term should still be cached — zero API calls
  const cached = await fetchPermissionOptions('test', 0, 50, addDangerToast);
  expect(getMock).not.toHaveBeenCalled();
  expect(cached.totalCount).toBe(1);
});

test('fetchGroupOptions sends filters array with search term', async () => {
  getMock.mockResolvedValue({
    json: {
      count: 2,
      result: [
        { id: 1, name: 'Engineering' },
        { id: 2, name: 'Analytics' },
      ],
    },
  } as any);
  const addDangerToast = jest.fn();

  const result = await fetchGroupOptions('eng', 1, 25, addDangerToast);

  expect(getMock).toHaveBeenCalledTimes(1);
  const { endpoint } = getMock.mock.calls[0][0] as { endpoint: string };
  const queryString = endpoint.split('?q=')[1];
  expect(rison.decode(queryString)).toEqual({
    page: 1,
    page_size: 25,
    filters: [{ col: 'name', opr: 'ct', value: 'eng' }],
  });
  expect(result).toEqual({
    data: [
      { value: 1, label: 'Engineering' },
      { value: 2, label: 'Analytics' },
    ],
    totalCount: 2,
  });
  expect(addDangerToast).not.toHaveBeenCalled();
});

test('fetchGroupOptions omits filters when search term is empty', async () => {
  getMock.mockResolvedValue({
    json: { count: 0, result: [] },
  } as any);
  const addDangerToast = jest.fn();

  await fetchGroupOptions('', 0, 100, addDangerToast);

  const { endpoint } = getMock.mock.calls[0][0] as { endpoint: string };
  const queryString = endpoint.split('?q=')[1];
  expect(rison.decode(queryString)).toEqual({
    page: 0,
    page_size: 100,
  });
});

test('fetchGroupOptions returns empty options on error', async () => {
  getMock.mockRejectedValue(new Error('request failed'));
  const addDangerToast = jest.fn();

  const result = await fetchGroupOptions('eng', 0, 100, addDangerToast);

  expect(addDangerToast).toHaveBeenCalledWith(
    'There was an error while fetching groups',
  );
  expect(result).toEqual({ data: [], totalCount: 0 });
});

test('fetchPermissionOptions fetches multiple pages when results exceed PAGE_SIZE', async () => {
  const PAGE_SIZE = 1000;
  const totalCount = 1500;
  const page0Items = Array.from({ length: PAGE_SIZE }, (_, i) => ({
    id: i + 1,
    permission: { name: `perm_${i}` },
    view_menu: { name: `view_${i}` },
  }));
  const page1Items = Array.from({ length: totalCount - PAGE_SIZE }, (_, i) => ({
    id: PAGE_SIZE + i + 1,
    permission: { name: `perm_${PAGE_SIZE + i}` },
    view_menu: { name: `view_${PAGE_SIZE + i}` },
  }));

  getMock.mockImplementation(({ endpoint }: { endpoint: string }) => {
    const query = rison.decode(endpoint.split('?q=')[1]) as Record<
      string,
      unknown
    >;
    if (query.page === 0) {
      return Promise.resolve({
        json: { count: totalCount, result: page0Items },
      } as any);
    }
    if (query.page === 1) {
      return Promise.resolve({
        json: { count: totalCount, result: page1Items },
      } as any);
    }
    return Promise.resolve({ json: { count: 0, result: [] } } as any);
  });

  const addDangerToast = jest.fn();
  const result = await fetchPermissionOptions('multi', 0, 50, addDangerToast);

  // Two search branches (view_menu + permission), each needing 2 pages = 4 calls
  expect(getMock).toHaveBeenCalledTimes(4);
  // Deduplicated: both branches return identical ids, so total is 1500
  expect(result.totalCount).toBe(totalCount);
});

test('fetchPermissionOptions handles backend capping page_size below requested', async () => {
  const BACKEND_CAP = 500;
  const totalCount = 1200;
  const makeItems = (start: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: start + i + 1,
      permission: { name: `perm_${start + i}` },
      view_menu: { name: `view_${start + i}` },
    }));

  getMock.mockImplementation(({ endpoint }: { endpoint: string }) => {
    const query = rison.decode(endpoint.split('?q=')[1]) as Record<
      string,
      unknown
    >;
    const page = query.page as number;
    let items: ReturnType<typeof makeItems>;
    if (page === 0) {
      items = makeItems(0, BACKEND_CAP);
    } else if (page === 1) {
      items = makeItems(BACKEND_CAP, BACKEND_CAP);
    } else {
      items = makeItems(BACKEND_CAP * 2, totalCount - BACKEND_CAP * 2);
    }
    return Promise.resolve({
      json: { count: totalCount, result: items },
    } as any);
  });

  const addDangerToast = jest.fn();
  const result = await fetchPermissionOptions('cap', 0, 50, addDangerToast);

  // Two search branches, each needing 3 pages (500+500+200) = 6 calls
  expect(getMock).toHaveBeenCalledTimes(6);
  // Both branches return identical ids, so deduplicated total is 1200
  expect(result.totalCount).toBe(totalCount);
  expect(result.data).toHaveLength(50); // first page of client-side pagination
});

test('fetchPermissionOptions shares cache across case variants', async () => {
  getMock.mockResolvedValue({
    json: {
      count: 1,
      result: [
        {
          id: 10,
          permission: { name: 'can_access' },
          view_menu: { name: 'dataset_one' },
        },
      ],
    },
  } as any);
  const addDangerToast = jest.fn();

  await fetchPermissionOptions('Dataset', 0, 50, addDangerToast);
  expect(getMock).toHaveBeenCalledTimes(2);

  // Same letters, different case should be a cache hit (normalized key)
  const result = await fetchPermissionOptions('dataset', 0, 50, addDangerToast);
  expect(getMock).toHaveBeenCalledTimes(2); // no new calls
  expect(result).toEqual({
    data: [{ value: 10, label: 'can access dataset one' }],
    totalCount: 1,
  });
});

test('fetchPermissionOptions evicts oldest cache entry when MAX_CACHE_ENTRIES is reached', async () => {
  getMock.mockImplementation(({ endpoint }: { endpoint: string }) => {
    const query = rison.decode(endpoint.split('?q=')[1]) as Record<string, any>;
    const searchVal = query.filters?.[0]?.value || 'unknown';
    return Promise.resolve({
      json: {
        count: 1,
        result: [
          {
            id: Number(searchVal.replace('term', '')),
            permission: { name: searchVal },
            view_menu: { name: 'view' },
          },
        ],
      },
    } as any);
  });

  const addDangerToast = jest.fn();

  // Fill cache with 20 entries (MAX_CACHE_ENTRIES)
  for (let i = 0; i < 20; i += 1) {
    await fetchPermissionOptions(`term${i}`, 0, 50, addDangerToast);
  }

  getMock.mockClear();

  // Adding the 21st entry should evict the oldest (term0)
  await fetchPermissionOptions('term20', 0, 50, addDangerToast);

  // term0 should have been evicted — re-fetching it should trigger API calls
  getMock.mockClear();
  await fetchPermissionOptions('term0', 0, 50, addDangerToast);
  expect(getMock).toHaveBeenCalled();

  // term2 should still be cached — no API calls
  // (term1 was evicted when term0 was re-added as the 21st entry)
  getMock.mockClear();
  await fetchPermissionOptions('term2', 0, 50, addDangerToast);
  expect(getMock).not.toHaveBeenCalled();
});

test('fetchPermissionOptions handles variable page sizes from backend', async () => {
  const totalCount = 1200;
  const pageSizes = [500, 300, 400];

  getMock.mockImplementation(({ endpoint }: { endpoint: string }) => {
    const query = rison.decode(endpoint.split('?q=')[1]) as Record<
      string,
      unknown
    >;
    const page = query.page as number;
    const size = page < pageSizes.length ? pageSizes[page] : 0;
    const start = pageSizes.slice(0, page).reduce((a, b) => a + b, 0);
    const items = Array.from({ length: size }, (_, i) => ({
      id: start + i + 1,
      permission: { name: `perm_${start + i}` },
      view_menu: { name: `view_${start + i}` },
    }));
    return Promise.resolve({
      json: { count: totalCount, result: items },
    } as any);
  });

  const addDangerToast = jest.fn();
  const result = await fetchPermissionOptions('var', 0, 50, addDangerToast);

  // Both branches return identical IDs so deduplicated total is 1200
  expect(result.totalCount).toBe(totalCount);
  expect(result.data).toHaveLength(50);
});

test('fetchPermissionOptions respects concurrency limit for parallel page fetches', async () => {
  const totalCount = 5000;
  const CONCURRENCY_LIMIT = 3;
  let maxConcurrent = 0;
  let inflight = 0;

  const deferreds: Array<{
    resolve: () => void;
  }> = [];

  getMock.mockImplementation(({ endpoint }: { endpoint: string }) => {
    const query = rison.decode(endpoint.split('?q=')[1]) as Record<
      string,
      unknown
    >;
    const page = query.page as number;

    return new Promise(resolve => {
      inflight += 1;
      maxConcurrent = Math.max(maxConcurrent, inflight);
      deferreds.push({
        resolve: () => {
          inflight -= 1;
          const items =
            page < 5
              ? Array.from({ length: 1000 }, (_, i) => ({
                  id: page * 1000 + i + 1,
                  permission: { name: `p${page * 1000 + i}` },
                  view_menu: { name: `v${page * 1000 + i}` },
                }))
              : [];
          resolve({ json: { count: totalCount, result: items } } as any);
        },
      });
    });
  });

  const addDangerToast = jest.fn();
  const fetchPromise = fetchPermissionOptions('conc', 0, 50, addDangerToast);

  // Resolve page 0 for both branches (2 calls)
  await new Promise(r => setTimeout(r, 10));
  while (deferreds.length > 0) {
    // Resolve all pending, then check concurrency on next batch
    const batch = deferreds.splice(0);
    batch.forEach(d => d.resolve());
    await new Promise(r => setTimeout(r, 10));
  }

  await fetchPromise;

  // Page 0 fires 2 requests simultaneously (one per branch).
  // Remaining pages fire in batches of CONCURRENCY_LIMIT per branch.
  // Max concurrent should not exceed 2 * CONCURRENCY_LIMIT
  // (both branches may be fetching their next batch simultaneously).
  expect(maxConcurrent).toBeLessThanOrEqual(2 * CONCURRENCY_LIMIT);
});

test('fetchPermissionOptions normalizes whitespace and case for cache keys', async () => {
  getMock.mockResolvedValue({
    json: {
      count: 1,
      result: [
        {
          id: 10,
          permission: { name: 'can_access' },
          view_menu: { name: 'dataset_one' },
        },
      ],
    },
  } as any);
  const addDangerToast = jest.fn();

  // Seed cache with "Dataset"
  await fetchPermissionOptions('Dataset', 0, 50, addDangerToast);
  expect(getMock).toHaveBeenCalledTimes(2);

  // "dataset" — same normalized key, cache hit
  getMock.mockClear();
  await fetchPermissionOptions('dataset', 0, 50, addDangerToast);
  expect(getMock).not.toHaveBeenCalled();

  // "dataset " (trailing space) — same normalized key, cache hit
  await fetchPermissionOptions('dataset ', 0, 50, addDangerToast);
  expect(getMock).not.toHaveBeenCalled();

  // " Dataset " (leading + trailing space) — same normalized key, cache hit
  await fetchPermissionOptions(' Dataset ', 0, 50, addDangerToast);
  expect(getMock).not.toHaveBeenCalled();
});
