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

type LayoutComponent = {
  id: string;
  type: string;
  children: string[];
  meta?: { chartId?: number; text?: string };
};

// Builds a dashboard layout with one row of charts per tab, plus an
// optional row of charts that sit outside any tab.
const buildLayout = (
  tabs: Record<string, number[]>,
  untabbed: number[] = [],
): Record<string, LayoutComponent> => {
  const layout: Record<string, LayoutComponent> = {
    ROOT_ID: { id: 'ROOT_ID', type: 'ROOT', children: ['TABS_1'] },
    TABS_1: {
      id: 'TABS_1',
      type: 'TABS',
      children: Object.keys(tabs),
    },
  };
  Object.entries(tabs).forEach(([tabId, chartIds]) => {
    const rowId = `ROW_${tabId}`;
    layout[tabId] = {
      id: tabId,
      type: 'TAB',
      children: [rowId],
      meta: { text: tabId },
    };
    layout[rowId] = {
      id: rowId,
      type: 'ROW',
      children: chartIds.map(chartId => `CHART_${chartId}`),
    };
    chartIds.forEach(chartId => {
      layout[`CHART_${chartId}`] = {
        id: `CHART_${chartId}`,
        type: 'CHART',
        children: [],
        meta: { chartId },
      };
    });
  });
  if (untabbed.length > 0) {
    layout.ROOT_ID.children.push('ROW_UNTABBED');
    layout.ROW_UNTABBED = {
      id: 'ROW_UNTABBED',
      type: 'ROW',
      children: untabbed.map(chartId => `CHART_${chartId}`),
    };
    untabbed.forEach(chartId => {
      layout[`CHART_${chartId}`] = {
        id: `CHART_${chartId}`,
        type: 'CHART',
        children: [],
        meta: { chartId },
      };
    });
  }
  return layout;
};

const createWrapper = (
  conf: Record<string, unknown> = {},
  state: Record<string, unknown> = {},
) => {
  const store = createStore(() => ({
    charts: {
      1: { latestQueryFormData: { datasource: '1__table' } },
      2: { latestQueryFormData: { datasource: '2__table' } },
      // A chart on a tab that has never been visited has no query data yet.
      3: { latestQueryFormData: {} },
      4: { latestQueryFormData: { datasource: '4__table' } },
    },
    dashboardInfo: {
      common: { conf },
    },
    ...state,
  }));
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
};

const renderHeaderAutoRefresh = (
  conf: Record<string, unknown> = {},
  overrides = {},
  state: Record<string, unknown> = {},
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
    wrapper: createWrapper(conf, state),
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

test('forceRefresh refreshes only charts on the active tab', async () => {
  const layout = buildLayout({ TAB_A: [1, 2], TAB_B: [4] });
  const { result, props } = renderHeaderAutoRefresh(
    {},
    { chartIds: [1, 2, 4] },
    {
      dashboardLayout: { present: layout },
      dashboardState: { activeTabs: ['TAB_A'] },
    },
  );

  await act(async () => {
    await result.current.forceRefresh();
  });

  expect(props.onRefresh).toHaveBeenCalledTimes(1);
  const [chartIds] = props.onRefresh.mock.calls[0];
  expect(chartIds).toEqual([1, 2]);
  expect(props.logEvent).toHaveBeenCalledWith(
    LOG_ACTIONS_FORCE_REFRESH_DASHBOARD,
    expect.objectContaining({ chartCount: 2 }),
  );
});

test('forceRefresh refreshes every chart on a dashboard without tabs', async () => {
  const layout = buildLayout({});
  const { result, props } = renderHeaderAutoRefresh(
    {},
    { chartIds: [1, 2, 4] },
    {
      dashboardLayout: { present: layout },
      dashboardState: { activeTabs: [] },
    },
  );

  await act(async () => {
    await result.current.forceRefresh();
  });

  expect(props.onRefresh).toHaveBeenCalledTimes(1);
  const [chartIds] = props.onRefresh.mock.calls[0];
  expect(chartIds).toEqual([1, 2, 4]);
});

test('forceRefresh falls back to every chart when the layout or active tabs are missing', async () => {
  const { result, props } = renderHeaderAutoRefresh(
    {},
    { chartIds: [1, 2, 4] },
  );

  await act(async () => {
    await result.current.forceRefresh();
  });

  expect(props.onRefresh).toHaveBeenCalledTimes(1);
  const [chartIds] = props.onRefresh.mock.calls[0];
  expect(chartIds).toEqual([1, 2, 4]);
});

test('forceRefresh still refreshes a chart shared by the active and a hidden tab', async () => {
  const layout = buildLayout({ TAB_A: [1, 2, 4], TAB_B: [4] });
  const { result, props } = renderHeaderAutoRefresh(
    {},
    { chartIds: [1, 2, 4] },
    {
      dashboardLayout: { present: layout },
      dashboardState: { activeTabs: ['TAB_A'] },
    },
  );

  await act(async () => {
    await result.current.forceRefresh();
  });

  expect(props.onRefresh).toHaveBeenCalledTimes(1);
  const [chartIds] = props.onRefresh.mock.calls[0];
  expect(chartIds).toEqual([1, 2, 4]);
});

test('forceRefresh refreshes a chart that is not under any tab', async () => {
  const layout = buildLayout({ TAB_A: [1, 2] }, [4]);
  const { result, props } = renderHeaderAutoRefresh(
    {},
    { chartIds: [1, 2, 4] },
    {
      dashboardLayout: { present: layout },
      dashboardState: { activeTabs: ['TAB_A'] },
    },
  );

  await act(async () => {
    await result.current.forceRefresh();
  });

  expect(props.onRefresh).toHaveBeenCalledTimes(1);
  const [chartIds] = props.onRefresh.mock.calls[0];
  expect(chartIds).toEqual([1, 2, 4]);
});
