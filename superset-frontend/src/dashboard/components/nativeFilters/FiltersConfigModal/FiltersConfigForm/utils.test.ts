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
import { Column } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import {
  ChartsState,
  DatasourcesState,
  Datasource,
  Chart,
} from 'src/dashboard/types';
import {
  hasTemporalColumns,
  isValidFilterValue,
  shouldShowTimeRangePicker,
  mostUsedDataset,
  doesColumnMatchFilterType,
} from './utils';

// Test hasTemporalColumns - validates time range pre-filter visibility logic
// This addresses the coverage gap from the skipped FiltersConfigModal test
// "doesn't render time range pre-filter if there are no temporal columns in datasource"

type DatasetParam = Parameters<typeof hasTemporalColumns>[0];

const createDataset = (
  columnTypes: GenericDataType[] | undefined,
): DatasetParam => ({ column_types: columnTypes }) as DatasetParam;

// Typed fixture helpers for mostUsedDataset tests
const createDatasourcesState = (
  entries: Array<{ key: string; id: number }>,
): DatasourcesState =>
  Object.fromEntries(
    entries.map(({ key, id }) => [key, { id } as Partial<Datasource>]),
  ) as DatasourcesState;

const createChartsState = (
  entries: Array<{ key: string; datasource?: string }>,
): ChartsState =>
  Object.fromEntries(
    entries.map(({ key, datasource }) => [
      key,
      datasource !== undefined
        ? ({ form_data: { datasource } } as Partial<Chart>)
        : ({} as Partial<Chart>),
    ]),
  ) as ChartsState;

// Typed fixture helper for doesColumnMatchFilterType tests
const createColumn = (
  column_name: string,
  type_generic?: GenericDataType,
): Column => ({ column_name, type_generic }) as Column;

test('hasTemporalColumns returns true when column_types is undefined (precautionary default)', () => {
  const dataset = createDataset(undefined);
  expect(hasTemporalColumns(dataset)).toBe(true);
});

test('hasTemporalColumns returns true when column_types is empty array (precautionary default)', () => {
  const dataset = createDataset([]);
  expect(hasTemporalColumns(dataset)).toBe(true);
});

test('hasTemporalColumns returns true when column_types includes Temporal', () => {
  const dataset = createDataset([
    GenericDataType.String,
    GenericDataType.Temporal,
    GenericDataType.Numeric,
  ]);
  expect(hasTemporalColumns(dataset)).toBe(true);
});

test('hasTemporalColumns returns true when column_types is only Temporal', () => {
  const dataset = createDataset([GenericDataType.Temporal]);
  expect(hasTemporalColumns(dataset)).toBe(true);
});

test('hasTemporalColumns returns false when column_types has no Temporal columns', () => {
  const dataset = createDataset([
    GenericDataType.String,
    GenericDataType.Numeric,
  ]);
  expect(hasTemporalColumns(dataset)).toBe(false);
});

test('hasTemporalColumns returns false when column_types has only Numeric columns', () => {
  const dataset = createDataset([GenericDataType.Numeric]);
  expect(hasTemporalColumns(dataset)).toBe(false);
});

test('hasTemporalColumns returns false when column_types has only String columns', () => {
  const dataset = createDataset([GenericDataType.String]);
  expect(hasTemporalColumns(dataset)).toBe(false);
});

test('hasTemporalColumns returns false when column_types has Boolean but no Temporal', () => {
  const dataset = createDataset([
    GenericDataType.Boolean,
    GenericDataType.String,
  ]);
  expect(hasTemporalColumns(dataset)).toBe(false);
});

test('hasTemporalColumns handles null dataset gracefully', () => {
  // @ts-expect-error testing null input
  expect(hasTemporalColumns(null)).toBe(true);
});

// Test shouldShowTimeRangePicker - wrapper function used by FiltersConfigForm
// to determine if time range picker should be displayed in pre-filter settings

test('shouldShowTimeRangePicker returns true when dataset is undefined (precautionary default)', () => {
  expect(shouldShowTimeRangePicker(undefined)).toBe(true);
});

test('shouldShowTimeRangePicker returns true when dataset has temporal columns', () => {
  const dataset = createDataset([
    GenericDataType.String,
    GenericDataType.Temporal,
  ]);
  expect(shouldShowTimeRangePicker(dataset)).toBe(true);
});

test('shouldShowTimeRangePicker returns false when dataset has no temporal columns', () => {
  const dataset = createDataset([
    GenericDataType.String,
    GenericDataType.Numeric,
  ]);
  expect(shouldShowTimeRangePicker(dataset)).toBe(false);
});

// Test mostUsedDataset - finds the dataset used by the most charts
// Used to pre-select dataset when creating new filters

test('mostUsedDataset returns the dataset ID used by most charts', () => {
  const datasets = createDatasourcesState([
    { key: '7__table', id: 7 },
    { key: '8__table', id: 8 },
  ]);
  const charts = createChartsState([
    { key: '1', datasource: '7__table' },
    { key: '2', datasource: '7__table' },
    { key: '3', datasource: '8__table' },
  ]);
  expect(mostUsedDataset(datasets, charts)).toBe(7);
});

test('mostUsedDataset returns undefined when charts is empty', () => {
  const datasets = createDatasourcesState([{ key: '7__table', id: 7 }]);
  const charts = createChartsState([]);
  expect(mostUsedDataset(datasets, charts)).toBeUndefined();
});

test('mostUsedDataset returns undefined when dataset not in datasets map', () => {
  const datasets = createDatasourcesState([]);
  const charts = createChartsState([{ key: '1', datasource: '7__table' }]);
  expect(mostUsedDataset(datasets, charts)).toBeUndefined();
});

test('mostUsedDataset skips charts without form_data', () => {
  const datasets = createDatasourcesState([{ key: '7__table', id: 7 }]);
  // Charts without datasource are created without form_data
  const charts = createChartsState([
    { key: '1', datasource: '7__table' },
    { key: '2' }, // No form_data
    { key: '3' }, // No form_data
  ]);
  expect(mostUsedDataset(datasets, charts)).toBe(7);
});

test('mostUsedDataset handles single chart correctly', () => {
  const datasets = createDatasourcesState([{ key: '8__table', id: 8 }]);
  const charts = createChartsState([{ key: '1', datasource: '8__table' }]);
  expect(mostUsedDataset(datasets, charts)).toBe(8);
});

// Test doesColumnMatchFilterType - validates column compatibility with filter types
// Used to filter column options in the filter configuration UI

test('doesColumnMatchFilterType returns true when column has no type_generic', () => {
  const column = createColumn('name');
  expect(doesColumnMatchFilterType('filter_select', column)).toBe(true);
});

test('doesColumnMatchFilterType returns true for unknown filter type', () => {
  const column = createColumn('name', GenericDataType.String);
  expect(doesColumnMatchFilterType('unknown_filter', column)).toBe(true);
});

test('doesColumnMatchFilterType returns true when column type matches filter_select', () => {
  const stringColumn = createColumn('name', GenericDataType.String);
  const numericColumn = createColumn('count', GenericDataType.Numeric);
  const boolColumn = createColumn('active', GenericDataType.Boolean);
  expect(doesColumnMatchFilterType('filter_select', stringColumn)).toBe(true);
  expect(doesColumnMatchFilterType('filter_select', numericColumn)).toBe(true);
  expect(doesColumnMatchFilterType('filter_select', boolColumn)).toBe(true);
});

test('doesColumnMatchFilterType returns true when column type matches filter_range', () => {
  const numericColumn = createColumn('count', GenericDataType.Numeric);
  expect(doesColumnMatchFilterType('filter_range', numericColumn)).toBe(true);
});

test('doesColumnMatchFilterType returns false when column type does not match filter_range', () => {
  const stringColumn = createColumn('name', GenericDataType.String);
  expect(doesColumnMatchFilterType('filter_range', stringColumn)).toBe(false);
});

test('doesColumnMatchFilterType returns true when column type matches filter_time', () => {
  const temporalColumn = createColumn('created_at', GenericDataType.Temporal);
  expect(doesColumnMatchFilterType('filter_time', temporalColumn)).toBe(true);
});

test('doesColumnMatchFilterType returns false when column type does not match filter_time', () => {
  const stringColumn = createColumn('name', GenericDataType.String);
  expect(doesColumnMatchFilterType('filter_time', stringColumn)).toBe(false);
});

// Test isValidFilterValue - validates default value field when "has default value" is enabled
// This is the validation logic used by FiltersConfigForm to show "Please choose a valid value" error

test('isValidFilterValue returns true for non-empty string value (non-range filter)', () => {
  expect(isValidFilterValue('some value', false)).toBe(true);
});

test('isValidFilterValue returns true for non-empty array value (non-range filter)', () => {
  expect(isValidFilterValue(['option1', 'option2'], false)).toBe(true);
});

test('isValidFilterValue returns true for number value (non-range filter)', () => {
  expect(isValidFilterValue(42, false)).toBe(true);
  expect(isValidFilterValue(0, false)).toBe(false); // 0 is falsy
});

test('isValidFilterValue returns false for empty/null/undefined (non-range filter)', () => {
  expect(isValidFilterValue('', false)).toBe(false);
  expect(isValidFilterValue(null, false)).toBe(false);
  expect(isValidFilterValue(undefined, false)).toBe(false);
});

test('isValidFilterValue returns false for empty array (non-range filter)', () => {
  // For multi-select filters, [] means "no selection was made"
  // This should be invalid when "has default value" is enabled
  expect(isValidFilterValue([], false)).toBe(false);
});

test('isValidFilterValue returns true when range filter has at least one non-null value', () => {
  expect(isValidFilterValue([1, 10], true)).toBe(true);
  expect(isValidFilterValue([1, null], true)).toBe(true);
  expect(isValidFilterValue([null, 10], true)).toBe(true);
});

test('isValidFilterValue returns false when range filter has both values null', () => {
  expect(isValidFilterValue([null, null], true)).toBe(false);
});

test('isValidFilterValue returns false when range filter value is not an array', () => {
  expect(isValidFilterValue('not an array', true)).toBe(false);
  expect(isValidFilterValue(null, true)).toBe(false);
  expect(isValidFilterValue(undefined, true)).toBe(false);
});
