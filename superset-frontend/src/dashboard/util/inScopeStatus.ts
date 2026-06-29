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
import { FilterConfiguration } from '@superset-ui/core';
import { cloneDeep } from 'lodash';
import {
  useNativeFiltersStore,
  useDashboardInfoStore,
  type FilterEntry,
} from 'src/dashboard/stores';

/** Writes each native filter's computed in-scope charts/tabs into the native-filters and dashboardInfo stores. */
export function setInScopeStatusOfFilters(
  filterScopes: {
    filterId: string;
    chartsInScope: number[];
    tabsInScope: string[];
  }[],
): void {
  const { filters } = useNativeFiltersStore.getState();
  const filtersWithScopes = filterScopes.map(scope => ({
    ...filters[scope.filterId],
    chartsInScope: scope.chartsInScope,
    tabsInScope: scope.tabsInScope,
  }));
  useNativeFiltersStore
    .getState()
    .setInScopeStatus(filtersWithScopes as FilterEntry[]);
  const metadata = cloneDeep(
    useDashboardInfoStore.getState().dashboardInfo.metadata,
  );
  const filterConfig =
    (metadata.native_filter_configuration as FilterConfiguration) || [];
  const mergedFilterConfig = filterConfig.map(filter => {
    const filterWithScope = filtersWithScopes.find(
      scope => scope.id === filter.id,
    );
    if (!filterWithScope) {
      return filter;
    }
    return {
      ...filter,
      chartsInScope: filterWithScope.chartsInScope,
      tabsInScope: filterWithScope.tabsInScope,
    };
  });
  metadata.native_filter_configuration = mergedFilterConfig;
  useDashboardInfoStore.getState().setDashboardInfo({ metadata });
}

/** Same as setInScopeStatusOfFilters but for chart customizations. */
export function setInScopeStatusOfCustomizations(
  customizationScopes: {
    customizationId: string;
    chartsInScope: number[];
    tabsInScope: string[];
  }[],
): void {
  const { filters } = useNativeFiltersStore.getState();

  const scopeConfig = customizationScopes
    .map(({ customizationId, chartsInScope, tabsInScope }) => {
      const existing = filters[customizationId];
      if (!existing) return null;
      return {
        ...existing,
        chartsInScope,
        tabsInScope,
      };
    })
    .filter(Boolean);

  if (scopeConfig.length > 0) {
    useNativeFiltersStore
      .getState()
      .setInScopeStatus(scopeConfig as FilterEntry[]);
  }

  const { metadata } = useDashboardInfoStore.getState().dashboardInfo;
  const customizationConfig =
    metadata?.chart_customization_config?.filter(Boolean) || [];

  const scopeMap = new Map(
    customizationScopes.map(
      ({ customizationId, chartsInScope, tabsInScope }) => [
        customizationId,
        { chartsInScope, tabsInScope },
      ],
    ),
  );

  const updatedConfig = customizationConfig.map(customization => {
    const scope = scopeMap.get(customization.id);
    if (!scope) {
      return customization;
    }
    return {
      ...customization,
      chartsInScope: scope.chartsInScope,
      tabsInScope: scope.tabsInScope,
    };
  });

  useDashboardInfoStore.getState().setDashboardInfo({
    metadata: {
      ...metadata,
      chart_customization_config: updatedConfig,
    },
  });
}
