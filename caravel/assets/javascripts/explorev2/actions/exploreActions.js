const $ = window.$ = require('jquery');
export const SET_DATASOURCE = 'SET_DATASOURCE';
export const SET_TIME_COLUMN_OPTS = 'SET_TIME_COLUMN_OPTS';
export const SET_TIME_GRAIN_OPTS = 'SET_TIME_GRAIN_OPTS';
export const SET_GROUPBY_COLUMN_OPTS = 'SET_GROUPBY_COLUMN_OPTS';
export const SET_METRICS_OPTS = 'SET_METRICS_OPTS';
export const SET_COLUMN_OPTS = 'SET_COLUMN_OPTS';
export const SET_ORDERING_OPTS = 'SET_ORDERING_OPTS';
export const TOGGLE_SEARCHBOX = 'TOGGLE_SEARCHBOX';
export const SET_FILTER_COLUMN_OPTS = 'SET_FILTER_COLUMN_OPTS';
export const ADD_FILTER = 'ADD_FILTER';
export const SET_FILTER = 'SET_FILTER';
export const REMOVE_FILTER = 'REMOVE_FILTER';
export const CHANGE_FILTER_FIELD = 'CHANGE_FILTER_FIELD';
export const CHANGE_FILTER_OP = 'CHANGE_FILTER_OP';
export const CHANGE_FILTER_VALUE = 'CHANGE_FILTER_VALUE';
export const RESET_FORM_DATA = 'RESET_FORM_DATA';
export const CLEAR_ALL_OPTS = 'CLEAR_ALL_OPTS';
export const SET_DATASOURCE_TYPE = 'SET_DATASOURCE_TYPE';
export const SET_FORM_DATA = 'SET_FORM_DATA';

export function setTimeColumnOpts(timeColumnOpts) {
  return { type: SET_TIME_COLUMN_OPTS, timeColumnOpts };
}

export function setTimeGrainOpts(timeGrainOpts) {
  return { type: SET_TIME_GRAIN_OPTS, timeGrainOpts };
}

export function setGroupByColumnOpts(groupByColumnOpts) {
  return { type: SET_GROUPBY_COLUMN_OPTS, groupByColumnOpts };
}

export function setMetricsOpts(metricsOpts) {
  return { type: SET_METRICS_OPTS, metricsOpts };
}

export function setColumnOpts(columnOpts) {
  return { type: SET_COLUMN_OPTS, columnOpts };
}

export function setOrderingOpts(orderingOpts) {
  return { type: SET_ORDERING_OPTS, orderingOpts };
}

export function setFilterColumnOpts(filterColumnOpts) {
  return { type: SET_FILTER_COLUMN_OPTS, filterColumnOpts };
}

export function resetFormData() {
  // Clear all form data when switching datasource
  return { type: RESET_FORM_DATA };
}

export function clearAllOpts() {
  return { type: CLEAR_ALL_OPTS };
}

export function setDatasourceType(datasourceType) {
  return { type: SET_DATASOURCE_TYPE, datasourceType };
}

export function setFormOpts(datasourceId, datasourceType) {
  return function (dispatch) {
    const timeColumnOpts = [];
    const groupByColumnOpts = [];
    const metricsOpts = [];
    const filterColumnOpts = [];
    const timeGrainOpts = [];
    const columnOpts = [];
    const orderingOpts = [];

    if (datasourceId) {
      const params = [`datasource_id=${datasourceId}`, `datasource_type=${datasourceType}`];
      const url = '/caravel/fetch_datasource_metadata?' + params.join('&');

      $.get(url, (data, status) => {
        if (status === 'success') {
          data.time_columns.forEach((d) => {
            if (d) timeColumnOpts.push({ value: d, label: d });
          });
          data.groupby_cols.forEach((d) => {
            if (d) groupByColumnOpts.push({ value: d, label: d });
          });
          data.metrics.forEach((d) => {
            if (d) metricsOpts.push({ value: d[1], label: d[0] });
          });
          data.filter_cols.forEach((d) => {
            if (d) filterColumnOpts.push({ value: d, label: d });
          });
          data.time_grains.forEach((d) => {
            if (d) timeGrainOpts.push({ value: d, label: d });
          });
          data.columns.forEach((d) => {
            if (d) columnOpts.push({ value: d, label: d });
          });
          data.ordering_cols.forEach((d) => {
            if (d) orderingOpts.push({ value: d, label: d });
          });

          // Repopulate options for controls
          dispatch(setTimeColumnOpts(timeColumnOpts));
          dispatch(setTimeGrainOpts(timeGrainOpts));
          dispatch(setGroupByColumnOpts(groupByColumnOpts));
          dispatch(setMetricsOpts(metricsOpts));
          dispatch(setFilterColumnOpts(filterColumnOpts));
          dispatch(setColumnOpts(columnOpts));
          dispatch(setOrderingOpts(orderingOpts));
        }
      });
    } else {
      // Clear all Select options
      dispatch(clearAllOpts());
    }
  };
}

export function setDatasource(datasourceId) {
  return { type: SET_DATASOURCE, datasourceId };
}

export function toggleSearchBox(searchBox) {
  return { type: TOGGLE_SEARCHBOX, searchBox };
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

export function setFormData(key, value) {
  return { type: SET_FORM_DATA, key, value };
}
