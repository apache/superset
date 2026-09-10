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
import { useCallback } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import {
  useDashboardLayoutStore,
  useDashboardStateStore,
  useDashboardSlicesStore,
  useDashboardInfoStore,
} from 'src/dashboard/stores';
import {
  useDataMaskStore,
  type DashboardFilterMetadata,
} from 'src/dataMask/useDataMaskStore';
import {
  HYDRATE_DASHBOARD,
  type HydrationPayload,
} from 'src/dashboard/actions/hydrate';
import { applyDashboardLabelsColorOnLoad } from 'src/dashboard/actions/dashboardState';
import type { RootState } from 'src/dashboard/types';
import { dashboardKeys } from '../keys';

/**
 * In-place discard: restores the dashboard from the cached hydration payload —
 * resets the Redux reducers, the Zustand layout + state stores, and the zundo
 * history. Returns `false` when no cached payload exists (fall back to reload).
 */
export function useDiscardChanges(dashboardId: number | string) {
  const dispatch = useDispatch();
  const reduxStore = useStore<RootState>();
  const queryClient = useQueryClient();

  return useCallback((): boolean => {
    const cached = queryClient.getQueryData<HydrationPayload>(
      dashboardKeys.hydrationPayload(dashboardId),
    );
    if (!cached) return false;

    // Cached chart entries are pristine; replaying them drops query results and
    // forces a re-fetch. Reuse live entries (with responses) for the original set
    // so discard stays in-place. (Charts stay on Redux, shared with Explore.)
    const liveCharts = reduxStore.getState().charts as Record<string, unknown>;
    const cachedCharts = cached.charts ?? {};
    const charts = Object.fromEntries(
      Object.keys(cachedCharts).map(id => [
        id,
        liveCharts[id] ?? cachedCharts[id],
      ]),
    );

    // Reset the Redux reducers that still listen for HYDRATE_DASHBOARD
    // (charts, datasources, dashboardFilters).
    dispatch({ type: HYDRATE_DASHBOARD, data: { ...cached, charts } });

    // Layout and state live in Zustand — restore them directly.
    if (cached.dashboardLayout?.present) {
      useDashboardLayoutStore
        .getState()
        .setLayout(cached.dashboardLayout.present);
    }
    if (cached.zustandStateSeed) {
      // Session-scoped (not dashboard-scoped) fields below keep their live values
      // so discard doesn't undo navigation or session-only settings.
      const live = useDashboardStateStore.getState();
      useDashboardStateStore.setState({
        ...cached.zustandStateSeed,
        // Session-only refresh interval survives discard; a persistent one is an
        // edit and reverts to the seed.
        ...(live.shouldPersistRefreshFrequency
          ? {}
          : {
              refreshFrequency: live.refreshFrequency,
              shouldPersistRefreshFrequency: live.shouldPersistRefreshFrequency,
            }),
        // Paired set: preserve both so discard doesn't reset inactiveTabs.
        activeTabs: live.activeTabs,
        inactiveTabs: live.inactiveTabs,
        tabActivationTimes: live.tabActivationTimes,
        // View preference, not an edit: don't collapse an open filter bar.
        nativeFiltersBarOpen: live.nativeFiltersBarOpen,
        // Session navigation: don't jump back to the chart focused at last save.
        directPathToChild: live.directPathToChild,
        directPathLastUpdated: live.directPathLastUpdated,
        editMode: false,
        hasUnsavedChanges: false,
      });
    }
    if (cached.sliceEntities?.slices) {
      useDashboardSlicesStore.getState().setSlices(cached.sliceEntities.slices);
    }

    // Re-seed dashboardInfo from the snapshot but keep the live
    // native_filter_configuration: it carries the post-hydration computed scope
    // (chartsInScope) the snapshot predates.
    if (cached.dashboardInfo) {
      const liveConfig =
        useDashboardInfoStore.getState().dashboardInfo?.metadata
          ?.native_filter_configuration ??
        cached.dashboardInfo.metadata?.native_filter_configuration;
      useDashboardInfoStore.getState().hydrateDashboardInfo({
        ...cached.dashboardInfo,
        metadata: {
          ...cached.dashboardInfo.metadata,
          native_filter_configuration: liveConfig,
        },
      } as typeof cached.dashboardInfo);
    }
    // preserveLiveExtras=false: clear live cross-filters, like the old reload.
    useDataMaskStore
      .getState()
      .hydrateDataMask(
        cached.dashboardInfo?.metadata as DashboardFilterMetadata | undefined,
        cached.dataMask,
        false,
      );
    // Re-apply saved colors/labels to the global color singleton (outside the
    // stores); reload rebuilt it, so in-place discard must too or edits leak.
    if (cached.dashboardInfo?.metadata) {
      dispatch(applyDashboardLabelsColorOnLoad(cached.dashboardInfo.metadata));
    }
    useDashboardLayoutStore.temporal.getState().clear();

    return true;
  }, [dispatch, reduxStore, queryClient, dashboardId]);
}
