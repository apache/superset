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

import { executeQuery } from './actions';
import fetchMock from 'fetch-mock';

fetchMock.post('glob:*/sqllab/execute', { result: [] });

afterAll(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('executeQuery', async () => {
  const mockDispatch = jest.fn();
  const mockedQueryExecutePayload = {
    client_id: 'client_id_1',
    database_id: 1,
    runAsync: false,
    catalog: null,
    schema: 'schema_1',
    sql: '1',
    tmp_table_name: 'tmp_table_1',
    select_as_cta: false,
    ctas_method: 'SELECT',
    queryLimit: 10,
    expand_data: false,
  };

  const returnedDispatchFunc = executeQuery(mockedQueryExecutePayload);
  await returnedDispatchFunc(mockDispatch);

  const [
    [setQueryIsLoadingActionObject],
    [setQueryResultActionObject],
    [setQueryIsNotLoadingActionObject],
  ] = mockDispatch.mock.calls;
  expect(setQueryIsLoadingActionObject).toStrictEqual({
    type: 'SET_QUERY_IS_LOADING',
    payload: true,
  });
  expect(setQueryResultActionObject).toStrictEqual({
    type: 'SET_QUERY_RESULT',
    payload: {
      result: [],
    },
  });
  expect(setQueryIsNotLoadingActionObject).toStrictEqual({
    type: 'SET_QUERY_IS_LOADING',
    payload: false,
  });
});
