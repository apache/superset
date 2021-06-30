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
import { useSelector } from 'react-redux';
import { useMemo } from 'react';
import { JsonObject } from '@superset-ui/core';
import { Filter, FilterConfiguration } from './types';
import { ActiveTabs, DashboardLayout, RootState } from '../../types';
import { TAB_TYPE } from '../../util/componentTypes';
import { CascadeFilter } from './FilterBar/CascadeFilters/types';

const defaultFilterConfiguration: Filter[] = [];

export function useFilterConfiguration() {
  return useSelector<any, FilterConfiguration>(
    state =>
      state.dashboardInfo?.metadata?.native_filter_configuration ||
      defaultFilterConfiguration,
  );
}

/**
 * returns the dashboard's filter configuration,
 * converted into a map of id -> filter
 */
export function useFilterConfigMap() {
  const filterConfig = useFilterConfiguration();
  return useMemo(
    () =>
      filterConfig.reduce((acc: Record<string, Filter>, filter: Filter) => {
        acc[filter.id] = filter;
        return acc;
      }, {} as Record<string, Filter>),
    [filterConfig],
  );
}

export function useDashboardLayout() {
  return useSelector<any, DashboardLayout>(
    state => state.dashboardLayout?.present,
  );
}

export function useDashboardHasTabs() {
  const dashboardLayout = useDashboardLayout();
  return useMemo(
    () =>
      Object.values(dashboardLayout).some(element => element.type === TAB_TYPE),
    [dashboardLayout],
  );
}

function useActiveDashboardTabs() {
  return useSelector<RootState, ActiveTabs>(
    state => state.dashboardState?.activeTabs,
  );
}

function useSelectChartTabParents() {
  const dashboardLayout = useDashboardLayout();
  return (chartId: number) => {
    const chartLayoutItem = Object.values(dashboardLayout).find(
      layoutItem => layoutItem.meta?.chartId === chartId,
    );
    return chartLayoutItem?.parents.filter(
      (parent: string) => dashboardLayout[parent].type === TAB_TYPE,
    );
  };
}

function useIsFilterInScope() {
  const activeTabs = useActiveDashboardTabs();
  const selectChartTabParents = useSelectChartTabParents();

  // Filter is in scope if any of it's charts is visible.
  // Chart is visible if it's placed in an active tab tree or if it's not attached to any tab.
  // Chart is in an active tab tree if all of it's ancestors of type TAB are active
  return (filter: CascadeFilter) =>
    filter.chartsInScope?.some((chartId: number) => {
      const tabParents = selectChartTabParents(chartId);
      return (
        tabParents?.length === 0 ||
        tabParents?.every(tab => activeTabs.includes(tab))
      );
    });
}

export function useSelectFiltersInScope(cascadeFilters: CascadeFilter[]) {
  const dashboardHasTabs = useDashboardHasTabs();
  const isFilterInScope = useIsFilterInScope();

  return useMemo(() => {
    let filtersInScope: CascadeFilter[] = [];
    const filtersOutOfScope: CascadeFilter[] = [];

    // we check native filters scopes only on dashboards with tabs
    if (!dashboardHasTabs) {
      filtersInScope = cascadeFilters;
    } else {
      cascadeFilters.forEach((filter: CascadeFilter) => {
        const filterInScope = isFilterInScope(filter);

        if (filterInScope) {
          filtersInScope.push(filter);
        } else {
          filtersOutOfScope.push(filter);
        }
      });
    }
    return [filtersInScope, filtersOutOfScope];
  }, [cascadeFilters, dashboardHasTabs, isFilterInScope]);
}

export function usePreselectNativeFilters(): JsonObject | undefined {
  return useSelector<RootState, any>(
    state => state.dashboardState?.preselectNativeFilters,
  );
}

export function usePreselectNativeFilter(id: string): JsonObject | undefined {
  return usePreselectNativeFilters()?.[id];
}
