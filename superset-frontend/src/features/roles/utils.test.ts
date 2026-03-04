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
    page_size: 5000,
    filters: [{ col: 'view_menu.name', opr: 'ct', value: 'dataset' }],
  });
  expect(queries).toContainEqual({
    page: 0,
    page_size: 5000,
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

test('fetchPermissionOptions clears cache when search is empty', async () => {
  // First, populate cache with a search
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

  // Empty search should clear cache and make a fresh request
  getMock.mockResolvedValue({ json: { count: 0, result: [] } } as any);
  await fetchPermissionOptions('', 0, 50, addDangerToast);
  expect(getMock).toHaveBeenCalledTimes(1);
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
