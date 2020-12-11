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
/* eslint camelcase: 0 */
import { DatasourceMeta } from '@superset-ui/chart-controls';
import {
  t,
  SupersetClient,
  DatasourceType,
  QueryFormData,
} from '@superset-ui/core';
import { Dispatch } from 'redux';
import { addDangerToast, toastActions } from 'src/messageToasts/actions';
import { Slice } from 'src/types/Chart';

const FAVESTAR_BASE_URL = '/superset/favstar/slice';

export const SET_DATASOURCE_TYPE = 'SET_DATASOURCE_TYPE';
export function setDatasourceType(datasourceType: DatasourceType) {
  return { type: SET_DATASOURCE_TYPE, datasourceType };
}

export const SET_DATASOURCE = 'SET_DATASOURCE';
export function setDatasource(datasource: DatasourceMeta) {
  return { type: SET_DATASOURCE, datasource };
}

export const SET_DATASOURCES = 'SET_DATASOURCES';
export function setDatasources(datasources: DatasourceMeta[]) {
  return { type: SET_DATASOURCES, datasources };
}

export const POST_DATASOURCE_STARTED = 'POST_DATASOURCE_STARTED';
export const FETCH_DATASOURCE_SUCCEEDED = 'FETCH_DATASOURCE_SUCCEEDED';
export function fetchDatasourceSucceeded() {
  return { type: FETCH_DATASOURCE_SUCCEEDED };
}

export const FETCH_DATASOURCES_STARTED = 'FETCH_DATASOURCES_STARTED';
export function fetchDatasourcesStarted() {
  return { type: FETCH_DATASOURCES_STARTED };
}

export const FETCH_DATASOURCES_SUCCEEDED = 'FETCH_DATASOURCES_SUCCEEDED';
export function fetchDatasourcesSucceeded() {
  return { type: FETCH_DATASOURCES_SUCCEEDED };
}

export const RESET_FIELDS = 'RESET_FIELDS';
export function resetControls() {
  return { type: RESET_FIELDS };
}

export const TOGGLE_FAVE_STAR = 'TOGGLE_FAVE_STAR';
export function toggleFaveStar(isStarred: boolean) {
  return { type: TOGGLE_FAVE_STAR, isStarred };
}

export const FETCH_FAVE_STAR = 'FETCH_FAVE_STAR';
export function fetchFaveStar(sliceId: string) {
  return function (dispatch: Dispatch) {
    SupersetClient.get({
      endpoint: `${FAVESTAR_BASE_URL}/${sliceId}/count`,
    }).then(({ json }) => {
      if (json.count > 0) {
        dispatch(toggleFaveStar(true));
      }
    });
  };
}

export const SAVE_FAVE_STAR = 'SAVE_FAVE_STAR';
export function saveFaveStar(sliceId: string, isStarred: boolean) {
  return function (dispatch: Dispatch) {
    const urlSuffix = isStarred ? 'unselect' : 'select';
    SupersetClient.get({
      endpoint: `${FAVESTAR_BASE_URL}/${sliceId}/${urlSuffix}/`,
    })
      .then(() => dispatch(toggleFaveStar(!isStarred)))
      .catch(() => {
        dispatch(
          addDangerToast(t('An error occurred while starring this chart')),
        );
      });
  };
}

export const SET_FIELD_VALUE = 'SET_FIELD_VALUE';
export function setControlValue(
  controlName: string,
  value: any,
  validationErrors: any[],
) {
  return { type: SET_FIELD_VALUE, controlName, value, validationErrors };
}

export const SET_EXPLORE_CONTROLS = 'UPDATE_EXPLORE_CONTROLS';
export function setExploreControls(formData: QueryFormData) {
  return { type: SET_EXPLORE_CONTROLS, formData };
}

export const REMOVE_CONTROL_PANEL_ALERT = 'REMOVE_CONTROL_PANEL_ALERT';
export function removeControlPanelAlert() {
  return { type: REMOVE_CONTROL_PANEL_ALERT };
}

export const UPDATE_CHART_TITLE = 'UPDATE_CHART_TITLE';
export function updateChartTitle(sliceName: string) {
  return { type: UPDATE_CHART_TITLE, sliceName };
}

export const CREATE_NEW_SLICE = 'CREATE_NEW_SLICE';
export function createNewSlice(
  can_add: boolean,
  can_download: boolean,
  can_overwrite: boolean,
  slice: Slice,
  form_data: QueryFormData,
) {
  return {
    type: CREATE_NEW_SLICE,
    can_add,
    can_download,
    can_overwrite,
    slice,
    form_data,
  };
}

export const SLICE_UPDATED = 'SLICE_UPDATED';
export function sliceUpdated(slice: Slice) {
  return { type: SLICE_UPDATED, slice };
}

export const exploreActions = {
  ...toastActions,
  setDatasourceType,
  setDatasource,
  setDatasources,
  fetchDatasourcesStarted,
  fetchDatasourcesSucceeded,
  resetControls,
  toggleFaveStar,
  fetchFaveStar,
  saveFaveStar,
  setControlValue,
  setExploreControls,
  removeControlPanelAlert,
  updateChartTitle,
  createNewSlice,
  sliceUpdated,
};

export type ExploreActions = typeof exploreActions;
