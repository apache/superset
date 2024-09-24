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
import { Dispatch } from 'redux';
import { makeApi, t, getErrorText } from '@superset-ui/core';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import {
  ChartConfiguration,
  DashboardInfo,
  FilterBarOrientation,
  GlobalChartCrossFilterConfig,
  RootState,
} from 'src/dashboard/types';
import { onSave } from './dashboardState';

export const DASHBOARD_INFO_UPDATED = 'DASHBOARD_INFO_UPDATED';

// updates partially changed dashboard info
export function dashboardInfoChanged(newInfo: { metadata: any }) {
  return { type: DASHBOARD_INFO_UPDATED, newInfo };
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
      const errorText = await getErrorText(errorObject, 'dashboard');
      dispatch(addDangerToast(errorText));
      throw errorObject;
    }
  };
}

export function saveCrossFiltersSetting(crossFiltersEnabled: boolean) {
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
          cross_filters_enabled: crossFiltersEnabled,
        }),
      });
      const updatedDashboard = response.result;
      const lastModifiedTime = response.last_modified_time;
      if (updatedDashboard.json_metadata) {
        const metadata = JSON.parse(updatedDashboard.json_metadata);
        dispatch(setCrossFiltersEnabled(metadata.cross_filters_enabled));
      }
      if (lastModifiedTime) {
        dispatch(onSave(lastModifiedTime));
      }
    } catch (errorObject) {
      const errorText = await getErrorText(errorObject, 'dashboard');
      dispatch(addDangerToast(errorText));
      throw errorObject;
    }
  };
}
