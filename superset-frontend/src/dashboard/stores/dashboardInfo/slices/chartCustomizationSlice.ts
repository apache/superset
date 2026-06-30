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
import type {
  ChartCustomization,
  ChartCustomizationDivider,
  ColumnOption,
} from '@superset-ui/core';
import type { DashboardInfoStore } from '../types';
import { nowInSeconds } from './helpers';
import type { DashboardMetadata } from './helpers';

export interface ChartCustomizationSlice {
  setChartCustomizationComplete: (
    chartCustomization: (ChartCustomization | ChartCustomizationDivider)[],
  ) => void;
  setChartCustomizationDataLoading: (
    itemId: string,
    isLoading: boolean,
  ) => void;
  setChartCustomizationData: (itemId: string, data: ColumnOption[]) => void;
  setPendingChartCustomization: (pending: ChartCustomization) => void;
  clearPendingChartCustomization: (itemId: string) => void;
  clearAllPendingChartCustomizations: () => void;
  clearAllChartCustomizations: () => void;
}

export const createChartCustomizationSlice: StateCreator<
  DashboardInfoStore,
  [['zustand/devtools', never], ['zustand/subscribeWithSelector', never]],
  [],
  ChartCustomizationSlice
> = set => ({
  setChartCustomizationComplete: chartCustomization =>
    set(
      state => ({
        dashboardInfo: {
          ...state.dashboardInfo,
          metadata: {
            ...state.dashboardInfo.metadata,
            native_filter_configuration: (
              state.dashboardInfo.metadata?.native_filter_configuration || []
            ).filter(
              item =>
                !(
                  item.type === 'CHART_CUSTOMIZATION' &&
                  item.id === 'chart_customization_groupby'
                ),
            ),
            chart_customization_config: chartCustomization,
          } as DashboardMetadata,
          last_modified_time: nowInSeconds(),
        },
      }),
      false,
      'dashboardInfo/setChartCustomizationComplete',
    ),

  setChartCustomizationDataLoading: (itemId, isLoading) =>
    set(
      state => ({
        dashboardInfo: {
          ...state.dashboardInfo,
          chartCustomizationLoading: {
            ...state.dashboardInfo.chartCustomizationLoading,
            [itemId]: isLoading,
          },
        },
      }),
      false,
      'dashboardInfo/setChartCustomizationDataLoading',
    ),

  setChartCustomizationData: (itemId, data) =>
    set(
      state => ({
        dashboardInfo: {
          ...state.dashboardInfo,
          chartCustomizationData: {
            ...state.dashboardInfo.chartCustomizationData,
            [itemId]: data,
          },
        },
      }),
      false,
      'dashboardInfo/setChartCustomizationData',
    ),

  setPendingChartCustomization: pending =>
    set(
      state => ({
        dashboardInfo: {
          ...state.dashboardInfo,
          pendingChartCustomizations: {
            ...state.dashboardInfo.pendingChartCustomizations,
            [pending.id]: pending,
          },
        },
      }),
      false,
      'dashboardInfo/setPendingChartCustomization',
    ),

  clearPendingChartCustomization: itemId =>
    set(
      state => {
        const pendingChartCustomizations = {
          ...state.dashboardInfo.pendingChartCustomizations,
        };
        delete pendingChartCustomizations[itemId];
        return {
          dashboardInfo: {
            ...state.dashboardInfo,
            pendingChartCustomizations,
          },
        };
      },
      false,
      'dashboardInfo/clearPendingChartCustomization',
    ),

  clearAllPendingChartCustomizations: () =>
    set(
      state => ({
        dashboardInfo: {
          ...state.dashboardInfo,
          pendingChartCustomizations: {},
        },
      }),
      false,
      'dashboardInfo/clearAllPendingChartCustomizations',
    ),

  clearAllChartCustomizations: () =>
    set(
      state => {
        const customizationConfig = (
          state.dashboardInfo.metadata?.chart_customization_config || []
        ).filter(Boolean);
        return {
          dashboardInfo: {
            ...state.dashboardInfo,
            metadata: {
              ...state.dashboardInfo.metadata,
              chart_customization_config: customizationConfig.map(
                customization => ({
                  ...customization,
                  targets: customization.targets?.map(target => ({
                    datasetId: target.datasetId,
                  })),
                }),
              ),
            } as DashboardMetadata,
            last_modified_time: nowInSeconds(),
          },
        };
      },
      false,
      'dashboardInfo/clearAllChartCustomizations',
    ),
});
