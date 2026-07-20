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
import { useHeaderAutoRefresh } from './useHeaderAutoRefresh';

jest.mock('src/dashboard/contexts/AutoRefreshContext', () => ({
  useAutoRefreshContext: () => ({
    startAutoRefresh: jest.fn(),
    endAutoRefresh: jest.fn(),
    setRefreshInFlight: jest.fn(),
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

jest.mock('src/dashboard/hooks/useAutoRefreshTabPause', () => ({
  useAutoRefreshTabPause: jest.fn(),
}));

const createWrapper = (conf: Record<string, unknown> = {}) => {
  const store = createStore(() => ({
    charts: {
      1: { latestQueryFormData: { datasource: '1__table' } },
      2: { latestQueryFormData: { datasource: '2__table' } },
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
