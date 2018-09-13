/* eslint camelcase: 0 */
const $ = window.$ = require('jquery');

const FAVESTAR_BASE_URL = '/superset/favstar/slice';

export const SET_DATASOURCE_TYPE = 'SET_DATASOURCE_TYPE';
export function setDatasourceType(datasourceType) {
  return { type: SET_DATASOURCE_TYPE, datasourceType };
}

export const SET_DATASOURCE = 'SET_DATASOURCE';
export function setDatasource(datasource) {
  return { type: SET_DATASOURCE, datasource };
}

export const SET_DATASOURCES = 'SET_DATASOURCES';
export function setDatasources(datasources) {
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

export const FETCH_DATASOURCES_FAILED = 'FETCH_DATASOURCES_FAILED';
export function fetchDatasourcesFailed(error) {
  return { type: FETCH_DATASOURCES_FAILED, error };
}


export const POST_DATASOURCES_FAILED = 'POST_DATASOURCES_FAILED';
export function postDatasourcesFailed(error) {
  return { type: POST_DATASOURCES_FAILED, error };
}

export const RESET_FIELDS = 'RESET_FIELDS';
export function resetControls() {
  return { type: RESET_FIELDS };
}

export function fetchDatasources() {
  return function (dispatch) {
    dispatch(fetchDatasourcesStarted());
    const url = '/superset/datasources/';
    $.ajax({
      type: 'GET',
      url,
      success: (data) => {
        dispatch(setDatasources(data));
        dispatch(fetchDatasourcesSucceeded());
      },
      error(error) {
        dispatch(fetchDatasourcesFailed(error.responseJSON.error));
      },
    });
  };
}

export const TOGGLE_FAVE_STAR = 'TOGGLE_FAVE_STAR';
export function toggleFaveStar(isStarred) {
  return { type: TOGGLE_FAVE_STAR, isStarred };
}

export const FETCH_FAVE_STAR = 'FETCH_FAVE_STAR';
export function fetchFaveStar(sliceId) {
  return function (dispatch) {
    const url = `${FAVESTAR_BASE_URL}/${sliceId}/count`;
    $.get(url, (data) => {
      if (data.count > 0) {
        dispatch(toggleFaveStar(true));
      }
    });
  };
}

export const SAVE_FAVE_STAR = 'SAVE_FAVE_STAR';
export function saveFaveStar(sliceId, isStarred) {
  return function (dispatch) {
    const urlSuffix = isStarred ? 'unselect' : 'select';
    const url = `${FAVESTAR_BASE_URL}/${sliceId}/${urlSuffix}/`;
    $.get(url);
    dispatch(toggleFaveStar(!isStarred));
  };
}

export const SET_FIELD_VALUE = 'SET_FIELD_VALUE';
export function setControlValue(controlName, value, validationErrors) {
  return { type: SET_FIELD_VALUE, controlName, value, validationErrors };
}

export const UPDATE_EXPLORE_ENDPOINTS = 'UPDATE_EXPLORE_ENDPOINTS';
export function updateExploreEndpoints(jsonUrl, csvUrl, standaloneUrl) {
  return { type: UPDATE_EXPLORE_ENDPOINTS, jsonUrl, csvUrl, standaloneUrl };
}

export const SET_EXPLORE_CONTROLS = 'UPDATE_EXPLORE_CONTROLS';
export function setExploreControls(formData) {
  return { type: SET_EXPLORE_CONTROLS, formData };
}

export const REMOVE_CONTROL_PANEL_ALERT = 'REMOVE_CONTROL_PANEL_ALERT';
export function removeControlPanelAlert() {
  return { type: REMOVE_CONTROL_PANEL_ALERT };
}

export const UPDATE_CHART_TITLE = 'UPDATE_CHART_TITLE';
export function updateChartTitle(slice_name) {
  return { type: UPDATE_CHART_TITLE, slice_name };
}

export const CREATE_NEW_SLICE = 'CREATE_NEW_SLICE';
export function createNewSlice(can_add, can_download, can_overwrite, slice, form_data) {
  return { type: CREATE_NEW_SLICE, can_add, can_download, can_overwrite, slice, form_data };
}
