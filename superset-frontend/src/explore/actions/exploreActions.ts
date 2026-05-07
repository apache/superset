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
import rison from 'rison';
import { Dataset } from '@superset-ui/chart-controls';
import { t, SupersetClient, QueryFormData } from '@superset-ui/core';
import { Dispatch } from 'redux';
import {
  addDangerToast,
  toastActions,
} from 'src/components/MessageToasts/actions';
import { Slice } from 'src/types/Chart';
import { SaveActionType } from 'src/explore/types';

export const UPDATE_FORM_DATA_BY_DATASOURCE = 'UPDATE_FORM_DATA_BY_DATASOURCE';
export function updateFormDataByDatasource(
  prevDatasource: Dataset,
  newDatasource: Dataset,
) {
  return {
    type: UPDATE_FORM_DATA_BY_DATASOURCE,
    prevDatasource,
    newDatasource,
  };
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

export const TOGGLE_FAVE_STAR = 'TOGGLE_FAVE_STAR';
export function toggleFaveStar(isStarred: boolean) {
  return { type: TOGGLE_FAVE_STAR, isStarred };
}

export const FETCH_FAVE_STAR = 'FETCH_FAVE_STAR';
export function fetchFaveStar(sliceId: string) {
  return function (dispatch: Dispatch) {
    SupersetClient.get({
      endpoint: `/api/v1/chart/favorite_status/?q=${rison.encode([sliceId])}`,
    }).then(({ json }) => {
      dispatch(toggleFaveStar(!!json?.result?.[0]?.value));
    });
  };
}

export const SAVE_FAVE_STAR = 'SAVE_FAVE_STAR';
export function saveFaveStar(sliceId: string, isStarred: boolean) {
  return function (dispatch: Dispatch) {
    const endpoint = `/api/v1/chart/${sliceId}/favorites/`;
    const apiCall = isStarred
      ? SupersetClient.delete({
          endpoint,
        })
      : SupersetClient.post({ endpoint });

    apiCall
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
  validationErrors?: any[],
) {
  return { type: SET_FIELD_VALUE, controlName, value, validationErrors };
}

export const SET_EXPLORE_CONTROLS = 'UPDATE_EXPLORE_CONTROLS';
export function setExploreControls(formData: QueryFormData) {
  return { type: SET_EXPLORE_CONTROLS, formData };
}

export const SET_FORM_DATA = 'UPDATE_FORM_DATA';
export function setFormData(formData: QueryFormData) {
  return { type: SET_FORM_DATA, formData };
}

export const UPDATE_CHART_TITLE = 'UPDATE_CHART_TITLE';
export function updateChartTitle(sliceName: string) {
  return { type: UPDATE_CHART_TITLE, sliceName };
}

export const SET_SAVE_ACTION = 'SET_SAVE_ACTION';
export function setSaveAction(saveAction: SaveActionType | null) {
  return { type: SET_SAVE_ACTION, saveAction };
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

export const SET_FORCE_QUERY = 'SET_FORCE_QUERY';
export function setForceQuery(force: boolean) {
  return {
    type: SET_FORCE_QUERY,
    force,
  };
}

export const SET_STASH_FORM_DATA = 'SET_STASH_FORM_DATA';
export function setStashFormData(
  isHidden: boolean,
  fieldNames: ReadonlyArray<string>,
) {
  return {
    type: SET_STASH_FORM_DATA,
    isHidden,
    fieldNames,
  };
}

export const START_METADATA_LOADING = 'START_METADATA_LOADING';
export function startMetaDataLoading() {
  return { type: START_METADATA_LOADING };
}

export const STOP_METADATA_LOADING = 'STOP_METADATA_LOADING';
export function stopMetaDataLoading() {
  return { type: STOP_METADATA_LOADING };
}

export const SYNC_DATASOURCE_METADATA = 'SYNC_DATASOURCE_METADATA';
export function syncDatasourceMetadata(datasource: Dataset) {
  return { type: SYNC_DATASOURCE_METADATA, datasource };
}

export const exploreActions = {
  ...toastActions,
  fetchDatasourcesStarted,
  fetchDatasourcesSucceeded,
  toggleFaveStar,
  fetchFaveStar,
  saveFaveStar,
  setControlValue,
  setExploreControls,
  setStashFormData,
  updateChartTitle,
  createNewSlice,
  sliceUpdated,
  setForceQuery,
  syncDatasourceMetadata,
};

export type ExploreActions = typeof exploreActions;
