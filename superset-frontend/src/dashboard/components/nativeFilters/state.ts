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
import { CHART_TYPE, TAB_TYPE, TABS_TYPE } from '../../util/componentTypes';
import { DASHBOARD_ROOT_ID } from '../../util/constants';
import { isChartCustomizationId } from './FiltersConfigModal/utils';
import {
  migrateChartCustomizationArray,
  isLegacyChartCustomizationFormat,
} from '../../util/migrateChartCustomization';

const EMPTY_ARRAY: ChartCustomizationConfiguration = [];
const EMPTY_ACTIVE_TABS: ActiveTabs = [];
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
      state.dashboardInfo?.metadata?.chart_customization_config || EMPTY_ARRAY,
    selectDashboardChartIds,
  ],
  (allCustomizations, dashboardChartIds): ChartCustomizationConfiguration => {
    const truthyCustomizations = allCustomizations.filter(Boolean);

    const hasLegacyFormat = truthyCustomizations.some(item =>
      isLegacyChartCustomizationFormat(item),
    );

    const migratedCustomizations = hasLegacyFormat
      ? migrateChartCustomizationArray(truthyCustomizations)
      : (truthyCustomizations as ChartCustomizationConfiguration);

    return migratedCustomizations.filter(customization => {
      if (
        !customization.chartsInScope ||
        customization.chartsInScope.length === 0
      ) {
        return true;
      }

      return customization.chartsInScope.some((chartId: number) =>
        dashboardChartIds.has(chartId),
      );
    });
  },
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
      dashboardLayout
        ? Object.values(dashboardLayout).some(
            element => element.type === TAB_TYPE,
          )
        : false,
    [dashboardLayout],
  );
}

function useActiveDashboardTabs(): ActiveTabs {
  const reduxTabs = useSelector<RootState, ActiveTabs>(
    state => state.dashboardState?.activeTabs,
  );
  const dashboardLayout = useDashboardLayout();

  return useMemo(() => {
    const reduxList = reduxTabs ?? [];
    const reduxFallback = reduxList.length ? reduxList : EMPTY_ACTIVE_TABS;
    if (!dashboardLayout) return reduxFallback;

    // Tabbed dashboards always nest the top-level TABS container as the first
    // child of ROOT. If that invariant doesn't hold (no-tabs layout), no
    // fallback applies and we use reduxTabs as-is.
    const root = dashboardLayout[DASHBOARD_ROOT_ID];
    if (!root?.children?.length) return reduxFallback;
    const topContainer = dashboardLayout[root.children[0]];
    if (topContainer?.type !== TABS_TYPE || !topContainer.children?.length) {
      return reduxFallback;
    }

    // Walk every TABS container along the active path. For each container,
    // pick the child Redux marked active; otherwise pick the first child (the
    // default the live Tabs component would render). This handles:
    //   - empty reduxTabs (hideTab:true, no permalink) → full default path
    //   - reduxTabs missing an outer ancestor (hideTab:true skipped the
    //     top-level Tabs, but a nested Tabs dispatched setActiveTab) → fill
    //     in the missing ancestor so outer-tab scoping is preserved
    //   - fully populated reduxTabs (normal hydration) → same result
    const reduxSet = new Set(reduxList);
    const result: ActiveTabs = [];
    const queue: string[] = [
      topContainer.children.find(c => reduxSet.has(c)) ??
        topContainer.children[0],
    ];
    while (queue.length > 0) {
      const tabId = queue.shift()!;
      result.push(tabId);
      const tab = dashboardLayout[tabId];
      if (!tab?.children) continue;
      for (const childId of tab.children) {
        const child = dashboardLayout[childId];
        if (child?.type !== TABS_TYPE || !child.children?.length) continue;
        queue.push(
          child.children.find(c => reduxSet.has(c)) ?? child.children[0],
        );
      }
    }

    // Preserve any reduxTabs entries that fell outside the traversed path so
    // we never silently drop a redux-marked active tab id.
    const resultSet = new Set(result);
    for (const id of reduxList) {
      if (!resultSet.has(id)) result.push(id);
    }
    return result;
  }, [reduxTabs, dashboardLayout]);
}

function useSelectChartTabParents() {
  const dashboardLayout = useDashboardLayout();
  const layoutChartItems = useMemo(
    () =>
      dashboardLayout
        ? Object.values(dashboardLayout).filter(
            item => item.type === CHART_TYPE,
          )
        : [],
    [dashboardLayout],
  );
  return useCallback(
    (chartId: number) => {
      const chartLayoutItem = layoutChartItems.find(
        layoutItem => layoutItem.meta?.chartId === chartId,
      );
      return chartLayoutItem?.parents?.filter(
        (parent: string) => dashboardLayout?.[parent]?.type === TAB_TYPE,
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

      const hasChartsInScope =
        Array.isArray(customization.chartsInScope) &&
        customization.chartsInScope.length > 0;
      const hasTabsInScope =
        Array.isArray(customization.tabsInScope) &&
        customization.tabsInScope.length > 0;

      if (!hasChartsInScope && !hasTabsInScope) {
        return true;
      }

      const isChartInScope =
        hasChartsInScope &&
        customization.chartsInScope!.some((chartId: number) => {
          const tabParents = selectChartTabParents(chartId);
          // Note: every() returns true for empty arrays, so length check is unnecessary
          return (
            !tabParents || tabParents.every(tab => activeTabs.includes(tab))
          );
        });

      const isCustomizationInActiveTab =
        hasTabsInScope &&
        customization.tabsInScope!.some(tab => activeTabs.includes(tab));

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

    // we check customization scopes only on dashboards with tabs
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
