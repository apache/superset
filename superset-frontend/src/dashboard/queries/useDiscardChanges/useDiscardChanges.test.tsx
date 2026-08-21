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

import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import {
  useDashboardLayoutStore,
  useDashboardStateStore,
  useDashboardInfoStore,
} from 'src/dashboard/stores';
import { useDataMaskStore } from 'src/dataMask/useDataMaskStore';
import type { DashboardInfo } from 'src/dashboard/types';
import { dashboardKeys } from '../keys';
import { useDiscardChanges } from './useDiscardChanges';

// zundo's temporal middleware needs the real zustand implementation.
// Jest hoists this above the imports, so the real module is loaded.
jest.unmock('zustand');

// Stub the color-singleton re-apply to a no-op; these tests assert the store re-seed.
jest.mock('src/dashboard/actions/dashboardState', () => ({
  ...jest.requireActual('src/dashboard/actions/dashboardState'),
  applyDashboardLabelsColorOnLoad: () => () => undefined,
}));

const DASHBOARD_ID = 6;

function setup(chartsState: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const dispatch = jest.fn();
  const store = configureStore({
    reducer: {
      dashboardLayout: (s = { past: [], present: {}, future: [] }) => s,
      charts: (s = chartsState) => s,
    },
  });
  const realDispatch = store.dispatch;
  store.dispatch = jest.fn((...args) => {
    dispatch(...args);
    return realDispatch(...args);
  }) as typeof store.dispatch;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );

  return { queryClient, dispatch, wrapper };
}

beforeEach(() => {
  useDashboardLayoutStore.setState({ layout: {} });
  useDashboardLayoutStore.temporal.getState().clear();
  useDashboardInfoStore.setState({ dashboardInfo: {} as DashboardInfo });
  useDataMaskStore.setState({ dataMask: {} });
});

test('returns false when no cached hydration payload exists', () => {
  const { wrapper } = setup();
  const { result } = renderHook(() => useDiscardChanges(DASHBOARD_ID), {
    wrapper,
  });
  expect(result.current()).toBe(false);
});

test('dispatches HYDRATE_DASHBOARD with the cached payload when present', () => {
  const { queryClient, dispatch, wrapper } = setup();
  const payload = { dashboardState: { hasUnsavedChanges: false } };
  queryClient.setQueryData(
    dashboardKeys.hydrationPayload(DASHBOARD_ID),
    payload,
  );

  const { result } = renderHook(() => useDiscardChanges(DASHBOARD_ID), {
    wrapper,
  });
  const handled = result.current();

  expect(handled).toBe(true);
  expect(dispatch).toHaveBeenCalledWith({
    type: 'HYDRATE_DASHBOARD',
    data: { ...payload, charts: {} },
  });
});

test('reuses live chart entries so discard does not force a re-fetch', () => {
  const liveChart = { id: 18, chartStatus: 'rendered', queriesResponse: [{}] };
  const { queryClient, dispatch, wrapper } = setup({ 18: liveChart });
  queryClient.setQueryData(dashboardKeys.hydrationPayload(DASHBOARD_ID), {
    charts: { 18: { id: 18, chartStatus: null } },
  });

  const { result } = renderHook(() => useDiscardChanges(DASHBOARD_ID), {
    wrapper,
  });
  result.current();

  // The pristine cached entry would drop the query result; the live entry
  // (with its response) is replayed instead, keeping charts in place.
  const dispatched = dispatch.mock.calls[0][0];
  expect(dispatched.data.charts[18]).toBe(liveChart);
});

test('clears the zundo temporal history on discard', () => {
  const { queryClient, wrapper } = setup();
  queryClient.setQueryData(dashboardKeys.hydrationPayload(DASHBOARD_ID), {});

  // Seed temporal history with a layout change
  useDashboardLayoutStore
    .getState()
    .setLayout({ A: { id: 'A', type: 'ROW', children: [], meta: {} } });
  useDashboardLayoutStore
    .getState()
    .setLayout({ B: { id: 'B', type: 'ROW', children: [], meta: {} } });
  expect(
    useDashboardLayoutStore.temporal.getState().pastStates.length,
  ).toBeGreaterThan(0);

  const { result } = renderHook(() => useDiscardChanges(DASHBOARD_ID), {
    wrapper,
  });
  result.current();

  expect(useDashboardLayoutStore.temporal.getState().pastStates.length).toBe(0);
  expect(useDashboardLayoutStore.temporal.getState().futureStates.length).toBe(
    0,
  );
});

test('re-seeds the dashboardInfo Zustand store from the cached payload', () => {
  const { queryClient, wrapper } = setup();
  queryClient.setQueryData(dashboardKeys.hydrationPayload(DASHBOARD_ID), {
    dashboardInfo: {
      id: DASHBOARD_ID,
      metadata: { color_scheme: 'restored' },
    },
  });

  // Simulate a dirty editing session in the dashboardInfo store.
  useDashboardInfoStore
    .getState()
    .setPendingChartCustomization({ id: 'pending-edit' } as never);

  const { result } = renderHook(() => useDiscardChanges(DASHBOARD_ID), {
    wrapper,
  });
  result.current();

  // Discard restores the cached dashboardInfo and clears pending customizations.
  const { dashboardInfo } = useDashboardInfoStore.getState();
  expect(dashboardInfo.id).toBe(DASHBOARD_ID);
  expect(dashboardInfo.metadata?.color_scheme).toBe('restored');
  expect(dashboardInfo.pendingChartCustomizations).toEqual({});
});

test('keeps the live native_filter_configuration so filters stay in scope after discard', () => {
  const { queryClient, wrapper } = setup();
  // The snapshot is captured at hydration, before setInScopeStatusOfFilters
  // computes chartsInScope — so its filter config is scope-less.
  queryClient.setQueryData(dashboardKeys.hydrationPayload(DASHBOARD_ID), {
    dashboardInfo: {
      id: DASHBOARD_ID,
      metadata: {
        color_scheme: 'restored',
        native_filter_configuration: [{ id: 'f1', chartsInScope: [] }],
      },
    },
  });
  // Live store: scope was computed after hydration.
  useDashboardInfoStore.setState({
    dashboardInfo: {
      id: DASHBOARD_ID,
      metadata: {
        native_filter_configuration: [{ id: 'f1', chartsInScope: [59, 60] }],
      },
    } as unknown as DashboardInfo,
  });

  const { result } = renderHook(() => useDiscardChanges(DASHBOARD_ID), {
    wrapper,
  });
  result.current();

  const { dashboardInfo } = useDashboardInfoStore.getState();
  // Other metadata is restored from the snapshot...
  expect(dashboardInfo.metadata?.color_scheme).toBe('restored');
  // ...but the filter config keeps its live, scope-computed value, otherwise
  // every native filter would render out of scope after an in-place discard.
  const config = dashboardInfo.metadata
    ?.native_filter_configuration as unknown as {
    chartsInScope: number[];
  }[];
  expect(config[0].chartsInScope).toEqual([59, 60]);
});

test('resets the Zustand state store from the cached seed (QA Finding E)', () => {
  const { queryClient, wrapper } = setup();
  queryClient.setQueryData(dashboardKeys.hydrationPayload(DASHBOARD_ID), {
    zustandStateSeed: {
      hasUnsavedChanges: false,
      editMode: false,
    },
  });

  // Simulate a dirty editing session in the Zustand state store.
  useDashboardStateStore.setState({
    hasUnsavedChanges: true,
    editMode: true,
  });

  const { result } = renderHook(() => useDiscardChanges(DASHBOARD_ID), {
    wrapper,
  });
  result.current();

  // Discard must clear the dirty flag and exit edit mode — otherwise
  // beforeunload stays armed on a cleanly-discarded dashboard.
  expect(useDashboardStateStore.getState().hasUnsavedChanges).toBe(false);
  expect(useDashboardStateStore.getState().editMode).toBe(false);
});

test('clears live cross-filter selections on discard', () => {
  const { queryClient, wrapper } = setup();
  // A cross-filter applied during the session (keyed by chart id, not native).
  useDataMaskStore.setState({
    dataMask: {
      '101': {
        id: '101',
        extraFormData: {},
        filterState: { value: [1] },
        ownState: {},
      },
    },
  });
  queryClient.setQueryData(dashboardKeys.hydrationPayload(DASHBOARD_ID), {
    dashboardInfo: { metadata: {} },
    dataMask: {},
  });

  const { result } = renderHook(() => useDiscardChanges(DASHBOARD_ID), {
    wrapper,
  });
  result.current();

  expect(useDataMaskStore.getState().dataMask['101']).toBeUndefined();
});

test('reverts a persistent refresh interval on discard', () => {
  const { queryClient, wrapper } = setup();
  queryClient.setQueryData(dashboardKeys.hydrationPayload(DASHBOARD_ID), {
    zustandStateSeed: {
      refreshFrequency: 0,
      shouldPersistRefreshFrequency: false,
    },
  });
  // A persistent interval set in edit mode is a dashboard edit, not a
  // session-only setting.
  useDashboardStateStore.setState({
    refreshFrequency: 30,
    shouldPersistRefreshFrequency: true,
  });

  const { result } = renderHook(() => useDiscardChanges(DASHBOARD_ID), {
    wrapper,
  });
  result.current();

  expect(useDashboardStateStore.getState().refreshFrequency).toBe(0);
  expect(useDashboardStateStore.getState().shouldPersistRefreshFrequency).toBe(
    false,
  );
});

test('preserves session-only fields across discard', () => {
  const { queryClient, wrapper } = setup();
  queryClient.setQueryData(dashboardKeys.hydrationPayload(DASHBOARD_ID), {
    zustandStateSeed: {
      hasUnsavedChanges: false,
      editMode: false,
      refreshFrequency: 0,
      shouldPersistRefreshFrequency: false,
      activeTabs: [],
      inactiveTabs: [],
      tabActivationTimes: {},
      nativeFiltersBarOpen: false,
    },
  });

  // Live store reflects out-of-edit-mode actions: tab nav (marks sibling
  // inactive), session-only refresh interval, opened filter bar.
  useDashboardStateStore.setState({
    hasUnsavedChanges: true,
    editMode: true,
    refreshFrequency: 10,
    shouldPersistRefreshFrequency: false,
    activeTabs: ['TAB-lg-5ymUDgm'],
    inactiveTabs: ['TAB-lg-sibling'],
    tabActivationTimes: { 'TAB-lg-5ymUDgm': 1234567890 },
    nativeFiltersBarOpen: true,
  });

  const { result } = renderHook(() => useDiscardChanges(DASHBOARD_ID), {
    wrapper,
  });
  result.current();

  const state = useDashboardStateStore.getState();
  expect(state.editMode).toBe(false);
  expect(state.hasUnsavedChanges).toBe(false);
  expect(state.refreshFrequency).toBe(10);
  expect(state.activeTabs).toEqual(['TAB-lg-5ymUDgm']);
  // inactiveTabs is paired with activeTabs and must be preserved too, not
  // reset to the hydration default.
  expect(state.inactiveTabs).toEqual(['TAB-lg-sibling']);
  expect(state.tabActivationTimes).toEqual({ 'TAB-lg-5ymUDgm': 1234567890 });
  // Filter-bar open/closed is a view preference, preserved (not reset to the
  // snapshot's closed default) so discard doesn't collapse an open bar.
  expect(state.nativeFiltersBarOpen).toBe(true);
});
