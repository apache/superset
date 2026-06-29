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
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { ReactNode } from 'react';
import { LOG_ACTIONS_FORCE_REFRESH_DASHBOARD } from 'src/logger/LogUtils';
import { useDashboardInfoStore } from 'src/dashboard/stores';
import type { DashboardInfo } from 'src/dashboard/types';
import { useHeaderAutoRefresh } from './useHeaderAutoRefresh';

const mockStartAutoRefresh = jest.fn();
const mockEndAutoRefresh = jest.fn();
const mockSetRefreshInFlight = jest.fn();

jest.mock('src/dashboard/contexts/AutoRefreshContext', () => ({
  useAutoRefreshContext: () => ({
    startAutoRefresh: mockStartAutoRefresh,
    endAutoRefresh: mockEndAutoRefresh,
    setRefreshInFlight: mockSetRefreshInFlight,
  }),
}));

jest.mock('src/dashboard/hooks/useRealTimeDashboard', () => ({
  useRealTimeDashboard: () => ({
    isPaused: false,
    setStatus: jest.fn(),
    setPaused: jest.fn(),
    setPausedByTab: jest.fn(),
    recordSuccess: jest.fn(),
    recordError: jest.fn(),
    setFetchStartTime: jest.fn(),
    autoRefreshPauseOnInactiveTab: false,
    setPauseOnInactiveTab: jest.fn(),
  }),
}));

const mockUseAutoRefreshTabPause = jest.fn();
jest.mock('src/dashboard/hooks/useAutoRefreshTabPause', () => ({
  useAutoRefreshTabPause: (...args: unknown[]) =>
    mockUseAutoRefreshTabPause(...args),
}));

const createWrapper = (conf: Record<string, unknown> = {}) => {
  const store = createStore(() => ({
    charts: {
      1: { latestQueryFormData: { datasource: '1__table' } },
      2: { latestQueryFormData: { datasource: '2__table' } },
      // A chart on a tab that has never been visited has no query data yet.
      3: { latestQueryFormData: {} },
    },
    dashboardInfo: {
      common: { conf },
    },
  }));
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
};

const renderHeaderAutoRefresh = (
  conf: Record<string, unknown> = {},
  overrides = {},
) => {
  const props = {
    chartIds: [1, 2],
    dashboardId: 100,
    refreshFrequency: 0,
    timedRefreshImmuneSlices: [],
    isLoading: false,
    onRefresh: jest.fn().mockResolvedValue(undefined),
    setRefreshFrequency: jest.fn(),
    logEvent: jest.fn(),
    ...overrides,
  };
  // The stagger config is read from the Zustand dashboard-info store, not Redux.
  useDashboardInfoStore.setState({
    dashboardInfo: { common: { conf } } as unknown as DashboardInfo,
  });
  const { result } = renderHook(() => useHeaderAutoRefresh(props), {
    wrapper: createWrapper(conf),
  });
  return { result, props };
};

test('forceRefresh passes the default stagger interval (5000ms) when no config is provided', async () => {
  const { result, props } = renderHeaderAutoRefresh();

  await act(async () => {
    await result.current.forceRefresh();
  });

  expect(props.onRefresh).toHaveBeenCalledTimes(1);
  // onRefresh signature: (chartIds, force, interval, dashboardId, skipFiltersRefresh?)
  const [chartIds, force, interval, dashboardId] =
    props.onRefresh.mock.calls[0];
  expect(chartIds).toEqual([1, 2]);
  expect(force).toBe(true);
  expect(interval).toBe(5000);
  expect(dashboardId).toBe(100);
});

test('forceRefresh uses the server config value when one is provided', async () => {
  const { result, props } = renderHeaderAutoRefresh({
    SUPERSET_DASHBOARD_MANUAL_REFRESH_STAGGER_MS: 12000,
  });

  await act(async () => {
    await result.current.forceRefresh();
  });

  const [, , interval] = props.onRefresh.mock.calls[0];
  expect(interval).toBe(12000);
  expect(props.logEvent).toHaveBeenCalledWith(
    LOG_ACTIONS_FORCE_REFRESH_DASHBOARD,
    expect.objectContaining({ interval: 12000 }),
  );
});

test('forceRefresh keeps the older unstaggered behavior when the config value is 0', async () => {
  const { result, props } = renderHeaderAutoRefresh({
    SUPERSET_DASHBOARD_MANUAL_REFRESH_STAGGER_MS: 0,
  });

  await act(async () => {
    await result.current.forceRefresh();
  });

  const [, , interval] = props.onRefresh.mock.calls[0];
  expect(interval).toBe(0);
  expect(props.logEvent).toHaveBeenCalledWith(
    LOG_ACTIONS_FORCE_REFRESH_DASHBOARD,
    expect.objectContaining({ interval: 0 }),
  );
});

test('forceRefresh normalizes a negative config value to 0 (unstaggered)', async () => {
  const { result, props } = renderHeaderAutoRefresh({
    SUPERSET_DASHBOARD_MANUAL_REFRESH_STAGGER_MS: -1000,
  });

  await act(async () => {
    await result.current.forceRefresh();
  });

  const [, , interval] = props.onRefresh.mock.calls[0];
  expect(interval).toBe(0);
  expect(props.logEvent).toHaveBeenCalledWith(
    LOG_ACTIONS_FORCE_REFRESH_DASHBOARD,
    expect.objectContaining({ interval: 0 }),
  );
});

test('a silent refresh reports only the affected chart ids to startAutoRefresh, not the whole dashboard', async () => {
  mockStartAutoRefresh.mockClear();
  mockUseAutoRefreshTabPause.mockClear();
  const { props } = renderHeaderAutoRefresh(
    {},
    { chartIds: [1, 2], timedRefreshImmuneSlices: [2] },
  );

  const { onRefresh: handleTabVisibilityRefresh } =
    mockUseAutoRefreshTabPause.mock.calls[0][0];

  await act(async () => {
    await handleTabVisibilityRefresh();
  });

  expect(props.onRefresh).toHaveBeenCalledTimes(1);
  expect(mockStartAutoRefresh).toHaveBeenCalledWith([1]);
  expect(mockStartAutoRefresh).not.toHaveBeenCalledWith([1, 2]);
});

test('a silent refresh excludes charts with no previous query data from both startAutoRefresh and onRefresh', async () => {
  mockStartAutoRefresh.mockClear();
  mockUseAutoRefreshTabPause.mockClear();
  const { props } = renderHeaderAutoRefresh(
    {},
    { chartIds: [1, 2, 3], timedRefreshImmuneSlices: [2] },
  );

  const { onRefresh: handleTabVisibilityRefresh } =
    mockUseAutoRefreshTabPause.mock.calls[0][0];

  await act(async () => {
    await handleTabVisibilityRefresh();
  });

  expect(mockStartAutoRefresh).toHaveBeenCalledTimes(1);
  expect(mockStartAutoRefresh).toHaveBeenCalledWith([1]);
  expect(props.onRefresh).toHaveBeenCalledTimes(1);
  const [refreshedChartIds] = props.onRefresh.mock.calls[0];
  expect(refreshedChartIds).toEqual([1]);
});
