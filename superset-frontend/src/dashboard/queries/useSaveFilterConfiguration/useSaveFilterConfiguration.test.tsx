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
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import fetchMock from 'fetch-mock';
import { useDashboardInfoStore } from 'src/dashboard/stores';
import type { DashboardInfo } from 'src/dashboard/types';
import type { SaveFilterChangesType } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/types';
import { useSaveFilterConfiguration } from './useSaveFilterConfiguration';

jest.unmock('zustand');

const mockAddDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addDangerToast: mockAddDangerToast,
    addSuccessToast: jest.fn(),
  }),
}));

function setup(dashboardInfo: Partial<DashboardInfo>) {
  useDashboardInfoStore.setState({
    dashboardInfo: dashboardInfo as DashboardInfo,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const store = configureStore({ reducer: { noop: (s = {}) => s } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
  return { wrapper };
}

const filterChanges = {
  modified: [{ id: 'NATIVE_FILTER-1' }],
  deleted: [],
  reordered: [],
} as unknown as SaveFilterChangesType;

beforeAll(() => fetchMock.mockGlobal());
afterAll(() => fetchMock.hardReset());
afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  jest.clearAllMocks();
});

test('keeps the live in-scope status instead of the stale copy the response returns (#43252)', async () => {
  // The save response echoes the persisted (stale) scope for every filter,
  // including ones this save never touched.
  fetchMock.put('glob:*/api/v1/dashboard/1/filters', {
    result: [
      {
        id: 'NATIVE_FILTER-1',
        name: 'Region',
        filterType: 'filter_select',
        chartsInScope: [999],
        tabsInScope: ['STALE-TAB'],
      },
    ],
  });
  // The store already holds the scope calculated live this session.
  const { wrapper } = setup({
    id: 1,
    metadata: {
      native_filter_configuration: [
        {
          id: 'NATIVE_FILTER-1',
          name: 'Region',
          chartsInScope: [10, 20],
          tabsInScope: ['TAB-A'],
        },
      ],
    },
  } as unknown as DashboardInfo);

  const { result } = renderHook(() => useSaveFilterConfiguration(), {
    wrapper,
  });
  await act(async () => {
    await result.current.mutateAsync(filterChanges);
  });

  const config = useDashboardInfoStore.getState().dashboardInfo.metadata
    ?.native_filter_configuration as {
    chartsInScope: number[];
    tabsInScope: string[];
  }[];
  const [saved] = config;
  // The stale [999]/['STALE-TAB'] from the response is dropped; the live scope wins.
  expect(saved.chartsInScope).toEqual([10, 20]);
  expect(saved.tabsInScope).toEqual(['TAB-A']);
});

test('shows a danger toast when the save fails', async () => {
  fetchMock.put('glob:*/api/v1/dashboard/1/filters', 500);
  const { wrapper } = setup({
    id: 1,
    metadata: { native_filter_configuration: [] },
  } as unknown as DashboardInfo);

  const { result } = renderHook(() => useSaveFilterConfiguration(), {
    wrapper,
  });
  await act(async () => {
    try {
      await result.current.mutateAsync(filterChanges);
    } catch {
      // Expected — the mutation rejects.
    }
  });

  expect(mockAddDangerToast).toHaveBeenCalledTimes(1);
});
