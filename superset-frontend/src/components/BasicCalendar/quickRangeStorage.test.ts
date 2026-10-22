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
import {
  quickRangeStorageKey,
  readQuickRange,
  rememberQuickRange,
  restoreQuickRangeDataMasks,
} from './quickRangeStorage';

const key = quickRangeStorageKey(1, 7, 'filter-a', 'datetime')!;

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('stores the relative quick range instead of its resolved timestamps', () => {
  rememberQuickRange(key, 'Last 4 hours', 'datetime');
  expect(localStorage.getItem(key)).toBe('Last 4 hours');
  expect(readQuickRange(key, 'datetime')).toBe('Last 4 hours');
});

test('manual timestamps and clearing remove the previous quick range', () => {
  rememberQuickRange(key, 'Last 4 hours', 'datetime');
  rememberQuickRange(
    key,
    '2026-10-22T12:00:00 : 2026-10-22T16:00:00',
    'datetime',
  );
  expect(readQuickRange(key, 'datetime')).toBeUndefined();
  rememberQuickRange(key, 'Last hour', 'datetime');
  rememberQuickRange(key, undefined, 'datetime');
  expect(localStorage.getItem(key)).toBeNull();
});

test('preferences are isolated by user, dashboard, filter and mode', () => {
  const original = quickRangeStorageKey(1, 7, 'filter-a', 'date');
  expect(quickRangeStorageKey(2, 7, 'filter-a', 'date')).not.toBe(original);
  expect(quickRangeStorageKey(1, 8, 'filter-a', 'date')).not.toBe(original);
  expect(quickRangeStorageKey(1, 7, 'filter-b', 'date')).not.toBe(original);
  expect(key).not.toBe(original);
  expect(
    quickRangeStorageKey(undefined, 7, 'filter-a', 'date'),
  ).toBeUndefined();
});

test('invalid or incompatible stored ranges are ignored', () => {
  localStorage.setItem(key, '2026-10-01 : 2026-10-08');
  expect(readQuickRange(key, 'datetime')).toBeUndefined();
  localStorage.setItem(key, 'Last week');
  expect(readQuickRange(key, 'datetime')).toBeUndefined();
  expect(readQuickRange(key, 'date')).toBe('Last week');
});

test('restricted browser storage never prevents the filter from working', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage blocked');
  });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage blocked');
  });
  expect(readQuickRange(key, 'datetime')).toBeUndefined();
  expect(() => rememberQuickRange(key, 'Last hour', 'datetime')).not.toThrow();
});

test('dashboard hydration restores simple-filter preferences as relative expressions', () => {
  const dateKey = quickRangeStorageKey(1, 7, 'date-filter', 'date')!;
  const timeKey = quickRangeStorageKey(1, 7, 'time-filter', 'datetime')!;
  localStorage.setItem(dateKey, 'Last month');
  localStorage.setItem(timeKey, 'Last 4 hours');
  expect(
    restoreQuickRangeDataMasks(
      [
        { id: 'date-filter', filterType: 'filter_simple_date_range' },
        { id: 'time-filter', filterType: 'filter_simple_datetime_range' },
        { id: 'other-filter', filterType: 'filter_time' },
      ],
      1,
      7,
      false,
    ),
  ).toEqual({
    'date-filter': {
      id: 'date-filter',
      extraFormData: { time_range: 'Last month' },
      filterState: { value: 'Last month' },
      ownState: {},
    },
    'time-filter': {
      id: 'time-filter',
      extraFormData: { time_range: 'Last 4 hours' },
      filterState: { value: 'Last 4 hours' },
      ownState: {},
    },
  });
});

test('explicit URL or permalink state takes precedence during hydration', () => {
  localStorage.setItem(
    quickRangeStorageKey(1, 7, 'date-filter', 'date')!,
    'Last month',
  );
  expect(
    restoreQuickRangeDataMasks(
      [{ id: 'date-filter', filterType: 'filter_simple_date_range' }],
      1,
      7,
      true,
    ),
  ).toEqual({});
});
