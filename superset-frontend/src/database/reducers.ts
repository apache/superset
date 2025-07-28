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

import type { QueryAdhocState } from './types';

const initialState: QueryAdhocState = {
  isLoading: null,
  sql: null,
  queryResult: null,
  error: null,
};

export default function databaseReducer(
  state: QueryAdhocState = initialState,
  action: any,
): QueryAdhocState {
  switch (action.type) {
    case 'SET_QUERY':
      return {
        ...state,
        sql: action.payload ?? '',
        queryResult: null,
        error: null,
      };
    case 'SET_QUERY_IS_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'SET_QUERY_RESULT':
      return {
        ...state,
        sql: action.payload.query.sql ?? '',
        queryResult: action.payload,
        error: null,
      };
    case 'SET_QUERY_ERROR':
      return {
        ...initialState,
        error: action.payload,
      };
    case 'RESET_DATABASE_STATE':
      return initialState;
    default:
      return state;
  }
}
