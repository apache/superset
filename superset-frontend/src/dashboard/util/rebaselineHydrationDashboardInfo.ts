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
import type { HydrationPayload } from 'src/dashboard/actions/hydrate';

/** Refresh the cached discard-snapshot's `dashboardInfo` after a backend persist. */
export function rebaselineHydrationDashboardInfo(id: number) {
  queryClient.setQueryData<HydrationPayload>(
    dashboardKeys.hydrationPayload(id),
    old =>
      old
        ? {
            ...old,
            dashboardInfo: useDashboardInfoStore.getState().dashboardInfo,
          }
        : old,
  );
}

/**
 * Refresh the cached discard-snapshot to the just-saved state (layout, state
 * seed, slice metadata, dashboardInfo) so a later discard stays in-place rather
 * than reloading. Charts/dashboardFilters still live in Redux, so the caller
 * passes their current values when the save can alter the chart set.
 */
export function rebaselineHydrationSnapshot(
  id: number,
  reduxState?: Pick<HydrationPayload, 'charts' | 'dashboardFilters'>,
) {
  queryClient.setQueryData<HydrationPayload>(
    dashboardKeys.hydrationPayload(id),
    old => {
      if (!old) return old;
      const live = useDashboardStateStore.getState() as unknown as Record<
        string,
        unknown
      >;
      const zustandStateSeed = Object.fromEntries(
        Object.keys(old.zustandStateSeed ?? {}).map(key => [key, live[key]]),
      );
      return {
        ...old,
        ...reduxState,
        dashboardInfo: useDashboardInfoStore.getState().dashboardInfo,
        dashboardLayout: {
          past: [],
          present: useDashboardLayoutStore.getState().layout,
          future: [],
        },
        sliceEntities: {
          ...old.sliceEntities,
          slices: useDashboardSlicesStore.getState().slices,
        },
        zustandStateSeed,
      };
    },
  );
}

/**
 * Drop the snapshot after a persist it can't faithfully represent, so the next
 * discard falls back to a full reload instead of reverting an already-saved change.
 */
export function dropHydrationSnapshot(id: number) {
  queryClient.removeQueries({ queryKey: dashboardKeys.hydrationPayload(id) });
}
