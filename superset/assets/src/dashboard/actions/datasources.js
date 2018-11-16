import { SupersetClient } from '@superset-ui/connection';
import getClientErrorObject from '../../utils/getClientErrorObject';

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
    const datasource = datasources[key];

    if (datasource) {
      return dispatch(setDatasource(datasource, key));
    }

    return SupersetClient.get({
      endpoint: `/superset/fetch_datasource_metadata?datasourceKey=${key}`,
    })
      .then(data => dispatch(data, key))
      .catch(response =>
        getClientErrorObject(response).then(({ error }) =>
          dispatch(fetchDatasourceFailed(error, key)),
        ),
      );
  };
}
