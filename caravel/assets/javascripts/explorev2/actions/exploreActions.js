export const SET_DATASOURCE = 'SET_DATASOURCE';
export const SET_VIZTYPE = 'SET_VIZTYPE';
export const SET_TIME_FILTER = 'SET_TIME_FILTER';
export const SET_GROUPBY = 'SET_GROUPBY';
export const ADD_COLUMN = 'ADD_COLUMN';
export const REMOVE_COLUMN = 'REMOVE_COLUMN';
export const ADD_ORDERING = 'ADD_ORDERING';
export const REMOVE_ORDERING = 'REMOVE_ORDERING';
export const SET_TIME_STAMP = 'SET_TIME_STAMP';
export const SET_ROW_LIMIT = 'SET_ROW_LIMIT';
export const TOGGLE_SEARCHBOX = 'TOGGLE_SEARCHBOX';
export const SET_SQL = 'SET_SQL';
export const ADD_FILTER = 'ADD_FILTER';
export const SET_FILTER = 'SET_FILTER';
export const REMOVE_FILTER = 'REMOVE_FILTER';

export function setDatasource(datasourceId) {
  return { type: SET_DATASOURCE, datasourceId };
}

export function setVizType(vizType) {
  return { type: SET_VIZTYPE, vizType };
}

export function setTimeFilter(timeFilter) {
  return { type: SET_TIME_FILTER, timeFilter };
}

export function setGroupBy(groupBy) {
  return { type: SET_GROUPBY, groupBy };
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

export function setSQL(sql) {
  return { type: SET_SQL, sql };
}

export function addFilter(filter) {
  return { type: ADD_FILTER, filter };
}

export function removeFilter(filter) {
  return { type: REMOVE_FILTER, filter };
}
