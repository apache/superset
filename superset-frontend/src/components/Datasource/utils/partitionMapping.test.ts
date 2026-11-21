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

import { clearDanglingPartitionMapping, updateColumns } from '.';

const addSuccessToast = jest.fn();

beforeEach(() => {
  addSuccessToast.mockClear();
});

test('the merge base decides which version of an edited column survives', () => {
  // Why `syncMetadata` has to merge against the live column state rather than
  // `datasource.columns`, which is the mount-time snapshot and never moves.
  // `updateColumns` passes an unchanged column through verbatim, so whatever
  // the base holds is what comes out -- these two calls differ only in the
  // base and disagree about the result.
  const sourceCols = [
    { column_name: 'country', type: 'VARCHAR', is_dttm: false },
  ];
  const asStored = {
    column_name: 'country',
    type: 'VARCHAR',
    is_dttm: false,
    description: 'as stored',
    partition_value_transform: 'lower(:value)',
    filterable: true,
    groupby: true,
  };
  // The same column after this session's edits: the mapping removed, the
  // partition-column defaults applied, the description rewritten.
  const asEdited = {
    ...asStored,
    description: 'edited this session',
    partition_value_transform: null,
    filterable: false,
    groupby: false,
  };

  const fromStale = updateColumns([asStored], sourceCols, addSuccessToast);
  expect(fromStale.finalColumns[0]).toMatchObject({
    description: 'as stored',
    partition_value_transform: 'lower(:value)',
    filterable: true,
    groupby: true,
  });

  const fromLive = updateColumns([asEdited], sourceCols, addSuccessToast);
  expect(fromLive.finalColumns[0]).toMatchObject({
    description: 'edited this session',
    partition_value_transform: null,
    filterable: false,
    groupby: false,
  });
});

test('a column sync preserves the partition value transform', () => {
  // The transform is set by hand in the row-expand section, so a sync that
  // reports the same column must not quietly discard it.
  const prevCols = [
    {
      column_name: 'event_time',
      type: 'TIMESTAMP',
      is_dttm: true,
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    },
  ];
  const newCols = [
    { column_name: 'event_time', type: 'TIMESTAMP', is_dttm: true },
  ];

  const result = updateColumns(prevCols, newCols, addSuccessToast);

  expect(result.finalColumns[0]).toMatchObject({
    partition_value_transform: 'unix_timestamp(:value)',
    partition_transform_is_monotonic: true,
  });
});

test('a column sync preserves the transform when the type changes', () => {
  const prevCols = [
    {
      column_name: 'event_time',
      type: 'TIMESTAMP',
      is_dttm: true,
      partition_value_transform: 'unix_timestamp(:value)',
    },
  ];
  const newCols = [
    { column_name: 'event_time', type: 'DATETIME', is_dttm: true },
  ];

  const result = updateColumns(prevCols, newCols, addSuccessToast);

  expect(result.modified).toEqual(['event_time']);
  expect(result.finalColumns[0]).toMatchObject({
    partition_value_transform: 'unix_timestamp(:value)',
  });
});

test('a sync that removes the partition column clears the mapping', () => {
  const datasource = {
    partition_column: 'dt_epoch',
    partition_mapped_column: null,
  };

  expect(
    clearDanglingPartitionMapping(datasource, [
      { column_name: 'event_time' },
      { column_name: 'country' },
    ]),
  ).toEqual({ partition_column: null, partition_mapped_column: null });
});

test('a sync that removes the mapped column clears only the override', () => {
  // The partition column is still real, so the designation survives; the
  // mapping just goes inactive until a column is chosen again.
  const datasource = {
    partition_column: 'dt_epoch',
    partition_mapped_column: 'event_time',
  };

  expect(
    clearDanglingPartitionMapping(datasource, [{ column_name: 'dt_epoch' }]),
  ).toEqual({ partition_column: 'dt_epoch', partition_mapped_column: null });
});

test('a sync that keeps both columns leaves the mapping alone', () => {
  const datasource = {
    partition_column: 'dt_epoch',
    partition_mapped_column: 'event_time',
  };

  expect(
    clearDanglingPartitionMapping(datasource, [
      { column_name: 'dt_epoch' },
      { column_name: 'event_time' },
    ]),
  ).toBeNull();
});

test('a dataset with no partition column needs no change', () => {
  expect(
    clearDanglingPartitionMapping({}, [{ column_name: 'event_time' }]),
  ).toBeNull();
});
