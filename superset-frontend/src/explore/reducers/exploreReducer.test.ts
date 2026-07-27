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

import exploreReducer, { ExploreState } from './exploreReducer';
import {
  setStashFormData,
  updateFormDataByDatasource,
} from '../actions/exploreActions';
import { setDatasource } from '../actions/datasourcesActions';
import { Dataset } from '@superset-ui/chart-controls';
import { Currency, DatasourceType, QueryFormData } from '@superset-ui/core';

test('reset hiddenFormData on SET_STASH_FORM_DATA', () => {
  const initialState: ExploreState = {
    form_data: { a: 3, c: 4 } as unknown as QueryFormData,
    controls: {},
  };
  const action = setStashFormData(true, ['a', 'c']) as Parameters<
    typeof exploreReducer
  >[1];
  const newState = exploreReducer(initialState, action);
  expect(newState.form_data).toEqual({});
  expect(newState.hiddenFormData).toEqual({ a: 3, c: 4 });
  const restoreAction = setStashFormData(false, ['c']) as Parameters<
    typeof exploreReducer
  >[1];
  const newState2 = exploreReducer(newState, restoreAction);
  expect(newState2.form_data).toEqual({ c: 4 });
  expect(newState2.hiddenFormData).toEqual({ a: 3 });
});

test('carries the derived currency formats into state.explore.datasource', () => {
  // Charts render from state.explore.datasource, which this action writes, so
  // the reducer is fed whatever setDatasource actually produced. That pins the
  // action-to-reducer seam; datasourcesActions.test.ts pins the thunk half.
  const usd: Currency = { symbol: 'USD', symbolPosition: 'prefix' };
  const prevDatasource: Dataset & { uid: string } = {
    id: 1,
    uid: '1__table',
    type: DatasourceType.Table,
    columns: [],
    metrics: [],
    column_formats: {},
    currency_formats: {},
    verbose_map: {},
    main_dttm_col: '__timestamp',
    datasource_name: 'test datasource',
    description: null,
  };
  // Shaped like an API payload: metrics carry the currency and the lookup key
  // is absent altogether.
  const rawDatasource: Dataset & { uid: string } = {
    id: 2,
    uid: '2__table',
    type: DatasourceType.Table,
    columns: [],
    metrics: [{ uuid: 'sales-uuid', metric_name: 'sales', currency: usd }],
    column_formats: {},
    verbose_map: {},
    main_dttm_col: '__timestamp',
    datasource_name: 'test datasource',
    description: null,
  };
  const initialState: ExploreState = {
    form_data: { datasource: '1__table' } as unknown as QueryFormData,
    controls: {},
    datasource: prevDatasource,
  };

  const { datasource } = setDatasource(rawDatasource);
  const newState = exploreReducer(
    initialState,
    updateFormDataByDatasource(prevDatasource, datasource) as Parameters<
      typeof exploreReducer
    >[1],
  );

  expect(newState.datasource?.currency_formats).toStrictEqual({ sales: usd });
  expect(newState.form_data.datasource).toEqual('2__table');
});

test('skips updates when the field is already updated on SET_STASH_FORM_DATA', () => {
  const initialState: ExploreState = {
    form_data: { a: 3, c: 4 } as unknown as QueryFormData,
    hiddenFormData: { b: 2 } as unknown as Partial<QueryFormData>,
    controls: {},
  };
  const restoreAction = setStashFormData(false, ['c', 'd']) as Parameters<
    typeof exploreReducer
  >[1];
  const newState = exploreReducer(initialState, restoreAction);
  expect(newState).toBe(initialState);
});
