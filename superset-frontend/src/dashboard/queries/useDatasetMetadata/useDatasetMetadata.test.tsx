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
import { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import fetchMock from 'fetch-mock';
import { queryClient } from 'src/queries/queryClient';
import { useDatasetMetadata, fetchDatasetList } from './useDatasetMetadata';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  queryClient.clear();
});

test('useDatasetMetadata fetches and returns the dataset result for a datasetId', async () => {
  fetchMock.get('glob:*/api/v1/dataset/5*', {
    result: {
      table_name: 'sales',
      columns: [{ column_name: 'region', filterable: true }],
    },
  });

  const { result } = renderHook(() => useDatasetMetadata(5), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.table_name).toBe('sales');
});

test('useDatasetMetadata stays idle (no request) when datasetId is null', () => {
  const { result } = renderHook(() => useDatasetMetadata(null), { wrapper });
  expect(result.current.fetchStatus).toBe('idle');
  expect(fetchMock.callHistory.calls().length).toBe(0);
});

test('fetchDatasetList returns parsed result and the API count', async () => {
  fetchMock.get('glob:*/api/v1/dataset/?q=*', {
    result: [{ id: 1, table_name: 'sales' }],
    count: 73,
  });

  const out = await fetchDatasetList('rison-query');
  expect(out.result).toHaveLength(1);
  expect(out.count).toBe(73);
});
