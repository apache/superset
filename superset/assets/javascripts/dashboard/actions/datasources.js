const $ = window.$ = require('jquery');

export const SET_DATASOURCE = 'SET_DATASOURCE';
export function setDatasource(datasource, key) {
  return { type: SET_DATASOURCE, datasource, key };
}

export const FETCH_DATASOURCE_STARTED = 'FETCH_DATASOURCE_STARTED';
export function fetchDatasourceStarted(key) {
  return { type: FETCH_DATASOURCE_STARTED, key };
}

export const FETCH_DATASOURCE_FAILED = 'FETCH_DATASOURCE_FAILED';
export function fetchDatasourceFailed(error, key) {
  return { type: FETCH_DATASOURCE_FAILED, error, key };
}

export function fetchDatasourceMetadata(key) {
  return (dispatch, getState) => {
    const { datasources } = getState();
    if (datasources[key]) {
      return Promise.resolve(true);
    }

    const url = `/superset/fetch_datasource_metadata?datasourceKey=${key}`;
    return $.ajax({
      type: 'GET',
      url,
      success: datasource => dispatch(setDatasource(datasource, key)),
      error: error => dispatch(fetchDatasourceFailed(error.responseJSON.error, key)),
    });
  };
}
