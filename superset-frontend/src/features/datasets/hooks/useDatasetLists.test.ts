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
import { SupersetClient, JsonResponse } from '@superset-ui/core';
import rison from 'rison';
import useDatasetsList from './useDatasetLists';

const mockAddDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/actions', () => ({
  addDangerToast: (msg: string) => mockAddDangerToast(msg),
}));

// Typed response helper to consolidate mocking boilerplate
// Uses 'as unknown as JsonResponse' because we're intentionally mocking
// only the json field without the full Response object for test simplicity
const buildSupersetResponse = <T>(data: { count: number; result: T[] }) =>
  ({
    json: data,
  }) as unknown as JsonResponse;

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
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValue(
      buildSupersetResponse({ count: 2, result: mockDatasets }),
    );

  const { result, waitFor } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitFor(() => expect(result.current.datasets).toEqual(mockDatasets));

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
    .mockResolvedValueOnce(
      buildSupersetResponse({ count: 3, result: page1Data }),
    )
    .mockResolvedValueOnce(
      buildSupersetResponse({ count: 3, result: page2Data }),
    );

  const { result, waitFor } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitFor(() =>
    expect(result.current.datasets).toEqual([...page1Data, ...page2Data]),
  );

  expect(result.current.datasetNames).toEqual(['table1', 'table2', 'table3']);
  expect(getSpy).toHaveBeenCalledTimes(2);
});

test('useDatasetsList extracts dataset names correctly', async () => {
  const datasets = [
    { id: 1, table_name: 'users' },
    { id: 2, table_name: 'orders' },
    { id: 3, table_name: 'products' },
  ];

  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValue(buildSupersetResponse({ count: 3, result: datasets }));

  const { result, waitFor } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitFor(() =>
    expect(result.current.datasetNames).toEqual([
      'users',
      'orders',
      'products',
    ]),
  );

  expect(getSpy).toHaveBeenCalledTimes(1);
});

test('useDatasetsList handles API 500 error gracefully', async () => {
  // Mock error on first call, then return empty result to break the loop
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValueOnce(new Error('Internal Server Error'))
    .mockResolvedValueOnce(buildSupersetResponse({ count: 0, result: [] }));

  const { result, waitFor } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitFor(() => expect(result.current.datasets).toEqual([]));

  expect(result.current.datasetNames).toEqual([]);
  expect(mockAddDangerToast).toHaveBeenCalledWith(
    'There was an error fetching dataset',
  );
  // Should be called twice - once for error, once to complete
  expect(getSpy).toHaveBeenCalledTimes(2);
});

test('useDatasetsList handles empty dataset response', async () => {
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValue(buildSupersetResponse({ count: 0, result: [] }));

  const { result, waitFor } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitFor(() => expect(result.current.datasets).toEqual([]));

  expect(result.current.datasetNames).toEqual([]);
  expect(getSpy).toHaveBeenCalledTimes(1);
});

test('useDatasetsList stops pagination when results reach count', async () => {
  // First page returns 2 items, second page returns empty (no more results)
  const datasets = [
    { id: 1, table_name: 'table1' },
    { id: 2, table_name: 'table2' },
  ];

  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValueOnce(
      buildSupersetResponse({ count: 2, result: datasets }),
    )
    .mockResolvedValueOnce(buildSupersetResponse({ count: 2, result: [] }));

  const { result, waitFor } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitFor(() => expect(result.current.datasets).toHaveLength(2));

  expect(result.current.datasetNames).toEqual(['table1', 'table2']);
  // Should stop after results.length >= count
  expect(getSpy).toHaveBeenCalledTimes(1);
});

test('useDatasetsList resets datasets when schema changes', async () => {
  const publicDatasets = [
    { id: 1, table_name: 'public_table1' },
    { id: 2, table_name: 'public_table2' },
  ];
  const privateDatasets = [{ id: 3, table_name: 'private_table1' }];

  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValueOnce(
      buildSupersetResponse({ count: 2, result: publicDatasets }),
    )
    .mockResolvedValueOnce(
      buildSupersetResponse({ count: 1, result: privateDatasets }),
    );

  const { result, waitFor, rerender } = renderHook(
    ({ db, schema }) => useDatasetsList(db, schema),
    {
      initialProps: { db: mockDb, schema: 'public' },
    },
  );

  await waitFor(() =>
    expect(result.current.datasetNames).toEqual([
      'public_table1',
      'public_table2',
    ]),
  );

  // Change schema
  rerender({ db: mockDb, schema: 'private' });

  // Should have new datasets from private schema
  await waitFor(() =>
    expect(result.current.datasetNames).toEqual(['private_table1']),
  );

  expect(getSpy).toHaveBeenCalledTimes(2);
});

test('useDatasetsList handles network timeout gracefully', async () => {
  // Mock timeout/abort error (status: 0)
  const timeoutError = new Error('Network timeout');
  (timeoutError as any).status = 0;

  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValueOnce(timeoutError)
    .mockResolvedValueOnce(buildSupersetResponse({ count: 0, result: [] }));

  const { result, waitFor } = renderHook(() =>
    useDatasetsList(mockDb, 'public'),
  );

  await waitFor(() => expect(result.current.datasets).toEqual([]));

  expect(result.current.datasetNames).toEqual([]);
  expect(mockAddDangerToast).toHaveBeenCalledWith(
    'There was an error fetching dataset',
  );
  expect(getSpy).toHaveBeenCalledTimes(2);
});

test('useDatasetsList skips fetching when schema is null or undefined', () => {
  const getSpy = jest.spyOn(SupersetClient, 'get');

  // Test with null schema
  const { result: resultNull, rerender } = renderHook(
    ({ db, schema }) => useDatasetsList(db, schema),
    { initialProps: { db: mockDb, schema: null as unknown as string } },
  );

  // Schema is null - should NOT call API
  expect(getSpy).not.toHaveBeenCalled();
  expect(resultNull.current.datasets).toEqual([]);
  expect(resultNull.current.datasetNames).toEqual([]);

  // Change to undefined - still should NOT call API
  rerender({ db: mockDb, schema: undefined as unknown as string });
  expect(getSpy).not.toHaveBeenCalled();
  expect(resultNull.current.datasets).toEqual([]);
  expect(resultNull.current.datasetNames).toEqual([]);
});

test('useDatasetsList encodes schemas with spaces and special characters in endpoint URL', async () => {
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValue(buildSupersetResponse({ count: 0, result: [] }));

  const { result, waitFor } = renderHook(() =>
    useDatasetsList(mockDb, 'sales analytics'),
  );

  await waitFor(() => expect(result.current.datasets).toEqual([]));

  // Verify API was called with encoded schema
  expect(getSpy).toHaveBeenCalledTimes(1);
  const callArg = getSpy.mock.calls[0]?.[0]?.endpoint;
  expect(callArg).toBeDefined();

  // Verify the encoded schema is present in the URL (double-encoded by rison)
  // Schema 'sales analytics' -> encodeURIComponent -> 'sales%20analytics' -> rison.encode_uri -> 'sales%2520analytics'
  expect(callArg).toContain('sales%2520analytics');

  // Decode rison to verify filter structure
  const risonParam = callArg!.split('?q=')[1];

  interface RisonFilter {
    col: string;
    opr: string;
    value: string;
  }

  interface RisonQuery {
    filters: RisonFilter[];
  }

  const decoded = rison.decode(decodeURIComponent(risonParam)) as RisonQuery;

  // After rison decoding, the schema should be the encoded version (encodeURIComponent output)
  expect(decoded.filters[1]).toEqual({
    col: 'schema',
    opr: 'eq',
    value: 'sales%20analytics', // This is what encodeURIComponent produces
  });
});
