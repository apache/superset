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
import configureStore, { MockStore } from 'redux-mock-store';
import rison from 'rison';
import { JsonResponse } from '@superset-ui/core';
import { supersetClientQuery } from './queryApi';

const getBaseQueryApiMock = (store: MockStore) => ({
  ...new AbortController(),
  dispatch: store.dispatch,
  getState: store.getState,
  extra: undefined,
  endpoint: 'endpoint',
  type: 'query' as const,
});

const mockStore = configureStore();
const store = mockStore();

afterEach(() => {
  fetchMock.reset();
});

test('supersetClientQuery should build the endpoint with rison encoded query string and return data when successful', async () => {
  const expectedData = { id: 1, name: 'Test' };
  const expectedUrl = '/api/v1/get-endpoint/';
  const expectedPostUrl = '/api/v1/post-endpoint/';
  const urlParams = { str: 'string', num: 123, bool: true };
  const getEndpoint = `glob:*${expectedUrl}?q=${rison.encode(urlParams)}`;
  const postEndpoint = `glob:*${expectedPostUrl}?q=${rison.encode(urlParams)}`;
  fetchMock.get(getEndpoint, { result: expectedData });
  fetchMock.post(postEndpoint, { result: expectedData });
  const result = await supersetClientQuery(
    {
      endpoint: expectedUrl,
      urlParams,
    },
    getBaseQueryApiMock(store),
    {},
  );
  expect(fetchMock.calls(getEndpoint)).toHaveLength(1);
  expect(fetchMock.calls(postEndpoint)).toHaveLength(0);
  expect((result.data as JsonResponse).json.result).toEqual(expectedData);
  await supersetClientQuery(
    {
      method: 'post',
      endpoint: expectedPostUrl,
      urlParams,
    },
    getBaseQueryApiMock(store),
    {},
  );
  expect(fetchMock.calls(getEndpoint)).toHaveLength(1);
  expect(fetchMock.calls(postEndpoint)).toHaveLength(1);
});

test('supersetClientQuery should return error when unsuccessful', async () => {
  const expectedError = 'Request failed';
  const expectedUrl = '/api/v1/get-endpoint/';
  const endpoint = `glob:*${expectedUrl}`;
  fetchMock.get(endpoint, { throws: new Error(expectedError) });
  const result = await supersetClientQuery(
    { endpoint },
    getBaseQueryApiMock(store),
    {},
  );
  expect(result.error).toEqual({ error: expectedError, errors: [] });
});

test('supersetClientQuery should return parsed response by parseMethod', async () => {
  const expectedUrl = '/api/v1/get-endpoint/';
  const endpoint = `glob:*${expectedUrl}`;
  const bitIntVal = '9223372036854775807';
  const expectedData = `{ "id": ${bitIntVal} }`;
  fetchMock.get(endpoint, expectedData);
  const result = await supersetClientQuery(
    { endpoint, parseMethod: 'json-bigint' },
    getBaseQueryApiMock(store),
    {},
  );
  expect(`${(result.data as JsonResponse).json.id}`).toEqual(bitIntVal);
});
