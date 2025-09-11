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
import { COMMON_ERR_MESSAGES } from '@superset-ui/core';
import {
  createWrapper,
  defaultStore as store,
} from 'spec/helpers/testing-library';
import { api } from 'src/hooks/apiResources/queryApi';
import { initialState } from 'src/SqlLab/fixtures';
import { useAnnotations } from './useAnnotations';

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
const expectDbId = 'db1';
const expectSchema = 'my_schema';
const expectSql = 'SELECT * from example_table';
const expectTemplateParams = '{"a": 1, "v": "str"}';
const expectValidatorEngine = 'defined_validator';
const queryValidationApiRoute = `glob:*/api/v1/database/${expectDbId}/validate_sql/`;

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  t: (str: string) => str,
}));

afterEach(() => {
  fetchMock.reset();
  act(() => {
    store.dispatch(api.util.resetApiState());
  });
});

beforeEach(() => {
  fetchMock.post(queryValidationApiRoute, fakeApiResult);
});

const initialize = (withValidator = false) => {
  if (withValidator) {
    return renderHook(
      () =>
        useAnnotations({
          sql: expectSql,
          dbId: expectDbId,
          schema: expectSchema,
          templateParams: expectTemplateParams,
        }),
      {
        wrapper: createWrapper({
          useRedux: true,
          initialState: {
            ...initialState,
            sqlLab: {
              ...initialState.sqlLab,
              databases: {
                [expectDbId]: {
                  backend: expectValidatorEngine,
                },
              },
            },
            common: {
              conf: {
                SQL_VALIDATORS_BY_ENGINE: {
                  [expectValidatorEngine]: true,
                },
              },
            },
          },
        }),
      },
    );
  }
  return renderHook(
    () =>
      useAnnotations({
        sql: expectSql,
        dbId: expectDbId,
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
};

test('skips fetching validation if validator is undefined', () => {
  const { result } = initialize();
  expect(result.current.data).toEqual([]);
  expect(fetchMock.calls(queryValidationApiRoute)).toHaveLength(0);
});

test('returns validation if validator is configured', async () => {
  const { result, waitFor } = initialize(true);
  await waitFor(() =>
    expect(fetchMock.calls(queryValidationApiRoute)).toHaveLength(1),
  );
  expect(result.current.data).toEqual(
    fakeApiResult.result.map(err => ({
      type: 'error',
      row: (err.line_number || 0) - 1,
      column: (err.start_column || 0) - 1,
      text: err.message,
    })),
  );
});

test('returns server error description', async () => {
  const errorMessage = 'Unexpected validation api error';
  fetchMock.post(
    queryValidationApiRoute,
    {
      throws: new Error(errorMessage),
    },
    { overwriteRoutes: true },
  );
  const { result, waitFor } = initialize(true);
  await waitFor(
    () =>
      expect(result.current.data).toEqual([
        {
          type: 'error',
          row: 0,
          column: 0,
          text: `The server failed to validate your query.\n${errorMessage}`,
        },
      ]),
    { timeout: 5000 },
  );
});

test('returns sesion expire description when CSRF token expired', async () => {
  const errorMessage = 'CSRF token expired';
  fetchMock.post(
    queryValidationApiRoute,
    {
      throws: new Error(errorMessage),
    },
    { overwriteRoutes: true },
  );
  const { result, waitFor } = initialize(true);
  await waitFor(
    () =>
      expect(result.current.data).toEqual([
        {
          type: 'error',
          row: 0,
          column: 0,
          text: `The server failed to validate your query.\n${COMMON_ERR_MESSAGES.SESSION_TIMED_OUT}`,
        },
      ]),
    { timeout: 5000 },
  );
});
