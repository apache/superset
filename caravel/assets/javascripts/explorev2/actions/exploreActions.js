const $ = window.$ = require('jquery');
export const SET_DATASOURCE = 'SET_DATASOURCE';
export const SET_VIZTYPE = 'SET_VIZTYPE';
export const SET_TIME_COLUMN_OPTS = 'SET_TIME_COLUMN_OPTS';
export const SET_TIME_GRAIN_OPTS = 'SET_TIME_GRAIN_OPTS';
export const SET_TIME_COLUMN = 'SET_TIME_COLUMN';
export const SET_TIME_GRAIN = 'SET_TIME_GRAIN';
export const SET_SINCE = 'SET_SINCE';
export const SET_UNTIL = 'SET_UNTIL';
export const SET_GROUPBY_COLUMNS = 'SET_GROUPBY_COLUMNS';
export const SET_GROUPBY_COLUMN_OPTS = 'SET_GROUPBY_COLUMN_OPTS';
export const SET_METRICS = 'SET_METRICS';
export const SET_METRICS_OPTS = 'SET_METRICS_OPTS';
export const ADD_COLUMN = 'ADD_COLUMN';
export const REMOVE_COLUMN = 'REMOVE_COLUMN';
export const ADD_ORDERING = 'ADD_ORDERING';
export const REMOVE_ORDERING = 'REMOVE_ORDERING';
export const SET_TIME_STAMP = 'SET_TIME_STAMP';
export const SET_ROW_LIMIT = 'SET_ROW_LIMIT';
export const TOGGLE_SEARCHBOX = 'TOGGLE_SEARCHBOX';
export const SET_FILTER_COLUMN_OPTS = 'SET_FILTER_COLUMN_OPTS';
export const SET_WHERE_CLAUSE = 'SET_WHERE_CLAUSE';
export const SET_HAVING_CLAUSE = 'SET_HAVING_CLAUSE';
export const ADD_FILTER = 'ADD_FILTER';
export const SET_FILTER = 'SET_FILTER';
export const REMOVE_FILTER = 'REMOVE_FILTER';
export const CHANGE_FILTER_FIELD = 'CHANGE_FILTER_FIELD';
export const CHANGE_FILTER_OP = 'CHANGE_FILTER_OP';
export const CHANGE_FILTER_VALUE = 'CHANGE_FILTER_VALUE';
export const RESET_FORM_DATA = 'RESET_FORM_DATA';
export const CLEAR_ALL_OPTS = 'CLEAR_ALL_OPTS';

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

export function setFormOpts(datasourceId, datasourceType) {
  return function (dispatch) {
    const timeColumnOpts = [];
    const groupByColumnOpts = [];
    const metricsOpts = [];
    const filterColumnOpts = [];
    const timeGrainOpts = [];

    if (datasourceId) {
      const params = [`datasource_id=${datasourceId}`, `datasource_type=${datasourceType}`];
      const url = '/caravel/fetch_datasource_metadata?' + params.join('&');

      $.get(url, (data, status) => {
        if (status === 'success') {
          data.dttm_cols.forEach((d) => {
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
          // Repopulate options for controls
          dispatch(setTimeColumnOpts(timeColumnOpts));
          dispatch(setTimeGrainOpts(timeGrainOpts));
          dispatch(setGroupByColumnOpts(groupByColumnOpts));
          dispatch(setMetricsOpts(metricsOpts));
          dispatch(setFilterColumnOpts(filterColumnOpts));
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

export function setVizType(vizType) {
  return { type: SET_VIZTYPE, vizType };
}

export function setTimeColumn(timeColumn) {
  return { type: SET_TIME_COLUMN, timeColumn };
}

export function setTimeGrain(timeGrain) {
  return { type: SET_TIME_GRAIN, timeGrain };
}

export function setSince(since) {
  return { type: SET_SINCE, since };
}

export function setUntil(until) {
  return { type: SET_UNTIL, until };
}

export function setGroupByColumns(groupByColumns) {
  return { type: SET_GROUPBY_COLUMNS, groupByColumns };
}

export function setMetrics(metrics) {
  return { type: SET_METRICS, metrics };
}

export function addColumn(column) {
  return { type: ADD_COLUMN, column };
}

export function removeColumn(column) {
  return { type: REMOVE_COLUMN, column };
}

export function addOrdering(ordering) {
  return { type: ADD_ORDERING, ordering };
}

export function removeOrdering(ordering) {
  return { type: REMOVE_ORDERING, ordering };
}

export function setTimeStamp(timeStampFormat) {
  return { type: SET_TIME_STAMP, timeStampFormat };
}

export function setRowLimit(rowLimit) {
  return { type: SET_ROW_LIMIT, rowLimit };
}

export function toggleSearchBox(searchBox) {
  return { type: TOGGLE_SEARCHBOX, searchBox };
}

export function setWhereClause(whereClause) {
  return { type: SET_WHERE_CLAUSE, whereClause };
}

export function setHavingClause(havingClause) {
  return { type: SET_HAVING_CLAUSE, havingClause };
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
