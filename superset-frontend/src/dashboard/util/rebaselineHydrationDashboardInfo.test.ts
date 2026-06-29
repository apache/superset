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
import { queryClient } from 'src/queries/queryClient';
import {
  useDashboardInfoStore,
  useDashboardLayoutStore,
  useDashboardSlicesStore,
  useDashboardStateStore,
} from 'src/dashboard/stores';
import { dashboardKeys } from 'src/dashboard/queries/keys';
import type { DashboardInfo } from 'src/dashboard/types';
import type { HydrationPayload } from 'src/dashboard/actions/hydrate';
import {
  rebaselineHydrationDashboardInfo,
  rebaselineHydrationSnapshot,
} from './rebaselineHydrationDashboardInfo';

const DASHBOARD_ID = 6;

beforeEach(() => {
  queryClient.clear();
  useDashboardInfoStore.setState({ dashboardInfo: {} as DashboardInfo });
});

test('refreshes the cached payload dashboardInfo from the store, leaving other fields intact', () => {
  queryClient.setQueryData(dashboardKeys.hydrationPayload(DASHBOARD_ID), {
    dashboardInfo: { id: DASHBOARD_ID, css: 'stale' },
    dashboardLayout: { present: { ROOT: {} } },
  });
  useDashboardInfoStore.setState({
    dashboardInfo: {
      id: DASHBOARD_ID,
      css: 'saved',
    } as unknown as DashboardInfo,
  });

  rebaselineHydrationDashboardInfo(DASHBOARD_ID);

  const cached = queryClient.getQueryData(
    dashboardKeys.hydrationPayload(DASHBOARD_ID),
  ) as { dashboardInfo: DashboardInfo; dashboardLayout: unknown };
  // dashboardInfo is replaced with the live (just-saved) store value
  expect(cached.dashboardInfo).toEqual({ id: DASHBOARD_ID, css: 'saved' });
  // unrelated payload fields are preserved
  expect(cached.dashboardLayout).toEqual({ present: { ROOT: {} } });
});

test('is a no-op when no hydration payload is cached', () => {
  useDashboardInfoStore.setState({
    dashboardInfo: { id: DASHBOARD_ID } as unknown as DashboardInfo,
  });

  rebaselineHydrationDashboardInfo(DASHBOARD_ID);

  expect(
    queryClient.getQueryData(dashboardKeys.hydrationPayload(DASHBOARD_ID)),
  ).toBeUndefined();
});

test('rebaselineHydrationSnapshot refreshes layout, seed, slices, info and the passed Redux state', () => {
  queryClient.setQueryData<HydrationPayload>(
    dashboardKeys.hydrationPayload(DASHBOARD_ID),
    {
      dashboardInfo: { dashboard_title: 'old' } as never,
      dashboardLayout: {
        present: { HEADER_ID: { meta: { text: 'old' } } } as never,
      },
      charts: {} as never,
      sliceEntities: {
        slices: {},
        isLoading: false,
        errorMessage: null,
        lastUpdated: 0,
      },
      dataMask: {} as never,
      dashboardFilters: {},
      nativeFilters: { filters: {} },
      // Only these seed keys get refreshed from the live state store.
      zustandStateSeed: { isPublished: false, lastModifiedTime: 0 },
    },
  );
  useDashboardLayoutStore.setState({
    layout: { HEADER_ID: { meta: { text: 'saved title' } } } as never,
  });
  useDashboardStateStore.setState({
    isPublished: true,
    lastModifiedTime: 1234,
  });
  useDashboardSlicesStore.setState({ slices: { 7: { slice_id: 7 } } as never });
  useDashboardInfoStore.setState({
    dashboardInfo: {
      dashboard_title: 'saved title',
    } as unknown as DashboardInfo,
  });

  rebaselineHydrationSnapshot(DASHBOARD_ID, {
    charts: { 7: { id: 7 } } as never,
    dashboardFilters: { f: 1 },
  });

  const next = queryClient.getQueryData<HydrationPayload>(
    dashboardKeys.hydrationPayload(DASHBOARD_ID),
  )!;
  // Rebaselined in place, never dropped.
  expect(next).toBeDefined();
  expect(next.dashboardLayout.present.HEADER_ID.meta.text).toBe('saved title');
  // Seed keys are refreshed from the live state store, same shape as before.
  expect(next.zustandStateSeed).toEqual({
    isPublished: true,
    lastModifiedTime: 1234,
  });
  expect(next.sliceEntities.slices).toEqual({ 7: { slice_id: 7 } });
  expect(next.dashboardInfo).toEqual({ dashboard_title: 'saved title' });
  // Redux-owned slices are taken from the caller.
  expect(next.charts).toEqual({ 7: { id: 7 } });
  expect(next.dashboardFilters).toEqual({ f: 1 });
});

test('rebaselineHydrationSnapshot is a no-op when no snapshot is cached', () => {
  rebaselineHydrationSnapshot(DASHBOARD_ID, {
    charts: {} as never,
    dashboardFilters: {},
  });
  expect(
    queryClient.getQueryData(dashboardKeys.hydrationPayload(DASHBOARD_ID)),
  ).toBeUndefined();
});
