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
import { JsonObject, SupersetClient } from '@superset-ui/core';
import { Datasource, DatasourcesState, RootState } from 'src/dashboard/types';
import {
  DatasourcesAction,
  fetchDatasourceMetadata,
  setDatasource,
} from './datasources';

const KEY = '7__table';

type ClientResponse = Awaited<ReturnType<typeof SupersetClient.get>>;

// Minimal typed stand-ins so the tests avoid `any` while exercising the thunk.
const datasource = (json: JsonObject = { uid: KEY, main_dttm_col: 'ds' }) =>
  json as unknown as Datasource;

const jsonResponse = (json: JsonObject): ClientResponse =>
  ({ json }) as unknown as ClientResponse;

const buildGetState =
  (datasources: DatasourcesState = {}) =>
  () =>
    ({ datasources }) as unknown as RootState;

afterEach(() => {
  jest.restoreAllMocks();
});

test('fetchDatasourceMetadata uses the cached datasource without a network call', () => {
  const getSpy = jest.spyOn(SupersetClient, 'get');
  const dispatch = jest.fn();
  const cached = datasource();

  fetchDatasourceMetadata(KEY)(dispatch, buildGetState({ [KEY]: cached }));

  expect(getSpy).not.toHaveBeenCalled();
  expect(dispatch).toHaveBeenCalledWith(setDatasource(cached, KEY));
});

test('fetchDatasourceMetadata fetches and caches an uncached datasource', async () => {
  const json = { uid: KEY, main_dttm_col: 'ds' };
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValue(jsonResponse(json));
  const dispatch = jest.fn();

  await fetchDatasourceMetadata(KEY)(dispatch, buildGetState());

  expect(getSpy).toHaveBeenCalledTimes(1);
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: DatasourcesAction.SetDatasource,
      key: KEY,
      datasource: json,
    }),
  );
});

test('fetchDatasourceMetadata deduplicates concurrent in-flight requests for the same key', async () => {
  let resolveGet: (value: ClientResponse) => void = () => {};
  const getSpy = jest.spyOn(SupersetClient, 'get').mockReturnValue(
    new Promise<ClientResponse>(resolve => {
      resolveGet = resolve;
    }),
  );
  const dispatch = jest.fn();
  const getState = buildGetState();

  // Two filters using the same dataset mount and dispatch before the first
  // request resolves and populates the cache.
  fetchDatasourceMetadata(KEY)(dispatch, getState);
  fetchDatasourceMetadata(KEY)(dispatch, getState);

  expect(getSpy).toHaveBeenCalledTimes(1);

  resolveGet(jsonResponse({ uid: KEY, main_dttm_col: 'ds' }));
  await Promise.resolve();
});

test('fetchDatasourceMetadata clears the in-flight key after a failed request so it can retry', async () => {
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValueOnce(new Error('boom'))
    .mockResolvedValueOnce(jsonResponse({ uid: KEY }));
  const dispatch = jest.fn();
  const getState = buildGetState();

  await expect(
    fetchDatasourceMetadata(KEY)(dispatch, getState),
  ).rejects.toThrow('boom');

  // The failed key is no longer in flight, so a subsequent dispatch retries.
  await fetchDatasourceMetadata(KEY)(dispatch, getState);

  expect(getSpy).toHaveBeenCalledTimes(2);
});
