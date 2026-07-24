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
import {
  useSemanticViewStructure,
  fetchSemanticViewStructure,
} from './useSemanticViewStructure';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  queryClient.clear();
});

test('useSemanticViewStructure fetches dimensions and metrics for an id', async () => {
  fetchMock.get('glob:*/api/v1/semantic_view/9/structure*', {
    result: {
      name: 'orders',
      dimensions: [{ name: 'status', type: 'STRING' }],
      metrics: [{ name: 'revenue', definition: 'SUM(amount)' }],
    },
  });

  const { result } = renderHook(() => useSemanticViewStructure(9), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.name).toBe('orders');
  expect(result.current.data?.dimensions).toHaveLength(1);
  expect(result.current.data?.metrics[0].definition).toBe('SUM(amount)');
});

test('useSemanticViewStructure stays idle when id is null', () => {
  const { result } = renderHook(() => useSemanticViewStructure(null), {
    wrapper,
  });
  expect(result.current.fetchStatus).toBe('idle');
  expect(fetchMock.callHistory.calls().length).toBe(0);
});

test('fetchSemanticViewStructure defaults missing fields to empty', async () => {
  fetchMock.get('glob:*/api/v1/semantic_view/3/structure*', { result: {} });

  const out = await fetchSemanticViewStructure(3);
  expect(out.name).toBe('');
  expect(out.dimensions).toEqual([]);
  expect(out.metrics).toEqual([]);
});
