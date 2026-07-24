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
import { FC, useEffect } from 'react';

import { useStore } from 'react-redux';
import { debounce, pick, pickBy } from 'lodash';
import { DashboardContextForExplore } from 'src/types/DashboardContextForExplore';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import {
  buildActiveFilters,
  getActiveFilters,
} from 'src/dashboard/util/activeDashboardFilters';
import { getAllActiveFilters } from 'src/dashboard/util/activeAllDashboardFilters';
import { enforceSharedLabelsColorsArray } from 'src/utils/colorScheme';
import {
  useDashboardStateStore,
  useNativeFiltersStore,
  useDashboardInfoStore,
  useDashboardLayoutStore,
  type FilterEntry,
} from 'src/dashboard/stores';
import { useDataMaskStore } from 'src/dataMask/useDataMaskStore';
import type { RootState } from 'src/dashboard/types';
import {
  DataMaskStateWithId,
  Divider,
  Filter,
  JsonObject,
} from '@superset-ui/core';

type Props = { dashboardPageId: string };

const EMPTY_OBJECT = {};
const DEBOUNCE_MS = 200;

export const getDashboardContextLocalStorage = () => {
  const dashboardsContexts = getItem(
    LocalStorageKeys.DashboardExploreContext,
    {},
  );
  // A new dashboard tab id is generated on each dashboard page opening.
  // We mark ids as redundant when user leaves the dashboard, because they won't be reused.
  // Then we remove redundant dashboard contexts from local storage in order not to clutter it
  return pickBy(dashboardsContexts, value => !value.isRedundant);
};

const updateDashboardTabLocalStorage = (
  dashboardPageId: string,
  dashboardContext: DashboardContextForExplore,
) => {
  const dashboardsContexts = getDashboardContextLocalStorage();
  setItem(LocalStorageKeys.DashboardExploreContext, {
    ...dashboardsContexts,
    [dashboardPageId]: { ...dashboardContext, dashboardPageId },
  });
};

const buildDashboardContextForExplore = (
  metadata: JsonObject | undefined,
  dashboardId: number,
  colorScheme: string | undefined,
  filters: Record<string, FilterEntry>,
  dataMask: DataMaskStateWithId,
  sliceIds: number[],
): DashboardContextForExplore => {
  const nativeFilters = Object.keys(filters).reduce<
    Record<string, Pick<Filter | Divider, 'chartsInScope'>>
  >((acc, key) => {
    const filter = filters[key];
    if ('chartsInScope' in filter) {
      acc[key] = pick(filter, ['chartsInScope']);
    }
    return acc;
  }, {});

  const activeFilters = getAllActiveFilters({
    chartConfiguration: metadata?.chart_configuration || EMPTY_OBJECT,
    nativeFilters: filters,
    dataMask,
    allSliceIds: sliceIds,
  });

  return {
    labelsColor: metadata?.label_colors || EMPTY_OBJECT,
    labelsColorMap: metadata?.map_label_colors || EMPTY_OBJECT,
    sharedLabelsColors: enforceSharedLabelsColorsArray(
      metadata?.shared_label_colors,
    ),
    colorScheme: colorScheme ?? '',
    chartConfiguration: metadata?.chart_configuration || EMPTY_OBJECT,
    nativeFilters,
    dataMask,
    dashboardId,
    filterBoxFilters: getActiveFilters(),
    activeFilters,
  };
};

const readCurrentContext = (): DashboardContextForExplore =>
  buildDashboardContextForExplore(
    useDashboardInfoStore.getState().dashboardInfo.metadata,
    useDashboardInfoStore.getState().dashboardInfo.id,
    useDashboardStateStore.getState().colorScheme,
    useNativeFiltersStore.getState().filters,
    useDataMaskStore.getState().dataMask,
    useDashboardStateStore.getState().sliceIds,
  );

/**
 * Syncs dashboard state to localStorage for cross-tab handoff to Explore.
 * Uses direct Zustand subscriptions (not React selectors) so the host component
 * never re-renders. Subsequent writes are debounced to batch rapid state changes.
 */
const SyncDashboardState: FC<Props> = ({ dashboardPageId }) => {
  const reduxStore = useStore<RootState>();

  useEffect(() => {
    // Initial write is synchronous so consumers see the context immediately on mount.
    updateDashboardTabLocalStorage(dashboardPageId, readCurrentContext());

    const write = debounce(() => {
      updateDashboardTabLocalStorage(dashboardPageId, readCurrentContext());
    }, DEBOUNCE_MS);

    // The legacy filter-box scope cache (getActiveFilters) is keyed off the
    // layout. Master rebuilt it on every layout mutation; rebuild it here on any
    // layout change so chartsInScope stays current, then re-sync the context.
    const rebuildActiveFilters = () => {
      buildActiveFilters({
        dashboardFilters: reduxStore.getState().dashboardFilters as Parameters<
          typeof buildActiveFilters
        >[0]['dashboardFilters'],
        components: useDashboardLayoutStore.getState().layout as Parameters<
          typeof buildActiveFilters
        >[0]['components'],
      });
      write();
    };

    // One subscription per relevant store slice. Each fires only when its slice changes.
    const unsubs = [
      useDashboardInfoStore.subscribe(s => s.dashboardInfo.metadata, write),
      useDashboardInfoStore.subscribe(s => s.dashboardInfo.id, write),
      useDashboardStateStore.subscribe(s => s.colorScheme, write),
      useDashboardStateStore.subscribe(s => s.sliceIds, write),
      useNativeFiltersStore.subscribe(s => s.filters, write),
      useDataMaskStore.subscribe(s => s.dataMask, write),
      useDashboardLayoutStore.subscribe(s => s.layout, rebuildActiveFilters),
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
      write.cancel();
      // Mark this tab id as redundant when the dashboard unmounts so it can be
      // GC'd from localStorage on the next page open (see getDashboardContextLocalStorage).
      updateDashboardTabLocalStorage(dashboardPageId, {
        ...readCurrentContext(),
        isRedundant: true,
      });
    };
  }, [dashboardPageId, reduxStore]);

  return null;
};

export default SyncDashboardState;
