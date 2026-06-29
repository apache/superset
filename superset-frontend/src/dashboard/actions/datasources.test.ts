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

import { SupersetClient } from '@superset-ui/core';
import type { RootState } from 'src/dashboard/types';
import { useDashboardInfoStore } from 'src/dashboard/stores';
import { fetchDatasourceMetadata } from './datasources';

const sourceKey = '2__semantic_view';

// Wrap the store action so the test can assert the exact refresh sequence the
// thunk requests, independent of how the store reconciles it.
const spyUpdateSemanticDataset = () => {
  const spy = jest.fn(useDashboardInfoStore.getState().updateSemanticDataset);
  useDashboardInfoStore.setState({ updateSemanticDataset: spy });
  return spy;
};

afterEach(() => {
  useDashboardInfoStore.setState(useDashboardInfoStore.getInitialState());
});

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
  const updateSemanticDataset = spyUpdateSemanticDataset();
  const dispatch = jest.fn(action => action);
  const getState = () =>
    ({
      datasources: { [sourceKey]: { ...source, columns: [] } },
    }) as unknown as RootState;

  await fetchDatasourceMetadata(sourceKey, 1)(dispatch, getState);

  expect(get).toHaveBeenCalledWith({
    endpoint: `/fetch_datasource_metadata?datasourceKey=${sourceKey}`,
  });
  expect(updateSemanticDataset).toHaveBeenCalledWith(
    1,
    sourceKey,
    { ...source, uid: sourceKey },
    expect.any(String),
    false,
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
  const updateSemanticDataset = spyUpdateSemanticDataset();
  const dispatch = jest.fn(action => action);
  const getState = () => ({ datasources: {} }) as unknown as RootState;

  await fetchDatasourceMetadata(sourceKey, 1)(dispatch, getState);

  expect(updateSemanticDataset.mock.calls).toEqual([
    [1, sourceKey, null, expect.any(String), true],
    [1, sourceKey, null, expect.any(String), false],
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
  const updateSemanticDataset = spyUpdateSemanticDataset();
  const dispatch = jest.fn(action => action);
  const getState = () => ({ datasources: {} }) as unknown as RootState;

  await fetchDatasourceMetadata(sourceKey, 1)(dispatch, getState);

  expect(updateSemanticDataset.mock.calls).toEqual([
    [1, sourceKey, null, expect.any(String), true],
    [1, sourceKey, null, expect.any(String), false],
  ]);
  get.mockRestore();
});
