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
import fetchMock from 'fetch-mock';
import rison from 'rison';
import {
  checkTimeRangeDefaults,
  timeRangeCheckMessage,
  isDivider,
  transformDividerId,
  isNativeFilterDivider,
  isChartCustomizationDivider,
  getItemType,
  getItemTypeInfo,
  hasCircularDependency,
  NATIVE_FILTER_DIVIDER_PREFIX,
  CHART_CUSTOMIZATION_DIVIDER_PREFIX,
  NATIVE_FILTER_PREFIX,
  CHART_CUSTOMIZATION_PREFIX,
} from './utils';
import {
  NativeFilterType,
  ChartCustomizationType,
  type Filter,
  type Level,
} from '@superset-ui/core';

test('isDivider returns true for native filter dividers', () => {
  const dividerId = `${NATIVE_FILTER_DIVIDER_PREFIX}abc123`;
  expect(isDivider(dividerId)).toBe(true);
});

test('isDivider returns true for chart customization dividers', () => {
  const dividerId = `${CHART_CUSTOMIZATION_DIVIDER_PREFIX}xyz789`;
  expect(isDivider(dividerId)).toBe(true);
});

test('isDivider returns false for regular filter IDs', () => {
  const filterId = `${NATIVE_FILTER_PREFIX}abc123`;
  expect(isDivider(filterId)).toBe(false);
});

test('isDivider returns false for regular customization IDs', () => {
  const customizationId = `${CHART_CUSTOMIZATION_PREFIX}xyz789`;
  expect(isDivider(customizationId)).toBe(false);
});

test('isDivider returns false for unrelated strings', () => {
  expect(isDivider('random-string')).toBe(false);
  expect(isDivider('')).toBe(false);
});

test('transformDividerId converts filter divider to customization divider', () => {
  const filterDividerId = `${NATIVE_FILTER_DIVIDER_PREFIX}abc123`;
  const result = transformDividerId(filterDividerId, 'customization');
  expect(result).toBe(`${CHART_CUSTOMIZATION_DIVIDER_PREFIX}abc123`);
});

test('transformDividerId converts customization divider to filter divider', () => {
  const customizationDividerId = `${CHART_CUSTOMIZATION_DIVIDER_PREFIX}xyz789`;
  const result = transformDividerId(customizationDividerId, 'filter');
  expect(result).toBe(`${NATIVE_FILTER_DIVIDER_PREFIX}xyz789`);
});

test('transformDividerId preserves hash when transforming', () => {
  const originalHash = 'uniqueHash123';
  const filterDividerId = `${NATIVE_FILTER_DIVIDER_PREFIX}${originalHash}`;
  const customizationResult = transformDividerId(
    filterDividerId,
    'customization',
  );
  expect(customizationResult).toBe(
    `${CHART_CUSTOMIZATION_DIVIDER_PREFIX}${originalHash}`,
  );

  const backToFilter = transformDividerId(customizationResult, 'filter');
  expect(backToFilter).toBe(filterDividerId);
});

test('isNativeFilterDivider correctly identifies native filter dividers', () => {
  const dividerId = `${NATIVE_FILTER_DIVIDER_PREFIX}abc123`;
  expect(isNativeFilterDivider(dividerId)).toBe(true);

  const customizationDividerId = `${CHART_CUSTOMIZATION_DIVIDER_PREFIX}xyz789`;
  expect(isNativeFilterDivider(customizationDividerId)).toBe(false);
});

test('isChartCustomizationDivider correctly identifies customization dividers', () => {
  const dividerId = `${CHART_CUSTOMIZATION_DIVIDER_PREFIX}xyz789`;
  expect(isChartCustomizationDivider(dividerId)).toBe(true);

  const filterDividerId = `${NATIVE_FILTER_DIVIDER_PREFIX}abc123`;
  expect(isChartCustomizationDivider(filterDividerId)).toBe(false);
});

test('getItemType returns filter for native filter IDs', () => {
  const filterId = `${NATIVE_FILTER_PREFIX}abc123`;
  expect(getItemType(filterId)).toBe('filter');
});

test('getItemType returns filter for native filter divider IDs', () => {
  const dividerId = `${NATIVE_FILTER_DIVIDER_PREFIX}abc123`;
  expect(getItemType(dividerId)).toBe('filter');
});

test('getItemType returns customization for chart customization IDs', () => {
  const customizationId = `${CHART_CUSTOMIZATION_PREFIX}xyz789`;
  expect(getItemType(customizationId)).toBe('customization');
});

test('getItemType returns customization for chart customization divider IDs', () => {
  const dividerId = `${CHART_CUSTOMIZATION_DIVIDER_PREFIX}xyz789`;
  expect(getItemType(dividerId)).toBe('customization');
});

test('getItemType throws error for unknown ID types', () => {
  expect(() => getItemType('unknown-id')).toThrow(
    'Unknown item type for id: unknown-id',
  );
});

test('getItemTypeInfo returns correct info for filter type', () => {
  const info = getItemTypeInfo('filter');
  expect(info.dividerPrefix).toBe(NATIVE_FILTER_DIVIDER_PREFIX);
  expect(info.dividerType).toBe(NativeFilterType.Divider);
  expect(info.itemTypeName).toBe('filter');
});

test('getItemTypeInfo returns correct info for customization type', () => {
  const info = getItemTypeInfo('customization');
  expect(info.dividerPrefix).toBe(CHART_CUSTOMIZATION_DIVIDER_PREFIX);
  expect(info.dividerType).toBe(ChartCustomizationType.Divider);
  expect(info.itemTypeName).toBe('customization');
});

test('hasCircularDependency returns false for a linear chain with no cycle', () => {
  const dependencyMap = new Map<string, string[]>([
    ['a', []],
    ['b', ['a']],
    ['c', ['b']],
  ]);
  expect(hasCircularDependency(dependencyMap, 'c')).toBe(false);
});

test('hasCircularDependency returns true for a filter that depends on itself', () => {
  const dependencyMap = new Map<string, string[]>([['a', ['a']]]);
  expect(hasCircularDependency(dependencyMap, 'a')).toBe(true);
});

test('hasCircularDependency returns true for a 2-node cycle', () => {
  const dependencyMap = new Map<string, string[]>([
    ['a', ['b']],
    ['b', ['a']],
  ]);
  expect(hasCircularDependency(dependencyMap, 'a')).toBe(true);
});

test('hasCircularDependency returns true for a longer 3-node cycle', () => {
  const dependencyMap = new Map<string, string[]>([
    ['a', ['b']],
    ['b', ['c']],
    ['c', ['a']],
  ]);
  expect(hasCircularDependency(dependencyMap, 'a')).toBe(true);
});

test('hasCircularDependency returns false for a diamond with a shared ancestor', () => {
  const dependencyMap = new Map<string, string[]>([
    ['d', ['b', 'c']],
    ['b', ['a']],
    ['c', ['a']],
    ['a', []],
  ]);
  expect(hasCircularDependency(dependencyMap, 'd')).toBe(false);
});

const SERVER: Record<string, [string, string]> = {
  'today : now': ['2025-05-31T00:00:00', '2025-05-31T14:30:00'],
  'Last quarter': ['2025-03-01T00:00:00', '2025-05-31T00:00:00'],
  'Last year': ['2024-05-31T00:00:00', '2025-05-31T00:00:00'],
  'previous calendar year': ['2024-01-01T00:00:00', '2025-01-01T00:00:00'],
  '2025-01-01 : ': ['2025-01-01T00:00:00', ''],
};

const POLICY_A_LEVELS: Level[] = [
  { source: 'global', policy: null },
  {
    source: 'dashboard',
    policy: {
      max_span: { quantity: 3, time_grain: 'P1M' },
      max_look_back: { quantity: 13, time_grain: 'P1M' },
      max_look_forward: { quantity: 0, time_grain: 'P1D' },
    },
  },
];

const timeFilter = (id: string, value?: string) =>
  ({
    id,
    type: NativeFilterType.NativeFilter,
    filterType: 'filter_time',
    name: id,
    defaultDataMask: { filterState: { value } },
  }) as unknown as Filter;

const selectFilter = {
  id: 'NATIVE_FILTER-S',
  type: NativeFilterType.NativeFilter,
  filterType: 'filter_select',
  name: 'Select',
  defaultDataMask: { filterState: {} },
} as unknown as Filter;

const mockTimeRange = (clock = SERVER['today : now']) =>
  fetchMock.get('glob:*/api/v1/time_range/*', ({ url }: { url: string }) => {
    const items = rison.decode(new URL(url).searchParams.get('q')!) as {
      timeRange: string;
    }[];
    return {
      result: items.map(({ timeRange }) => {
        const [since, until] =
          timeRange === 'today : now' ? clock : SERVER[timeRange];
        return { since, until, timeRange, shift: null };
      }),
    };
  });

const timeRangeCalls = () =>
  fetchMock.callHistory.calls('glob:*/api/v1/time_range/*').length;

const LIMITS_FAILED =
  'Time range limits could not be loaded. Queries are paused to protect the database.';

beforeAll(() => fetchMock.mockGlobal());
afterAll(() => fetchMock.hardReset());
afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('checkTimeRangeDefaults: an empty default needs a value', async () => {
  mockTimeRange();
  expect(
    await checkTimeRangeDefaults(
      { T: timeFilter('T'), S: selectFilter },
      POLICY_A_LEVELS,
    ),
  ).toEqual({ T: 'Please choose a valid value' });
  expect(timeRangeCalls()).toBe(0);
});

test('checkTimeRangeDefaults: a valid default has no message', async () => {
  mockTimeRange();
  expect(
    await checkTimeRangeDefaults(
      { T: timeFilter('T', 'Last quarter') },
      POLICY_A_LEVELS,
    ),
  ).toEqual({ T: undefined });
  expect(timeRangeCalls()).toBe(1);
});

test('checkTimeRangeDefaults: a failing default gets the dashboard span text', async () => {
  mockTimeRange();
  expect(
    await checkTimeRangeDefaults(
      { T: timeFilter('T', 'Last year'), S: selectFilter },
      POLICY_A_LEVELS,
    ),
  ).toEqual({
    T: 'Longer than this dashboard allows (3 months)',
  });
});

test('checkTimeRangeDefaults: a default breaking the span and the look-back gets one reason', async () => {
  mockTimeRange();
  expect(
    await checkTimeRangeDefaults(
      { T: timeFilter('T', 'previous calendar year') },
      POLICY_A_LEVELS,
    ),
  ).toEqual({
    T: 'Longer than this dashboard allows (3 months)',
  });
});

test('checkTimeRangeDefaults: a default with a blank end says "End is required on this dashboard"', async () => {
  mockTimeRange();
  expect(
    await checkTimeRangeDefaults(
      { T: timeFilter('T', '2025-01-01 : ') },
      POLICY_A_LEVELS,
    ),
  ).toEqual({ T: 'End is required on this dashboard' });
});

test('checkTimeRangeDefaults: an unavailable check with loaded limits fails closed', async () => {
  mockTimeRange(['', '']);
  expect(
    await checkTimeRangeDefaults(
      { T: timeFilter('T', 'Last quarter') },
      POLICY_A_LEVELS,
    ),
  ).toEqual({ T: 'Time range could not be checked.' });
});

test('checkTimeRangeDefaults: a failed policy marks every time range filter', async () => {
  mockTimeRange();
  expect(
    await checkTimeRangeDefaults(
      {
        T1: timeFilter('T1', 'Last quarter'),
        T2: timeFilter('T2'),
        S: selectFilter,
      },
      null,
    ),
  ).toEqual({ T1: LIMITS_FAILED, T2: LIMITS_FAILED });
  expect(timeRangeCalls()).toBe(0);
});

test('timeRangeCheckMessage: an error preserves the server message', () => {
  expect(
    timeRangeCheckMessage({
      status: 'error',
      timeRange: 'invalid expression',
      message: 'Unable to parse time range: invalid expression',
    }),
  ).toBe('Unable to parse time range: invalid expression');
});
