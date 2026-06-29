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
import { ChartCustomization, ChartCustomizationType } from '@superset-ui/core';
import { useDashboardInfoStore } from 'src/dashboard/stores';
import type { DashboardInfo } from 'src/dashboard/types';
import { useSaveChartCustomization } from './useSaveChartCustomization';

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

const getMergedConfig = () =>
  useDashboardInfoStore.getState().dashboardInfo.metadata
    ?.chart_customization_config as { id: string }[];

beforeAll(() => fetchMock.mockGlobal());
afterAll(() => fetchMock.hardReset());
afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  jest.clearAllMocks();
});

const customization: ChartCustomization = {
  id: 'CUSTOM-1',
  type: ChartCustomizationType.ChartCustomization,
  name: 'Group By',
  filterType: 'chart_customization_dynamic_groupby',
  targets: [{}],
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
  chartsInScope: [10],
  tabsInScope: ['TAB-A'],
  defaultDataMask: {},
  controlValues: {},
};

test('filters null entries from currentConfig before merging', async () => {
  fetchMock.put('glob:*/api/v1/dashboard/1/chart_customizations', {
    result: [customization],
  });
  const { wrapper } = setup({
    id: 1,
    metadata: {
      chart_customization_config: [
        null,
        { id: 'CUSTOM-1', name: 'Group By', chartsInScope: [10] },
        null,
      ],
    },
  } as unknown as DashboardInfo);

  const { result } = renderHook(() => useSaveChartCustomization(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({
      modifiedCustomizations: [customization],
      deletedIds: [],
    });
  });

  const config = getMergedConfig();
  expect(config.every((item: unknown) => item !== null)).toBe(true);
});

test('filters null entries from oldConfig when resetDataMask is true', async () => {
  fetchMock.put('glob:*/api/v1/dashboard/1/chart_customizations', {
    result: [customization],
  });
  const { wrapper } = setup({
    id: 1,
    metadata: {
      chart_customization_config: [
        null,
        { id: 'CUSTOM-1', name: 'Group By', chartsInScope: [10] },
        null,
      ],
    },
  } as unknown as DashboardInfo);

  const { result } = renderHook(() => useSaveChartCustomization(), { wrapper });
  await act(async () => {
    // Should not throw when building oldCustomizationsById from null-containing config
    await expect(
      result.current.mutateAsync({
        modifiedCustomizations: [customization],
        deletedIds: [],
        reorderedIds: [],
        resetDataMask: true,
      }),
    ).resolves.toBeDefined();
  });
});

test('shows a danger toast when the save fails', async () => {
  fetchMock.put('glob:*/api/v1/dashboard/1/chart_customizations', 500);
  const { wrapper } = setup({
    id: 1,
    metadata: { chart_customization_config: [] },
  } as unknown as DashboardInfo);

  const { result } = renderHook(() => useSaveChartCustomization(), { wrapper });
  await act(async () => {
    try {
      await result.current.mutateAsync({
        modifiedCustomizations: [customization],
        deletedIds: [],
      });
    } catch {
      // Expected — the mutation rejects.
    }
  });

  expect(mockAddDangerToast).toHaveBeenCalledTimes(1);
});
