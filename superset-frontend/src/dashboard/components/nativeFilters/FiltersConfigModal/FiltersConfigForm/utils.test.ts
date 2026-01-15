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
import { GenericDataType } from '@apache-superset/core/api/core';
import {
  hasTemporalColumns,
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
  const datasets = {
    '7__table': { id: 7 },
    '8__table': { id: 8 },
  };
  const charts = {
    '1': { form_data: { datasource: '7__table' } },
    '2': { form_data: { datasource: '7__table' } },
    '3': { form_data: { datasource: '8__table' } },
  };
  expect(mostUsedDataset(datasets as any, charts as any)).toBe(7);
});

test('mostUsedDataset returns undefined when charts is empty', () => {
  const datasets = { '7__table': { id: 7 } };
  const charts = {};
  expect(mostUsedDataset(datasets as any, charts as any)).toBeUndefined();
});

test('mostUsedDataset returns undefined when dataset not in datasets map', () => {
  const datasets = {};
  const charts = {
    '1': { form_data: { datasource: '7__table' } },
  };
  expect(mostUsedDataset(datasets as any, charts as any)).toBeUndefined();
});

test('mostUsedDataset skips charts without form_data', () => {
  const datasets = {
    '7__table': { id: 7 },
  };
  const charts = {
    '1': { form_data: { datasource: '7__table' } },
    '2': {}, // No form_data
    '3': { form_data: null }, // Null form_data
  };
  expect(mostUsedDataset(datasets as any, charts as any)).toBe(7);
});

test('mostUsedDataset handles single chart correctly', () => {
  const datasets = {
    '8__table': { id: 8 },
  };
  const charts = {
    '1': { form_data: { datasource: '8__table' } },
  };
  expect(mostUsedDataset(datasets as any, charts as any)).toBe(8);
});

// Test doesColumnMatchFilterType - validates column compatibility with filter types
// Used to filter column options in the filter configuration UI

test('doesColumnMatchFilterType returns true when column has no type_generic', () => {
  const column = { column_name: 'name' };
  expect(doesColumnMatchFilterType('filter_select', column as any)).toBe(true);
});

test('doesColumnMatchFilterType returns true for unknown filter type', () => {
  const column = { column_name: 'name', type_generic: GenericDataType.String };
  expect(doesColumnMatchFilterType('unknown_filter', column as any)).toBe(true);
});

test('doesColumnMatchFilterType returns true when column type matches filter_select', () => {
  const stringColumn = {
    column_name: 'name',
    type_generic: GenericDataType.String,
  };
  const numericColumn = {
    column_name: 'count',
    type_generic: GenericDataType.Numeric,
  };
  const boolColumn = {
    column_name: 'active',
    type_generic: GenericDataType.Boolean,
  };
  expect(doesColumnMatchFilterType('filter_select', stringColumn as any)).toBe(
    true,
  );
  expect(doesColumnMatchFilterType('filter_select', numericColumn as any)).toBe(
    true,
  );
  expect(doesColumnMatchFilterType('filter_select', boolColumn as any)).toBe(
    true,
  );
});

test('doesColumnMatchFilterType returns true when column type matches filter_range', () => {
  const numericColumn = {
    column_name: 'count',
    type_generic: GenericDataType.Numeric,
  };
  expect(doesColumnMatchFilterType('filter_range', numericColumn as any)).toBe(
    true,
  );
});

test('doesColumnMatchFilterType returns false when column type does not match filter_range', () => {
  const stringColumn = {
    column_name: 'name',
    type_generic: GenericDataType.String,
  };
  expect(doesColumnMatchFilterType('filter_range', stringColumn as any)).toBe(
    false,
  );
});

test('doesColumnMatchFilterType returns true when column type matches filter_time', () => {
  const temporalColumn = {
    column_name: 'created_at',
    type_generic: GenericDataType.Temporal,
  };
  expect(doesColumnMatchFilterType('filter_time', temporalColumn as any)).toBe(
    true,
  );
});

test('doesColumnMatchFilterType returns false when column type does not match filter_time', () => {
  const stringColumn = {
    column_name: 'name',
    type_generic: GenericDataType.String,
  };
  expect(doesColumnMatchFilterType('filter_time', stringColumn as any)).toBe(
    false,
  );
});
