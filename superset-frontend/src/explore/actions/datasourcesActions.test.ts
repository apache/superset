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
import { DatasourceType, getClientErrorObject } from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import {
  setDatasource,
  changeDatasource,
  saveDataset,
} from 'src/explore/actions/datasourcesActions';
import sinon from 'sinon';
import datasourcesReducer from '../reducers/datasourcesReducer';
import { updateFormDataByDatasource } from './exploreActions';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getClientErrorObject: jest.fn(),
}));

const mockedGetClientErrorObject = getClientErrorObject as jest.Mock;

const CURRENT_DATASOURCE = {
  id: 1,
  uid: '1__table',
  type: DatasourceType.Table,
  columns: [],
  metrics: [],
  column_formats: {},
  currency_formats: {},
  verbose_map: {},
  main_dttm_col: '__timestamp',
  // eg. ['["ds", true]', 'ds [asc]']
  datasource_name: 'test datasource',
  description: null,
};

const NEW_DATASOURCE = {
  id: 2,
  type: DatasourceType.Table,
  columns: [],
  metrics: [],
  column_formats: {},
  currency_formats: {},
  verbose_map: {},
  main_dttm_col: '__timestamp',
  // eg. ['["ds", true]', 'ds [asc]']
  datasource_name: 'test datasource',
  description: null,
};

const SAVE_DATASET_POST_ARGS = {
  schema: 'foo',
  sql: 'select * from bar',
  database: { id: 1 },
  templateParams: undefined,
  datasourceName: 'new dataset',
  columns: [],
};

const defaultDatasourcesReducerState = {
  [CURRENT_DATASOURCE.uid]: CURRENT_DATASOURCE,
};

const saveDatasetEndpoint = `glob:*/api/v1/dataset/`;

test('sets new datasource', () => {
  const newState = datasourcesReducer(
    defaultDatasourcesReducerState,
    setDatasource(NEW_DATASOURCE),
  );
  expect(newState).toEqual({
    ...defaultDatasourcesReducerState,
    '2__table': NEW_DATASOURCE,
  });
});

test('change datasource action', () => {
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    explore: {
      datasource: CURRENT_DATASOURCE,
    },
  }));
  // ignore getState type check - we dont need explore.datasource field for this test
  // @ts-ignore
  changeDatasource(NEW_DATASOURCE)(dispatch, getState);
  expect(dispatch).toHaveBeenCalledTimes(2);
  expect(dispatch).toHaveBeenNthCalledWith(1, setDatasource(NEW_DATASOURCE));
  expect(dispatch).toHaveBeenNthCalledWith(
    2,
    updateFormDataByDatasource(CURRENT_DATASOURCE, NEW_DATASOURCE),
  );
});

test('saveDataset handles success', async () => {
  const datasource = { id: 1 };
  const saveDatasetResponse = {
    data: datasource,
  };
  fetchMock.reset();
  fetchMock.post(saveDatasetEndpoint, saveDatasetResponse);
  const dispatch = sinon.spy();
  const getState = sinon.spy(() => ({ explore: { datasource } }));
  const dataset = await saveDataset(SAVE_DATASET_POST_ARGS)(dispatch);

  expect(fetchMock.calls(saveDatasetEndpoint)).toHaveLength(1);
  expect(dispatch.callCount).toBe(1);
  const thunk = dispatch.getCall(0).args[0];
  thunk(dispatch, getState);
  expect(dispatch.getCall(1).args[0].type).toEqual('SET_DATASOURCE');

  expect(dataset).toEqual(datasource);
});

test('updateSlice with add to existing dashboard handles failure', async () => {
  fetchMock.reset();
  const sampleError = new Error('sampleError');
  mockedGetClientErrorObject.mockImplementation(() =>
    Promise.resolve(sampleError),
  );
  fetchMock.post(saveDatasetEndpoint, { throws: sampleError });
  const dispatch = sinon.spy();

  let caughtError;
  try {
    await saveDataset(SAVE_DATASET_POST_ARGS)(dispatch);
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toEqual(sampleError);
  expect(fetchMock.calls(saveDatasetEndpoint)).toHaveLength(4);
  expect(mockedGetClientErrorObject).toHaveBeenCalledWith(sampleError);
});
