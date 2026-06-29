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

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type {
  Divider,
  Filter,
  NativeFiltersState,
  ChartCustomization,
  ChartCustomizationDivider,
} from '@superset-ui/core';

export type FilterEntry =
  Filter | Divider | ChartCustomization | ChartCustomizationDivider;

export interface ExtendedNativeFiltersState extends NativeFiltersState {
  hoveredChartCustomizationId?: string;
}

/** Builds state from a filter config, preserving existing filters; used by hydration and the in-scope-status update. */
export function getNativeFiltersInitialState({
  filterConfig,
  state: prevState,
}: {
  filterConfig?: FilterEntry[];
  state?: ExtendedNativeFiltersState;
}): ExtendedNativeFiltersState {
  const filters = { ...prevState?.filters } as Record<string, FilterEntry>;
  if (filterConfig) {
    filterConfig.forEach(filter => {
      filters[filter.id] = filter;
    });
  }
  return {
    filters,
    focusedFilterId: undefined,
    hoveredFilterId: undefined,
    hoveredChartCustomizationId: undefined,
  };
}

function mergeFilterChanges(
  currentFilters: Record<string, FilterEntry>,
  filters: FilterEntry[],
  deletedIds: string[] = [],
): Record<string, FilterEntry> {
  // Merge into the existing map (not rebuild): native filters and chart
  // customizations share it and each save reports only its own domain, so
  // rebuilding would drop the other's entries. Deletions come via deletedIds.
  const newFilters: Record<string, FilterEntry> = { ...currentFilters };
  filters.forEach(filter => {
    const existingFilter = currentFilters[filter.id];
    if (filter.chartsInScope != null && filter.tabsInScope != null) {
      newFilters[filter.id] = filter;
    } else {
      newFilters[filter.id] = {
        ...filter,
        chartsInScope: filter.chartsInScope ?? existingFilter?.chartsInScope,
        tabsInScope: filter.tabsInScope ?? existingFilter?.tabsInScope,
      };
    }
  });
  deletedIds.forEach(id => {
    delete newFilters[id];
  });
  return newFilters;
}

export interface NativeFiltersStore extends ExtendedNativeFiltersState {
  filters: Record<string, FilterEntry>;
  setFiltersConfigComplete: (
    filterChanges: FilterEntry[],
    deletedIds?: string[],
  ) => void;
  setInScopeStatus: (filterConfig: FilterEntry[]) => void;
  setFocusedFilter: (id: string) => void;
  unsetFocusedFilter: () => void;
  setHoveredFilter: (id: string) => void;
  unsetHoveredFilter: () => void;
  setHoveredChartCustomization: (id: string) => void;
  unsetHoveredChartCustomization: () => void;
  updateCascadeParentIds: (id: string, parentIds: string[]) => void;
  hydrateNativeFilters: (incomingFilters: Record<string, FilterEntry>) => void;
}

export const useNativeFiltersStore = create<NativeFiltersStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      filters: {},
      focusedFilterId: undefined,
      hoveredFilterId: undefined,
      hoveredChartCustomizationId: undefined,

      setFiltersConfigComplete: (filterChanges, deletedIds) =>
        set(
          state => {
            const filters = mergeFilterChanges(
              state.filters,
              filterChanges,
              deletedIds,
            );
            // Drop a focus/hover id pointing at a filter this change removed,
            // so consumers never resolve a stale id to a missing filter.
            return {
              filters,
              ...(state.focusedFilterId && !filters[state.focusedFilterId]
                ? { focusedFilterId: undefined }
                : null),
              ...(state.hoveredFilterId && !filters[state.hoveredFilterId]
                ? { hoveredFilterId: undefined }
                : null),
            };
          },
          false,
          'nativeFilters/setFiltersConfigComplete',
        ),

      setInScopeStatus: filterConfig =>
        set(
          getNativeFiltersInitialState({ filterConfig, state: get() }),
          false,
          'nativeFilters/setInScopeStatus',
        ),

      setFocusedFilter: id =>
        set({ focusedFilterId: id }, false, 'nativeFilters/setFocusedFilter'),

      unsetFocusedFilter: () =>
        set(
          { focusedFilterId: undefined },
          false,
          'nativeFilters/unsetFocusedFilter',
        ),

      setHoveredFilter: id =>
        set({ hoveredFilterId: id }, false, 'nativeFilters/setHoveredFilter'),

      unsetHoveredFilter: () =>
        set(
          { hoveredFilterId: undefined },
          false,
          'nativeFilters/unsetHoveredFilter',
        ),

      setHoveredChartCustomization: id =>
        set(
          { hoveredChartCustomizationId: id },
          false,
          'nativeFilters/setHoveredChartCustomization',
        ),

      unsetHoveredChartCustomization: () =>
        set(
          { hoveredChartCustomizationId: undefined },
          false,
          'nativeFilters/unsetHoveredChartCustomization',
        ),

      updateCascadeParentIds: (id, parentIds) =>
        set(
          state => ({
            filters: {
              ...state.filters,
              [id]: { ...state.filters[id], cascadeParentIds: parentIds },
            },
          }),
          false,
          'nativeFilters/updateCascadeParentIds',
        ),

      hydrateNativeFilters: incomingFilters =>
        set(
          state => {
            const mergedFilters: Record<string, FilterEntry> = {};
            Object.entries(incomingFilters).forEach(([id, incomingFilter]) => {
              const existingFilter = state.filters[id];
              if (
                incomingFilter.chartsInScope == null &&
                existingFilter?.chartsInScope != null
              ) {
                mergedFilters[id] = {
                  ...incomingFilter,
                  chartsInScope: existingFilter.chartsInScope,
                  tabsInScope: existingFilter.tabsInScope,
                };
              } else {
                mergedFilters[id] = incomingFilter;
              }
            });
            return {
              filters: mergedFilters,
              focusedFilterId: undefined,
              hoveredFilterId: undefined,
              hoveredChartCustomizationId: undefined,
            };
          },
          false,
          'nativeFilters/hydrateNativeFilters',
        ),
    })),
    {
      name: 'NativeFiltersStore',
      enabled: process.env.WEBPACK_MODE === 'development',
    },
  ),
);
