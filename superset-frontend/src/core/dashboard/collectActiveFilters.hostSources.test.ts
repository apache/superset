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
import { dashboard as dashboardApi } from '@apache-superset/core';
import DashboardProvider, { HOST_SOURCE_PREFIX } from './DashboardProvider';
import {
  getActiveFiltersForDataset,
  getActiveResolvedFiltersForDataset,
} from './collectActiveFilters';

const DATASET_ID = 1;

const hostFilter = (value: string, targets?: string[]) => ({
  selection: value,
  resolved: {
    column: 'region',
    operator: 'EQUALS' as const,
    value,
    datasource: DATASET_ID,
  },
  targets,
});

let store: DashboardProvider;

beforeEach(() => {
  store = new DashboardProvider();
});

test('a host source applies to every consumer on the same dataset', () => {
  const consumerId = store.addWidget(store.getRoot().id, 0, {
    type: 'echarts',
  });

  store.emit(
    `${HOST_SOURCE_PREFIX}region`,
    dashboardApi.VALUE_CHANGED_EVENT,
    hostFilter('west'),
  );

  expect(
    getActiveResolvedFiltersForDataset(store, DATASET_ID, consumerId),
  ).toEqual([
    { column: 'region', operator: 'EQUALS', value: 'west', datasource: 1 },
  ]);
  expect(getActiveFiltersForDataset(store, DATASET_ID, consumerId)).toEqual([
    {
      expressionType: 'SIMPLE',
      subject: 'region',
      clause: 'WHERE',
      operator: '==',
      comparator: 'west',
    },
  ]);
  expect(getActiveFiltersForDataset(store, 2, consumerId)).toEqual([]);
});

test('a host source with targets applies only to the targeted nodes', () => {
  const rootId = store.getRoot().id;
  const targeted = store.addWidget(rootId, 0, { type: 'echarts' });
  const other = store.addWidget(rootId, 1, { type: 'echarts' });

  store.emit(
    `${HOST_SOURCE_PREFIX}region`,
    dashboardApi.VALUE_CHANGED_EVENT,
    hostFilter('west', [targeted]),
  );

  expect(getActiveFiltersForDataset(store, DATASET_ID, targeted)).toHaveLength(
    1,
  );
  expect(getActiveFiltersForDataset(store, DATASET_ID, other)).toEqual([]);
});

test('a cleared host source no longer applies', () => {
  const consumerId = store.addWidget(store.getRoot().id, 0, {
    type: 'echarts',
  });
  const sourceId = `${HOST_SOURCE_PREFIX}region`;

  store.emit(sourceId, dashboardApi.VALUE_CHANGED_EVENT, hostFilter('west'));
  store.emit(sourceId, dashboardApi.VALUE_CHANGED_EVENT, {
    selection: null,
    resolved: null,
  });

  expect(getActiveFiltersForDataset(store, DATASET_ID, consumerId)).toEqual([]);
});

test('a value left behind by a node no longer in the tree is ignored', () => {
  const rootId = store.getRoot().id;
  const removed = store.addWidget(rootId, 0, { type: 'echarts' });
  const consumerId = store.addWidget(rootId, 1, { type: 'echarts' });

  store.emit(removed, dashboardApi.VALUE_CHANGED_EVENT, hostFilter('west'));
  store.removeWidget(removed);

  expect(getActiveFiltersForDataset(store, DATASET_ID, consumerId)).toEqual([]);
});

test('sources in one store never reach a consumer in another', () => {
  const other = new DashboardProvider();
  const consumerId = other.addWidget(other.getRoot().id, 0, {
    type: 'echarts',
  });

  store.emit(
    `${HOST_SOURCE_PREFIX}region`,
    dashboardApi.VALUE_CHANGED_EVENT,
    hostFilter('west'),
  );

  expect(getActiveFiltersForDataset(other, DATASET_ID, consumerId)).toEqual([]);
});
