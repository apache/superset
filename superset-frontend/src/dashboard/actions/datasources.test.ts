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
import type {
  Datasource,
  DatasourcesState,
  RootState,
} from 'src/dashboard/types';
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

test('fetchDatasourceMetadata shares one in-flight promise across concurrent callers', async () => {
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
  const first = fetchDatasourceMetadata(KEY)(dispatch, getState);
  const second = fetchDatasourceMetadata(KEY)(dispatch, getState);

  // Only one network request fires, and both callers receive the same promise
  // so each observes the same completion/rejection.
  expect(getSpy).toHaveBeenCalledTimes(1);
  expect(second).toBe(first);

  resolveGet(jsonResponse({ uid: KEY, main_dttm_col: 'ds' }));
  await Promise.all([first, second]);

  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: DatasourcesAction.SetDatasource,
      key: KEY,
    }),
  );
});

test('fetchDatasourceMetadata propagates a rejection to all concurrent callers', async () => {
  jest.spyOn(SupersetClient, 'get').mockRejectedValue(new Error('boom'));
  const dispatch = jest.fn();
  const getState = buildGetState();

  const first = fetchDatasourceMetadata(KEY)(dispatch, getState);
  const second = fetchDatasourceMetadata(KEY)(dispatch, getState);

  expect(second).toBe(first);
  await expect(first).rejects.toThrow('boom');
  await expect(second).rejects.toThrow('boom');
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

test('fetchDatasourceMetadata fetches when the datasources slice is missing', async () => {
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValue(jsonResponse({ uid: KEY }));
  const dispatch = jest.fn();

  await fetchDatasourceMetadata(KEY)(
    dispatch,
    () => ({}) as unknown as RootState,
  );

  expect(getSpy).toHaveBeenCalledTimes(1);
});

const sourceKey = '2__semantic_view';

test('adding a semantic Table source refreshes its metadata despite a cached source', async () => {
  const source = {
    id: 2,
    uid: 'provider-source-identity',
    type: 'semantic_view',
    columns: [{ column_name: 'country', is_dttm: false }],
  };
  const get = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: source,
  } as unknown as Awaited<ReturnType<typeof SupersetClient.get>>);
  const dispatch = jest.fn(action => action);
  const getState = () =>
    ({
      datasources: { [sourceKey]: { ...source, columns: [] } },
    }) as unknown as RootState;

  await fetchDatasourceMetadata(sourceKey, 1)(dispatch, getState);

  expect(get).toHaveBeenCalledWith({
    endpoint: `/fetch_datasource_metadata?datasourceKey=${sourceKey}`,
  });
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'UPDATE_DASHBOARD_SEMANTIC_DATASET',
      dashboardId: 1,
      sourceKey,
      dataset: { ...source, uid: sourceKey },
    }),
  );
  get.mockRestore();
});

test('a provider response omitting the source cannot prove its temporal columns', async () => {
  const get = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {
      uid: '3__semantic_view',
      type: 'semantic_view',
      columns: [{ column_name: 'country', is_dttm: false }],
    },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.get>>);
  const dispatch = jest.fn(action => action);
  const getState = () => ({ datasources: {} }) as unknown as RootState;

  await fetchDatasourceMetadata(sourceKey, 1)(dispatch, getState);

  expect(
    dispatch.mock.calls.filter(
      ([action]) => action.type === 'UPDATE_DASHBOARD_SEMANTIC_DATASET',
    ),
  ).toEqual([
    [expect.objectContaining({ sourceKey, dataset: null })],
    [expect.objectContaining({ sourceKey, dataset: null })],
  ]);
  expect(dispatch).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: 'SET_DATASOURCE' }),
  );
  get.mockRestore();
});

test('failed semantic metadata fetch settles the request without claiming proof', async () => {
  const get = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValue(new Error('metadata unavailable'));
  const dispatch = jest.fn(action => action);
  const getState = () => ({ datasources: {} }) as unknown as RootState;

  await fetchDatasourceMetadata(sourceKey, 1)(dispatch, getState);

  expect(
    dispatch.mock.calls.filter(
      ([action]) => action.type === 'UPDATE_DASHBOARD_SEMANTIC_DATASET',
    ),
  ).toEqual([
    [
      expect.objectContaining({
        sourceKey,
        dataset: null,
        isRefreshStart: true,
      }),
    ],
    [
      expect.objectContaining({
        sourceKey,
        dataset: null,
        isRefreshStart: false,
      }),
    ],
  ]);
  get.mockRestore();
});
