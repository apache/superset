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

/**
 * Tests for the requiredFirstFilter logic in useNativeFilters hook.
 *
 * This tests the core logic that determines whether to block dashboard rendering
 * based on the "Select first filter value by default" (requiredFirst) setting.
 */

const requiredFirstFilterPredicate = (filter: {
  requiredFirst?: boolean;
  filterType?: string;
}) =>
  'requiredFirst' in filter &&
  filter.requiredFirst === true &&
  filter.filterType !== 'filter_time';

/**
 * Unit test for the missingInitialFilters logic.
 * This determines which requiredFirst filters are missing values.
 */
const isMissingValue = (
  filterId: string,
  dataMask: Record<string, { filterState?: { value?: unknown } }>,
) => dataMask[filterId]?.filterState?.value === undefined;

test('requiredFirstFilterPredicate only matches filters with requiredFirst explicitly true', () => {
  expect(
    requiredFirstFilterPredicate({
      requiredFirst: true,
      filterType: 'filter_select',
    }),
  ).toBe(true);

  expect(
    requiredFirstFilterPredicate({
      requiredFirst: false,
      filterType: 'filter_select',
    }),
  ).toBe(false);

  expect(
    requiredFirstFilterPredicate({
      requiredFirst: undefined,
      filterType: 'filter_select',
    }),
  ).toBe(false);

  // Filter without requiredFirst property at all
  expect(requiredFirstFilterPredicate({ filterType: 'filter_select' })).toBe(
    false,
  );
});

test('requiredFirstFilterPredicate excludes time filters even when requiredFirst is true', () => {
  expect(
    requiredFirstFilterPredicate({
      requiredFirst: true,
      filterType: 'filter_time',
    }),
  ).toBe(false);

  expect(
    requiredFirstFilterPredicate({
      requiredFirst: true,
      filterType: 'filter_select',
    }),
  ).toBe(true);
});

test('isMissingValue correctly identifies undefined values', () => {
  // undefined is missing
  expect(
    isMissingValue('filter-1', {
      'filter-1': { filterState: { value: undefined } },
    }),
  ).toBe(true);

  // Missing dataMask entry is also missing
  expect(isMissingValue('filter-1', {})).toBe(true);

  // Missing filterState is missing
  expect(isMissingValue('filter-1', { 'filter-1': {} })).toBe(true);

  // null is NOT missing (null !== undefined)
  expect(
    isMissingValue('filter-1', {
      'filter-1': { filterState: { value: null } },
    }),
  ).toBe(false);

  // empty array is NOT missing ([] !== undefined)
  expect(
    isMissingValue('filter-1', { 'filter-1': { filterState: { value: [] } } }),
  ).toBe(false);

  // actual value is NOT missing
  expect(
    isMissingValue('filter-1', {
      'filter-1': { filterState: { value: ['val'] } },
    }),
  ).toBe(false);
});

test('filters with requiredFirst:false do not block dashboard (regression test for #36062)', () => {
  // This is the exact bug scenario from PR #36062
  const filters = [
    {
      id: 'filter-1',
      name: 'Filter 1',
      requiredFirst: false, // Was true, now disabled
      filterType: 'filter_select',
    },
  ];

  const dataMask = {
    'filter-1': { filterState: { value: undefined } }, // No value set
  };

  // Filter should NOT be included in requiredFirstFilter
  const requiredFirstFilters = filters.filter(requiredFirstFilterPredicate);
  expect(requiredFirstFilters).toHaveLength(0);

  // Therefore, no missing initial filters
  const missingInitialFilters = requiredFirstFilters
    .filter(f => isMissingValue(f.id, dataMask))
    .map(f => f.name);
  expect(missingInitialFilters).toHaveLength(0);

  // Dashboard should show (missingInitialFilters.length === 0)
  const showDashboard = missingInitialFilters.length === 0;
  expect(showDashboard).toBe(true);
});

test('filters with requiredFirst:true and no value block dashboard', () => {
  const filters = [
    {
      id: 'filter-1',
      name: 'Required Filter',
      requiredFirst: true,
      filterType: 'filter_select',
    },
  ];

  const dataMask = {
    'filter-1': { filterState: { value: undefined } },
  };

  const requiredFirstFilters = filters.filter(requiredFirstFilterPredicate);
  expect(requiredFirstFilters).toHaveLength(1);

  const missingInitialFilters = requiredFirstFilters
    .filter(f => isMissingValue(f.id, dataMask))
    .map(f => f.name);
  expect(missingInitialFilters).toEqual(['Required Filter']);

  // Dashboard should NOT show
  const showDashboard = missingInitialFilters.length === 0;
  expect(showDashboard).toBe(false);
});

test('filters with requiredFirst:true and a value allow dashboard to show', () => {
  const filters = [
    {
      id: 'filter-1',
      name: 'Required Filter',
      requiredFirst: true,
      filterType: 'filter_select',
    },
  ];

  const dataMask = {
    'filter-1': { filterState: { value: ['some-value'] } },
  };

  const requiredFirstFilters = filters.filter(requiredFirstFilterPredicate);
  expect(requiredFirstFilters).toHaveLength(1);

  const missingInitialFilters = requiredFirstFilters
    .filter(f => isMissingValue(f.id, dataMask))
    .map(f => f.name);
  expect(missingInitialFilters).toHaveLength(0);

  // Dashboard should show
  const showDashboard = missingInitialFilters.length === 0;
  expect(showDashboard).toBe(true);
});

test('only requiredFirst:true filters without values block dashboard', () => {
  const filters = [
    {
      id: 'filter-1',
      name: 'Required With Value',
      requiredFirst: true,
      filterType: 'filter_select',
    },
    {
      id: 'filter-2',
      name: 'Required Without Value',
      requiredFirst: true,
      filterType: 'filter_select',
    },
    {
      id: 'filter-3',
      name: 'Non-Required',
      requiredFirst: false,
      filterType: 'filter_select',
    },
    {
      id: 'filter-4',
      name: 'Time Filter',
      requiredFirst: true,
      filterType: 'filter_time', // Excluded
    },
  ];

  const dataMask = {
    'filter-1': { filterState: { value: ['val'] } },
    'filter-2': { filterState: { value: undefined } },
    'filter-3': { filterState: { value: undefined } },
    'filter-4': { filterState: { value: undefined } },
  };

  const requiredFirstFilters = filters.filter(requiredFirstFilterPredicate);
  // Only filter-1 and filter-2 should be included (not filter-3 or filter-4)
  expect(requiredFirstFilters.map(f => f.id)).toEqual(['filter-1', 'filter-2']);

  const missingInitialFilters = requiredFirstFilters
    .filter(f => isMissingValue(f.id, dataMask))
    .map(f => f.name);
  // Only filter-2 is missing a value
  expect(missingInitialFilters).toEqual(['Required Without Value']);

  // Dashboard should NOT show because filter-2 is missing
  const showDashboard = missingInitialFilters.length === 0;
  expect(showDashboard).toBe(false);
});
