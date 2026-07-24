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

import type { FilterConfiguration } from '@superset-ui/core';
import {
  useDataMaskStore,
  getInitialDataMask,
  buildHydratedDataMask,
} from './useDataMaskStore';

const store = useDataMaskStore;

beforeEach(() => {
  store.setState({ dataMask: {} });
});

test('has empty initial state', () => {
  expect(store.getState().dataMask).toEqual({});
});

test('getInitialDataMask returns the empty mask shape', () => {
  expect(getInitialDataMask('NATIVE_FILTER-1')).toEqual({
    id: 'NATIVE_FILTER-1',
    extraFormData: {},
    filterState: {},
    ownState: {},
  });
});

test('updateDataMask merges into the initial mask shape', () => {
  store.getState().updateDataMask('NATIVE_FILTER-1', {
    filterState: { value: ['a'] },
  });
  expect(store.getState().dataMask['NATIVE_FILTER-1']).toEqual({
    id: 'NATIVE_FILTER-1',
    extraFormData: {},
    filterState: { value: ['a'] },
    ownState: {},
  });
});

test('updateDataMask preserves prior fields on a second update', () => {
  store.getState().updateDataMask('f1', { filterState: { value: ['a'] } });
  store
    .getState()
    .updateDataMask('f1', { extraFormData: { time_range: 'Last week' } });
  expect(store.getState().dataMask.f1.filterState).toEqual({ value: ['a'] });
  expect(store.getState().dataMask.f1.extraFormData).toEqual({
    time_range: 'Last week',
  });
});

test('removeDataMask deletes a single filter entry', () => {
  store.getState().updateDataMask('f1', {});
  store.getState().updateDataMask('f2', {});
  store.getState().removeDataMask('f1');
  expect(store.getState().dataMask.f1).toBeUndefined();
  expect(store.getState().dataMask.f2).toBeDefined();
});

test('clearDataMask empties the whole map', () => {
  store.getState().updateDataMask('f1', {});
  store.getState().clearDataMask();
  expect(store.getState().dataMask).toEqual({});
});

test('hydrateDataMask seeds native filters from the dashboard metadata', () => {
  const metadata = {
    native_filter_configuration: [
      { id: 'NATIVE_FILTER-1', defaultDataMask: { filterState: { value: 1 } } },
    ] as unknown as FilterConfiguration,
  };
  store.getState().hydrateDataMask(metadata);
  expect(store.getState().dataMask['NATIVE_FILTER-1']).toMatchObject({
    id: 'NATIVE_FILTER-1',
    filterState: { value: 1 },
  });
});

test('hydrateDataMask applies the loaded dataMask over the defaults', () => {
  const metadata = {
    native_filter_configuration: [
      { id: 'NATIVE_FILTER-1', defaultDataMask: {} },
    ] as unknown as FilterConfiguration,
  };
  store.getState().hydrateDataMask(metadata, {
    'NATIVE_FILTER-1': {
      id: 'NATIVE_FILTER-1',
      extraFormData: {},
      filterState: { value: ['loaded'] },
      ownState: {},
    },
  });
  expect(store.getState().dataMask['NATIVE_FILTER-1'].filterState).toEqual({
    value: ['loaded'],
  });
});

test('hydrateExploreDataMask merges loaded masks into existing state', () => {
  store.getState().updateDataMask('keep', { filterState: { value: 1 } });
  store.getState().hydrateExploreDataMask({
    incoming: {
      id: 'incoming',
      extraFormData: {},
      filterState: { value: 2 },
      ownState: {},
    },
  });
  expect(store.getState().dataMask.keep).toBeDefined();
  expect(store.getState().dataMask.incoming.filterState).toEqual({ value: 2 });
});

test('setDataMaskForFilterChanges drops deleted filters', () => {
  store.getState().updateDataMask('NATIVE_FILTER-1', {});
  store.getState().updateDataMask('NATIVE_FILTER-2', {});
  store.getState().setDataMaskForFilterChanges({
    modified: [],
    deleted: ['NATIVE_FILTER-1'],
    reordered: [],
  });
  expect(store.getState().dataMask['NATIVE_FILTER-1']).toBeUndefined();
  expect(store.getState().dataMask['NATIVE_FILTER-2']).toBeDefined();
});

test('buildHydratedDataMask seeds cross-filter chart_configuration ids', () => {
  const result = buildHydratedDataMask({ chart_configuration: { 42: {} } }, {});
  expect(result['42']).toEqual(getInitialDataMask('42'));
});

test('buildHydratedDataMask keeps live cross-filters by default, drops them when preserveLiveExtras=false', () => {
  const liveCrossFilter = {
    '99': {
      id: '99',
      extraFormData: {},
      filterState: { value: [1] },
      ownState: {},
    },
  };
  // Initial hydration carries the live cross-filter over.
  expect(buildHydratedDataMask({}, liveCrossFilter)['99']).toBeDefined();
  // In-place discard passes false, clearing it.
  expect(
    buildHydratedDataMask({}, liveCrossFilter, undefined, false)['99'],
  ).toBeUndefined();
});

test('subscribeWithSelector fires when dataMask changes', () => {
  const listener = jest.fn();
  const unsub = store.subscribe(s => s.dataMask, listener);
  store.getState().updateDataMask('f1', {});
  expect(listener).toHaveBeenCalled();
  unsub();
});
