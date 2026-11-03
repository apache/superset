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
import { DatasourceType, NO_TIME_RANGE } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import type { DynamicTitleConfig } from 'src/dashboard/types';
import {
  createDynamicTitleAlias,
  extractDynamicTitleAliases,
  getChartBaseTitle,
  getDynamicTitleFilterValue,
  getInvalidDynamicTitleAliases,
  hasInvalidDynamicTitleTokens,
  hasNoTemporalTitleSupport,
  resolveDynamicTitle,
} from './dynamicTitle';

const config: DynamicTitleConfig = {
  template: '{{chart_title}} in {{country}}',
  tokenMappings: { country: 'country-filter', unused: 'deleted-filter' },
};
const filters = [{ id: 'country-filter', name: 'Country', value: 'Brazil' }];

test.each([
  [{ sql: 'select * from sales' }, undefined],
  [{ sql: undefined }, undefined],
  [{ columns: [{ is_dttm: false, expression: '{{ from_dttm }}' }] }, undefined],
  [
    { metrics: [{ expression: '{% set t = get_time_filter() %} COUNT(*)' }] },
    undefined,
  ],
  [{}, { adhoc_filters: [{ sqlExpression: '{{ from_dttm }}' }] }],
])('preserves time support for SQL or Jinja %p', (overrides, formData) => {
  expect(
    hasNoTemporalTitleSupport(
      {
        type: DatasourceType.Table,
        sql: null,
        column_types: [GenericDataType.String],
        columns: [{ is_dttm: false }],
        ...overrides,
      },
      formData,
    ),
  ).toBe(false);
});

test.each([
  ['Custom revenue', 'Revenue', 'Custom revenue'],
  ['', 'Revenue', 'Revenue'],
  [undefined, 'Revenue', 'Revenue'],
  ['', undefined, ''],
])(
  'resolves dashboard base title %p over %p',
  (override, original, expected) => {
    expect(getChartBaseTitle(override, original)).toBe(expected);
  },
);

test('renders a title without changing its base title or mapping', () => {
  expect(resolveDynamicTitle(config, 'Revenue', filters)).toBe(
    'Revenue in Brazil',
  );
  expect(config.tokenMappings.country).toBe('country-filter');
});

test.each([
  undefined,
  { ...config, template: '' },
  { ...config, template: '{{ country' },
  { ...config, template: '{{unknown}}' },
  { ...config, template: 'Revenue in {{country}}', tokenMappings: {} },
])('falls back to the complete base title for invalid config %p', candidate => {
  expect(resolveDynamicTitle(candidate, 'Revenue', [])).toBe('Revenue');
});

test('does not leave partial literals when a referenced filter has been cleared', () => {
  expect(
    resolveDynamicTitle(config, 'Revenue', [
      { ...filters[0], value: undefined },
    ]),
  ).toBe('Revenue');
});

test('a removed or out-of-scope filter cannot supply a title value', () => {
  expect(resolveDynamicTitle(config, 'Revenue', [])).toBe('Revenue');
  expect(getInvalidDynamicTitleAliases(config, [])).toEqual(['country']);
});

test('unused mappings do not affect rendering or validation', () => {
  expect(getInvalidDynamicTitleAliases(config, filters)).toEqual([]);
  expect(resolveDynamicTitle(config, 'Revenue', filters)).toBe(
    'Revenue in Brazil',
  );
});

test('reserved chart_title cannot be overridden by a filter mapping', () => {
  expect(
    resolveDynamicTitle(
      {
        template: '{{chart_title}}',
        tokenMappings: { chart_title: 'country-filter' },
      },
      'Revenue',
      filters,
    ),
  ).toBe('Revenue');
});

test('zero and false are rendered as values', () => {
  expect(
    resolveDynamicTitle(config, 'Revenue', [{ ...filters[0], value: '0' }]),
  ).toBe('Revenue in 0');
  expect(
    resolveDynamicTitle(config, 'Revenue', [{ ...filters[0], value: 'false' }]),
  ).toBe('Revenue in false');
});

test('extracts unique aliases repeatedly without regexp state leaks', () => {
  const template = '{{country}} {{ country }} {{chart_title}}';
  expect(extractDynamicTitleAliases(template)).toEqual([
    'country',
    'chart_title',
  ]);
  expect(extractDynamicTitleAliases(template)).toEqual([
    'country',
    'chart_title',
  ]);
  expect(hasInvalidDynamicTitleTokens(template)).toBe(false);
  expect(hasInvalidDynamicTitleTokens('{{ country-name }}')).toBe(true);
});

test('creates valid unique aliases for localized and colliding names', () => {
  expect(createDynamicTitleAlias('País', [])).toBe('pais');
  expect(createDynamicTitleAlias('国家', [])).toBe('filter');
  expect(createDynamicTitleAlias('国家', ['filter'])).toBe('filter_2');
  expect(createDynamicTitleAlias('Chart title', [])).toBe('chart_title_2');
});

test.each([
  [{ value: 0, label: '' }, '0'],
  [{ value: false }, 'false'],
  [{ value: ['BR'], label: 'Brazil' }, 'Brazil'],
  [{ value: ['BR', 'CA'] }, 'BR, CA'],
  [{ value: [], label: 'stale label' }, undefined],
  [{ value: null, label: 'stale label' }, undefined],
  [{ value: '' }, undefined],
  [{ value: [null], label: 'NULL' }, 'NULL'],
])('formats an applied select filter state %p', (filterState, expected) => {
  expect(
    getDynamicTitleFilterValue(
      { filterType: 'filter_select' },
      { filterState },
    ),
  ).toBe(expected);
});

test('treats an unrestricted temporal filter as missing, even when it has a label', () => {
  expect(
    getDynamicTitleFilterValue(
      { filterType: 'filter_time' },
      { filterState: { value: NO_TIME_RANGE, label: 'All dates' } },
    ),
  ).toBeUndefined();
});

test('preserves a range label and ignores a cleared range', () => {
  expect(
    getDynamicTitleFilterValue(
      { filterType: 'filter_range' },
      { filterState: { value: [0, 10], label: '0 ≤ x ≤ 10' } },
    ),
  ).toBe('0 ≤ x ≤ 10');
  expect(
    getDynamicTitleFilterValue(
      { filterType: 'filter_range' },
      { filterState: { value: [null, null], label: 'stale' } },
    ),
  ).toBeUndefined();
});

test('tolerates malformed persisted template values', () => {
  expect(
    resolveDynamicTitle(
      { template: 42 } as unknown as DynamicTitleConfig,
      'Revenue',
      filters,
    ),
  ).toBe('Revenue');
});
