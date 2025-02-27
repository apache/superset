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
import {
  Divider,
  Filter,
  FilterConfiguration,
  isFilterDivider,
} from '@superset-ui/core';
import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ActiveTabs, DashboardLayout, RootState } from '../../types';
import { CHART_TYPE, TAB_TYPE } from '../../util/componentTypes';

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
      filterConfig.reduce<Record<string, Filter | Divider>>(
        (acc: Record<string, Filter | Divider>, filter: Filter) => {
          acc[filter.id] = filter;
          return acc;
        },
        {},
      ),
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
  const layoutChartItems = useMemo(
    () =>
      Object.values(dashboardLayout).filter(item => item.type === CHART_TYPE),
    [dashboardLayout],
  );
  return useCallback(
    (chartId: number) => {
      const chartLayoutItem = layoutChartItems.find(
        layoutItem => layoutItem.meta?.chartId === chartId,
      );
      return chartLayoutItem?.parents?.filter(
        (parent: string) => dashboardLayout[parent]?.type === TAB_TYPE,
      );
    },
    [dashboardLayout, layoutChartItems],
  );
}

export function useIsFilterInScope() {
  const activeTabs = useActiveDashboardTabs();
  const selectChartTabParents = useSelectChartTabParents();
  const dashboardHasTabs = useDashboardHasTabs();

  // Filter is in scope if any of its charts is visible.
  // Chart is visible if it's placed in an active tab tree or if it's not attached to any tab.
  // Chart is in an active tab tree if all of its ancestors of type TAB are active
  // Dividers are always in scope
  return useCallback(
    (filter: Filter | Divider) => {
      // Early returns for cases where filter is always in scope
      if (
        isFilterDivider(filter) || // Dividers are always in scope
        !dashboardHasTabs || // Without tabs, all filters are in scope
        (!filter.scope?.rootPath?.length && !filter.chartsInScope?.length) // Global filters are always in scope
      ) {
        return true;
      }

      // Safely handle potentially undefined arrays
      const rootPath = filter.scope?.rootPath ?? [];
      const chartsInScope = filter.chartsInScope ?? [];

      const hasRootPath = rootPath.length > 0;
      const hasCharts = chartsInScope.length > 0;

      // Calculate tab scope only if needed
      const isFilterInActiveTab =
        !hasRootPath || rootPath.some(tab => activeTabs.includes(tab));

      // Short circuit - if filter has rootPath but not in active tab
      if (hasRootPath && !isFilterInActiveTab) {
        return false;
      }

      // Calculate chart scope only if needed
      if (hasCharts) {
        const isChartInScope = chartsInScope.some(chartId => {
          const tabParents = selectChartTabParents(chartId);
          return (
            !tabParents ||
            tabParents.length === 0 ||
            tabParents.every(tab => activeTabs.includes(tab))
          );
        });

        // Use the actual chart scope in our return value
        // Show filter if either its charts are visible OR it's in an active tab
        return isChartInScope || isFilterInActiveTab;
      }

      // If we got here, filter has rootPath but no charts
      return isFilterInActiveTab;
    },
    [selectChartTabParents, activeTabs, dashboardHasTabs],
  );
}

export function useSelectFiltersInScope(filters: (Filter | Divider)[]) {
  const dashboardHasTabs = useDashboardHasTabs();
  const isFilterInScope = useIsFilterInScope();

  return useMemo(() => {
    let filtersInScope: (Filter | Divider)[] = [];
    const filtersOutOfScope: (Filter | Divider)[] = [];

    // we check native filters scopes only on dashboards with tabs
    if (!dashboardHasTabs) {
      filtersInScope = filters;
    } else {
      filters.forEach(filter => {
        const filterInScope = isFilterInScope(filter);

        if (filterInScope) {
          filtersInScope.push(filter);
        } else {
          filtersOutOfScope.push(filter);
        }
      });
    }
    return [filtersInScope, filtersOutOfScope];
  }, [filters, dashboardHasTabs, isFilterInScope]);
}
