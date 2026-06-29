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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fetchMock from 'fetch-mock';
import { DatasourceType } from '@superset-ui/core';
import {
  parseSlicesResult,
  useSlicesQuery,
  getCachedSlice,
} from './useSlicesQuery';

const rawSlice: Parameters<typeof parseSlicesResult>[0][number] = {
  id: 7,
  params: JSON.stringify({ viz_type: 'table' }),
  url: '/explore/7',
  slice_name: 'Sales by Region',
  datasource_id: 3,
  datasource_type: DatasourceType.Table,
  datasource_name_text: 'sales',
  datasource_url: '/datasource/3',
  changed_on_utc: '2021-01-01T00:00:00',
  changed_on_delta_humanized: '1 day ago',
  description: 'desc',
  description_markeddown: 'desc',
  viz_type: 'table',
  thumbnail_url: '/thumb/7',
  owners: [{ id: 1 }],
  created_by: { id: 1 },
};

const CHART_ENDPOINT = 'glob:*/api/v1/chart/?q=*';

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

test('parseSlicesResult maps raw rows into the Slice shape', () => {
  const slices = parseSlicesResult([rawSlice]);
  expect(slices[7]).toMatchObject({
    slice_id: 7,
    slice_name: 'Sales by Region',
    viz_type: 'table',
    datasource_id: 3,
    datasource_type: 'table',
  });
  // datasource is forced to the "id__type" form
  expect(slices[7].form_data.datasource).toBe('3__table');
});

test('useSlicesQuery fetches and returns the parsed slices', async () => {
  fetchMock.get(CHART_ENDPOINT, { body: { result: [rawSlice] } });

  const { result } = renderHook(
    () => useSlicesQuery({ sortColumn: 'changed_on' }),
    { wrapper },
  );

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.[7]).toMatchObject({ slice_id: 7 });
});

test('getCachedSlice returns undefined when nothing is cached', () => {
  expect(getCachedSlice(999)).toBeUndefined();
});
