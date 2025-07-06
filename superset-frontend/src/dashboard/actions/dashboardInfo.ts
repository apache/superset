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
import {
  getChartDataRequest,
  refreshChart,
} from 'src/components/Chart/chartAction';
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
import { removeDataMask } from 'src/dataMask/actions';
import { onSave } from './dashboardState';

export interface ChartCustomizationSavePayload {
  id: string;
  title?: string;
  description?: string;
  removed?: boolean;
  chartId?: number;
  customization: {
    name: string;
    dataset: string | null;
    datasetInfo?: {
      label: string;
      value: number;
      table_name: string;
    };
    column: string | null;
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

    // TODO extract this out when makeApi supports url parameters
    const updateDashboard = makeApi<
      Partial<DashboardInfo>,
      { result: DashboardInfo }
    >({
      method: 'PUT',
      endpoint: `/api/v1/dashboard/${id}`,
    });

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
          metadata: JSON.parse(response.result.json_metadata),
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

function getAffectedChartIdsFromCustomization(
  chartCustomization: ChartCustomizationItem[],
  state: any,
): number[] {
  const targetDatasets = chartCustomization
    .map(item => item.customization?.dataset)
    .filter(dataset => dataset !== null && dataset !== undefined) as string[];

  const charts = state.charts || {};
  if (targetDatasets.length === 0) {
    return [];
  }

  return Object.keys(charts)
    .filter(id => {
      const chart = charts[id];
      if (
        !chart?.latestQueryFormData ||
        Object.keys(chart.latestQueryFormData).length === 0
      ) {
        return false;
      }

      const chartDataset = chart.latestQueryFormData.datasource;
      if (!chartDataset) {
        return false;
      }

      const chartDatasetParts = String(chartDataset).split('__');
      const chartDatasetId = chartDatasetParts[0];

      return targetDatasets.some(targetDataset => {
        const targetDatasetId = String(targetDataset);

        return chartDatasetId === targetDatasetId;
      });
    })
    .map(id => parseInt(id, 10));
}

export function setChartCustomization(
  chartCustomization: ChartCustomizationItem[],
) {
  return { type: SAVE_CHART_CUSTOMIZATION_COMPLETE, chartCustomization };
}

export function saveFilterBarOrientation(orientation: FilterBarOrientation) {
  return async (dispatch: Dispatch, getState: () => RootState) => {
    const { id, metadata } = getState().dashboardInfo;
    const updateDashboard = makeApi<
      Partial<DashboardInfo>,
      { result: Partial<DashboardInfo>; last_modified_time: number }
    >({
      method: 'PUT',
      endpoint: `/api/v1/dashboard/${id}`,
    });
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
    const updateDashboard = makeApi<
      Partial<DashboardInfo>,
      { result: DashboardInfo }
    >({
      method: 'PUT',
      endpoint: `/api/v1/dashboard/${id}`,
    });

    try {
      const response = await updateDashboard({
        json_metadata: JSON.stringify({
          ...metadata,
          cross_filters_enabled: crossFiltersEnabled,
        }),
      });
      dispatch(
        dashboardInfoChanged({
          metadata: JSON.parse(response.result.json_metadata),
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

    const removedItems = currentChartCustomizationItems.filter(
      currentItem =>
        !chartCustomizationItems.some(
          newItem => newItem.id === currentItem.id,
        ) ||
        chartCustomizationItems.some(
          newItem => newItem.id === currentItem.id && newItem.removed,
        ),
    );

    const simpleItems = chartCustomizationItems
      .filter(item => !item.removed)
      .map(item => ({
        id: item.id,
        title: item.title || '[untitled]',
        chartId: item.chartId,
        customization: {
          name: item.customization?.name || '',
          dataset: item.customization?.dataset || null,
          datasetInfo: item.customization?.datasetInfo,
          column: item.customization?.column || null,
          description: item.customization?.description,
          sortFilter: !!item.customization?.sortFilter,
          sortAscending: item.customization?.sortAscending !== false,
          sortMetric: item.customization?.sortMetric || undefined,
          hasDefaultValue: !!item.customization?.hasDefaultValue,
          defaultValue: item.customization?.defaultValue,
          isRequired: !!item.customization?.isRequired,
          selectFirst: !!item.customization?.selectFirst,
          defaultDataMask: item.customization?.defaultDataMask,
          defaultValueQueriesData: item.customization?.defaultValueQueriesData,
        },
      }));

    const updateDashboard = makeApi<
      Partial<DashboardInfo>,
      { result: Partial<DashboardInfo>; last_modified_time: number }
    >({
      method: 'PUT',
      endpoint: `/api/v1/dashboard/${id}`,
    });

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

        removedItems.forEach(removedItem => {
          const customizationFilterId = `chart_customization_${removedItem.id}`;
          dispatch(removeDataMask(customizationFilterId));
        });

        const state = getState();
        const affectedChartIds = getAffectedChartIdsFromCustomization(
          simpleItems,
          state,
        );

        removedItems.forEach(removedItem => {
          if (removedItem.chartId) {
            affectedChartIds.push(removedItem.chartId);
          }
        });

        const uniqueAffectedChartIds = [...new Set(affectedChartIds)];

        uniqueAffectedChartIds.forEach(chartId => {
          const chart = state.charts[chartId];
          if (
            chart?.latestQueryFormData &&
            Object.keys(chart.latestQueryFormData).length > 0
          ) {
            dispatch(refreshChart(chartId));
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
): InitializeChartCustomization {
  return {
    type: INITIALIZE_CHART_CUSTOMIZATION,
    chartCustomizationItems,
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
  columnName: string,
): ThunkAction<Promise<void>, RootState, null, AnyAction> {
  return async (dispatch: ThunkDispatch<RootState, null, AnyAction>) => {
    if (!datasetId || !columnName) {
      return;
    }

    dispatch(setChartCustomizationDataLoading(itemId, true));

    try {
      const formData = getFormData({
        datasetId: Number(datasetId),
        groupby: columnName,
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
          const value = row[columnName];
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

export type AnyDashboardInfoAction =
  | ReturnType<typeof dashboardInfoChanged>
  | ReturnType<typeof nativeFiltersConfigChanged>
  | ReturnType<typeof setFilterBarOrientation>
  | ReturnType<typeof setCrossFiltersEnabled>
  | ReturnType<typeof setChartCustomization>
  | InitializeChartCustomization
  | SetChartCustomizationDataLoading
  | SetChartCustomizationData;
