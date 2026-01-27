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
import { t } from '@apache-superset/core';
import { SupersetClient, QueryFormData } from '@superset-ui/core';
import { Dispatch } from 'redux';
import { ActionCreators as UndoActionCreators } from 'redux-undo';
import { isEqual } from 'lodash';
import {
  addDangerToast,
  toastActions,
} from 'src/components/MessageToasts/actions';
import { Slice } from 'src/types/Chart';
import { SaveActionType } from 'src/explore/types';
import {
  updateQueryFormData,
  renderTriggered,
} from 'src/components/Chart/chartAction';
import { getFormDataFromControls } from 'src/explore/controlUtils';

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

/**
 * Helper function to detect if the change between two control states
 * involves only renderTrigger controls (visual-only changes).
 *
 * @param controlsBefore - Control state before the change
 * @param controlsAfter - Control state after the change
 * @returns true if we should trigger a re-render (all changes are renderTrigger)
 */
function detectRenderTriggerChange(
  controlsBefore: Record<string, any>,
  controlsAfter: Record<string, any>,
): boolean {
  // Find all controls that changed
  const changedControlKeys = Object.keys(controlsAfter).filter(key => {
    const before = controlsBefore[key];
    const after = controlsAfter[key];

    if (!before || !after) return false;

    // Compare values
    return !isEqual(before.value, after.value);
  });

  if (changedControlKeys.length === 0) {
    return false; // Nothing changed
  }

  // Check if ALL changed controls have renderTrigger: true
  const allAreRenderTrigger = changedControlKeys.every(
    key => controlsAfter[key].renderTrigger === true,
  );

  return allAreRenderTrigger;
}

/**
 * Undo an explore action and sync chart state.
 *
 * This handles two scenarios:
 * 1. If the undone change was a renderTrigger control (visual-only),
 *    trigger a chart re-render without fetching new data
 * 2. If the undone change was a data control (metrics, filters, etc.),
 *    just update the state - user must click "Update Chart" to query
 */
export function undoExploreAction() {
  return (dispatch: Dispatch, getState: () => any) => {
    // 1. Get the current state BEFORE undo (to detect what changed)
    const stateBefore = getState();
    const exploreBefore = stateBefore.explore.present;

    // 2. Perform the undo
    dispatch(UndoActionCreators.undo());

    // 3. Get the state AFTER undo
    const stateAfter = getState();
    const exploreAfter = stateAfter.explore.present;

    // 4. Get chart ID from the slice or charts state
    const chartId =
      exploreAfter.slice?.slice_id || Object.keys(stateAfter.charts)[0];

    // 5. Sync chart state with undone explore state
    const newFormData = getFormDataFromControls(exploreAfter.controls);
    dispatch(updateQueryFormData(newFormData, chartId));

    // 6. Detect if the undone change was a renderTrigger control
    const shouldReRender = detectRenderTriggerChange(
      exploreBefore.controls,
      exploreAfter.controls,
    );

    if (shouldReRender) {
      // Only visual changes - trigger re-render without fetching data
      dispatch(renderTriggered(new Date().getTime(), chartId));
    }
    // Note: If it's a data change, we DON'T auto-trigger query
    // The chart will show as "stale" and user can click "Update Chart"
  };
}

/**
 * Redo an explore action and sync chart state.
 */
export function redoExploreAction() {
  return (dispatch: Dispatch, getState: () => any) => {
    // 1. Get the current state BEFORE redo
    const stateBefore = getState();
    const exploreBefore = stateBefore.explore.present;

    // 2. Perform the redo
    dispatch(UndoActionCreators.redo());

    // 3. Get the state AFTER redo
    const stateAfter = getState();
    const exploreAfter = stateAfter.explore.present;

    // 4. Get chart ID
    const chartId =
      exploreAfter.slice?.slice_id || Object.keys(stateAfter.charts)[0];

    // 5. Sync chart state
    const newFormData = getFormDataFromControls(exploreAfter.controls);
    dispatch(updateQueryFormData(newFormData, chartId));

    // 6. Detect if the redone change was a renderTrigger control
    const shouldReRender = detectRenderTriggerChange(
      exploreBefore.controls,
      exploreAfter.controls,
    );

    if (shouldReRender) {
      dispatch(renderTriggered(new Date().getTime(), chartId));
    }
  };
}

/**
 * Clear explore undo/redo history.
 */
export function clearExploreHistory() {
  return UndoActionCreators.clearHistory();
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
  undoExploreAction,
  redoExploreAction,
  clearExploreHistory,
};

export type ExploreActions = typeof exploreActions;
