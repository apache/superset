/* eslint camelcase: 0 */
const $ = window.$ = require('jquery');
export const SET_DATASOURCE = 'SET_DATASOURCE';
export const SET_FIELD_OPTIONS = 'SET_FIELD_OPTIONS';
export const TOGGLE_SEARCHBOX = 'TOGGLE_SEARCHBOX';
export const SET_FILTER_COLUMN_OPTS = 'SET_FILTER_COLUMN_OPTS';
export const ADD_FILTER = 'ADD_FILTER';
export const SET_FILTER = 'SET_FILTER';
export const REMOVE_FILTER = 'REMOVE_FILTER';
export const CHANGE_FILTER_FIELD = 'CHANGE_FILTER_FIELD';
export const CHANGE_FILTER_OP = 'CHANGE_FILTER_OP';
export const CHANGE_FILTER_VALUE = 'CHANGE_FILTER_VALUE';
export const CLEAR_ALL_OPTS = 'CLEAR_ALL_OPTS';
export const SET_DATASOURCE_TYPE = 'SET_DATASOURCE_TYPE';
export const SET_FIELD_VALUE = 'SET_FIELD_VALUE';
export const UPDATE_VIZ = 'UPDATE_VIZ';

export function setFieldOptions(options) {
  return { type: SET_FIELD_OPTIONS, options };
}

export function clearAllOpts() {
  return { type: CLEAR_ALL_OPTS };
}

export function setDatasourceType(datasourceType) {
  return { type: SET_DATASOURCE_TYPE, datasourceType };
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
export function fetchFailed() {
  return { type: FETCH_FAILED };
}

export function fetchFieldOptions(datasourceId, datasourceType) {
  return function (dispatch) {
    dispatch(fetchStarted());

    if (datasourceId) {
      const params = [`datasource_id=${datasourceId}`, `datasource_type=${datasourceType}`];
      const url = '/superset/fetch_datasource_metadata?' + params.join('&');

      $.get(url, (data, status) => {
        if (status === 'success') {
          // populate options for select type fields
          dispatch(setFieldOptions(data.field_options));
          dispatch(fetchSucceeded());
        } else if (status === 'error') {
          dispatch(fetchFailed());
        }
      });
    } else {
      // in what case don't we have a datasource id?
    }
  };
}
export function addFilter(filter) {
  return { type: ADD_FILTER, filter };
}

export function removeFilter(filter) {
  return { type: REMOVE_FILTER, filter };
}

export function changeFilterField(filter, field) {
  return { type: CHANGE_FILTER_FIELD, filter, field };
}

export function changeFilterOp(filter, op) {
  return { type: CHANGE_FILTER_OP, filter, op };
}

export function changeFilterValue(filter, value) {
  return { type: CHANGE_FILTER_VALUE, filter, value };
}

export function setFieldValue(key, value) {
  return { type: SET_FIELD_VALUE, key, value };
}

export function updateViz(viz) {
  return { type: UPDATE_VIZ, viz };
}

export const CHART_UPDATE_STARTED = 'CHART_UPDATE_STARTED';
export function chartUpdateStarted() {
  return { type: CHART_UPDATE_STARTED };
}

export const CHART_UPDATE_FAILED = 'CHART_UPDATE_FAILED ';
export function chartUpdateFailed() {
  return { type: CHART_UPDATE_FAILED };
}
export function updateExplore(datasource_type, datasource_id, form_data) {
  return function (dispatch) {
    dispatch(chartUpdateStarted);
    const updateUrl =
    `/superset/update_explore/${datasource_type}/${datasource_id}/`;

    $.ajax({
      type: 'POST',
      url: updateUrl,
      data: {
        data: JSON.stringify(form_data),
      },
      success: (data) => {
        dispatch(updateViz(JSON.parse(data)));
      },
      error(error) {
        dispatch(chartUpdateFailed(error));
      },
    });
  };
}

