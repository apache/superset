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
  ChartCustomization,
  ChartCustomizationDivider,
  ColumnOption,
} from '@superset-ui/core';
import {
  DASHBOARD_INFO_UPDATED,
  DASHBOARD_SAVE_SUCCEEDED,
  SET_FILTER_BAR_ORIENTATION,
  SET_CROSS_FILTERS_ENABLED,
  DASHBOARD_INFO_FILTERS_CHANGED,
  REPLACE_DASHBOARD_SEMANTIC_DATASETS,
  UPDATE_DASHBOARD_SEMANTIC_DATASET,
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
import {
  DashboardInfo,
  FilterBarOrientation,
  FilterConfigItem,
} from '../types';

type SemanticDatasets = NonNullable<
  DashboardInfo['semanticDatasets']
>['datasets'];

interface DashboardInfoAction {
  type: string;
  newInfo?: Partial<DashboardInfo>;
  filterBarOrientation?: FilterBarOrientation;
  crossFiltersEnabled?: boolean;
  chartCustomization?: (ChartCustomization | ChartCustomizationDivider)[];
  itemId?: string;
  isLoading?: boolean;
  data?: ColumnOption[];
  pendingCustomization?: ChartCustomization;
  dashboardId?: number;
  datasets?: SemanticDatasets | null;
  sourceKey?: string;
  dataset?: SemanticDatasets[number] | null;
  requestId?: string;
  isRefreshStart?: boolean;
  expectedGeneration?: number;
  [key: string]: unknown;
}

export interface HydrateDashboardInfoAction {
  type: typeof HYDRATE_DASHBOARD;
  data: {
    dashboardInfo: DashboardInfo;
    [key: string]: unknown;
  };
}

type DashboardInfoReducerAction =
  | DashboardInfoAction
  | HydrateDashboardInfoAction;

type DashboardInfoState = Partial<DashboardInfo> & {
  last_modified_time?: number;
  versionHistoryRevision?: number;
  [key: string]: unknown;
};

function isHydrateAction(
  action: DashboardInfoReducerAction,
): action is HydrateDashboardInfoAction {
  return action.type === HYDRATE_DASHBOARD;
}

/** Base shape for items that can have scopes preserved */
interface ScopedConfigItem {
  id: string;
  chartsInScope?: number[];
  tabsInScope?: string[];
}

function preserveScopes<T extends ScopedConfigItem>(
  existingConfig: T[] | undefined,
  incomingConfig: T[] | undefined,
): T[] {
  const truthyExistingConfig = (existingConfig || []).filter(Boolean);
  const truthyIncomingConfig = (incomingConfig || []).filter(Boolean);

  const existingScopesMap = truthyExistingConfig.reduce<
    Record<string, { chartsInScope?: number[]; tabsInScope?: string[] }>
  >((acc, item) => {
    if (item.chartsInScope != null || item.tabsInScope != null) {
      acc[item.id] = {
        chartsInScope: item.chartsInScope,
        tabsInScope: item.tabsInScope,
      };
    }
    return acc;
  }, {});

  return truthyIncomingConfig.map(item => {
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
}

export default function dashboardInfoReducer(
  state: DashboardInfoState = {},
  action: DashboardInfoReducerAction,
): DashboardInfoState {
  switch (action.type) {
    case REPLACE_DASHBOARD_SEMANTIC_DATASETS: {
      const {
        dashboardId,
        datasets,
        requestId,
        isRefreshStart,
        expectedGeneration,
      } = action as DashboardInfoAction;
      if (dashboardId === undefined || dashboardId !== state.id) {
        return state;
      }
      if (isRefreshStart && !requestId) return state;
      const currentGeneration = state.semanticDatasetsGeneration ?? 0;
      const pageGeneration = expectedGeneration ?? 0;
      if (
        !isRefreshStart &&
        (state.semanticDatasetsRequestId !== requestId ||
          (!requestId &&
            (pageGeneration > currentGeneration ||
              pageGeneration < (state.semanticDatasetsSaveGeneration ?? 0) ||
              (datasets === null && pageGeneration !== currentGeneration))))
      ) {
        return state;
      }
      const pageModifiedKeys = new Set(
        !requestId
          ? [
              ...Object.entries(state.semanticDatasetMutationGenerations ?? {})
                .filter(([, generation]) => generation > pageGeneration)
                .map(([sourceKey]) => sourceKey),
              ...Object.keys(state.semanticDatasetRequests ?? {}),
            ]
          : [],
      );
      const overrides = state.semanticDatasetOverrides ?? {};
      const mergedDatasets =
        datasets &&
        (requestId
          ? [
              ...datasets.filter(source => !(source.uid in overrides)),
              ...Object.values(overrides).filter(
                (source): source is SemanticDatasets[number] => source !== null,
              ),
            ]
          : [
              ...datasets.filter(source => !pageModifiedKeys.has(source.uid)),
              ...(state.semanticDatasets?.datasets ?? []).filter(source =>
                pageModifiedKeys.has(source.uid),
              ),
            ]);
      return {
        ...state,
        semanticDatasets: mergedDatasets
          ? { dashboardId, datasets: mergedDatasets }
          : null,
        semanticDatasetsRequestId: isRefreshStart ? requestId : undefined,
        semanticDatasetRequests: isRefreshStart
          ? {}
          : state.semanticDatasetRequests,
        semanticDatasetOverrides: isRefreshStart ? {} : undefined,
        semanticDatasetsGeneration: currentGeneration + (requestId ? 1 : 0),
        semanticDatasetsSaveGeneration: requestId
          ? currentGeneration + 1
          : state.semanticDatasetsSaveGeneration,
      };
    }
    case UPDATE_DASHBOARD_SEMANTIC_DATASET: {
      const { dashboardId, sourceKey, dataset, requestId, isRefreshStart } =
        action as DashboardInfoAction;
      if (dashboardId === undefined || dashboardId !== state.id || !sourceKey) {
        return state;
      }
      if (isRefreshStart && !requestId) return state;
      if (
        !isRefreshStart &&
        (state.semanticDatasetRequests?.[sourceKey] !== requestId ||
          (!requestId && state.semanticDatasetsRequestId !== undefined))
      ) {
        return state;
      }
      const sourceRequests = { ...state.semanticDatasetRequests };
      if (isRefreshStart && requestId) {
        sourceRequests[sourceKey] = requestId;
      } else {
        delete sourceRequests[sourceKey];
      }
      const overrides = { ...state.semanticDatasetOverrides };
      if (isRefreshStart) {
        delete overrides[sourceKey];
      } else if (state.semanticDatasetsRequestId) {
        overrides[sourceKey] = dataset ?? null;
      }
      const previous =
        state.semanticDatasets &&
        state.semanticDatasets.dashboardId === dashboardId
          ? state.semanticDatasets.datasets
          : [];
      return {
        ...state,
        semanticDatasets: {
          dashboardId,
          datasets: [
            ...previous.filter(source => source.uid !== sourceKey),
            ...(dataset ? [dataset] : []),
          ],
        },
        semanticDatasetsRequestId: state.semanticDatasetsRequestId,
        semanticDatasetRequests: sourceRequests,
        semanticDatasetOverrides: overrides,
        semanticDatasetsGeneration: (state.semanticDatasetsGeneration ?? 0) + 1,
        semanticDatasetMutationGenerations: {
          ...state.semanticDatasetMutationGenerations,
          [sourceKey]: (state.semanticDatasetsGeneration ?? 0) + 1,
        },
      };
    }
    case DASHBOARD_SAVE_SUCCEEDED:
      return (action as DashboardInfoAction).dashboardId === state.id
        ? {
            ...state,
            versionHistoryRevision: (state.versionHistoryRevision ?? 0) + 1,
          }
        : state;
    case DASHBOARD_INFO_UPDATED: {
      const dashAction = action as DashboardInfoAction;
      const newInfo = dashAction.newInfo || {};
      const incomingMeta = newInfo.metadata;
      return {
        ...state,
        ...newInfo,
        // Preserve client-only scope data (chartsInScope, tabsInScope) when
        // metadata is refreshed from the server, matching HYDRATE_DASHBOARD.
        ...(incomingMeta && {
          metadata: {
            ...incomingMeta,
            ...(incomingMeta.native_filter_configuration && {
              native_filter_configuration: preserveScopes(
                state.metadata?.native_filter_configuration,
                incomingMeta.native_filter_configuration,
              ),
            }),
            ...(incomingMeta.chart_customization_config && {
              chart_customization_config: preserveScopes(
                state.metadata?.chart_customization_config,
                incomingMeta.chart_customization_config,
              ),
            }),
          },
        }),
        last_modified_time: Math.round(new Date().getTime() / 1000),
      };
    }
    case DASHBOARD_INFO_FILTERS_CHANGED: {
      const dashAction = action as DashboardInfoAction;
      const existingConfig = state.metadata?.native_filter_configuration || [];
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

      const newConfigWithScopes = (
        (dashAction.newInfo as FilterConfigItem[]) || []
      ).map((filter: FilterConfigItem) => {
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
        } as DashboardInfo['metadata'],
        last_modified_time: Math.round(new Date().getTime() / 1000),
        versionHistoryRevision: (state.versionHistoryRevision ?? 0) + 1,
      };
    }
    case HYDRATE_DASHBOARD: {
      if (!isHydrateAction(action)) return state;
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
        semanticDatasets:
          state.semanticDatasets?.dashboardId === action.data.dashboardInfo.id
            ? state.semanticDatasets
            : null,
        semanticDatasetsRequestId:
          state.id === action.data.dashboardInfo.id ||
          state.semanticDatasets?.dashboardId === action.data.dashboardInfo.id
            ? state.semanticDatasetsRequestId
            : undefined,
        // A remount's page load supersedes add requests from the previous mount.
        semanticDatasetRequests: {},
        semanticDatasetOverrides:
          state.id === action.data.dashboardInfo.id ||
          state.semanticDatasets?.dashboardId === action.data.dashboardInfo.id
            ? state.semanticDatasetOverrides
            : {},
        semanticDatasetsGeneration:
          state.id === action.data.dashboardInfo.id ||
          state.semanticDatasets?.dashboardId === action.data.dashboardInfo.id
            ? state.semanticDatasetsGeneration
            : 0,
        semanticDatasetsSaveGeneration:
          state.id === action.data.dashboardInfo.id ||
          state.semanticDatasets?.dashboardId === action.data.dashboardInfo.id
            ? state.semanticDatasetsSaveGeneration
            : 0,
        semanticDatasetMutationGenerations:
          state.id === action.data.dashboardInfo.id ||
          state.semanticDatasets?.dashboardId === action.data.dashboardInfo.id
            ? state.semanticDatasetMutationGenerations
            : {},
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
        filterBarOrientation: (action as DashboardInfoAction)
          .filterBarOrientation,
      };
    case SET_CROSS_FILTERS_ENABLED:
      return {
        ...state,
        crossFiltersEnabled: (action as DashboardInfoAction)
          .crossFiltersEnabled,
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
          chart_customization_config: (action as DashboardInfoAction)
            .chartCustomization,
        } as DashboardInfo['metadata'],
        last_modified_time: Math.round(new Date().getTime() / 1000),
      };
    case SET_CHART_CUSTOMIZATION_DATA_LOADING: {
      const dashAction = action as DashboardInfoAction;
      return {
        ...state,
        chartCustomizationLoading: {
          ...state.chartCustomizationLoading,
          [dashAction.itemId as string]: dashAction.isLoading as boolean,
        },
      };
    }
    case SET_CHART_CUSTOMIZATION_DATA: {
      const dashAction = action as DashboardInfoAction;
      return {
        ...state,
        chartCustomizationData: {
          ...state.chartCustomizationData,
          [dashAction.itemId as string]: dashAction.data as ColumnOption[],
        },
      };
    }
    case SET_PENDING_CHART_CUSTOMIZATION: {
      const dashAction = action as DashboardInfoAction;
      const pendingCustomization =
        dashAction.pendingCustomization as ChartCustomization;
      return {
        ...state,
        pendingChartCustomizations: {
          ...state.pendingChartCustomizations,
          [pendingCustomization.id]: pendingCustomization,
        },
      };
    }
    case CLEAR_PENDING_CHART_CUSTOMIZATION: {
      const dashAction = action as DashboardInfoAction;
      const pendingCopy = { ...state.pendingChartCustomizations };
      delete pendingCopy[dashAction.itemId as string];
      return {
        ...state,
        pendingChartCustomizations: pendingCopy,
      };
    }
    case CLEAR_ALL_PENDING_CHART_CUSTOMIZATIONS:
      return {
        ...state,
        pendingChartCustomizations: {},
      };
    case CLEAR_ALL_CHART_CUSTOMIZATIONS: {
      const customizationConfig = (
        state.metadata?.chart_customization_config || []
      ).filter(Boolean);
      return {
        ...state,
        metadata: {
          ...state.metadata,
          chart_customization_config: customizationConfig.map(
            customization => ({
              ...customization,
              targets: customization.targets?.map(target => ({
                datasetId: target.datasetId,
                datasourceType: target.datasourceType,
              })),
            }),
          ),
        } as DashboardInfo['metadata'],
        last_modified_time: Math.round(new Date().getTime() / 1000),
      };
    }
    default:
      return state;
  }
}
