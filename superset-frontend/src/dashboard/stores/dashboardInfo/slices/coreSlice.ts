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

import type { StateCreator } from 'zustand';
import type { DashboardInfo, FilterConfigItem } from 'src/dashboard/types';
import type { DashboardInfoStore, DashboardInfoData } from '../types';
import { nowInSeconds, preserveScopes } from './helpers';
import type { DashboardMetadata } from './helpers';

export interface CoreSlice {
  /**
   * Typed as the full DashboardInfo for consumer ergonomics; the store holds
   * an empty object until hydration, matching the former Redux RootState.
   */
  dashboardInfo: DashboardInfo;
  /** Partially merges changed dashboard info, preserving refreshed scopes. */
  setDashboardInfo: (newInfo: Partial<DashboardInfo>) => void;
  /** Replaces native_filter_configuration, preserving existing scopes. */
  setNativeFiltersConfig: (newConfig: FilterConfigItem[]) => void;
  /** Seeds the store from the dashboard hydration payload. */
  hydrateDashboardInfo: (incoming: DashboardInfoData) => void;
}

export const coreInitialState = {
  dashboardInfo: {} as DashboardInfo,
};

export const createCoreSlice: StateCreator<
  DashboardInfoStore,
  [['zustand/devtools', never], ['zustand/subscribeWithSelector', never]],
  [],
  CoreSlice
> = set => ({
  ...coreInitialState,

  setDashboardInfo: newInfo =>
    set(
      state => {
        // undefined = "no change"; null still clears.
        const cleanedInfo = Object.fromEntries(
          Object.entries(newInfo).filter(([, v]) => v !== undefined),
        ) as Partial<DashboardInfo>;
        const incomingMeta = cleanedInfo.metadata;
        return {
          dashboardInfo: {
            ...state.dashboardInfo,
            ...cleanedInfo,
            ...(incomingMeta && {
              metadata: {
                ...incomingMeta,
                ...(incomingMeta.native_filter_configuration && {
                  native_filter_configuration: preserveScopes(
                    state.dashboardInfo.metadata?.native_filter_configuration,
                    incomingMeta.native_filter_configuration,
                  ),
                }),
                ...(incomingMeta.chart_customization_config && {
                  chart_customization_config: preserveScopes(
                    state.dashboardInfo.metadata?.chart_customization_config,
                    incomingMeta.chart_customization_config,
                  ),
                }),
              },
            }),
            last_modified_time: nowInSeconds(),
          },
        };
      },
      false,
      'dashboardInfo/setDashboardInfo',
    ),

  setNativeFiltersConfig: newConfig =>
    set(
      state => {
        const existingConfig =
          state.dashboardInfo.metadata?.native_filter_configuration || [];
        const existingScopesMap = existingConfig.reduce<
          Record<string, { chartsInScope?: number[]; tabsInScope?: string[] }>
        >((acc, filter) => {
          if (filter.chartsInScope != null || filter.tabsInScope != null) {
            acc[filter.id] = {
              chartsInScope: filter.chartsInScope,
              tabsInScope: filter.tabsInScope,
            };
          }
          return acc;
        }, {});

        const newConfigWithScopes = (newConfig || []).map(filter => {
          const existingScopes = existingScopesMap[filter.id];
          if (filter.chartsInScope == null && existingScopes) {
            return {
              ...filter,
              chartsInScope: existingScopes.chartsInScope,
              tabsInScope: existingScopes.tabsInScope,
            };
          }
          return filter;
        });

        return {
          dashboardInfo: {
            ...state.dashboardInfo,
            metadata: {
              ...state.dashboardInfo.metadata,
              native_filter_configuration: newConfigWithScopes,
            } as DashboardMetadata,
            last_modified_time: nowInSeconds(),
          },
        };
      },
      false,
      'dashboardInfo/setNativeFiltersConfig',
    ),

  hydrateDashboardInfo: incoming =>
    set(
      state => {
        const incomingMetadata = incoming.metadata;
        const mergedFilterConfig = preserveScopes(
          state.dashboardInfo.metadata?.native_filter_configuration,
          incomingMetadata?.native_filter_configuration,
        );
        const mergedCustomizationConfig = preserveScopes(
          state.dashboardInfo.metadata?.chart_customization_config,
          incomingMetadata?.chart_customization_config,
        );

        return {
          dashboardInfo: {
            ...state.dashboardInfo,
            ...incoming,
            metadata: {
              ...incomingMetadata,
              native_filter_configuration: mergedFilterConfig,
              chart_customization_config: mergedCustomizationConfig,
            } as DashboardMetadata,
            pendingChartCustomizations: {},
          },
        };
      },
      false,
      'dashboardInfo/hydrateDashboardInfo',
    ),
});
