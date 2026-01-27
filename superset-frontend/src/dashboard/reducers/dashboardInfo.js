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
  DASHBOARD_INFO_UPDATED,
  SET_FILTER_BAR_ORIENTATION,
  SET_CROSS_FILTERS_ENABLED,
  DASHBOARD_INFO_FILTERS_CHANGED,
} from '../actions/dashboardInfo';
import {
  SAVE_CHART_CUSTOMIZATION_COMPLETE,
  SET_CHART_CUSTOMIZATION_DATA_LOADING,
  SET_CHART_CUSTOMIZATION_DATA,
  SET_PENDING_CHART_CUSTOMIZATION,
  CLEAR_PENDING_CHART_CUSTOMIZATION,
  CLEAR_ALL_PENDING_CHART_CUSTOMIZATIONS,
  CLEAR_ALL_CHART_CUSTOMIZATIONS,
} from '../actions/chartCustomizationActions';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';

export default function dashboardStateReducer(state = {}, action) {
  switch (action.type) {
    case DASHBOARD_INFO_UPDATED: {
      const { theme_id: themeId, ...otherInfo } = action.newInfo;
      const updatedState = {
        ...state,
        ...otherInfo,
        last_modified_time: Math.round(new Date().getTime() / 1000),
      };

      if (themeId !== undefined) {
        if (themeId === null) {
          updatedState.theme = null;
        } else {
          updatedState.theme = { id: themeId, name: `Theme ${themeId}` };
        }
      }

      return updatedState;
    }
    case DASHBOARD_INFO_FILTERS_CHANGED: {
      const existingConfig = state.metadata?.native_filter_configuration || [];
      const existingScopesMap = existingConfig.reduce((acc, filter) => {
        if (filter.chartsInScope != null || filter.tabsInScope != null) {
          acc[filter.id] = {
            chartsInScope: filter.chartsInScope,
            tabsInScope: filter.tabsInScope,
          };
        }
        return acc;
      }, {});

      const newConfigWithScopes = action.newInfo.map(filter => {
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
        ...state,
        metadata: {
          ...state.metadata,
          native_filter_configuration: newConfigWithScopes,
        },
        last_modified_time: Math.round(new Date().getTime() / 1000),
      };
    }
    case HYDRATE_DASHBOARD: {
      const preserveScopes = (existingConfig, incomingConfig) => {
        const existingScopesMap = (existingConfig || []).reduce((acc, item) => {
          if (item.chartsInScope != null || item.tabsInScope != null) {
            acc[item.id] = {
              chartsInScope: item.chartsInScope,
              tabsInScope: item.tabsInScope,
            };
          }
          return acc;
        }, {});

        return (incomingConfig || []).map(item => {
          const existingScopes = existingScopesMap[item.id];
          if (item.chartsInScope == null && existingScopes) {
            return {
              ...item,
              chartsInScope: existingScopes.chartsInScope,
              tabsInScope: existingScopes.tabsInScope,
            };
          }
          return item;
        });
      };

      const incomingMetadata = action.data.dashboardInfo.metadata || {};

      const mergedFilterConfig = preserveScopes(
        state.metadata?.native_filter_configuration,
        incomingMetadata.native_filter_configuration,
      );

      const mergedCustomizationConfig = preserveScopes(
        state.metadata?.chart_customization_config,
        incomingMetadata.chart_customization_config,
      );

      return {
        ...state,
        ...action.data.dashboardInfo,
        metadata: {
          ...incomingMetadata,
          native_filter_configuration: mergedFilterConfig,
          chart_customization_config: mergedCustomizationConfig,
        },
        pendingChartCustomizations: {},
      };
    }
    case SET_FILTER_BAR_ORIENTATION:
      return {
        ...state,
        filterBarOrientation: action.filterBarOrientation,
      };
    case SET_CROSS_FILTERS_ENABLED:
      return {
        ...state,
        crossFiltersEnabled: action.crossFiltersEnabled,
      };
    case SAVE_CHART_CUSTOMIZATION_COMPLETE:
      return {
        ...state,
        metadata: {
          ...state.metadata,
          native_filter_configuration: (
            state.metadata?.native_filter_configuration || []
          ).filter(
            item =>
              !(
                item.type === 'CHART_CUSTOMIZATION' &&
                item.id === 'chart_customization_groupby'
              ),
          ),
          chart_customization_config: action.chartCustomization,
        },
        last_modified_time: Math.round(new Date().getTime() / 1000),
      };
    case SET_CHART_CUSTOMIZATION_DATA_LOADING:
      return {
        ...state,
        chartCustomizationLoading: {
          ...state.chartCustomizationLoading,
          [action.itemId]: action.isLoading,
        },
      };
    case SET_CHART_CUSTOMIZATION_DATA:
      return {
        ...state,
        chartCustomizationData: {
          ...state.chartCustomizationData,
          [action.itemId]: action.data,
        },
      };
    case SET_PENDING_CHART_CUSTOMIZATION:
      return {
        ...state,
        pendingChartCustomizations: {
          ...state.pendingChartCustomizations,
          [action.pendingCustomization.id]: action.pendingCustomization,
        },
      };
    case CLEAR_PENDING_CHART_CUSTOMIZATION:
      return {
        ...state,
        pendingChartCustomizations: {
          ...state.pendingChartCustomizations,
          [action.itemId]: undefined,
        },
      };
    case CLEAR_ALL_PENDING_CHART_CUSTOMIZATIONS:
      return {
        ...state,
        pendingChartCustomizations: {},
      };
    case CLEAR_ALL_CHART_CUSTOMIZATIONS:
      return {
        ...state,
        metadata: {
          ...state.metadata,
          chart_customization_config:
            state.metadata?.chart_customization_config?.map(customization => ({
              ...customization,
              targets: customization.targets?.map(target => ({
                datasetId: target.datasetId,
              })),
            })) || [],
        },
        last_modified_time: Math.round(new Date().getTime() / 1000),
      };
    default:
      return state;
  }
}
