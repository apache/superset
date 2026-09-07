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
  applyMappingMove,
  applyPartitionColumnDefaults,
  defaultTransformFor,
  mappedColumnIsImplicit,
  mappingIsActive,
  partitionRowState,
  previewOperatorFor,
  sampleValuesFor,
  resolveMappedColumn,
  suggestedMappedColumn,
} from './utils';
import type { PartitionMappingColumn } from './types';

const COLUMNS = [
  {
    column_name: 'event_time',
    type: 'TIMESTAMP',
    is_dttm: true,
    filterable: true,
    groupby: true,
  },
  { column_name: 'dt_epoch', type: 'BIGINT', filterable: true, groupby: true },
  { column_name: 'country', type: 'TEXT', filterable: true, groupby: true },
];

test('the mapped column follows the default datetime column', () => {
  const datasource = {
    main_dttm_col: 'event_time',
    partition_column: 'dt_epoch',
    partition_mapped_column: null,
  };

  expect(resolveMappedColumn(datasource)).toBe('event_time');
  expect(mappedColumnIsImplicit(datasource)).toBe(true);
});

test('an explicit override wins over the default datetime column', () => {
  const datasource = {
    main_dttm_col: 'event_time',
    partition_column: 'region_key',
    partition_mapped_column: 'country',
  };

  expect(resolveMappedColumn(datasource)).toBe('country');
  expect(mappedColumnIsImplicit(datasource)).toBe(false);
});

test('there is no mapped column without a partition column', () => {
  expect(
    resolveMappedColumn({
      main_dttm_col: 'event_time',
      partition_column: null,
    }),
  ).toBeNull();
});

test('a partition column with no datetime column maps to nothing', () => {
  // Wireframe 1g: the column is hidden from Explore but nothing mirrors onto it.
  const datasource = { main_dttm_col: null, partition_column: 'dt_epoch' };

  expect(resolveMappedColumn(datasource)).toBeNull();
  expect(mappingIsActive(datasource, COLUMNS)).toBe(false);
});

test('a mapping without a transform is configured but inert', () => {
  const datasource = {
    main_dttm_col: 'event_time',
    partition_column: 'dt_epoch',
  };

  expect(mappingIsActive(datasource, COLUMNS)).toBe(false);
});

test('a mapping with a transform is active', () => {
  const datasource = {
    main_dttm_col: 'event_time',
    partition_column: 'dt_epoch',
  };
  const columns = COLUMNS.map(column =>
    column.column_name === 'event_time'
      ? { ...column, partition_value_transform: 'unix_timestamp(:value)' }
      : column,
  );

  expect(mappingIsActive(datasource, columns)).toBe(true);
});

test('a whitespace-only transform does not count as active', () => {
  const datasource = {
    main_dttm_col: 'event_time',
    partition_column: 'dt_epoch',
  };
  const columns = COLUMNS.map(column =>
    column.column_name === 'event_time'
      ? { ...column, partition_value_transform: '   ' }
      : column,
  );

  expect(mappingIsActive(datasource, columns)).toBe(false);
});

test('each column gets one of the three row treatments', () => {
  const datasource = {
    main_dttm_col: 'event_time',
    partition_column: 'dt_epoch',
  };

  expect(partitionRowState(datasource, 'event_time')).toBe('mapped');
  expect(partitionRowState(datasource, 'country')).toBe('unmapped');
  expect(partitionRowState(datasource, 'dt_epoch')).toBe('partition');
});

test('no column has a row treatment without a partition column', () => {
  expect(partitionRowState({ main_dttm_col: 'event_time' }, 'event_time')).toBe(
    'none',
  );
});

test('moving the mapping discards the previous transform', () => {
  // Both cardinalities are one, so reassignment replaces rather than
  // accumulating a second mapping.
  const columns = [
    {
      column_name: 'event_time',
      is_dttm: true,
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    },
    { column_name: 'country' },
  ];

  const moved = applyMappingMove(columns, 'country', '');

  expect(moved[0]).toMatchObject({
    partition_value_transform: null,
    partition_transform_is_monotonic: false,
  });
});

test('moving the mapping clears a transform on any column, not just the last one', () => {
  // Reaching "no mapping" and then mapping a new column must not leave the
  // old transform behind to come back to life later.
  const columns = [
    {
      column_name: 'event_time',
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    },
    { column_name: 'country' },
  ];

  const moved = applyMappingMove(columns, 'country', 'lower(:value)');

  expect(moved[0].partition_value_transform).toBeNull();
  expect(moved[1].partition_value_transform).toBe('lower(:value)');
});

test('moving the mapping pre-fills the new column when we have a default', () => {
  const columns: PartitionMappingColumn[] = [
    { column_name: 'event_time', is_dttm: true },
  ];

  const moved = applyMappingMove(columns, 'event_time', 'unix_timestamp(:value)');

  expect(moved[0].partition_value_transform).toBe('unix_timestamp(:value)');
});

test('moving the mapping keeps a transform the column already had', () => {
  const columns = [
    {
      column_name: 'country',
      partition_value_transform: 'lower(:value)',
    },
  ];

  const moved = applyMappingMove(columns, 'country', '');

  expect(moved[0].partition_value_transform).toBe('lower(:value)');
});

test('re-selecting the column already mapped keeps its transform', () => {
  const columns = [
    {
      column_name: 'event_time',
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    },
  ];

  const moved = applyMappingMove(columns, 'event_time', '');

  expect(moved[0]).toMatchObject({
    partition_value_transform: 'unix_timestamp(:value)',
    partition_transform_is_monotonic: true,
  });
});

test('designating a partition column takes it out of the Explore pickers', () => {
  const updated = applyPartitionColumnDefaults(COLUMNS, 'dt_epoch');

  expect(updated.find(c => c.column_name === 'dt_epoch')).toMatchObject({
    filterable: false,
    groupby: false,
  });
  // Everything else is left alone.
  expect(updated.find(c => c.column_name === 'country')).toMatchObject({
    filterable: true,
    groupby: true,
  });
});

test('only temporal columns get a pre-filled transform', () => {
  const datasource = { partition_value_transform_default: 'unix_timestamp(:value)' };

  expect(defaultTransformFor(datasource, COLUMNS[0])).toBe(
    'unix_timestamp(:value)',
  );
  expect(defaultTransformFor(datasource, COLUMNS[2])).toBe('');
});

test('an engine with no default offers no pre-fill', () => {
  // `unix_timestamp(:value)` would not parse on Postgres, and a wrong default
  // is worse than none.
  expect(defaultTransformFor({}, COLUMNS[0])).toBe('');
});

test('a range is only previewed when the transform preserves ordering', () => {
  expect(
    previewOperatorFor({
      column_name: 'event_time',
      is_dttm: true,
      partition_transform_is_monotonic: true,
    }),
  ).toBe('>=');
  // Previewing a range the mapping would refuse to mirror would report an
  // error against a mapping that is in fact working.
  expect(
    previewOperatorFor({
      column_name: 'event_time',
      is_dttm: true,
      partition_transform_is_monotonic: false,
    }),
  ).toBe('==');
});

test('a non-temporal column previews the IN shape a category filter produces', () => {
  expect(previewOperatorFor({ column_name: 'country' })).toBe('IN');
  expect(sampleValuesFor({ column_name: 'country' })).toEqual(['US', 'CA']);
  expect(sampleValuesFor({ column_name: 'event_time', is_dttm: true })).toEqual([
    '2026-01-15 00:00:00',
  ]);
});

test('"map a column" suggests a temporal column over whatever sorts first', () => {
  // The alternative lands on `revenue`, which nobody would mirror onto a
  // partition key.
  const columns = [
    { column_name: 'revenue', type: 'DOUBLE PRECISION' },
    { column_name: 'dt_epoch', type: 'BIGINT' },
    { column_name: 'event_time', type: 'TIMESTAMP', is_dttm: true },
  ];

  expect(suggestedMappedColumn(columns, 'dt_epoch')).toBe('event_time');
});

test('with no temporal column it falls back to the first non-partition one', () => {
  const columns = [
    { column_name: 'region_key', type: 'TEXT' },
    { column_name: 'country', type: 'TEXT' },
  ];

  expect(suggestedMappedColumn(columns, 'region_key')).toBe('country');
});

test('a dataset of nothing but the partition column suggests nothing', () => {
  expect(suggestedMappedColumn([{ column_name: 'dt_epoch' }], 'dt_epoch')).toBeNull();
});
