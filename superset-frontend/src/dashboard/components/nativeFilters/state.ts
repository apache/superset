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
import { useCallback, useMemo } from 'react';
import { createSelector } from '@reduxjs/toolkit';
import {
  Filter,
  Divider,
  isChartCustomization,
  ChartCustomization,
  ChartCustomizationDivider,
  ChartCustomizationConfiguration,
  NativeFilterType,
} from '@superset-ui/core';
import { FilterElement } from './FilterBar/FilterControls/types';
import { ActiveTabs, DashboardLayout, RootState } from '../../types';
import { CHART_TYPE, TAB_TYPE } from '../../util/componentTypes';
import { isChartCustomizationId } from './FiltersConfigModal/utils';

const EMPTY_ARRAY: ChartCustomizationConfiguration = [];
const defaultFilterConfiguration: (Filter | Divider)[] = [];

export const selectFilterConfiguration: (
  state: RootState,
) => (Filter | Divider)[] = createSelector(
  (state: RootState) =>
    state.dashboardInfo?.metadata?.native_filter_configuration,
  (nativeFilterConfig): (Filter | Divider)[] => {
    if (!nativeFilterConfig) {
      return defaultFilterConfiguration;
    }
    return nativeFilterConfig.filter(
      (
        filter:
          | Filter
          | Divider
          | ChartCustomization
          | ChartCustomizationDivider,
      ) =>
        filter.type !== 'CHART_CUSTOMIZATION' &&
        filter.type !== 'CHART_CUSTOMIZATION_DIVIDER',
    ) as (Filter | Divider)[];
  },
);

export function useFilterConfiguration() {
  return useSelector(selectFilterConfiguration);
}

export const selectChartCustomizationFromRedux: (
  state: RootState,
) => (ChartCustomization | ChartCustomizationDivider)[] = createSelector(
  (state: RootState) => state.nativeFilters?.filters || {},
  (filtersMap): (ChartCustomization | ChartCustomizationDivider)[] =>
    Object.values(filtersMap).filter(
      (
        item: Filter | Divider | ChartCustomization | ChartCustomizationDivider,
      ): item is ChartCustomization | ChartCustomizationDivider =>
        item?.id != null && isChartCustomizationId(item.id),
    ),
);

export function useChartCustomizationFromRedux() {
  return useSelector(selectChartCustomizationFromRedux);
}

const selectDashboardChartIds = createSelector(
  (state: RootState) => state.dashboardLayout?.present,
  (dashboardLayout): Set<number> =>
    new Set(
      Object.values(dashboardLayout)
        .filter(item => item.type === CHART_TYPE && item.meta?.chartId)
        .map(item => item.meta.chartId!),
    ),
);

const selectChartCustomizationConfiguration = createSelector(
  [
    (state: RootState) =>
      state.dashboardInfo.metadata?.chart_customization_config || EMPTY_ARRAY,
    selectDashboardChartIds,
  ],
  (allCustomizations, dashboardChartIds): ChartCustomizationConfiguration =>
    allCustomizations.filter(customization => {
      if (
        !customization.chartsInScope ||
        customization.chartsInScope.length === 0
      ) {
        return true;
      }

      return customization.chartsInScope.some((chartId: number) =>
        dashboardChartIds.has(chartId),
      );
    }),
);

export function useChartCustomizationConfiguration() {
  return useSelector(selectChartCustomizationConfiguration);
}

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

export function useChartCustomizationConfigMap() {
  const filterConfig = useChartCustomizationConfiguration();
  return useMemo(
    () =>
      filterConfig.reduce<
        Record<string, ChartCustomization | ChartCustomizationDivider>
      >(
        (
          acc: Record<string, ChartCustomization | ChartCustomizationDivider>,
          chartCustomization: ChartCustomization | ChartCustomizationDivider,
        ) => {
          acc[chartCustomization.id] = chartCustomization;
          return acc;
        },
        {},
      ),
    [filterConfig],
  );
}

export function useDashboardLayout() {
  return useSelector<RootState, DashboardLayout>(
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

  // Filter is in scope if any of its charts is visible.
  // Chart is visible if it's placed in an active tab tree or if it's not attached to any tab.
  // Chart is in an active tab tree if all of its ancestors of type TAB are active
  // Dividers are always in scope
  return useCallback(
    (filter: FilterElement | Divider) => {
      if (filter.type === NativeFilterType.Divider) return true;

      const hasChartsInScope =
        Array.isArray(filter.chartsInScope) && filter.chartsInScope.length > 0;

      let isChartInScope = false;
      if (hasChartsInScope) {
        isChartInScope = filter.chartsInScope!.some((chartId: number) => {
          const tabParents = selectChartTabParents(chartId);
          // Note: every() returns true for empty arrays, so length check is unnecessary
          return (
            !tabParents || tabParents.every(tab => activeTabs.includes(tab))
          );
        });
      }

      if (isChartCustomization(filter)) {
        const isCustomizationInActiveTab = filter.tabsInScope?.some(tab =>
          activeTabs.includes(tab),
        );
        return isChartInScope || isCustomizationInActiveTab;
      }

      if (hasChartsInScope) {
        return isChartInScope;
      }

      return (
        filter.scope?.rootPath?.some(tab => activeTabs.includes(tab)) ?? false
      );
    },
    [selectChartTabParents, activeTabs],
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

export function useIsCustomizationInScope() {
  const activeTabs = useActiveDashboardTabs();
  const selectChartTabParents = useSelectChartTabParents();

  return useCallback(
    (customization: ChartCustomization | ChartCustomizationDivider) => {
      if ('title' in customization) return true;

      const isChartInScope =
        Array.isArray(customization.chartsInScope) &&
        customization.chartsInScope.length > 0 &&
        customization.chartsInScope.some((chartId: number) => {
          const tabParents = selectChartTabParents(chartId);
          // Note: every() returns true for empty arrays, so length check is unnecessary
          return (
            !tabParents || tabParents.every(tab => activeTabs.includes(tab))
          );
        });

      const isCustomizationInActiveTab = customization.tabsInScope?.some(tab =>
        activeTabs.includes(tab),
      );

      return isChartInScope || isCustomizationInActiveTab;
    },
    [selectChartTabParents, activeTabs],
  );
}

export function useSelectCustomizationsInScope(
  customizations: (ChartCustomization | ChartCustomizationDivider)[],
) {
  const dashboardHasTabs = useDashboardHasTabs();
  const isCustomizationInScope = useIsCustomizationInScope();

  return useMemo(() => {
    let customizationsInScope: (
      | ChartCustomization
      | ChartCustomizationDivider
    )[] = [];
    const customizationsOutOfScope: (
      | ChartCustomization
      | ChartCustomizationDivider
    )[] = [];

    if (!dashboardHasTabs) {
      customizationsInScope = customizations;
    } else {
      customizations.forEach(customization => {
        const customizationInScope = isCustomizationInScope(customization);

        if (customizationInScope) {
          customizationsInScope.push(customization);
        } else {
          customizationsOutOfScope.push(customization);
        }
      });
    }
    return [customizationsInScope, customizationsOutOfScope];
  }, [customizations, dashboardHasTabs, isCustomizationInScope]);
}
