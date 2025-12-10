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
import { renderHook } from '@testing-library/react-hooks';
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import useDatasetsList from './useDatasetLists';

const mockAddDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/actions', () => ({
  addDangerToast: (msg: string) => mockAddDangerToast(msg),
}));

// Shared test fixtures
const mockDb = {
  id: 1,
  database_name: 'test_db',
  owners: [1] as [number],
};

const mockDatasets = [
  { id: 1, table_name: 'table1', schema: 'public' },
  { id: 2, table_name: 'table2', schema: 'public' },
];

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('useDatasetsList fetches first page of datasets successfully', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {
      count: 2,
      result: mockDatasets,
    },
  } as any);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitForNextUpdate();

  expect(result.current.datasets).toEqual(mockDatasets);
  expect(result.current.datasetNames).toEqual(['table1', 'table2']);
  expect(getSpy).toHaveBeenCalledTimes(1);
});

test('useDatasetsList fetches multiple pages (pagination) until count reached', async () => {
  const page1Data = [
    { id: 1, table_name: 'table1', schema: 'public' },
    { id: 2, table_name: 'table2', schema: 'public' },
  ];
  const page2Data = [{ id: 3, table_name: 'table3', schema: 'public' }];

  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValueOnce({
      json: {
        count: 3,
        result: page1Data,
      },
    } as any)
    .mockResolvedValueOnce({
      json: {
        count: 3,
        result: page2Data,
      },
    } as any);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitForNextUpdate();

  expect(result.current.datasets).toEqual([...page1Data, ...page2Data]);
  expect(result.current.datasetNames).toEqual(['table1', 'table2', 'table3']);
  expect(getSpy).toHaveBeenCalledTimes(2);
});

test('useDatasetsList extracts dataset names correctly', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {
      count: 3,
      result: [
        { id: 1, table_name: 'users' },
        { id: 2, table_name: 'orders' },
        { id: 3, table_name: 'products' },
      ],
    },
  } as any);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitForNextUpdate();

  expect(result.current.datasetNames).toEqual(['users', 'orders', 'products']);
  expect(getSpy).toHaveBeenCalledTimes(1);
});

test('useDatasetsList handles API 500 error gracefully', async () => {
  // Mock error - loop should break immediately
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValue(new Error('Internal Server Error'));

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitForNextUpdate();

  expect(result.current.datasets).toEqual([]);
  expect(result.current.datasetNames).toEqual([]);
  expect(mockAddDangerToast).toHaveBeenCalledWith(
    'There was an error fetching dataset',
  );
  // Should only be called once - error causes break
  expect(getSpy).toHaveBeenCalledTimes(1);
});

test('useDatasetsList handles empty dataset response', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {
      count: 0,
      result: [],
    },
  } as any);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitForNextUpdate();

  expect(result.current.datasets).toEqual([]);
  expect(result.current.datasetNames).toEqual([]);
  expect(getSpy).toHaveBeenCalledTimes(1);
});

test('useDatasetsList stops pagination when results reach count', async () => {
  // First page returns 2 items, second page returns empty (no more results)
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValueOnce({
      json: {
        count: 2,
        result: [
          { id: 1, table_name: 'table1' },
          { id: 2, table_name: 'table2' },
        ],
      },
    } as any)
    .mockResolvedValueOnce({
      json: {
        count: 2,
        result: [], // No more results
      },
    } as any);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitForNextUpdate();

  expect(result.current.datasets).toHaveLength(2);
  expect(result.current.datasetNames).toEqual(['table1', 'table2']);
  // Should stop after results.length >= count
  expect(getSpy).toHaveBeenCalledTimes(1);
});

test('useDatasetsList resets datasets when schema changes', async () => {
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValueOnce({
      json: {
        count: 2,
        result: [
          { id: 1, table_name: 'public_table1' },
          { id: 2, table_name: 'public_table2' },
        ],
      },
    } as any)
    .mockResolvedValueOnce({
      json: {
        count: 1,
        result: [{ id: 3, table_name: 'private_table1' }],
      },
    } as any);

  const { result, waitForNextUpdate, rerender } = renderHook(
    ({ db, schema }) => useDatasetsList(db, schema),
    {
      initialProps: { db: mockDb, schema: 'public' },
    },
  );

  await waitForNextUpdate();

  expect(result.current.datasetNames).toEqual([
    'public_table1',
    'public_table2',
  ]);

  // Change schema
  rerender({ db: mockDb, schema: 'private' });

  await waitForNextUpdate();

  // Should have new datasets from private schema
  expect(result.current.datasetNames).toEqual(['private_table1']);
  expect(getSpy).toHaveBeenCalledTimes(2);
});

test('useDatasetsList handles network timeout gracefully', async () => {
  // Mock timeout/abort error (status: 0)
  const timeoutError = new Error('Network timeout');
  (timeoutError as any).status = 0;

  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValue(timeoutError);

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitForNextUpdate();

  expect(result.current.datasets).toEqual([]);
  expect(result.current.datasetNames).toEqual([]);
  expect(mockAddDangerToast).toHaveBeenCalledWith(
    'There was an error fetching dataset',
  );
  // Should only be called once - error causes break
  expect(getSpy).toHaveBeenCalledTimes(1);
});

test('useDatasetsList breaks pagination loop on persistent API errors', async () => {
  // Mock API that always fails (persistent error)
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValue(new Error('Persistent server error'));

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitForNextUpdate();

  // Should only attempt once, then break (not infinite loop)
  expect(getSpy).toHaveBeenCalledTimes(1);
  expect(result.current.datasets).toEqual([]);
  expect(result.current.datasetNames).toEqual([]);
  expect(mockAddDangerToast).toHaveBeenCalledWith(
    'There was an error fetching dataset',
  );
  expect(mockAddDangerToast).toHaveBeenCalledTimes(1);
});

test('useDatasetsList handles error on second page gracefully', async () => {
  // First page succeeds, second page fails
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValueOnce({
      json: {
        count: 3, // Indicates more data exists
        result: [{ id: 1, table_name: 'table1' }],
      },
    } as any)
    .mockRejectedValue(new Error('Second page error'));

  const { result, waitForNextUpdate } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitForNextUpdate();

  // Should have first page data, then stop on error
  expect(getSpy).toHaveBeenCalledTimes(2);
  expect(result.current.datasets).toHaveLength(1);
  expect(result.current.datasets[0].table_name).toBe('table1');
  expect(result.current.datasetNames).toEqual(['table1']);
  expect(mockAddDangerToast).toHaveBeenCalledWith(
    'There was an error fetching dataset',
  );
  expect(mockAddDangerToast).toHaveBeenCalledTimes(1);
});

test('useDatasetsList skips fetching when schema is null or undefined', () => {
  const getSpy = jest.spyOn(SupersetClient, 'get');

  // Test with null schema
  const { result: resultNull, rerender } = renderHook(
    ({ db, schema }) => useDatasetsList(db, schema),
    { initialProps: { db: mockDb, schema: null as any } },
  );

  // Schema is null - should NOT call API
  expect(getSpy).not.toHaveBeenCalled();
  expect(resultNull.current.datasets).toEqual([]);
  expect(resultNull.current.datasetNames).toEqual([]);

  // Change to undefined - still should NOT call API
  rerender({ db: mockDb, schema: undefined as any });
  expect(getSpy).not.toHaveBeenCalled();
  expect(resultNull.current.datasets).toEqual([]);
  expect(resultNull.current.datasetNames).toEqual([]);
});

test('useDatasetsList skips fetching when db is undefined', () => {
  const getSpy = jest.spyOn(SupersetClient, 'get');

  const { result } = renderHook(() => useDatasetsList(undefined, 'public'));

  // db is undefined - should NOT call API
  expect(getSpy).not.toHaveBeenCalled();
  expect(result.current.datasets).toEqual([]);
  expect(result.current.datasetNames).toEqual([]);
});

test('useDatasetsList skips fetching when db.id is undefined', () => {
  const getSpy = jest.spyOn(SupersetClient, 'get');

  // Create db object without id property
  const dbWithoutId = {
    database_name: 'test_db',
    owners: [1] as [number],
  } as any;

  const { result } = renderHook(() => useDatasetsList(dbWithoutId, 'public'));

  // db.id is undefined - should NOT call API
  expect(getSpy).not.toHaveBeenCalled();
  expect(result.current.datasets).toEqual([]);
  expect(result.current.datasetNames).toEqual([]);
});

test('useDatasetsList encodes schemas with spaces and special characters in endpoint URL', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { count: 0, result: [] },
  } as any);

  const { waitForNextUpdate } = renderHook(() =>
    useDatasetsList(mockDb, 'sales analytics'),
  );

  await waitForNextUpdate();

  // Verify API was called with encoded schema
  expect(getSpy).toHaveBeenCalledTimes(1);
  const callArg = getSpy.mock.calls[0]?.[0]?.endpoint;
  expect(callArg).toBeDefined();

  // Verify the encoded schema is present in the URL (double-encoded by rison)
  // Schema 'sales analytics' -> encodeURIComponent -> 'sales%20analytics' -> rison.encode_uri -> 'sales%2520analytics'
  expect(callArg).toContain('sales%2520analytics');

  // Decode rison to verify filter structure
  const risonParam = callArg!.split('?q=')[1];
  const decoded = rison.decode(decodeURIComponent(risonParam)) as any;

  // After rison decoding, the schema should be the encoded version (encodeURIComponent output)
  expect(decoded.filters[1]).toEqual({
    col: 'schema',
    opr: 'eq',
    value: 'sales%20analytics', // This is what encodeURIComponent produces
  });
});
