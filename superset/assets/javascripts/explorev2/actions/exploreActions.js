/* eslint camelcase: 0 */
const $ = window.$ = require('jquery');
const FAVESTAR_BASE_URL = '/superset/favstar/slice';
import { getExploreUrl } from '../exploreUtils';

export const SET_DATASOURCE_TYPE = 'SET_DATASOURCE_TYPE';
export function setDatasourceType(datasourceType) {
  return { type: SET_DATASOURCE_TYPE, datasourceType };
}

export const SET_DATASOURCE = 'SET_DATASOURCE';
export function setDatasource(datasource) {
  return { type: SET_DATASOURCE, datasource };
}

export const FETCH_STARTED = 'FETCH_STARTED';
export function fetchStarted() {
  return { type: FETCH_STARTED };
}

export const FETCH_SUCCEEDED = 'FETCH_SUCCEEDED';
export function fetchSucceeded() {
  return { type: FETCH_SUCCEEDED };
}

export const FETCH_FAILED = 'FETCH_FAILED';
export function fetchFailed(error) {
  return { type: FETCH_FAILED, error };
}

export function fetchDatasourceMetadata(datasourceId, datasourceType) {
  return function (dispatch) {
    dispatch(fetchStarted());

    if (datasourceId) {
      const params = [`datasource_id=${datasourceId}`, `datasource_type=${datasourceType}`];
      const url = '/superset/fetch_datasource_metadata?' + params.join('&');
      $.ajax({
        type: 'GET',
        url,
        success: (data) => {
          dispatch(setDatasource(data));
          dispatch(fetchSucceeded());
        },
        error(error) {
          dispatch(fetchFailed(error.responseJSON.error));
        },
      });
    } else {
      dispatch(fetchFailed('Please select a datasource'));
    }
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
export function setFieldValue(fieldName, value, validationErrors) {
  return { type: SET_FIELD_VALUE, fieldName, value, validationErrors };
}

export const CHART_UPDATE_STARTED = 'CHART_UPDATE_STARTED';
export function chartUpdateStarted() {
  return { type: CHART_UPDATE_STARTED };
}

export const CHART_UPDATE_SUCCEEDED = 'CHART_UPDATE_SUCCEEDED';
export function chartUpdateSucceeded(queryResponse) {
  return { type: CHART_UPDATE_SUCCEEDED, queryResponse };
}

export const CHART_UPDATE_FAILED = 'CHART_UPDATE_FAILED';
export function chartUpdateFailed(queryResponse) {
  return { type: CHART_UPDATE_FAILED, queryResponse };
}

export const CHART_RENDERING_FAILED = 'CHART_RENDERING_FAILED';
export function chartRenderingFailed(error) {
  return { type: CHART_RENDERING_FAILED, error };
}

export const UPDATE_EXPLORE_ENDPOINTS = 'UPDATE_EXPLORE_ENDPOINTS';
export function updateExploreEndpoints(jsonUrl, csvUrl, standaloneUrl) {
  return { type: UPDATE_EXPLORE_ENDPOINTS, jsonUrl, csvUrl, standaloneUrl };
}

export const REMOVE_CONTROL_PANEL_ALERT = 'REMOVE_CONTROL_PANEL_ALERT';
export function removeControlPanelAlert() {
  return { type: REMOVE_CONTROL_PANEL_ALERT };
}

export const REMOVE_CHART_ALERT = 'REMOVE_CHART_ALERT';
export function removeChartAlert() {
  return { type: REMOVE_CHART_ALERT };
}

export const FETCH_DASHBOARDS_SUCCEEDED = 'FETCH_DASHBOARDS_SUCCEEDED';
export function fetchDashboardsSucceeded(choices) {
  return { type: FETCH_DASHBOARDS_SUCCEEDED, choices };
}

export const FETCH_DASHBOARDS_FAILED = 'FETCH_DASHBOARDS_FAILED';
export function fetchDashboardsFailed(userId) {
  return { type: FETCH_FAILED, userId };
}

export function fetchDashboards(userId) {
  return function (dispatch) {
    const url = '/dashboardmodelviewasync/api/read?_flt_0_owners=' + userId;
    $.get(url, function (data, status) {
      if (status === 'success') {
        const choices = [];
        for (let i = 0; i < data.pks.length; i++) {
          choices.push({ value: data.pks[i], label: data.result[i].dashboard_title });
        }
        dispatch(fetchDashboardsSucceeded(choices));
      } else {
        dispatch(fetchDashboardsFailed(userId));
      }
    });
  };
}

export const SAVE_SLICE_FAILED = 'SAVE_SLICE_FAILED';
export function saveSliceFailed() {
  return { type: SAVE_SLICE_FAILED };
}

export const REMOVE_SAVE_MODAL_ALERT = 'REMOVE_SAVE_MODAL_ALERT';
export function removeSaveModalAlert() {
  return { type: REMOVE_SAVE_MODAL_ALERT };
}

export function saveSlice(url) {
  return function (dispatch) {
    $.get(url, (data, status) => {
      if (status === 'success') {
        // Go to new slice url or dashboard url
        window.location = data;
      } else {
        dispatch(saveSliceFailed());
      }
    });
  };
}

export const UPDATE_CHART_STATUS = 'UPDATE_CHART_STATUS';
export function updateChartStatus(status) {
  return { type: UPDATE_CHART_STATUS, status };
}

export const RUN_QUERY = 'RUN_QUERY';
export function runQuery(formData, datasourceType) {
  return function (dispatch) {
    dispatch(updateChartStatus('loading'));
    const url = getExploreUrl(formData, datasourceType, 'json');
    $.getJSON(url, function (queryResponse) {
      dispatch(chartUpdateSucceeded(queryResponse));
    }).fail(function (err) {
      dispatch(chartUpdateFailed(err));
    });
  };
}
