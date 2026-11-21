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
import type { DashboardInfo } from 'src/dashboard/types';
import {
  useDashboardInfoStore,
  replaceDashboardSemanticDatasets,
  updateDashboardSemanticDataset,
} from '..';
import type { DashboardInfoData } from '../types';

const semanticSource = {
  uid: '2__semantic_view',
  type: DatasourceType.SemanticView,
  columns: [{ column_name: 'event_time', is_dttm: false }],
};

const seed = (dashboardInfo: Partial<DashboardInfo>) =>
  useDashboardInfoStore.setState({
    dashboardInfo: dashboardInfo as DashboardInfo,
  });
const info = () => useDashboardInfoStore.getState().dashboardInfo;
const hydrate = (incoming: Record<string, unknown>) =>
  useDashboardInfoStore
    .getState()
    .hydrateDashboardInfo(incoming as DashboardInfoData);

beforeEach(() => {
  useDashboardInfoStore.setState(useDashboardInfoStore.getInitialState());
});

test('replaces dashboard semantic metadata after a schema refresh', () => {
  seed({
    id: 1,
    semanticDatasets: { dashboardId: 1, datasets: [semanticSource] },
  });
  replaceDashboardSemanticDatasets(1, [
    {
      ...semanticSource,
      columns: [{ column_name: 'event_time', is_dttm: true }],
    },
  ]);
  expect(info().semanticDatasets?.datasets[0].columns[0].is_dttm).toBe(true);
});

test('a completed refresh omitting a source removes stale semantic metadata', () => {
  seed({
    id: 1,
    semanticDatasets: { dashboardId: 1, datasets: [semanticSource] },
  });
  replaceDashboardSemanticDatasets(1, []);
  expect(info().semanticDatasets?.datasets).toEqual([]);
});

test('adding a source updates only its dashboard metadata without a reload', () => {
  seed({ id: 1, semanticDatasets: { dashboardId: 1, datasets: [] } });
  updateDashboardSemanticDataset(1, semanticSource.uid, semanticSource);
  expect(info().semanticDatasets?.datasets).toEqual([semanticSource]);
});

test('dashboard navigation discards the previous dashboard metadata', () => {
  seed({
    id: 1,
    semanticDatasets: { dashboardId: 1, datasets: [semanticSource] },
  });
  hydrate({ id: 2, metadata: {} });
  expect(info().semanticDatasets).toBeNull();
});

test('hydration keeps a matching page-load metadata response', () => {
  seed({ semanticDatasets: { dashboardId: 1, datasets: [semanticSource] } });
  hydrate({ id: 1, metadata: {} });
  expect(info().semanticDatasets?.datasets).toEqual([semanticSource]);
});

test.each(['page first', 'add first'])(
  'same-dashboard hydration rejects a pre-remount add response: %s',
  order => {
    seed({ id: 1 });
    updateDashboardSemanticDataset(
      1,
      semanticSource.uid,
      null,
      'before-remount',
      true,
    );
    expect(info().semanticDatasetRequests).toEqual({
      [semanticSource.uid]: 'before-remount',
    });
    const pendingGeneration = info().semanticDatasetsGeneration;
    hydrate({ id: 1, metadata: {} });
    expect(info().semanticDatasetRequests).toEqual({});
    const freshSource = {
      ...semanticSource,
      columns: [{ column_name: 'event_time', is_dttm: true }],
    };
    const page = () =>
      replaceDashboardSemanticDatasets(
        1,
        [freshSource],
        undefined,
        false,
        pendingGeneration,
      );
    const staleAdd = () =>
      updateDashboardSemanticDataset(
        1,
        semanticSource.uid,
        semanticSource,
        'before-remount',
      );
    (order === 'page first' ? [page, staleAdd] : [staleAdd, page]).forEach(
      apply => apply(),
    );
    expect(info().semanticDatasets?.datasets).toEqual([freshSource]);
  },
);

test('page metadata cannot publish before dashboard hydration', () => {
  seed({});
  const before = info();
  replaceDashboardSemanticDatasets(1, [semanticSource]);
  expect(info()).toBe(before);
});

test('a late add response cannot revive metadata invalidated by a newer save', () => {
  seed({ id: 1 });
  updateDashboardSemanticDataset(1, semanticSource.uid, null, 'add', true);
  replaceDashboardSemanticDatasets(1, null, 'save', true);
  updateDashboardSemanticDataset(1, semanticSource.uid, semanticSource, 'add');
  expect(info().semanticDatasets).toBeNull();
});

test('two independent source refreshes both complete', () => {
  const other = { ...semanticSource, uid: '3__semantic_view' };
  seed({ id: 1 });
  updateDashboardSemanticDataset(1, semanticSource.uid, null, 'first', true);
  updateDashboardSemanticDataset(1, other.uid, null, 'second', true);
  updateDashboardSemanticDataset(
    1,
    semanticSource.uid,
    semanticSource,
    'first',
  );
  updateDashboardSemanticDataset(1, other.uid, other, 'second');
  expect(info().semanticDatasets?.datasets).toEqual([semanticSource, other]);
});

test('a save rejects an old page response but accepts a fresh request', () => {
  seed({ id: 1 });
  replaceDashboardSemanticDatasets(1, null, 'save', true);
  replaceDashboardSemanticDatasets(1, [semanticSource], undefined, false, 0);
  expect(info().semanticDatasets).toBeNull();
  replaceDashboardSemanticDatasets(1, [semanticSource], 'save');
  replaceDashboardSemanticDatasets(1, [], undefined, false, 0);
  expect(info().semanticDatasets?.datasets).toEqual([semanticSource]);
  replaceDashboardSemanticDatasets(1, [], undefined, false, 2);
  expect(info().semanticDatasets?.datasets).toEqual([]);
});

test('an in-flight page response retains unaffected sources after an add', () => {
  const existing = { ...semanticSource, uid: '3__semantic_view' };
  seed({ id: 1 });
  updateDashboardSemanticDataset(1, semanticSource.uid, null, 'add', true);
  replaceDashboardSemanticDatasets(
    1,
    [existing, { ...semanticSource, columns: [] }],
    undefined,
    false,
    0,
  );
  expect(info().semanticDatasets?.datasets).toEqual([existing]);
  updateDashboardSemanticDataset(1, semanticSource.uid, semanticSource, 'add');
  replaceDashboardSemanticDatasets(
    1,
    [existing, { ...semanticSource, columns: [] }],
    undefined,
    false,
    0,
  );
  expect(info().semanticDatasets?.datasets).toEqual([existing, semanticSource]);
});

test.each(['add first', 'save first'])(
  'save and add both retain proven sources: %s',
  order => {
    const added = semanticSource;
    const savedSource = { ...semanticSource, uid: '3__semantic_view' };
    seed({ id: 1 });
    replaceDashboardSemanticDatasets(1, null, 'save', true);
    updateDashboardSemanticDataset(1, added.uid, null, 'add', true);
    const addResult = () =>
      updateDashboardSemanticDataset(1, added.uid, added, 'add');
    const saveResult = () =>
      replaceDashboardSemanticDatasets(1, [savedSource], 'save');
    (order === 'add first'
      ? [addResult, saveResult]
      : [saveResult, addResult]
    ).forEach(apply => apply());
    expect(info().semanticDatasets?.datasets).toEqual([savedSource, added]);
  },
);
