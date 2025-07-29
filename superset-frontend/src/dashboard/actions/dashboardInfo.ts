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
import { Dispatch, AnyAction } from 'redux';
import { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { makeApi, t, getClientErrorObject } from '@superset-ui/core';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { getFormData } from 'src/dashboard/components/nativeFilters/utils';
import {
  ChartConfiguration,
  DashboardInfo,
  FilterBarOrientation,
  GlobalChartCrossFilterConfig,
  RootState,
} from 'src/dashboard/types';
import {
  ChartCustomizationItem,
  FilterOption,
} from 'src/dashboard/components/nativeFilters/ChartCustomization/types';
import { removeDataMask, updateDataMask } from 'src/dataMask/actions';
import { onSave } from './dashboardState';

const createUpdateDashboardApi = (id: number | string | undefined) => {
  if (!id) {
    throw new Error('Dashboard ID is required');
  }
  return makeApi<
    Partial<DashboardInfo>,
    { result: Partial<DashboardInfo>; last_modified_time: number }
  >({
    method: 'PUT',
    endpoint: `/api/v1/dashboard/${id}`,
  });
};

export interface ChartCustomizationSavePayload {
  id: string;
  title?: string;
  description?: string;
  removed?: boolean;
  chartId?: number;
  customization: {
    name: string;
    dataset:
      | string
      | number
      | {
          value: string | number;
          label?: string;
          table_name?: string;
          schema?: string;
        }
      | null;
    datasetInfo?: {
      label: string;
      value: number;
      table_name: string;
    };
    column: string | string[] | null;
    description?: string;
    sortFilter?: boolean;
    sortAscending?: boolean;
    sortMetric?: string;
    hasDefaultValue?: boolean;
    defaultValue?: string;
    isRequired?: boolean;
    selectFirst?: boolean;
    defaultDataMask?: any;
    defaultValueQueriesData?: any;
    aggregation?: string;
    canSelectMultiple?: boolean;
  };
}

export const DASHBOARD_INFO_UPDATED = 'DASHBOARD_INFO_UPDATED';
export const DASHBOARD_INFO_FILTERS_CHANGED = 'DASHBOARD_INFO_FILTERS_CHANGED';

// updates partially changed dashboard info
export function dashboardInfoChanged(newInfo: Partial<DashboardInfo>) {
  return { type: DASHBOARD_INFO_UPDATED, newInfo };
}

export function nativeFiltersConfigChanged(newInfo: Record<string, any>) {
  return { type: DASHBOARD_INFO_FILTERS_CHANGED, newInfo };
}

export const SAVE_CHART_CONFIG_BEGIN = 'SAVE_CHART_CONFIG_BEGIN';
export const SAVE_CHART_CONFIG_COMPLETE = 'SAVE_CHART_CONFIG_COMPLETE';
export const SAVE_CHART_CONFIG_FAIL = 'SAVE_CHART_CONFIG_FAIL';

export const saveChartConfiguration =
  ({
    chartConfiguration,
    globalChartConfiguration,
  }: {
    chartConfiguration?: ChartConfiguration;
    globalChartConfiguration?: GlobalChartCrossFilterConfig;
  }) =>
  async (dispatch: Dispatch, getState: () => RootState) => {
    dispatch({
      type: SAVE_CHART_CONFIG_BEGIN,
      chartConfiguration,
      globalChartConfiguration,
    });
    const { id, metadata } = getState().dashboardInfo;

    const updateDashboard = createUpdateDashboardApi(id);

    try {
      const response = await updateDashboard({
        json_metadata: JSON.stringify({
          ...metadata,
          chart_configuration:
            chartConfiguration ?? metadata.chart_configuration,
          global_chart_configuration:
            globalChartConfiguration ?? metadata.global_chart_configuration,
        }),
      });
      dispatch(
        dashboardInfoChanged({
          metadata: JSON.parse(response.result.json_metadata || '{}'),
        }),
      );
      dispatch({
        type: SAVE_CHART_CONFIG_COMPLETE,
        chartConfiguration,
        globalChartConfiguration,
      });
    } catch (err) {
      dispatch({
        type: SAVE_CHART_CONFIG_FAIL,
        chartConfiguration,
        globalChartConfiguration,
      });
      dispatch(addDangerToast(t('Failed to save cross-filter scoping')));
    }
  };

export const SET_FILTER_BAR_ORIENTATION = 'SET_FILTER_BAR_ORIENTATION';

export function setFilterBarOrientation(
  filterBarOrientation: FilterBarOrientation,
) {
  return { type: SET_FILTER_BAR_ORIENTATION, filterBarOrientation };
}

export const SET_CROSS_FILTERS_ENABLED = 'SET_CROSS_FILTERS_ENABLED';

export function setCrossFiltersEnabled(crossFiltersEnabled: boolean) {
  return { type: SET_CROSS_FILTERS_ENABLED, crossFiltersEnabled };
}

export const SAVE_CHART_CUSTOMIZATION_COMPLETE =
  'SAVE_CHART_CUSTOMIZATION_COMPLETE';

export function setChartCustomization(
  chartCustomization: ChartCustomizationItem[],
) {
  return { type: SAVE_CHART_CUSTOMIZATION_COMPLETE, chartCustomization };
}

export const SET_DASHBOARD_THEME = 'SET_DASHBOARD_THEME';

export function setDashboardTheme(theme: { id: number; name: string } | null) {
  return { type: SET_DASHBOARD_THEME, theme };
}

export function updateDashboardTheme(themeId: number | null) {
  return async (dispatch: Dispatch, getState: () => RootState) => {
    const { id } = getState().dashboardInfo;
    const updateDashboard = createUpdateDashboardApi(id);

    try {
      const response = await updateDashboard({
        theme_id: themeId,
      });

      // Update the dashboard info with the new theme
      if (themeId === null) {
        // Clearing the theme
        dispatch(setDashboardTheme(null));
      } else if (response.result.theme) {
        // API returned the theme object
        dispatch(setDashboardTheme(response.result.theme));
      } else {
        // API didn't return theme object, create it from the themeId
        dispatch(setDashboardTheme({ id: themeId, name: `Theme ${themeId}` }));
      }

      const lastModifiedTime = response.last_modified_time;
      if (lastModifiedTime) {
        dispatch(onSave(lastModifiedTime));
      }
    } catch (errorObject) {
      const { error } = await getClientErrorObject(errorObject);
      dispatch(
        addDangerToast(
          t(
            'Sorry, there was an error saving this dashboard: %s',
            error || 'Bad Request',
          ),
        ),
      );
      throw errorObject;
    }
  };
}

export function saveFilterBarOrientation(orientation: FilterBarOrientation) {
  return async (dispatch: Dispatch, getState: () => RootState) => {
    const { id, metadata } = getState().dashboardInfo;
    const updateDashboard = createUpdateDashboardApi(id);
    try {
      const response = await updateDashboard({
        json_metadata: JSON.stringify({
          ...metadata,
          filter_bar_orientation: orientation,
        }),
      });
      const updatedDashboard = response.result;
      const lastModifiedTime = response.last_modified_time;
      if (updatedDashboard.json_metadata) {
        const metadata = JSON.parse(updatedDashboard.json_metadata);
        if (metadata.filter_bar_orientation) {
          dispatch(setFilterBarOrientation(metadata.filter_bar_orientation));
        }
      }
      if (lastModifiedTime) {
        dispatch(onSave(lastModifiedTime));
      }
    } catch (errorObject) {
      const { error } = await getClientErrorObject(errorObject);
      dispatch(
        addDangerToast(
          t(
            'Sorry, there was an error saving this dashboard: %s',
            error || 'Bad Request',
          ),
        ),
      );
      throw errorObject;
    }
  };
}

export function saveCrossFiltersSetting(crossFiltersEnabled: boolean) {
  return async function saveCrossFiltersSettingThunk(
    dispatch: Dispatch,
    getState: () => RootState,
  ) {
    const { id, metadata } = getState().dashboardInfo;
    dispatch(setCrossFiltersEnabled(crossFiltersEnabled));
    const updateDashboard = createUpdateDashboardApi(id);

    try {
      const response = await updateDashboard({
        json_metadata: JSON.stringify({
          ...metadata,
          cross_filters_enabled: crossFiltersEnabled,
        }),
      });
      dispatch(
        dashboardInfoChanged({
          metadata: JSON.parse(response.result.json_metadata || '{}'),
        }),
      );
      return response;
    } catch (err) {
      dispatch(addDangerToast(t('Failed to save cross-filters setting')));
      throw err;
    }
  };
}

export function saveChartCustomization(
  chartCustomizationItems: ChartCustomizationSavePayload[],
): ThunkAction<Promise<any>, RootState, null, AnyAction> {
  return async function (
    dispatch: ThunkDispatch<RootState, null, AnyAction>,
    getState: () => RootState,
  ) {
    const { id, metadata, json_metadata } = getState().dashboardInfo;

    const currentState = getState();
    const currentChartCustomizationItems =
      currentState.dashboardInfo.metadata?.chart_customization_config || [];

    const existingItemsMap = new Map(
      currentChartCustomizationItems.map(item => [item.id, item]),
    );

    const updatedItemsMap = new Map(existingItemsMap);

    chartCustomizationItems.forEach(newItem => {
      if (newItem.removed) {
        updatedItemsMap.delete(newItem.id);
      } else {
        const chartCustomizationItem: ChartCustomizationItem = {
          id: newItem.id,
          title: newItem.title,
          removed: newItem.removed,
          chartId: newItem.chartId,
          customization: newItem.customization,
        };
        updatedItemsMap.set(newItem.id, chartCustomizationItem);
      }
    });

    const simpleItems = Array.from(updatedItemsMap.values());

    const updateDashboard = createUpdateDashboardApi(id);

    try {
      let parsedMetadata: any = {};
      try {
        parsedMetadata = json_metadata ? JSON.parse(json_metadata) : metadata;
      } catch (e) {
        console.error('Error parsing json_metadata:', e);
        parsedMetadata = metadata || {};
      }

      const updatedMetadata = {
        ...parsedMetadata,
        native_filter_configuration: (
          parsedMetadata.native_filter_configuration || []
        ).filter(
          (item: any) =>
            !(
              item.type === 'CHART_CUSTOMIZATION' &&
              item.id === 'chart_customization_groupby'
            ),
        ),
        chart_customization_config: simpleItems,
      };

      const response = await updateDashboard({
        json_metadata: JSON.stringify(updatedMetadata),
      });

      const updatedDashboard = response.result;
      const lastModifiedTime = response.last_modified_time;

      if (updatedDashboard.json_metadata) {
        dispatch(setChartCustomization(simpleItems));

        const removedItems = currentChartCustomizationItems.filter(
          existingItem => !updatedItemsMap.has(existingItem.id),
        );

        removedItems.forEach(removedItem => {
          const customizationFilterId = `chart_customization_${removedItem.id}`;
          dispatch(removeDataMask(customizationFilterId));
        });

        simpleItems.forEach(item => {
          const customizationFilterId = `chart_customization_${item.id}`;

          if (item.customization?.column) {
            dispatch(removeDataMask(customizationFilterId));

            const dataMask = {
              extraFormData: {},
              filterState: {
                value:
                  item.customization?.defaultDataMask?.filterState?.value || [],
              },
              ownState: {
                column: item.customization.column,
              },
            };
            dispatch(updateDataMask(customizationFilterId, dataMask));
          } else {
            dispatch(removeDataMask(customizationFilterId));
          }
        });
      }

      if (lastModifiedTime) {
        dispatch(onSave(lastModifiedTime));
      }

      return response;
    } catch (errorObject) {
      console.error('Error saving chart customization:', errorObject);
      const { error } = await getClientErrorObject(errorObject);
      dispatch(
        addDangerToast(error || t('Failed to save chart customization')),
      );
      throw errorObject;
    }
  };
}

export const INITIALIZE_CHART_CUSTOMIZATION = 'INITIALIZE_CHART_CUSTOMIZATION';
export interface InitializeChartCustomization {
  type: typeof INITIALIZE_CHART_CUSTOMIZATION;
  chartCustomizationItems: ChartCustomizationItem[];
}

export function initializeChartCustomization(
  chartCustomizationItems: ChartCustomizationItem[],
): ThunkAction<void, RootState, null, AnyAction> {
  return (dispatch: ThunkDispatch<RootState, null, AnyAction>) => {
    dispatch({
      type: INITIALIZE_CHART_CUSTOMIZATION,
      chartCustomizationItems,
    });

    chartCustomizationItems.forEach(item => {
      const customizationFilterId = `chart_customization_${item.id}`;

      if (item.customization?.column) {
        dispatch(removeDataMask(customizationFilterId));

        const dataMask = {
          extraFormData: {},
          filterState: {
            value:
              item.customization?.defaultDataMask?.filterState?.value || [],
          },
          ownState: {
            column: item.customization.column,
          },
        };
        dispatch(updateDataMask(customizationFilterId, dataMask));
      } else {
        dispatch(removeDataMask(customizationFilterId));
      }
    });
  };
}

export const SET_CHART_CUSTOMIZATION_DATA_LOADING =
  'SET_CHART_CUSTOMIZATION_DATA_LOADING';
export interface SetChartCustomizationDataLoading {
  type: typeof SET_CHART_CUSTOMIZATION_DATA_LOADING;
  itemId: string;
  isLoading: boolean;
}

export function setChartCustomizationDataLoading(
  itemId: string,
  isLoading: boolean,
): SetChartCustomizationDataLoading {
  return {
    type: SET_CHART_CUSTOMIZATION_DATA_LOADING,
    itemId,
    isLoading,
  };
}

export const SET_CHART_CUSTOMIZATION_DATA = 'SET_CHART_CUSTOMIZATION_DATA';
export interface SetChartCustomizationData {
  type: typeof SET_CHART_CUSTOMIZATION_DATA;
  itemId: string;
  data: FilterOption[];
}

export function setChartCustomizationData(
  itemId: string,
  data: FilterOption[],
): SetChartCustomizationData {
  return {
    type: SET_CHART_CUSTOMIZATION_DATA,
    itemId,
    data,
  };
}

export function loadChartCustomizationData(
  itemId: string,
  datasetId: string,
  columnName: string | string[],
): ThunkAction<Promise<void>, RootState, null, AnyAction> {
  return async (dispatch: ThunkDispatch<RootState, null, AnyAction>) => {
    if (!datasetId || !columnName) {
      return;
    }

    const actualColumnName = Array.isArray(columnName)
      ? columnName[0]
      : columnName;

    if (!actualColumnName) {
      return;
    }

    dispatch(setChartCustomizationDataLoading(itemId, true));

    try {
      const formData = getFormData({
        datasetId: Number(datasetId),
        groupby: actualColumnName,
        dashboardId: 0,
        filterType: 'filter_select',
      });

      const response = await getChartDataRequest({
        formData,
      });

      if (response?.json?.result) {
        const data = response.json.result[0]?.data || [];
        const uniqueValues = new Set();
        const formattedData: FilterOption[] = [];

        data.forEach((row: any) => {
          const value = row[actualColumnName];
          if (
            value !== null &&
            value !== undefined &&
            !uniqueValues.has(value)
          ) {
            uniqueValues.add(value);
            formattedData.push({
              label: value.toString(),
              value: value.toString(),
            });
          }
        });

        formattedData.sort((a, b) => a.label.localeCompare(b.label));
        dispatch(setChartCustomizationData(itemId, formattedData));
      } else {
        dispatch(setChartCustomizationData(itemId, []));
      }
    } catch (error) {
      console.warn('Failed to load chart customization data:', error);
      dispatch(setChartCustomizationData(itemId, []));
    } finally {
      dispatch(setChartCustomizationDataLoading(itemId, false));
    }
  };
}

export const SET_PENDING_CHART_CUSTOMIZATION =
  'SET_PENDING_CHART_CUSTOMIZATION';
export interface SetPendingChartCustomization {
  type: typeof SET_PENDING_CHART_CUSTOMIZATION;
  pendingCustomization: ChartCustomizationSavePayload;
}

export function setPendingChartCustomization(
  pendingCustomization: ChartCustomizationSavePayload,
): SetPendingChartCustomization {
  return {
    type: SET_PENDING_CHART_CUSTOMIZATION,
    pendingCustomization,
  };
}

export const CLEAR_PENDING_CHART_CUSTOMIZATION =
  'CLEAR_PENDING_CHART_CUSTOMIZATION';
export interface ClearPendingChartCustomization {
  type: typeof CLEAR_PENDING_CHART_CUSTOMIZATION;
  itemId: string;
}

export function clearPendingChartCustomization(
  itemId: string,
): ClearPendingChartCustomization {
  return {
    type: CLEAR_PENDING_CHART_CUSTOMIZATION,
    itemId,
  };
}

export const CLEAR_ALL_PENDING_CHART_CUSTOMIZATIONS =
  'CLEAR_ALL_PENDING_CHART_CUSTOMIZATIONS';
export interface ClearAllPendingChartCustomizations {
  type: typeof CLEAR_ALL_PENDING_CHART_CUSTOMIZATIONS;
}

export function clearAllPendingChartCustomizations(): ClearAllPendingChartCustomizations {
  return {
    type: CLEAR_ALL_PENDING_CHART_CUSTOMIZATIONS,
  };
}

export const CLEAR_ALL_CHART_CUSTOMIZATIONS = 'CLEAR_ALL_CHART_CUSTOMIZATIONS';
export interface ClearAllChartCustomizations {
  type: typeof CLEAR_ALL_CHART_CUSTOMIZATIONS;
}

export function clearAllChartCustomizations(): ClearAllChartCustomizations {
  return {
    type: CLEAR_ALL_CHART_CUSTOMIZATIONS,
  };
}

export function clearAllChartCustomizationsFromMetadata() {
  return clearAllChartCustomizations();
}

export type AnyDashboardInfoAction =
  | ReturnType<typeof dashboardInfoChanged>
  | ReturnType<typeof nativeFiltersConfigChanged>
  | ReturnType<typeof setFilterBarOrientation>
  | ReturnType<typeof setCrossFiltersEnabled>
  | ReturnType<typeof setChartCustomization>
  | InitializeChartCustomization
  | SetChartCustomizationDataLoading
  | SetChartCustomizationData
  | SetPendingChartCustomization
  | ClearPendingChartCustomization
  | ClearAllPendingChartCustomizations
  | ClearAllChartCustomizations;
