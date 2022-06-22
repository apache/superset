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
import { setDatasource } from 'src/explore/actions/datasourcesActions';
import datasourcesReducer from '../reducers/datasourcesReducer';

const defaultState = {
  '1__table': {
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
  },
};

test('sets new datasource', () => {
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
  const newState = datasourcesReducer(
    defaultState,
    setDatasource(NEW_DATASOURCE),
  );
  expect(newState).toEqual({ ...defaultState, '2__table': NEW_DATASOURCE });
});
