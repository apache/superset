const $ = window.$ = require('jquery');

export const SET_DATASOURCE = 'SET_DATASOURCE';
export function setDatasource(datasource) {
  return { type: SET_DATASOURCE, datasource };
}

export const FETCH_DATASOURCE_STARTED = 'FETCH_DATASOURCE_STARTED';
export function fetchDatasourceStarted() {
  return { type: FETCH_DATASOURCE_STARTED };
}

export const FETCH_DATASOURCE_SUCCEEDED = 'FETCH_DATASOURCE_SUCCEEDED';
export function fetchDatasourceSucceeded() {
  return { type: FETCH_DATASOURCE_SUCCEEDED };
}

export const FETCH_DATASOURCE_FAILED = 'FETCH_DATASOURCE_FAILED';
export function fetchDatasourceFailed(error) {
  return { type: FETCH_DATASOURCE_FAILED, error };
}

export function fetchDatasourceMetadata(datasourceKey) {
  return function (dispatch) {
    dispatch(fetchDatasourceStarted());
    const url = `/superset/fetch_datasource_metadata?datasourceKey=${datasourceKey}`;
    $.ajax({
      type: 'GET',
      url,
      success: (data) => {
        dispatch(setDatasource(data));
        dispatch(fetchDatasourceSucceeded());
      },
      error(error) {
        dispatch(fetchDatasourceFailed(error.responseJSON.error));
      },
    });
  };
}