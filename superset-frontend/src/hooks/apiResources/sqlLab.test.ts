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
import { DEFAULT_COMMON_BOOTSTRAP_DATA } from 'src/constants';

import { useSqlLabInitialState } from './sqlLab';

const fakeApiResult = {
  result: {
    common: DEFAULT_COMMON_BOOTSTRAP_DATA,
    tab_state_ids: [],
    databases: [],
    queries: {},
    user: {
      userId: 1,
      username: 'some name',
      isActive: true,
      isAnonymous: false,
      firstName: 'first name',
      lastName: 'last name',
      permissions: {},
      roles: {},
    },
  },
};

const expectedResult = fakeApiResult.result;
const sqlLabInitialStateApiRoute = `glob:*/api/v1/sqllab/`;

afterEach(() => {
  fetchMock.reset();
  act(() => {
    store.dispatch(api.util.resetApiState());
  });
});

beforeEach(() => {
  fetchMock.get(sqlLabInitialStateApiRoute, fakeApiResult);
});

test('returns api response mapping json result', async () => {
  const { result, waitFor } = renderHook(() => useSqlLabInitialState(), {
    wrapper: createWrapper({
      useRedux: true,
      store,
    }),
  });
  await waitFor(() =>
    expect(fetchMock.calls(sqlLabInitialStateApiRoute).length).toBe(1),
  );
  expect(result.current.data).toEqual(expectedResult);
  expect(fetchMock.calls(sqlLabInitialStateApiRoute).length).toBe(1);
  // clean up cache
  act(() => {
    store.dispatch(api.util.invalidateTags(['SqlLabInitialState']));
  });
  await waitFor(() =>
    expect(fetchMock.calls(sqlLabInitialStateApiRoute).length).toBe(2),
  );
  expect(result.current.data).toEqual(expectedResult);
});

test('returns cached data without api request', async () => {
  const { result, waitFor, rerender } = renderHook(
    () => useSqlLabInitialState(),
    {
      wrapper: createWrapper({
        store,
        useRedux: true,
      }),
    },
  );
  await waitFor(() => expect(result.current.data).toEqual(expectedResult));
  expect(fetchMock.calls(sqlLabInitialStateApiRoute).length).toBe(1);
  rerender();
  await waitFor(() => expect(result.current.data).toEqual(expectedResult));
  expect(fetchMock.calls(sqlLabInitialStateApiRoute).length).toBe(1);
});
