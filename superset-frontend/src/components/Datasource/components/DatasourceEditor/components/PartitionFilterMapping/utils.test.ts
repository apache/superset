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
  applyImplicitMappingMove,
  applyMappingMove,
  clearMappingTransforms,
  defaultTransformFor,
  mappedColumnIsImplicit,
  mappingIsActive,
  nextMappedColumnOverride,
  partitionRowState,
  previewOperatorFor,
  sampleValuesFor,
  resolveMappedColumn,
  suggestedMappedColumn,
  transformCanPreview,
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

  const moved = applyMappingMove(
    columns,
    'event_time',
    'unix_timestamp(:value)',
  );

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

test('removing a mapping clears the transform on every column, not just the mapped one', () => {
  // Removing the override drops the mapping back onto the default datetime
  // column, so a transform left anywhere else is not dormant -- it is the next
  // mapping, armed and invisible.
  const columns = [
    {
      column_name: 'event_time',
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    },
    {
      column_name: 'event_time2',
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    },
  ];

  const cleared = clearMappingTransforms(columns);

  expect(cleared).toMatchObject([
    {
      partition_value_transform: null,
      partition_transform_is_monotonic: false,
    },
    {
      partition_value_transform: null,
      partition_transform_is_monotonic: false,
    },
  ]);
});

test('clearing a mapping nothing holds hands back the same columns', () => {
  // Callers clear unconditionally, and column state's identity is what triggers
  // the editor's validation pass -- a fresh array every time would run it on
  // every unrelated edit.
  const columns = [{ column_name: 'event_time' }, { column_name: 'country' }];

  expect(clearMappingTransforms(columns)).toBe(columns);
});

test('the mapping follows the default datetime column to its new home', () => {
  const columns = [
    {
      column_name: 'event_time',
      is_dttm: true,
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    },
    { column_name: 'event_time2', is_dttm: true },
  ];

  const moved = applyImplicitMappingMove(columns, 'event_time', 'event_time2');

  expect(moved[0]).toMatchObject({
    partition_value_transform: null,
    partition_transform_is_monotonic: false,
  });
  // The ordering declaration travels too: leaving it behind would quietly
  // downgrade a mirrored range to a mirrored equality.
  expect(moved[1]).toMatchObject({
    partition_value_transform: 'unix_timestamp(:value)',
    partition_transform_is_monotonic: true,
  });
});

test('following the default datetime column leaves no transform behind anywhere', () => {
  const columns = [
    {
      column_name: 'event_time',
      partition_value_transform: 'unix_timestamp(:value)',
    },
    { column_name: 'event_time2' },
    {
      column_name: 'legacy_time',
      partition_value_transform: 'to_unixtime(:value)',
      partition_transform_is_monotonic: true,
    },
  ];

  const moved = applyImplicitMappingMove(columns, 'event_time', 'event_time2');

  expect(moved[2]).toMatchObject({
    partition_value_transform: null,
    partition_transform_is_monotonic: false,
  });
});

test('the mapping cannot follow the default datetime column onto a column this list has no row for', () => {
  // A calculated column can be the default datetime column but never renders a
  // transform editor, so carrying one there would make a live mapping the owner
  // has no way to see or undo.
  const columns = [
    {
      column_name: 'event_time',
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    },
  ];

  const moved = applyImplicitMappingMove(columns, 'event_time', 'calc_time');

  expect(moved[0]).toMatchObject({
    partition_value_transform: null,
    partition_transform_is_monotonic: false,
  });
});

test('a default datetime column with no transform carries none over', () => {
  const columns = [
    { column_name: 'event_time' },
    { column_name: 'event_time2' },
  ];

  const moved = applyImplicitMappingMove(columns, 'event_time', 'event_time2');

  expect(moved[1].partition_value_transform ?? null).toBeNull();
});

test('re-selecting the same default datetime column leaves the mapping alone', () => {
  const columns = [
    {
      column_name: 'event_time',
      partition_value_transform: 'unix_timestamp(:value)',
    },
  ];

  expect(applyImplicitMappingMove(columns, 'event_time', 'event_time')).toBe(
    columns,
  );
});

test('clearing the default datetime column clears the mapping transform with it', () => {
  // With no default datetime column and no override there is no mapped column,
  // so the transform has nowhere to live and must not wait for one.
  const columns = [
    {
      column_name: 'event_time',
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    },
  ];

  const moved = applyImplicitMappingMove(columns, 'event_time', undefined);

  expect(moved[0]).toMatchObject({
    partition_value_transform: null,
    partition_transform_is_monotonic: false,
  });
});

test('pre-filling the identity :value auto-declares the transform monotonic', () => {
  // `:value` provably preserves ordering, so a fresh pre-fill of it may check
  // the box for the owner rather than making them assert what cannot be false.
  const columns: PartitionMappingColumn[] = [{ column_name: 'country' }];

  const moved = applyMappingMove(columns, 'country', ':value');

  expect(moved[0]).toMatchObject({
    partition_value_transform: ':value',
    partition_transform_is_monotonic: true,
  });
});

test('pre-filling an engine default leaves monotonicity for the owner', () => {
  // `unix_timestamp(:value)` is not provably order-preserving, so it is not
  // auto-declared the way the bare identity is.
  const columns: PartitionMappingColumn[] = [
    { column_name: 'event_time', is_dttm: true },
  ];

  const moved = applyMappingMove(
    columns,
    'event_time',
    'unix_timestamp(:value)',
  );

  expect(moved[0].partition_transform_is_monotonic).toBeFalsy();
});

test('a temporal column on an engine with a default gets the engine syntax', () => {
  const datasource = {
    partition_value_transform_default: 'unix_timestamp(:value)',
  };

  expect(defaultTransformFor(datasource, COLUMNS[0])).toBe(
    'unix_timestamp(:value)',
  );
});

test('everything else falls back to the bare :value identity transform', () => {
  const datasource = {
    partition_value_transform_default: 'unix_timestamp(:value)',
  };

  // A non-temporal column: the engine's temporal default does not apply, but
  // the field still gets a working starting point instead of being left blank.
  expect(defaultTransformFor(datasource, COLUMNS[2])).toBe(':value');
  // A temporal column on an engine with no default (e.g. Postgres/Presto),
  // where `unix_timestamp(:value)` would not parse.
  expect(defaultTransformFor({}, COLUMNS[0])).toBe(':value');
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
  expect(sampleValuesFor({ column_name: 'event_time', is_dttm: true })).toEqual(
    ['2026-01-15 00:00:00'],
  );
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
  expect(
    suggestedMappedColumn([{ column_name: 'dt_epoch' }], 'dt_epoch'),
  ).toBeNull();
});

test('a transform without the placeholder is not worth a preview request', () => {
  // Nothing to substitute, so the transform is inert however well-formed it is
  // -- and every settled keystroke on the way to writing one would otherwise
  // spend the per-user budget.
  expect(transformCanPreview('unix_timestamp(event_time)')).toBe(false);
  expect(transformCanPreview('unix_timestamp(:values)')).toBe(false);
  expect(transformCanPreview('unix_timestamp(:value)')).toBe(true);
});

test('an empty or missing transform is not previewed', () => {
  expect(transformCanPreview('')).toBe(false);
  expect(transformCanPreview('   ')).toBe(false);
  expect(transformCanPreview(null)).toBe(false);
  expect(transformCanPreview(undefined)).toBe(false);
});

test('a Jinja transform is not previewed', () => {
  // Rejected on save, so previewing it only burns budget.
  expect(transformCanPreview('unix_timestamp({{ current_username() }})')).toBe(
    false,
  );
  expect(transformCanPreview('{% if x %}:value{% endif %}')).toBe(false);
});

test('a column mapped onto itself is not previewed', () => {
  // The backend rejects a self-mapping outright.
  expect(transformCanPreview('lower(:value)', 'dt_epoch', 'dt_epoch')).toBe(
    false,
  );
  expect(transformCanPreview('lower(:value)', 'country', 'region_key')).toBe(
    true,
  );
});

test('the preview gate stays a necessary condition, not a parser', () => {
  // Unparseable, but only the server can say so -- this must not pretend to.
  expect(transformCanPreview('unix_timestamp(:value')).toBe(true);
});

test('choosing a partition column that matches the override clears it', () => {
  // Keeping it would map the column onto itself, which the backend rejects --
  // and it is one click away, since the picker offers every column.
  expect(nextMappedColumnOverride('dt_epoch', 'dt_epoch')).toBeNull();
});

test('choosing an unrelated partition column keeps the override', () => {
  expect(nextMappedColumnOverride('event_time', 'dt_epoch')).toBe('event_time');
});

test('clearing the partition column clears the override with it', () => {
  // Left behind, it would silently re-arm the next mapping.
  expect(nextMappedColumnOverride('event_time', null)).toBeNull();
});

test('no override stays no override', () => {
  expect(nextMappedColumnOverride(null, 'dt_epoch')).toBeNull();
  expect(nextMappedColumnOverride(undefined, 'dt_epoch')).toBeNull();
});
