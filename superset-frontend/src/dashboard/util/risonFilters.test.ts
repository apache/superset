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
import { PartialFilters, DataMaskStateWithId } from '@superset-ui/core';
import {
  injectRisonFiltersIntelligently,
  RisonFilter,
  parseRisonFilters,
  risonFiltersToExtraFormDataFilters,
  risonFiltersToString,
  risonToAdhocFilters,
  updateUrlWithUnmatchedFilters,
} from './risonFilters';

const mockNativeFilters: PartialFilters = {
  filter_1: {
    id: 'filter_1',
    targets: [
      {
        column: { name: 'country' },
        datasetId: 1,
      },
    ],
    filterType: 'filter_select',
  },
  filter_2: {
    id: 'filter_2',
    targets: [
      {
        column: { name: 'year' },
        datasetId: 1,
      },
    ],
    filterType: 'filter_range',
  },
  filter_3: {
    id: 'filter_3',
    targets: [
      {
        column: { name: 'Country Code' },
        datasetId: 1,
      },
    ],
    filterType: 'filter_select',
  },
};

const mockDataMask: DataMaskStateWithId = {
  filter_1: {
    id: 'filter_1',
    filterState: { value: undefined },
    ownState: {},
  },
};

test('should parse simple Rison filters', () => {
  const risonString = '(country:USA,year:2024)';
  const result = parseRisonFilters(risonString);

  expect(result).toHaveLength(2);
  expect(result[0]).toEqual({
    subject: 'country',
    operator: '==',
    comparator: 'USA',
  });
  expect(result[1]).toEqual({
    subject: 'year',
    operator: '==',
    comparator: 2024,
  });
});

test('should parse IN operator with array syntax', () => {
  const result = parseRisonFilters('(country:!(USA,Canada))');

  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    subject: 'country',
    operator: 'IN',
    comparator: ['USA', 'Canada'],
  });
});

test('should parse BETWEEN operator', () => {
  const result = parseRisonFilters('(msrp:(between:!(35,200)))');

  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    subject: 'msrp',
    operator: 'BETWEEN',
    comparator: [35, 200],
  });
});

test('should parse NOT operator', () => {
  const result = parseRisonFilters('(NOT:(country:USA))');

  expect(result).toHaveLength(1);
  expect(result[0].operator).toBe('!=');
  expect(result[0].comparator).toBe('USA');
});

test('should parse comparison operators', () => {
  expect(parseRisonFilters('(sales:(gt:100000))')[0].operator).toBe('>');
  expect(parseRisonFilters('(age:(gte:18))')[0].operator).toBe('>=');
  expect(parseRisonFilters('(temp:(lt:32))')[0].operator).toBe('<');
  expect(parseRisonFilters('(price:(lte:1000))')[0].operator).toBe('<=');
});

test('should return empty array for invalid Rison', () => {
  expect(parseRisonFilters('invalid rison')).toEqual([]);
  expect(parseRisonFilters('(unclosed')).toEqual([]);
});

test('should match Rison filter to native filter by column name', () => {
  const risonFilters: RisonFilter[] = [
    { subject: 'country', operator: '==', comparator: 'USA' },
  ];

  const result = injectRisonFiltersIntelligently(
    risonFilters,
    mockNativeFilters,
    mockDataMask,
  );

  expect(result.updatedDataMask.filter_1.filterState?.value).toEqual(['USA']);
  expect(result.unmatchedFilters).toHaveLength(0);
});

test('should match column names with spaces (case-insensitive)', () => {
  const risonFilters: RisonFilter[] = [
    { subject: 'Country Code', operator: '==', comparator: 'USA' },
  ];

  const result = injectRisonFiltersIntelligently(
    risonFilters,
    mockNativeFilters,
    mockDataMask,
  );

  expect(result.updatedDataMask.filter_3.filterState?.value).toEqual(['USA']);
  expect(result.unmatchedFilters).toHaveLength(0);
});

test('should match column names case-insensitively', () => {
  const risonFilters: RisonFilter[] = [
    { subject: 'country code', operator: '==', comparator: 'USA' },
  ];

  const result = injectRisonFiltersIntelligently(
    risonFilters,
    mockNativeFilters,
    mockDataMask,
  );

  expect(result.updatedDataMask.filter_3.filterState?.value).toEqual(['USA']);
  expect(result.unmatchedFilters).toHaveLength(0);
});

test('should handle unmatched filters with fallback', () => {
  const risonFilters: RisonFilter[] = [
    { subject: 'region', operator: '==', comparator: 'North America' },
  ];

  const result = injectRisonFiltersIntelligently(
    risonFilters,
    mockNativeFilters,
    mockDataMask,
  );

  expect(result.unmatchedFilters).toHaveLength(1);
  expect(result.unmatchedFilters[0].subject).toBe('region');
});

test('should convert values correctly for different filter types', () => {
  const risonFilters: RisonFilter[] = [
    { subject: 'country', operator: '==', comparator: 'USA' },
    { subject: 'year', operator: 'BETWEEN', comparator: [2020, 2024] },
  ];

  const result = injectRisonFiltersIntelligently(
    risonFilters,
    mockNativeFilters,
    mockDataMask,
  );

  // Select filter should be array
  expect(result.updatedDataMask.filter_1.filterState?.value).toEqual(['USA']);

  // Range filter should be min/max object
  expect(result.updatedDataMask.filter_2.filterState?.value).toEqual({
    min: 2020,
    max: 2024,
  });

  expect(result.unmatchedFilters).toHaveLength(0);
});

test('should set extraFormData for auto-application on select filters', () => {
  const risonFilters: RisonFilter[] = [
    { subject: 'country', operator: '==', comparator: 'USA' },
  ];

  const result = injectRisonFiltersIntelligently(
    risonFilters,
    mockNativeFilters,
    mockDataMask,
  );

  expect(result.updatedDataMask.filter_1.extraFormData).toEqual({
    filters: [{ col: 'country', op: 'IN', val: ['USA'] }],
  });
});

test('should set extraFormData for auto-application on IN filters', () => {
  const risonFilters: RisonFilter[] = [
    { subject: 'country', operator: 'IN', comparator: ['USA', 'Canada'] },
  ];

  const result = injectRisonFiltersIntelligently(
    risonFilters,
    mockNativeFilters,
    mockDataMask,
  );

  expect(result.updatedDataMask.filter_1.filterState?.value).toEqual([
    'USA',
    'Canada',
  ]);
  expect(result.updatedDataMask.filter_1.extraFormData).toEqual({
    filters: [{ col: 'country', op: 'IN', val: ['USA', 'Canada'] }],
  });
});

test('should set extraFormData for auto-application on BETWEEN filters', () => {
  const risonFilters: RisonFilter[] = [
    { subject: 'year', operator: 'BETWEEN', comparator: [2020, 2024] },
  ];

  const result = injectRisonFiltersIntelligently(
    risonFilters,
    mockNativeFilters,
    mockDataMask,
  );

  expect(result.updatedDataMask.filter_2.filterState?.value).toEqual({
    min: 2020,
    max: 2024,
  });
  expect(result.updatedDataMask.filter_2.extraFormData).toEqual({
    filters: [
      { col: 'year', op: '>=', val: 2020 },
      { col: 'year', op: '<=', val: 2024 },
    ],
  });
});

test('should handle mixed matched and unmatched filters', () => {
  const risonFilters: RisonFilter[] = [
    { subject: 'country', operator: '==', comparator: 'USA' },
    { subject: 'category', operator: '==', comparator: 'Sales' },
  ];

  const result = injectRisonFiltersIntelligently(
    risonFilters,
    mockNativeFilters,
    mockDataMask,
  );

  expect(result.updatedDataMask.filter_1.filterState?.value).toEqual(['USA']);
  expect(result.unmatchedFilters).toHaveLength(1);
  expect(result.unmatchedFilters[0].subject).toBe('category');
});

test('should convert filters to adhoc format', () => {
  const risonFilters: RisonFilter[] = [
    { subject: 'country', operator: '==', comparator: 'USA' },
  ];

  const adhocFilters = risonToAdhocFilters(risonFilters);

  expect(adhocFilters).toHaveLength(1);
  expect(adhocFilters[0]).toMatchObject({
    expressionType: 'SIMPLE',
    clause: 'WHERE',
    subject: 'country',
    operator: '==',
    comparator: 'USA',
  });
});

test('should convert filters to Rison string', () => {
  const filters: RisonFilter[] = [
    { subject: 'country', operator: '==', comparator: 'USA' },
  ];

  const result = risonFiltersToString(filters);
  expect(result).toBe('(country:USA)');
});

test('should convert IN filters to Rison string', () => {
  const filters: RisonFilter[] = [
    { subject: 'country', operator: 'IN', comparator: ['USA', 'Canada'] },
  ];

  const result = risonFiltersToString(filters);
  expect(result).toBe('(country:!(USA,Canada))');
});

test('should return empty string for empty filters', () => {
  expect(risonFiltersToString([])).toBe('');
});

test('risonFiltersToExtraFormDataFilters expands BETWEEN into two clauses', () => {
  const filters: RisonFilter[] = [
    { subject: 'country', operator: '==', comparator: 'USA' },
    { subject: 'year', operator: 'BETWEEN', comparator: [2020, 2024] },
  ];

  expect(risonFiltersToExtraFormDataFilters(filters)).toEqual([
    { col: 'country', op: 'IN', val: ['USA'] },
    { col: 'year', op: '>=', val: 2020 },
    { col: 'year', op: '<=', val: 2024 },
  ]);
});

test('updateUrlWithUnmatchedFilters goes through history when supplied', () => {
  const replace = jest.fn();
  const history = { replace };

  // Seed the URL so the function has something to read.
  const originalLocation = window.location.href;
  window.history.replaceState({}, '', '/superset/dashboard/1/?f=(country:USA)');

  updateUrlWithUnmatchedFilters(
    [{ subject: 'region', operator: '==', comparator: 'EMEA' }],
    history,
  );

  expect(replace).toHaveBeenCalledTimes(1);
  const call = replace.mock.calls[0][0];
  expect(call.pathname).toBe('/superset/dashboard/1/');
  expect(call.search).toContain('f=');
  expect(call.search).toContain('region');

  // Restore.
  window.history.replaceState({}, '', originalLocation);
});

test('updateUrlWithUnmatchedFilters drops f= when no unmatched remain', () => {
  const replace = jest.fn();
  const originalLocation = window.location.href;
  window.history.replaceState({}, '', '/superset/dashboard/1/?f=(country:USA)');

  updateUrlWithUnmatchedFilters([], { replace });

  expect(replace).toHaveBeenCalledTimes(1);
  expect(replace.mock.calls[0][0].search).toBe('');

  window.history.replaceState({}, '', originalLocation);
});

test('updateUrlWithUnmatchedFilters cleanup is observable by history readers', () => {
  // Validates PR review item #3: the URL cleanup must go through a path
  // that downstream history-readers (e.g. publishDataMask) observe. The
  // raw window.history.replaceState fallback alone left react-router's
  // history.location.search stale, causing publishDataMask to re-append
  // the original f= on the next interaction.
  //
  // Stand in for react-router's history with a fake whose `.location`
  // updates synchronously when .replace is called — same contract as
  // react-router-dom's history.replace.
  const fakeHistory = {
    location: {
      pathname: '/superset/dashboard/1/',
      search: '?f=(country:USA)',
    },
    replace(next: { pathname: string; search: string }) {
      this.location = next;
    },
  };
  const originalLocation = window.location.href;
  window.history.replaceState({}, '', '/superset/dashboard/1/?f=(country:USA)');

  updateUrlWithUnmatchedFilters(
    [{ subject: 'sales', operator: '>', comparator: 1000 }],
    fakeHistory,
  );

  // After cleanup, a reader of history.location.search (the same path
  // publishDataMask uses) must NOT see the original matched filter.
  expect(fakeHistory.location.search).not.toContain('country');
  expect(fakeHistory.location.search).toContain('sales');

  window.history.replaceState({}, '', originalLocation);
});
