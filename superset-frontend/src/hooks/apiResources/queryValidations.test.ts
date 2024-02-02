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
import fetchMock from 'fetch-mock';
import { act, renderHook } from '@testing-library/react-hooks';
import {
  createWrapper,
  defaultStore as store,
} from 'spec/helpers/testing-library';
import { api } from 'src/hooks/apiResources/queryApi';
import { useQueryValidationsQuery } from './queryValidations';

const fakeApiResult = {
  result: [
    {
      end_column: null,
      line_number: 3,
      message: 'ERROR: syntax error at or near ";"',
      start_column: null,
    },
  ],
};

const expectedResult = fakeApiResult.result;

const expectDbId = 'db1';
const expectSchema = 'my_schema';
const expectSql = 'SELECT * from example_table';
const expectTemplateParams = '{"a": 1, "v": "str"}';

afterEach(() => {
  fetchMock.reset();
  act(() => {
    store.dispatch(api.util.resetApiState());
  });
});

test('returns api response mapping json result', async () => {
  const queryValidationApiRoute = `glob:*/api/v1/database/${expectDbId}/validate_sql/`;
  fetchMock.post(queryValidationApiRoute, fakeApiResult);
  const { result, waitFor } = renderHook(
    () =>
      useQueryValidationsQuery({
        dbId: expectDbId,
        sql: expectSql,
        schema: expectSchema,
        templateParams: expectTemplateParams,
      }),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );
  await waitFor(() =>
    expect(fetchMock.calls(queryValidationApiRoute).length).toBe(1),
  );
  expect(result.current.data).toEqual(expectedResult);
  expect(fetchMock.calls(queryValidationApiRoute).length).toBe(1);
  expect(
    JSON.parse(`${fetchMock.calls(queryValidationApiRoute)[0][1]?.body}`),
  ).toEqual({
    schema: expectSchema,
    sql: expectSql,
    template_params: JSON.parse(expectTemplateParams),
  });
  act(() => {
    result.current.refetch();
  });
  await waitFor(() =>
    expect(fetchMock.calls(queryValidationApiRoute).length).toBe(2),
  );
  expect(result.current.data).toEqual(expectedResult);
});

test('returns cached data without api request', async () => {
  const queryValidationApiRoute = `glob:*/api/v1/database/${expectDbId}/validate_sql/`;
  fetchMock.post(queryValidationApiRoute, fakeApiResult);
  const { result, waitFor, rerender } = renderHook(
    () =>
      useQueryValidationsQuery({
        dbId: expectDbId,
        sql: expectSql,
        schema: expectSchema,
        templateParams: expectTemplateParams,
      }),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );
  await waitFor(() => expect(result.current.data).toEqual(expectedResult));
  expect(fetchMock.calls(queryValidationApiRoute).length).toBe(1);
  rerender();
  await waitFor(() => expect(result.current.data).toEqual(expectedResult));
  expect(fetchMock.calls(queryValidationApiRoute).length).toBe(1);
});
