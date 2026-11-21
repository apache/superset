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
import { Dataset } from '@superset-ui/chart-controls';
import { SET_DATASOURCE } from '../actions/datasourcesActions';
import { HYDRATE_EXPLORE, HydrateExplore } from '../actions/hydrateExplore';
import datasourcesReducer from './datasourcesReducer';

type DatasourcesState = Parameters<typeof datasourcesReducer>[0];
type DatasourcesAction = Parameters<typeof datasourcesReducer>[1];

const makeDataset = (overrides: Partial<Dataset> = {}): Dataset =>
  ({
    id: 1,
    type: DatasourceType.Table,
    columns: [],
    metrics: [],
    column_formats: {},
    verbose_map: {},
    main_dttm_col: '__timestamp',
    datasource_name: 'test datasource',
    description: null,
    ...overrides,
  }) as Dataset;

const setDatasourceAction = (datasource: Dataset): DatasourcesAction => ({
  type: SET_DATASOURCE,
  datasource,
});

const hydrateAction = (
  datasources: Record<string, Dataset> | undefined,
): DatasourcesAction =>
  ({
    type: HYDRATE_EXPLORE,
    data: { datasources },
  }) as unknown as HydrateExplore;

test('SET_DATASOURCE adds a datasource keyed by its uid without dropping others', () => {
  const existing = makeDataset({ id: 1, uid: '1__table' });
  const added = makeDataset({ id: 2, uid: '2__table' });

  const newState = datasourcesReducer(
    { '1__table': existing },
    setDatasourceAction(added),
  );

  expect(newState).toEqual({ '1__table': existing, '2__table': added });
});

test('SET_DATASOURCE derives the key from id and type when uid is missing', () => {
  const added = makeDataset({ id: 2, uid: undefined });

  const newState = datasourcesReducer({}, setDatasourceAction(added));

  expect(newState).toEqual({ '2__table': added });
});

test('SET_DATASOURCE replaces the entry that has the same key', () => {
  const original = makeDataset({ id: 1, uid: '1__table' });
  const other = makeDataset({ id: 2, uid: '2__table' });
  const updated = makeDataset({
    id: 1,
    uid: '1__table',
    datasource_name: 'renamed',
  });

  const newState = datasourcesReducer(
    { '1__table': original, '2__table': other },
    setDatasourceAction(updated),
  );

  expect(newState).toEqual({ '1__table': updated, '2__table': other });
  expect(newState['1__table']).toBe(updated);
});

test('SET_DATASOURCE does not mutate the previous state', () => {
  const state: DatasourcesState = {
    '1__table': makeDataset({ id: 1, uid: '1__table' }),
  };
  const snapshot = { ...state };

  const newState = datasourcesReducer(
    state,
    setDatasourceAction(makeDataset({ id: 2, uid: '2__table' })),
  );

  expect(newState).not.toBe(state);
  expect(state).toEqual(snapshot);
});

test('SET_DATASOURCE works when the state is undefined', () => {
  const added = makeDataset({ id: 2, uid: '2__table' });

  const newState = datasourcesReducer(
    undefined as unknown as DatasourcesState,
    setDatasourceAction(added),
  );

  expect(newState).toEqual({ '2__table': added });
});

test('HYDRATE_EXPLORE replaces the whole map with the payload datasources', () => {
  const stale = makeDataset({ id: 1, uid: '1__table' });
  const fresh = makeDataset({ id: 3, uid: '3__table' });

  const newState = datasourcesReducer(
    { '1__table': stale },
    hydrateAction({ '3__table': fresh }),
  );

  expect(newState).toEqual({ '3__table': fresh });
  expect(newState).not.toHaveProperty('1__table');
});

test('HYDRATE_EXPLORE returns a copy rather than the payload object', () => {
  const payloadDatasources = { '3__table': makeDataset({ id: 3 }) };

  const newState = datasourcesReducer({}, hydrateAction(payloadDatasources));

  expect(newState).toEqual(payloadDatasources);
  expect(newState).not.toBe(payloadDatasources);
});

test('HYDRATE_EXPLORE without datasources resets to an empty map', () => {
  const newState = datasourcesReducer(
    { '1__table': makeDataset({ id: 1, uid: '1__table' }) },
    hydrateAction(undefined),
  );

  expect(newState).toEqual({});
});

test('returns an empty map for undefined state and an unknown action', () => {
  const newState = datasourcesReducer(
    undefined as unknown as DatasourcesState,
    {
      type: 'UNKNOWN_ACTION',
    } as unknown as DatasourcesAction,
  );

  expect(newState).toEqual({});
});

test('returns the same state reference for an unknown action', () => {
  const state: DatasourcesState = {
    '1__table': makeDataset({ id: 1, uid: '1__table' }),
  };

  const newState = datasourcesReducer(state, {
    type: 'UNKNOWN_ACTION',
  } as unknown as DatasourcesAction);

  expect(newState).toBe(state);
});
