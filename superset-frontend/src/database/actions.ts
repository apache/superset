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

import { SupersetClient, makeApi } from '@superset-ui/core';
import { ThunkDispatch } from 'redux-thunk';
import { AnyAction } from 'redux';
import { QueryExecutePayload, QueryExecuteResponse } from './types';

export const executeQueryApi = makeApi<
  QueryExecutePayload,
  QueryExecuteResponse
>({
  method: 'POST',
  endpoint: '/api/v1/sqllab/execute',
});

export function setQuery(query: string) {
  return {
    type: 'SET_QUERY',
    payload: query,
  };
}

export function setQueryIsLoading(isLoading: boolean) {
  return {
    type: 'SET_QUERY_IS_LOADING',
    payload: isLoading,
  };
}
export function setQueryResult(queryResult: QueryExecuteResponse) {
  return {
    type: 'SET_QUERY_RESULT',
    payload: queryResult,
  };
}
export function resetDatabaseState() {
  return {
    type: 'RESET_DATABASE_STATE',
  };
}
export function setQueryError(error: string) {
  return {
    type: 'SET_QUERY_ERROR',
    payload: error,
  };
}
export function executeQuery(payload: QueryExecutePayload) {
  return async function (dispatch: ThunkDispatch<any, undefined, AnyAction>) {
    try {
      dispatch(setQueryIsLoading(true));
      const result = await executeQueryApi(payload);
      dispatch(setQueryResult(result as QueryExecuteResponse));
    } catch (error) {
      dispatch(setQueryError(error.message));
    } finally {
      dispatch(setQueryIsLoading(false));
    }
  };
}

export function formatQuery(sql: string) {
  return function (dispatch: ThunkDispatch<any, undefined, AnyAction>) {
    return SupersetClient.post({
      endpoint: `/api/v1/sqllab/format_sql/`,
      body: JSON.stringify({ sql }),
      headers: { 'Content-Type': 'application/json' },
    }).then(response => {
      dispatch(setQuery(response.json.result));
      return response;
    });
  };
}
