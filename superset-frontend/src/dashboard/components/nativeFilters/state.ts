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
import { useCallback, useMemo } from 'react';
import {
  useDashboardLayout,
  useActiveTabs,
  useNativeFilterConfiguration,
  useChartCustomizationConfig,
  useFilterEntries,
} from 'src/dashboard/stores';
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
import { ActiveTabs, FilterConfigItem } from '../../types';
import { CHART_TYPE, TAB_TYPE, TABS_TYPE } from '../../util/componentTypes';
import getChartIdsFromLayout from '../../util/getChartIdsFromLayout';
import { DASHBOARD_ROOT_ID } from '../../util/constants';
import { isChartCustomizationId } from './FiltersConfigModal/utils';
import {
  migrateChartCustomizationArray,
  isLegacyChartCustomizationFormat,
} from '../../util/migrateChartCustomization';

const EMPTY_ARRAY: ChartCustomizationConfiguration = [];
const EMPTY_ACTIVE_TABS: ActiveTabs = [];
const defaultFilterConfiguration: (Filter | Divider)[] = [];

/** Drops chart-customization entries, keeping only native filters and dividers. */
function selectFilterConfiguration(
  nativeFilterConfig: FilterConfigItem[] | undefined,
): (Filter | Divider)[] {
  if (!nativeFilterConfig) {
    return defaultFilterConfiguration;
  }
  return nativeFilterConfig.filter(
    (
      filter: Filter | Divider | ChartCustomization | ChartCustomizationDivider,
    ) =>
      filter.type !== 'CHART_CUSTOMIZATION' &&
      filter.type !== 'CHART_CUSTOMIZATION_DIVIDER',
  ) as (Filter | Divider)[];
}

export function useFilterConfiguration() {
  const nativeFilterConfig = useNativeFilterConfiguration();
  return useMemo(
    () => selectFilterConfiguration(nativeFilterConfig),
    [nativeFilterConfig],
  );
}

export function useChartCustomizations() {
  const filtersMap = useFilterEntries();
  return useMemo(
    (): (ChartCustomization | ChartCustomizationDivider)[] =>
      Object.values(filtersMap).filter(
        (
          item:
            | Filter
            | Divider
            | ChartCustomization
            | ChartCustomizationDivider,
        ): item is ChartCustomization | ChartCustomizationDivider =>
          item?.id != null && isChartCustomizationId(item.id),
      ),
    [filtersMap],
  );
}

function filterCustomizationsForDashboard(
  allCustomizations: ChartCustomizationConfiguration,
  dashboardChartIds: Set<number>,
): ChartCustomizationConfiguration {
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
}

export function useChartCustomizationConfiguration() {
  const allCustomizations = useChartCustomizationConfig() || EMPTY_ARRAY;
  const dashboardLayout = useDashboardLayout();
  return useMemo(() => {
    const dashboardChartIds = new Set(getChartIdsFromLayout(dashboardLayout));
    return filterCustomizationsForDashboard(
      allCustomizations,
      dashboardChartIds,
    );
  }, [allCustomizations, dashboardLayout]);
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
  const storeTabs = useActiveTabs();
  const dashboardLayout = useDashboardLayout();

  return useMemo(() => {
    const storeList = storeTabs ?? [];
    const storeFallback = storeList.length ? storeList : EMPTY_ACTIVE_TABS;
    if (!dashboardLayout) return storeFallback;

    // Tabbed dashboards always nest the top-level TABS container as the first
    // child of ROOT. If that invariant doesn't hold (no-tabs layout), no
    // fallback applies and we use the stored active tabs as-is.
    const root = dashboardLayout[DASHBOARD_ROOT_ID];
    if (!root?.children?.length) return storeFallback;
    const topContainer = dashboardLayout[root.children[0]];
    if (topContainer?.type !== TABS_TYPE || !topContainer.children?.length) {
      return storeFallback;
    }

    // Walk every TABS container along the active path, picking the child the
    // store marks active, else the first child (the default the live Tabs
    // renders). Handles empty activeTabs (hideTab/no permalink → default path),
    // a missing outer ancestor (fill it in so outer-tab scoping holds), and
    // fully populated activeTabs (same result).
    const storeSet = new Set(storeList);
    const result: ActiveTabs = [];
    const queue: string[] = [
      topContainer.children.find(c => storeSet.has(c)) ??
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
          child.children.find(c => storeSet.has(c)) ?? child.children[0],
        );
      }
    }

    // Keep any stored active-tab ids that fell outside the traversed path.
    const resultSet = new Set(result);
    for (const id of storeList) {
      if (!resultSet.has(id)) result.push(id);
    }
    return result;
  }, [storeTabs, dashboardLayout]);
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
