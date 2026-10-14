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
import { ReactNode } from 'react';
import fetchMock from 'fetch-mock';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardQuery } from './useDashboardData';

const DASHBOARD_ID = 42;
const RESULT = {
  id: DASHBOARD_ID,
  dashboard_title: 'Test',
  json_metadata: '{"color_scheme":"d3Category10"}',
  position_json: '{"ROOT_ID":{"type":"ROOT"}}',
  owners: [{ id: 1 }],
};

function wrapper(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get('glob:*/api/v1/dashboard/42*', { body: { result: RESULT } });
});

afterAll(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('does not fetch when enabled is false', async () => {
  const { result } = renderHook(
    () => useDashboardQuery(DASHBOARD_ID, { enabled: false }),
    { wrapper: ({ children }) => wrapper(children) },
  );
  // Give TQ a tick to (not) fire the request
  await new Promise(f => setTimeout(f, 50));
  expect(
    fetchMock.callHistory.calls('glob:*/api/v1/dashboard/42*').length,
  ).toBe(0);
  expect(result.current.data).toBeUndefined();
});

test('fetches and parses metadata + position_data when enabled', async () => {
  const { result } = renderHook(
    () => useDashboardQuery(DASHBOARD_ID, { enabled: true }),
    { wrapper: ({ children }) => wrapper(children) },
  );

  await waitFor(() => expect(result.current.data).toBeDefined());

  expect(result.current.data?.id).toBe(DASHBOARD_ID);
  expect(result.current.data?.metadata).toEqual({
    color_scheme: 'd3Category10',
  });
  expect(result.current.data?.position_data).toEqual({
    ROOT_ID: { type: 'ROOT' },
  });
});

test('defaults to enabled when option omitted', async () => {
  const { result } = renderHook(() => useDashboardQuery(DASHBOARD_ID), {
    wrapper: ({ children }) => wrapper(children),
  });
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(result.current.data?.id).toBe(DASHBOARD_ID);
});
