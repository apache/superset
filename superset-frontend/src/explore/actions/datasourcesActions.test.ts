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
import { DatasourceType } from '@superset-ui/core';
import {
  setDatasource,
  changeDatasource,
} from 'src/explore/actions/datasourcesActions';
import datasourcesReducer from '../reducers/datasourcesReducer';
import { updateFormDataByDatasource } from './exploreActions';

const CURRENT_DATASOURCE = {
  id: 1,
  uid: '1__table',
  type: DatasourceType.Table,
  columns: [],
  metrics: [],
  column_format: {},
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
  column_format: {},
  verbose_map: {},
  main_dttm_col: '__timestamp',
  // eg. ['["ds", true]', 'ds [asc]']
  datasource_name: 'test datasource',
  description: null,
};

const defaultDatasourcesReducerState = {
  [CURRENT_DATASOURCE.uid]: CURRENT_DATASOURCE,
};

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
