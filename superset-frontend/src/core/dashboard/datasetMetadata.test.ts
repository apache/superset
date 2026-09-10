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
import {
  fetchDatasetMetadata,
  resetDatasetMetadataCacheForTests,
  useDatasetMetadata,
} from './datasetMetadata';

const getSpy = jest.spyOn(SupersetClient, 'get');

beforeEach(() => {
  resetDatasetMetadataCacheForTests();
  getSpy.mockReset();
});

test('parses columns and metrics from the dataset GET response', async () => {
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [
          { column_name: 'region', type_generic: 1, verbose_name: 'Region' },
          { column_name: 'sales_amount', type_generic: 0 },
        ],
        metrics: [{ metric_name: 'count', verbose_name: 'Count' }],
        datasource_type: 'table',
        extra: '{"disallow_adhoc_metrics": true}',
      },
    },
  } as never);

  const metadata = await fetchDatasetMetadata(1);

  expect(metadata.columns).toEqual([
    { name: 'region', type: 1, verboseName: 'Region' },
    { name: 'sales_amount', type: 0, verboseName: 'sales_amount' },
  ]);
  expect(metadata.metrics).toEqual([{ name: 'count', verboseName: 'Count' }]);
  expect(metadata.datasourceType).toBe('table');
  expect(metadata.extra).toBe('{"disallow_adhoc_metrics": true}');
  expect(getSpy).toHaveBeenCalledWith(
    expect.objectContaining({ endpoint: '/api/v1/dataset/1' }),
  );
});

test('falls back to metric_name when verbose_name is blank', async () => {
  getSpy.mockResolvedValue({
    json: { result: { metrics: [{ metric_name: 'count', verbose_name: '' }] } },
  } as never);

  const metadata = await fetchDatasetMetadata(2);

  expect(metadata.metrics).toEqual([{ name: 'count', verboseName: 'count' }]);
});

test('falls back to column_name when a column verbose_name is blank', async () => {
  getSpy.mockResolvedValue({
    json: {
      result: { columns: [{ column_name: 'region', verbose_name: '' }] },
    },
  } as never);

  const metadata = await fetchDatasetMetadata(7);

  expect(metadata.columns).toEqual([
    { name: 'region', type: null, verboseName: 'region' },
  ]);
});

test("parses the dataset's own name from the GET response", async () => {
  getSpy.mockResolvedValue({
    json: { result: { table_name: 'sales' } },
  } as never);

  const metadata = await fetchDatasetMetadata(6);

  expect(metadata.tableName).toBe('sales');
});

test('fetches only once per dataset id and caches the result', async () => {
  getSpy.mockResolvedValue({ json: { result: {} } } as never);

  await fetchDatasetMetadata(3);
  await fetchDatasetMetadata(3);

  expect(getSpy).toHaveBeenCalledTimes(1);
});

test('does not cache a failed fetch, so a retry can succeed', async () => {
  getSpy.mockRejectedValueOnce(new Error('boom'));
  getSpy.mockResolvedValueOnce({ json: { result: {} } } as never);

  await expect(fetchDatasetMetadata(4)).rejects.toThrow('boom');
  await expect(fetchDatasetMetadata(4)).resolves.toEqual({
    columns: [],
    metrics: [],
  });
  expect(getSpy).toHaveBeenCalledTimes(2);
});

test('useDatasetMetadata fails open to null metadata on error', async () => {
  getSpy.mockRejectedValue(new Error('boom'));

  const { result } = renderHook(() => useDatasetMetadata(5));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.metadata).toBeNull();
  expect(result.current.error).toBe('boom');
});

test('useDatasetMetadata returns the empty state when no dataset id is given', () => {
  const { result } = renderHook(() => useDatasetMetadata(undefined));

  expect(result.current).toEqual({
    metadata: null,
    loading: false,
    error: null,
  });
});
