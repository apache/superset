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
import { NO_TIME_RANGE } from '@superset-ui/core';
import { sharedControls } from '../../src';
import { ControlPanelState } from '../../src/types';

const MAPPING = {
  partition_column: 'dt_epoch',
  mapped_column: 'event_time',
  active: true,
  is_monotonic: true,
  mirrorable_operators: ['<', '<=', '==', '>', '>=', 'IN', 'TEMPORAL_RANGE'],
};

const state = (
  datasource: Record<string, unknown>,
  formData: Record<string, unknown>,
) =>
  ({
    datasource,
    form_data: formData,
  }) as unknown as ControlPanelState;

const partitionMapping = (
  datasource: Record<string, unknown>,
  formData: Record<string, unknown>,
) =>
  sharedControls.time_range.mapStateToProps?.(
    state(datasource, formData),
    {} as never,
  ).partitionMapping;

test('the time range is mirrored when it filters the mapped column', () => {
  expect(
    partitionMapping(
      { partition_filter_mapping: MAPPING },
      { granularity_sqla: 'event_time', time_range: 'Last week' },
    ),
  ).toEqual(MAPPING);
});

test('a time range on another temporal column is not mirrored', () => {
  // The control names no column of its own, so without this check the glyph
  // would appear on a chart whose query has no partition predicate at all.
  expect(
    partitionMapping(
      { partition_filter_mapping: MAPPING },
      { granularity_sqla: 'created_at', time_range: 'Last week' },
    ),
  ).toBeNull();
});

test('"No filter" resolves to no bounds, so nothing is mirrored', () => {
  expect(
    partitionMapping(
      { partition_filter_mapping: MAPPING },
      { granularity_sqla: 'event_time', time_range: NO_TIME_RANGE },
    ),
  ).toBeNull();
});

test('a range needs the monotonicity declaration to mirror', () => {
  expect(
    partitionMapping(
      {
        partition_filter_mapping: {
          ...MAPPING,
          is_monotonic: false,
          mirrorable_operators: ['==', 'IN'],
        },
      },
      { granularity_sqla: 'event_time', time_range: 'Last week' },
    ),
  ).toBeNull();
});

test('always_filter_main_dttm mirrors even when the chart groups by another column', () => {
  // That setting adds a second time filter on the main datetime column, and
  // that one is on the mapped column.
  expect(
    partitionMapping(
      {
        partition_filter_mapping: MAPPING,
        always_filter_main_dttm: true,
        main_dttm_col: 'event_time',
      },
      { granularity_sqla: 'created_at', time_range: 'Last week' },
    ),
  ).toEqual(MAPPING);
});

test('an inactive or absent mapping is not mirrored', () => {
  expect(
    partitionMapping(
      { partition_filter_mapping: { ...MAPPING, active: false } },
      { granularity_sqla: 'event_time', time_range: 'Last week' },
    ),
  ).toBeNull();
  expect(
    partitionMapping(
      {},
      { granularity_sqla: 'event_time', time_range: 'Last week' },
    ),
  ).toBeNull();
});
