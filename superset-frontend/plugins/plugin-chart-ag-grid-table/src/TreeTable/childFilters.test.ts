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
import { QueryObject } from '@superset-ui/core';
import { parentDateFilters } from './buildQuery';
import { childQueryBase, childRangeApplies } from './childFilters';
import { TreeLevel } from './types';

const level = (time_column: string, apply_date_filter = false): TreeLevel => ({
  key: time_column,
  name: time_column,
  id_column: time_column,
  columns: [],
  detail_fields: [],
  time_column,
  apply_date_filter,
});
const levels = [level('session_started_at'), level('step_started_at', true)];
const range = {
  col: 'session_started_at',
  op: 'TEMPORAL_RANGE' as const,
  val: 'Last week',
};
const base: QueryObject = {
  filters: [
    range,
    { col: 'channel', op: 'IN', val: ['Voice'] },
    { col: 'outcome', op: '==', val: 'Completed' },
    { col: 'result', op: 'IN', val: ['error'] },
    { col: 'session_started_at', op: '>=', val: '2026-01-01' },
  ],
  extras: {
    where: '(duration_ms > 0)',
    having: '(COUNT(*) > 1)',
    time_grain_sqla: 'P1D',
    relative_start: 'a',
    relative_end: 'b',
  },
  time_range: 'Last week',
  granularity: 'other',
};

test('children drop every non-date filter and SQL extras, preserving date context without mutating the base', () => {
  const snapshot = JSON.stringify(base);
  const result = childQueryBase(base, levels, 1);
  expect(result.filters).toEqual([range, { ...range, col: 'step_started_at' }]);
  expect(result.extras).toEqual({ ...base.extras, where: '', having: '' });
  expect(result.time_range).toBe('Last week');
  expect(result.granularity).toBeUndefined();
  expect(JSON.stringify(base)).toBe(snapshot);
});

test('off preserves only the parent range; on copies it and duplicate columns are dropped', () => {
  expect(
    childQueryBase(base, [levels[0], level('step_started_at')], 1).filters,
  ).toEqual([range]);
  expect(
    childQueryBase(base, [levels[0], level('session_started_at', true)], 1)
      .filters,
  ).toEqual([range]);
});

test('dashboard time_range alone uses the rewritten parent range; No filter adds no child range', () => {
  const raw: QueryObject = { time_range: 'Last week' };
  const rewritten = { ...raw, filters: parentDateFilters(raw, levels[0]) };
  expect(childQueryBase(rewritten, levels, 1).filters).toEqual([
    range,
    { ...range, col: 'step_started_at' },
  ]);
  const noFilter: QueryObject = { time_range: 'No filter' };
  expect(
    childQueryBase(
      { ...noFilter, filters: parentDateFilters(noFilter, levels[0]) },
      levels,
      1,
    ).filters,
  ).toEqual([]);
  expect(childRangeApplies(noFilter, levels, 1)).toBe(false);
});

test('deeper enabled ancestors carry ranges in level order, with shared columns deduplicated', () => {
  const s4 = [
    level('start_local'),
    level('agent_time'),
    level('start_local', true),
    level('segment_start', true),
  ];
  const raw: QueryObject = { filters: [{ ...range, col: 'start_local' }] };
  expect(childQueryBase(raw, s4, 2).filters).toEqual(raw.filters);
  expect(childQueryBase(raw, s4, 3).filters).toEqual([
    ...raw.filters!,
    { ...range, col: 'segment_start' },
  ]);
  s4[2] = level('segment_start', true);
  expect(childQueryBase(raw, s4, 3).filters).toEqual([
    ...raw.filters!,
    { ...range, col: 'segment_start' },
  ]);
  s4[2] = level('interaction_start', true);
  expect(childQueryBase(raw, s4, 3).filters).toEqual([
    ...raw.filters!,
    { ...range, col: 'interaction_start' },
    { ...range, col: 'segment_start' },
  ]);
});

test('range text checks every parent range, including a finite range after No filter', () => {
  expect(
    childRangeApplies(
      { filters: [{ ...range, val: 'No filter' }, range] },
      levels,
      1,
    ),
  ).toBe(true);
  expect(
    childRangeApplies({ filters: [{ ...range, val: 'No filter' }] }, levels, 1),
  ).toBe(false);
  expect(
    childRangeApplies(base, [levels[0], level('step_started_at')], 1),
  ).toBe(false);
  expect(
    childRangeApplies(
      base,
      [levels[0], { ...levels[1], time_column: undefined }],
      1,
    ),
  ).toBe(false);
  expect(childRangeApplies(base, levels, 1)).toBe(true);
});

test('only ranges on level 1 time column bound children; a range on another column stays on its column', () => {
  const other = { ...range, col: 'other_date', val: 'Last year' };
  expect(
    childQueryBase({ filters: [range, other] }, levels, 1).filters,
  ).toEqual([range, other, { ...range, col: 'step_started_at' }]);
  expect(childRangeApplies({ filters: [other] }, levels, 1)).toBe(false);
  expect(
    childRangeApplies(
      { time_range: 'Last week', filters: [{ ...range, val: 'No filter' }] },
      levels,
      1,
    ),
  ).toBe(false);
});
