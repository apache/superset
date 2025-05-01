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
import { useDatabaseFunctionsQuery } from './databaseFunctions';

const fakeApiResult = {
  function_names: ['abs', 'avg', 'sum'],
};

const expectedResult = fakeApiResult.function_names;
const expectDbId = 'db1';
const dbFunctionNamesApiRoute = `glob:*/api/v1/database/${expectDbId}/function_names/`;

afterEach(() => {
  fetchMock.reset();
  act(() => {
    store.dispatch(api.util.resetApiState());
  });
});

beforeEach(() => {
  fetchMock.get(dbFunctionNamesApiRoute, fakeApiResult);
});

test('returns api response mapping json result', async () => {
  const { result, waitFor } = renderHook(
    () =>
      useDatabaseFunctionsQuery({
        dbId: expectDbId,
      }),
    {
      wrapper: createWrapper({
        useRedux: true,
        store,
      }),
    },
  );
  await waitFor(() =>
    expect(fetchMock.calls(dbFunctionNamesApiRoute).length).toBe(1),
  );
  expect(result.current.data).toEqual(expectedResult);
  expect(fetchMock.calls(dbFunctionNamesApiRoute).length).toBe(1);
  act(() => {
    result.current.refetch();
  });
  await waitFor(() =>
    expect(fetchMock.calls(dbFunctionNamesApiRoute).length).toBe(2),
  );
  expect(result.current.data).toEqual(expectedResult);
});

test('returns cached data without api request', async () => {
  const { result, waitFor, rerender } = renderHook(
    () =>
      useDatabaseFunctionsQuery({
        dbId: expectDbId,
      }),
    {
      wrapper: createWrapper({
        store,
        useRedux: true,
      }),
    },
  );
  await waitFor(() => expect(result.current.data).toEqual(expectedResult));
  expect(fetchMock.calls(dbFunctionNamesApiRoute).length).toBe(1);
  rerender();
  await waitFor(() => expect(result.current.data).toEqual(expectedResult));
  expect(fetchMock.calls(dbFunctionNamesApiRoute).length).toBe(1);
});
