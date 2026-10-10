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
import { t } from '@apache-superset/core/translation';
import {
  DatasourceType,
  makeApi,
  getClientErrorObject,
} from '@superset-ui/core';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import {
  ChartConfiguration,
  DashboardInfo,
  FilterBarOrientation,
  GlobalChartCrossFilterConfig,
  RootState,
} from 'src/dashboard/types';
import { onSave } from './dashboardState';

const createUpdateDashboardApi = (id: number) =>
  makeApi<
    Partial<DashboardInfo>,
    { result: Partial<DashboardInfo>; last_modified_time: number }
  >({
    method: 'PUT',
    endpoint: `/api/v1/dashboard/${id}`,
  });

export const DASHBOARD_SAVE_SUCCEEDED = 'DASHBOARD_SAVE_SUCCEEDED';

export function dashboardSaveSucceeded(dashboardId: number) {
  return { type: DASHBOARD_SAVE_SUCCEEDED, dashboardId };
}

export const DASHBOARD_INFO_UPDATED = 'DASHBOARD_INFO_UPDATED';
export const DASHBOARD_INFO_FILTERS_CHANGED = 'DASHBOARD_INFO_FILTERS_CHANGED';
export const REPLACE_DASHBOARD_SEMANTIC_DATASETS =
  'REPLACE_DASHBOARD_SEMANTIC_DATASETS';
export const UPDATE_DASHBOARD_SEMANTIC_DATASET =
  'UPDATE_DASHBOARD_SEMANTIC_DATASET';

type SemanticDataset = NonNullable<
  DashboardInfo['semanticDatasets']
>['datasets'][number];

const SEMANTIC_SOURCE_KEY_RE = new RegExp(
  `^([1-9]\\d*)__${DatasourceType.SemanticView}$`,
);

export function provenSemanticDataset(
  value: unknown,
  sourceKey: string,
): SemanticDataset | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SemanticDataset> & { id?: number };
  const sourceId = SEMANTIC_SOURCE_KEY_RE.exec(sourceKey)?.[1];
  if (
    !sourceId ||
    candidate.type !== DatasourceType.SemanticView ||
    !Array.isArray(candidate.columns) ||
    !candidate.columns.every(
      (column: unknown) =>
        column !== null &&
        typeof column === 'object' &&
        'column_name' in column &&
        typeof column.column_name === 'string',
    ) ||
    (candidate.id !== undefined && candidate.id !== Number(sourceId)) ||
    (candidate.uid !== sourceKey && candidate.id === undefined)
  ) {
    return null;
  }
  // The metadata endpoint uses provider identity for uid; dashboard charts
  // use the integer datasource key. A matching id proves this normalization.
  return { ...candidate, uid: sourceKey } as SemanticDataset;
}

export function provenSemanticDatasets(
  value: unknown,
): SemanticDataset[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .map((candidate: unknown) => {
      if (
        !candidate ||
        typeof candidate !== 'object' ||
        !('uid' in candidate)
      ) {
        return null;
      }
      return provenSemanticDataset(candidate, String(candidate.uid));
    })
    .filter((candidate): candidate is SemanticDataset => candidate !== null);
}

export function replaceDashboardSemanticDatasets(
  dashboardId: number,
  datasets: SemanticDataset[] | null,
  requestId?: string,
  isRefreshStart = false,
  expectedGeneration?: number,
) {
  return {
    type: REPLACE_DASHBOARD_SEMANTIC_DATASETS,
    dashboardId,
    datasets,
    requestId,
    isRefreshStart,
    expectedGeneration,
  };
}

export function updateDashboardSemanticDataset(
  dashboardId: number,
  sourceKey: string,
  dataset: SemanticDataset | null,
  requestId?: string,
  isRefreshStart = false,
) {
  return {
    type: UPDATE_DASHBOARD_SEMANTIC_DATASET,
    dashboardId,
    sourceKey,
    dataset,
    requestId,
    isRefreshStart,
  };
}

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
      dispatch(dashboardSaveSucceeded(id));
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

    const previousCrossFiltersEnabled =
      getState().dashboardInfo.crossFiltersEnabled;

    dispatch(setCrossFiltersEnabled(crossFiltersEnabled));
    const updateDashboard = createUpdateDashboardApi(id);

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

      dispatch(
        dashboardInfoChanged({
          metadata: JSON.parse(response.result.json_metadata || '{}'),
        }),
      );
      return response;
    } catch (err) {
      dispatch(setCrossFiltersEnabled(previousCrossFiltersEnabled));
      dispatch(addDangerToast(t('Failed to save cross-filters setting')));
      throw err;
    }
  };
}
