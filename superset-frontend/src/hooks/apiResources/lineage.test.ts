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
import { makeApi } from '@superset-ui/core';
import {
  useChartLineage,
  useDashboardLineage,
  useDatasetLineage,
} from './lineage';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  makeApi: jest.fn(),
}));

const mockedMakeApi = jest.mocked(makeApi);

// makeApi returns a function that issues the request; capture the endpoint it
// was configured with so we can assert the correct URL was built.
function mockApiSuccess(payload: unknown) {
  const fetcher = jest.fn().mockResolvedValue({ result: payload });
  mockedMakeApi.mockReturnValue(fetcher as any);
  return fetcher;
}

function mockApiError(error: Error) {
  const fetcher = jest.fn().mockRejectedValue(error);
  mockedMakeApi.mockReturnValue(fetcher as any);
  return fetcher;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('useDatasetLineage fetches dataset lineage and unwraps result', async () => {
  const payload = {
    dataset: { id: 1, name: 'ds' },
    upstream: { database: { id: 2, database_name: 'db', backend: 'pg' } },
    downstream: {
      charts: { count: 0, result: [] },
      dashboards: { count: 0, result: [] },
    },
  };
  mockApiSuccess(payload);

  const { result } = renderHook(() => useDatasetLineage(1));

  expect(result.current.status).toBe('loading');
  await waitFor(() => expect(result.current.status).toBe('complete'));

  expect(mockedMakeApi).toHaveBeenCalledWith(
    expect.objectContaining({
      method: 'GET',
      endpoint: '/api/v1/dataset/1/lineage',
    }),
  );
  expect(result.current.result).toEqual(payload);
  expect(result.current.error).toBeNull();
});

test('useChartLineage builds the chart lineage endpoint', async () => {
  mockApiSuccess({ chart: { id: 5, slice_name: 'c', viz_type: 'pie' } });

  const { result } = renderHook(() => useChartLineage(5));

  await waitFor(() => expect(result.current.status).toBe('complete'));
  expect(mockedMakeApi).toHaveBeenCalledWith(
    expect.objectContaining({ endpoint: '/api/v1/chart/5/lineage' }),
  );
});

test('useDashboardLineage builds the dashboard lineage endpoint', async () => {
  mockApiSuccess({ dashboard: { id: 9, title: 'd', slug: 'd' } });

  const { result } = renderHook(() => useDashboardLineage(9));

  await waitFor(() => expect(result.current.status).toBe('complete'));
  expect(mockedMakeApi).toHaveBeenCalledWith(
    expect.objectContaining({ endpoint: '/api/v1/dashboard/9/lineage' }),
  );
});

test('lineage hooks surface network errors', async () => {
  mockApiError(new Error('Network error'));

  const { result } = renderHook(() => useDatasetLineage(1));

  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.result).toBeNull();
  expect(result.current.error).toBeInstanceOf(Error);
});

test('lineage hooks skip the request when the id is empty', async () => {
  const fetcher = mockApiSuccess({});

  const { result } = renderHook(() => useDatasetLineage(''));

  // Empty id resolves immediately without ever firing a request, so we never
  // hit an invalid endpoint such as `/api/v1/dataset//lineage`.
  expect(result.current.status).toBe('loading');
  expect(fetcher).not.toHaveBeenCalled();
});

test('lineage hooks skip the request when skip is true', async () => {
  const fetcher = mockApiSuccess({});

  const { result } = renderHook(() => useChartLineage(5, true));

  expect(result.current.status).toBe('loading');
  expect(fetcher).not.toHaveBeenCalled();
});
