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

import { partitionedTimeRangeColumn } from './partitionedTimeRange';

const COLUMNS = [
  { column_name: 'event_time', is_dttm: true },
  { column_name: 'region', is_dttm: false },
];

const live = {
  active: true,
  evaluable: true,
  is_monotonic: true,
  mapped_column: 'event_time',
};

test('a live order-preserving mapping puts the time range on the mapped column', () => {
  expect(
    partitionedTimeRangeColumn({
      partition_filter_mapping: live,
      columns: COLUMNS,
    }),
  ).toBe('event_time');
});

test.each([
  ['no mapping', null],
  ['an inactive mapping', { ...live, active: false }],
  ['a transform the engine refused', { ...live, evaluable: false }],
  // SC-130302: never probed, or the verdict expired. A broken transform in
  // this state got the default, which scanned every partition anyway and
  // narrowed the value list to nothing.
  ['a transform nothing has confirmed', { ...live, evaluable: null }],
  ['a summary with no verdict', { ...live, evaluable: undefined }],
  // Without the ordering declaration a time range is not mirrored, so it
  // would hide values without saving a single partition read.
  [
    'a transform not declared order-preserving',
    { ...live, is_monotonic: false },
  ],
])('%s gets no default time range', (_, mapping) => {
  expect(
    partitionedTimeRangeColumn({
      partition_filter_mapping: mapping,
      columns: COLUMNS,
    }),
  ).toBeUndefined();
});

test('a mapped column the time column picker does not offer gets none', () => {
  expect(
    partitionedTimeRangeColumn({
      partition_filter_mapping: { ...live, mapped_column: 'region' },
      columns: COLUMNS,
    }),
  ).toBeUndefined();
});
