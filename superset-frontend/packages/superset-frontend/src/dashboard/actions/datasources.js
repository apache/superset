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
import { SupersetClient } from '@superset-ui/core';
import { getClientErrorObject } from '../../utils/getClientErrorObject';

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
      .then(({ json }) => dispatch(setDatasource(json, key)))
      .catch(response =>
        getClientErrorObject(response).then(({ error }) =>
          dispatch(fetchDatasourceFailed(error, key)),
        ),
      );
  };
}
