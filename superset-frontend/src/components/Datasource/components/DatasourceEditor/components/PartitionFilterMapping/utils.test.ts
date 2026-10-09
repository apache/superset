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
  clearUnmappedTransforms,
  clearUnmappedTransformsAcrossMove,
  defaultTransformFor,
  mappedColumnIsImplicit,
  mappingIsActive,
  nextMappedColumnOverride,
  partitionMappingErrors,
  partitionRowState,
  previewOperatorFor,
  sampleValuesFor,
  resolveMappedColumn,
  suggestedMappedColumn,
  transformCanPreview,
  valueTransformIssues,
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

/** Mapping `event_time` onto the `dt_epoch` partition, with no override. */
const MAPPED_TO_EVENT_TIME = {
  main_dttm_col: 'event_time',
  partition_column: 'dt_epoch',
  partition_mapped_column: null,
};

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
  // Wireframe 1g: a partition column is designated but nothing mirrors onto it.
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

  const moved = applyMappingMove(MAPPED_TO_EVENT_TIME, columns, 'country', '');

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

  const moved = applyMappingMove(
    MAPPED_TO_EVENT_TIME,
    columns,
    'country',
    'lower(:value)',
  );

  expect(moved[0].partition_value_transform).toBeNull();
  expect(moved[1].partition_value_transform).toBe('lower(:value)');
});

test('moving the mapping pre-fills the new column when we have a default', () => {
  const columns: PartitionMappingColumn[] = [
    { column_name: 'event_time', is_dttm: true },
  ];

  const moved = applyMappingMove(
    { main_dttm_col: null, partition_column: 'dt_epoch' },
    columns,
    'event_time',
    'unix_timestamp(:value)',
  );

  expect(moved[0].partition_value_transform).toBe('unix_timestamp(:value)');
});

test('moving the mapping does not pick up a leftover transform', () => {
  // The mapping has one mirrored column, so a transform on any *other* column
  // is a leftover some writer stranded there -- not an expression written about
  // this column. Picking it up made "Move mapping to this column" a live
  // mapping with no typing, emitting predicates nobody authored while the
  // pruning indicator stayed green: NEW-R11-01.
  const columns = [
    { column_name: 'event_time', is_dttm: true },
    {
      column_name: 'country',
      partition_value_transform: 'lower(:value)',
      partition_transform_is_monotonic: true,
    },
  ];

  const moved = applyMappingMove(MAPPED_TO_EVENT_TIME, columns, 'country', '');

  expect(moved[1]).toMatchObject({
    partition_value_transform: null,
    partition_transform_is_monotonic: false,
  });
});

test('moving the mapping installs the engine default over a leftover', () => {
  // The move is not refused, only disarmed: it arrives holding whatever the
  // engine offers, which is the same thing a clean column would get.
  const columns = [
    { column_name: 'event_time', is_dttm: true },
    {
      column_name: 'other_time',
      is_dttm: true,
      partition_value_transform: 'to_unixtime(:value)',
      partition_transform_is_monotonic: true,
    },
  ];

  const moved = applyMappingMove(
    MAPPED_TO_EVENT_TIME,
    columns,
    'other_time',
    'unix_timestamp(:value)',
  );

  expect(moved[1]).toMatchObject({
    partition_value_transform: 'unix_timestamp(:value)',
    partition_transform_is_monotonic: false,
  });
});

test('re-selecting the column already mapped keeps its transform', () => {
  const columns = [
    {
      column_name: 'event_time',
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    },
  ];

  const moved = applyMappingMove(
    MAPPED_TO_EVENT_TIME,
    columns,
    'event_time',
    '',
  );

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

test('a transform on a column the mapping does not mirror is cleared', () => {
  // The editor is not the only writer: a PUT, an `override_columns` sync and an
  // import all reach the columns directly, so a dataset can arrive already
  // violating the invariant. The mapped column's own transform stays.
  const columns = [
    {
      column_name: 'event_time',
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    },
    {
      column_name: 'other_time',
      partition_value_transform: 'to_unixtime(:value)',
      partition_transform_is_monotonic: true,
    },
  ];

  const cleared = clearUnmappedTransforms(MAPPED_TO_EVENT_TIME, columns);

  expect(cleared[0]).toMatchObject({
    partition_value_transform: 'unix_timestamp(:value)',
    partition_transform_is_monotonic: true,
  });
  expect(cleared[1]).toMatchObject({
    partition_value_transform: null,
    partition_transform_is_monotonic: false,
  });
});

test('with no mapping at all, no column may hold a transform', () => {
  const columns = [
    {
      column_name: 'event_time',
      partition_value_transform: 'unix_timestamp(:value)',
    },
  ];

  expect(
    clearUnmappedTransforms({ main_dttm_col: 'event_time' }, columns)[0]
      .partition_value_transform,
  ).toBeNull();
});

test('a sync that re-points the mapping cannot arm what the new column holds', () => {
  // NEW-R12-01. The mapping sits explicitly on `country`; `event_time` is the
  // default datetime column and is holding a transform some earlier writer
  // stranded there. A column sync drops `country`, so the override is repaired
  // to null and the mapping falls back to `event_time`.
  //
  // Asked only about the mapping the repair leaves behind, the invariant reads
  // `event_time` as the mapped column and keeps its transform -- which then
  // goes live from a sync nobody typed into: 181 rows instead of 183, 0 instead
  // of 1 for an equality, and the pruning indicator still green. It has to be
  // asked on both sides of the move.
  const before = {
    main_dttm_col: 'event_time',
    partition_column: 'dt_epoch',
    partition_mapped_column: 'country',
  };
  const after = { ...before, partition_mapped_column: null };
  const columns = [
    {
      column_name: 'event_time',
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    },
  ];

  // The bug, stated as the single-sided answer this replaced.
  expect(clearUnmappedTransforms(after, columns)[0]).toMatchObject({
    partition_value_transform: 'unix_timestamp(:value)',
  });

  expect(
    clearUnmappedTransformsAcrossMove(before, after, columns)[0],
  ).toMatchObject({
    partition_value_transform: null,
    partition_transform_is_monotonic: false,
  });
});

test('a sync that moves nothing leaves the mapped transform alone', () => {
  // The limit of the rule above: with both sides agreeing on the mapped column
  // there is no move, and a sync must not cost the owner the transform they
  // wrote. Only a transform parked elsewhere goes.
  const datasource = {
    main_dttm_col: 'event_time',
    partition_column: 'dt_epoch',
    partition_mapped_column: null,
  };
  const columns = [
    {
      column_name: 'event_time',
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    },
    {
      column_name: 'other_time',
      partition_value_transform: 'to_unixtime(:value)',
    },
  ];

  const kept = clearUnmappedTransformsAcrossMove(
    datasource,
    datasource,
    columns,
  );

  expect(kept[0]).toMatchObject({
    partition_value_transform: 'unix_timestamp(:value)',
    partition_transform_is_monotonic: true,
  });
  expect(kept[1].partition_value_transform).toBeNull();
});

test('clearing strays when there are none hands back the same columns', () => {
  // Same contract as `clearMappingTransforms`, and for the same reason: the
  // editor's validation pass keys off column state's identity.
  const columns = [
    {
      column_name: 'event_time',
      partition_value_transform: 'unix_timestamp(:value)',
    },
    { column_name: 'country' },
  ];

  expect(clearUnmappedTransforms(MAPPED_TO_EVENT_TIME, columns)).toBe(columns);
});

test('the value transform does not follow the default datetime column', () => {
  // A transform states how *this* column relates to the partition column, so
  // re-asserting it on a different one turns mirroring on with an expression
  // nobody wrote for it -- and the rows it prunes are silently wrong.
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
  // The destination never held a mapping, so it is handed back untouched --
  // which is the same thing as holding no transform.
  expect(moved[1].partition_value_transform ?? null).toBeNull();
  expect(moved[1].partition_transform_is_monotonic ?? false).toBe(false);
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

test('moving the default datetime column onto a column this list has no row for clears too', () => {
  // A calculated column can be the default datetime column but never renders a
  // transform editor, so a transform left live there is one the owner has no
  // way to see or undo.
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

test('moving the default datetime column when nothing holds a mapping is not a change', () => {
  // `clearMappingTransforms` hands back the same array when no column held
  // anything, and the editor's validation effect keys off column identity.
  const columns = [
    { column_name: 'event_time' },
    { column_name: 'event_time2' },
  ];

  expect(applyImplicitMappingMove(columns, 'event_time', 'event_time2')).toBe(
    columns,
  );
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

test('only temporal columns get a pre-filled transform', () => {
  const datasource = {
    partition_value_transform_default: 'unix_timestamp(:value)',
  };

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
  expect(sampleValuesFor({ column_name: 'event_time', is_dttm: true })).toEqual(
    ['2026-01-15 00:00:00'],
  );
});

test('a temporal column stored as a number previews in its stored representation', () => {
  expect(
    sampleValuesFor({
      column_name: 'event_epoch',
      type: 'BIGINT',
      is_dttm: true,
      python_date_format: 'epoch_s',
    }),
  ).toEqual(['1768435200']);
  expect(
    sampleValuesFor({
      column_name: 'event_epoch_ms',
      type: 'BIGINT',
      is_dttm: true,
      python_date_format: 'epoch_ms',
    }),
  ).toEqual(['1768435200000']);
  // A numeric temporal column without an epoch format still gets numbers,
  // never a timestamp string its own type cannot hold.
  expect(
    sampleValuesFor({ column_name: 'ds_int', type: 'INTEGER', is_dttm: true }),
  ).toEqual(['2025', '2026']);
  expect(
    sampleValuesFor({
      column_name: 'event_time',
      type: 'TIMESTAMP',
      is_dttm: true,
      python_date_format: 'epoch_s',
    }),
  ).toEqual(['2026-01-15 00:00:00']);
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

const withTransform = (
  columnName: string,
  transform: string | null,
): PartitionMappingColumn[] =>
  COLUMNS.map(column =>
    column.column_name === columnName
      ? { ...column, partition_value_transform: transform }
      : column,
  );

test('a well-formed mapping does not stop the save', () => {
  expect(
    partitionMappingErrors(
      {
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
        partition_mapped_column: null,
      },
      withTransform('event_time', 'unix_timestamp(:value)'),
    ),
  ).toEqual([]);
});

test('a dataset with no partition column has nothing to validate', () => {
  expect(
    partitionMappingErrors({ main_dttm_col: 'event_time' }, COLUMNS),
  ).toEqual([]);
});

test('a partition column that is not on the dataset stops the save', () => {
  const issues = partitionMappingErrors(
    { main_dttm_col: 'event_time', partition_column: 'dropped_col' },
    COLUMNS,
  );

  expect(issues).toHaveLength(1);
  expect(issues[0].field).toBe('partition_column');
  expect(issues[0].message).toContain('dropped_col');
});

test('a mapped column override that is not on the dataset stops the save', () => {
  const issues = partitionMappingErrors(
    {
      main_dttm_col: 'event_time',
      partition_column: 'dt_epoch',
      partition_mapped_column: 'dropped_col',
    },
    COLUMNS,
  );

  expect(issues.map(issue => issue.field)).toContain('partition_mapped_column');
  expect(issues[0].message).toContain('dropped_col');
});

test('an explicit self-mapping stops the save', () => {
  // An override naming the partition column is something the owner asked for
  // and can take back, so it is blocking -- Tier 1 in
  // `validate_partition_mapping` too.
  const issues = partitionMappingErrors(
    {
      main_dttm_col: 'event_time',
      partition_column: 'dt_epoch',
      partition_mapped_column: 'dt_epoch',
    },
    COLUMNS,
  );

  expect(issues).toHaveLength(1);
  expect(issues[0].field).toBe('partition_column');
  expect(issues[0].message).toContain('mapped onto itself');
  expect(issues[0].blocking).toBe(true);
});

test('an implicit self-mapping warns but does not stop the save', () => {
  // No override, and `main_dttm_col` happens to equal the partition column.
  // Tier 2 in `validate_partition_mapping` on purpose: metadata sync used to
  // be able to produce this state, and blocking it disabled Save on such a
  // dataset even for a description-only edit -- exactly the unsaveable dataset
  // the backend comment says it avoids.
  const issues = partitionMappingErrors(
    {
      main_dttm_col: 'dt_epoch',
      partition_column: 'dt_epoch',
      partition_mapped_column: null,
    },
    COLUMNS,
  );

  expect(issues).toHaveLength(1);
  expect(issues[0].field).toBe('partition_column');
  expect(issues[0].message).toContain('mapped onto itself');
  expect(issues[0].blocking).toBe(false);
});

test('Jinja in the transform stops the save', () => {
  const issues = partitionMappingErrors(
    {
      main_dttm_col: 'event_time',
      partition_column: 'dt_epoch',
      partition_mapped_column: null,
    },
    withTransform('event_time', "unix_timestamp('{{ ds }}')"),
  );

  expect(issues).toHaveLength(1);
  expect(issues[0].field).toBe('partition_value_transform');
  expect(issues[0].message).toContain('Jinja');
});

test('a non-temporal mapped column must carry a transform', () => {
  const issues = partitionMappingErrors(
    {
      main_dttm_col: 'event_time',
      partition_column: 'dt_epoch',
      partition_mapped_column: 'country',
    },
    withTransform('country', '   '),
  );

  expect(issues).toHaveLength(1);
  expect(issues[0].field).toBe('partition_value_transform');
  expect(issues[0].message).toContain('country');
});

test('a temporal mapped column with no transform saves and stays inactive', () => {
  expect(
    partitionMappingErrors(
      {
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
        partition_mapped_column: null,
      },
      withTransform('event_time', null),
    ),
  ).toEqual([]);
});

test("an unparseable transform is the server's call, not the editor's", () => {
  // Tier 2 on the backend: saved, and inactive until it parses. Blocking it
  // here would cost the owner the rest of their edits.
  expect(
    partitionMappingErrors(
      {
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
        partition_mapped_column: null,
      },
      withTransform('event_time', 'unix_timestamp(:value'),
    ),
  ).toEqual([]);
});

test("a transform missing the placeholder is not the editor's call either", () => {
  expect(
    partitionMappingErrors(
      {
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
        partition_mapped_column: null,
      },
      withTransform('event_time', 'unix_timestamp(event_time)'),
    ),
  ).toEqual([]);
});

test('the transform check judges the text it is handed, not the stored value', () => {
  // What lets the field warn as the owner types while the save gate reads the
  // committed record.
  const stored = {
    column_name: 'country',
    partition_value_transform: ':value',
  };

  expect(valueTransformIssues(stored, '{{ ds }}')).toHaveLength(1);
  expect(valueTransformIssues(stored, ':value')).toEqual([]);
});

test('a column the list has no record of yields no transform issue', () => {
  expect(valueTransformIssues(undefined, '')).toEqual([]);
});

test.each([
  ['a transform with no :value to substitute', 'unix_timestamp(event_time)'],
  ['a transform carrying Jinja', '{{ current_username() }}'],
])('%s is not an active mapping', (_label, transform) => {
  // The backend's own summary reports these inactive, so calling them active
  // here showed the green "filters will automatically apply" message for a
  // mapping that mirrors nothing -- telling an owner their queries prune when
  // they do not.
  const datasource = {
    main_dttm_col: 'event_time',
    partition_column: 'dt_epoch',
  };
  const columns = COLUMNS.map(column =>
    column.column_name === 'event_time'
      ? { ...column, partition_value_transform: transform }
      : column,
  );

  expect(mappingIsActive(datasource, columns)).toBe(false);
});

test('samples follow the mapped column type, not just whether it is temporal', () => {
  // `CAST(:value AS INTEGER)` on an integer column is a real configuration, and
  // evaluating it at 'US' made the engine reject a transform that an actual
  // `IN (2025, 2026)` filter would mirror perfectly well.
  expect(sampleValuesFor({ column_name: 'year', type: 'INTEGER' })).toEqual([
    '2025',
    '2026',
  ]);
  expect(
    sampleValuesFor({ column_name: 'amount', type: 'DECIMAL(10,2)' }),
  ).toEqual(['2025', '2026']);
  expect(sampleValuesFor({ column_name: 'country', type: 'TEXT' })).toEqual([
    'US',
    'CA',
  ]);
});
