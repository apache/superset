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
import type { DataMask, DataMaskStateWithId } from '@superset-ui/core';
import {
  clearSavedDashboardFilters,
  FilterConfigEntry,
  getDashboardFiltersStorageKey,
  getFilterFingerprint,
  loadSavedDashboardFilters,
  saveDashboardFilters,
} from './dashboardFilterPersistence';

const USER_ID = 7;
const DASHBOARD_ID = 3;
const KEY = getDashboardFiltersStorageKey(USER_ID, DASHBOARD_ID);

const countryControlValues = { multiSelect: true, inverseSelection: false };

const countryFilter: FilterConfigEntry = {
  id: 'NATIVE_FILTER-country',
  type: 'NATIVE_FILTER',
  name: 'Country',
  filterType: 'filter_select',
  targets: [{ datasetId: 1, column: { name: 'country' } }],
  controlValues: countryControlValues,
};

const countryMask: DataMask & { id: string } = {
  id: 'NATIVE_FILTER-country',
  extraFormData: { filters: [{ col: 'country', op: 'IN', val: ['FR'] }] },
  filterState: { value: ['FR'] },
};

const save = (
  dataMask: DataMaskStateWithId,
  filters: FilterConfigEntry[] = [countryFilter],
) =>
  saveDashboardFilters({
    dashboardId: DASHBOARD_ID,
    userId: USER_ID,
    dataMask,
    filters,
  });

const load = (filterConfig: (FilterConfigEntry | null)[] = [countryFilter]) =>
  loadSavedDashboardFilters({
    dashboardId: DASHBOARD_ID,
    userId: USER_ID,
    filterConfig,
  });

beforeEach(() => {
  localStorage.clear();
});

test('restores saved selections for the same filters', () => {
  save({ [countryMask.id]: countryMask });

  expect(load()).toEqual({ [countryMask.id]: countryMask });
});

test('scopes saved selections to the user and dashboard', () => {
  save({ [countryMask.id]: countryMask });

  expect(Object.keys(localStorage)).toEqual([
    'dashboard__native_filters__7__3',
  ]);
  expect(
    loadSavedDashboardFilters({
      dashboardId: DASHBOARD_ID,
      userId: 8,
      filterConfig: [countryFilter],
    }),
  ).toBeNull();
});

test('keeps the key for a user id of 0', () => {
  expect(getDashboardFiltersStorageKey(0, DASHBOARD_ID)).toBe(
    'dashboard__native_filters__0__3',
  );
});

test('saves only native filters, not dividers, customizations or cross-filters', () => {
  save(
    {
      [countryMask.id]: countryMask,
      'DIVIDER-1': { id: 'DIVIDER-1' },
      'CHART_CUSTOMIZATION-1': { id: 'CHART_CUSTOMIZATION-1' },
      '42': { id: '42', extraFormData: { filters: [] } },
    },
    [
      countryFilter,
      { id: 'DIVIDER-1', type: 'DIVIDER' },
      { id: 'CHART_CUSTOMIZATION-1', type: 'CHART_CUSTOMIZATION' },
    ],
  );

  const saved = JSON.parse(localStorage.getItem(KEY)!);
  expect(Object.keys(saved.dataMask)).toEqual([countryMask.id]);
  expect(Object.keys(saved.fingerprints)).toEqual([countryMask.id]);
});

test('never overwrites saved selections with an empty set', () => {
  save({ [countryMask.id]: countryMask });
  save({});

  expect(load()).toEqual({ [countryMask.id]: countryMask });
});

test('skips the write when nothing changed', () => {
  save({ [countryMask.id]: countryMask });
  const setItem = jest.spyOn(Storage.prototype, 'setItem');

  save({ [countryMask.id]: countryMask });

  expect(setItem).not.toHaveBeenCalled();
  setItem.mockRestore();
});

test('drops a selection when its filter is retargeted', () => {
  save({ [countryMask.id]: countryMask });

  expect(
    load([
      {
        ...countryFilter,
        targets: [{ datasetId: 1, column: { name: 'region' } }],
      },
    ]),
  ).toBeNull();
});

test('drops a selection when its filter type changes', () => {
  save({ [countryMask.id]: countryMask });

  expect(load([{ ...countryFilter, filterType: 'filter_range' }])).toBeNull();
});

test('drops a selection when a query-shaping control such as the comparator changes', () => {
  save({ [countryMask.id]: countryMask });

  expect(
    load([
      {
        ...countryFilter,
        controlValues: { ...countryControlValues, inverseSelection: true },
      },
    ]),
  ).toBeNull();
});

test('keeps a selection when only display settings change', () => {
  save({ [countryMask.id]: countryMask });

  expect(
    load([
      {
        ...countryFilter,
        name: 'Renamed',
        description: 'New description',
        defaultDataMask: { filterState: { value: ['DE'] } },
      },
    ]),
  ).toEqual({ [countryMask.id]: countryMask });
});

test('fingerprints ignore object key order', () => {
  expect(
    getFilterFingerprint({ controlValues: { a: 1, b: 2 }, filterType: 'x' }),
  ).toBe(
    getFilterFingerprint({ filterType: 'x', controlValues: { b: 2, a: 1 } }),
  );
});

test('drops selections for filters that no longer exist', () => {
  save({ [countryMask.id]: countryMask });

  expect(load([])).toBeNull();
});

test('ignores null rows in the filter configuration', () => {
  save({ [countryMask.id]: countryMask });

  expect(load([null, countryFilter])).toEqual({
    [countryMask.id]: countryMask,
  });
});

test.each([
  ['invalid JSON', '{not json'],
  ['an array', '[]'],
  ['a primitive', '42'],
  ['an unversioned mask', JSON.stringify({ [countryMask.id]: countryMask })],
  [
    'a null data mask',
    JSON.stringify({ version: 1, dataMask: null, fingerprints: {} }),
  ],
  [
    'a newer version',
    JSON.stringify({ version: 2, dataMask: {}, fingerprints: {} }),
  ],
])('ignores %s in storage', (_label, raw) => {
  localStorage.setItem(KEY, raw);

  expect(load()).toBeNull();
});

test('ignores a malformed entry inside an otherwise valid value', () => {
  const fingerprint = getFilterFingerprint(countryFilter);
  localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 1,
      dataMask: { [countryMask.id]: null },
      fingerprints: { [countryMask.id]: fingerprint },
    }),
  );

  expect(load()).toBeNull();
});

test("clears every user's saved selections", () => {
  localStorage.setItem('dashboard__native_filters__1__2', '{}');
  localStorage.setItem('dashboard__native_filters__3__4', '{}');
  localStorage.setItem('redux', 'kept');

  clearSavedDashboardFilters();

  expect(Object.keys(localStorage)).toEqual(['redux']);
});

test("can keep one user's saved selections while clearing the rest", () => {
  localStorage.setItem('dashboard__native_filters__1__2', '{}');
  localStorage.setItem('dashboard__native_filters__12__2', '{}');
  localStorage.setItem('dashboard__native_filters__3__4', '{}');

  clearSavedDashboardFilters(1);

  expect(Object.keys(localStorage)).toEqual([
    'dashboard__native_filters__1__2',
  ]);
});

test('does not throw when storage is unavailable', () => {
  const getItem = jest
    .spyOn(Storage.prototype, 'getItem')
    .mockImplementation(() => {
      throw new Error('denied');
    });
  const setItem = jest
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('quota');
    });

  expect(load()).toBeNull();
  expect(() => save({ [countryMask.id]: countryMask })).not.toThrow();
  getItem.mockRestore();
  setItem.mockRestore();
});
