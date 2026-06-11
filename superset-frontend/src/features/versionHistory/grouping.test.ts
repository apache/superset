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
  buildTimeline,
  classifySaveGroup,
  mergeActivityPages,
  recordKey,
} from './grouping';
import type { ActivityRecord, SaveGroup } from './types';

const baseRecord: ActivityRecord = {
  version_uuid: 'v-1',
  entity_kind: 'chart',
  entity_uuid: 'e-1',
  entity_name: 'My chart',
  entity_deleted: false,
  entity_deletion_state: null,
  source: 'self',
  transaction_id: 10,
  action_kind: null,
  issued_at: '2025-12-05T17:18:00',
  changed_by: { id: 1, first_name: 'Ada', last_name: 'Lovelace' },
  kind: 'metric',
  operation: 'add',
  path: ['params', 'metrics', 'Revenue'],
  from_value: null,
  to_value: { label: 'Revenue' },
  summary: '',
  impact: null,
};

const record = (overrides: Partial<ActivityRecord>): ActivityRecord => ({
  ...baseRecord,
  ...overrides,
});

test('buildTimeline groups self records by transaction id', () => {
  const entries = buildTimeline([
    record({ transaction_id: 12, issued_at: '2025-12-06T10:00:00' }),
    record({
      transaction_id: 12,
      issued_at: '2025-12-06T10:00:00',
      kind: 'filter',
      path: ['params', 'adhoc_filters', 'country'],
    }),
    record({ transaction_id: 10 }),
  ]);

  expect(entries).toHaveLength(2);
  expect(entries[0]).toMatchObject({
    type: 'group',
    transactionId: 12,
  });
  expect((entries[0] as SaveGroup).records).toHaveLength(2);
  expect(entries[1]).toMatchObject({ type: 'group', transactionId: 10 });
});

test('buildTimeline interleaves related records chronologically', () => {
  const entries = buildTimeline([
    record({ transaction_id: 14, issued_at: '2025-12-07T09:00:00' }),
    record({
      source: 'related',
      entity_kind: 'dataset',
      entity_name: 'Sales',
      transaction_id: 13,
      issued_at: '2025-12-06T12:00:00',
      summary: 'Dataset updated: Sales',
    }),
    record({ transaction_id: 12, issued_at: '2025-12-06T10:00:00' }),
  ]);

  expect(entries.map(entry => entry.type)).toEqual([
    'group',
    'related',
    'group',
  ]);
});

test('buildTimeline orders newest first even with shuffled input', () => {
  const entries = buildTimeline([
    record({ transaction_id: 10, issued_at: '2025-12-05T17:18:00' }),
    record({ transaction_id: 14, issued_at: '2025-12-07T09:00:00' }),
    record({ transaction_id: 12, issued_at: '2025-12-06T10:00:00' }),
  ]);

  expect(
    entries.map(entry => (entry as SaveGroup).transactionId),
  ).toEqual([14, 12, 10]);
});

test('buildTimeline propagates restore action_kind to the group', () => {
  const entries = buildTimeline([
    record({
      transaction_id: 15,
      action_kind: 'restore',
      issued_at: '2025-12-08T09:00:00',
    }),
    record({
      transaction_id: 15,
      action_kind: 'restore',
      issued_at: '2025-12-08T09:00:00',
      kind: 'field',
      path: ['slice_name'],
    }),
  ]);

  expect(entries).toHaveLength(1);
  expect((entries[0] as SaveGroup).actionKind).toBe('restore');
});

test('classifySaveGroup returns filters when every record is a filter change', () => {
  const [group] = buildTimeline([
    record({
      entity_kind: 'dashboard',
      kind: 'filter',
      path: ['json_metadata', 'native_filter_configuration', 'NATIVE_1'],
    }),
    record({
      entity_kind: 'dashboard',
      kind: 'filter',
      path: ['json_metadata', 'native_filter_configuration', 'NATIVE_2'],
      operation: 'remove',
    }),
  ]) as SaveGroup[];

  expect(classifySaveGroup(group)).toBe('filters');
});

test('classifySaveGroup returns edit when any record is not a filter change', () => {
  const [group] = buildTimeline([
    record({ entity_kind: 'dashboard', kind: 'filter' }),
    record({ entity_kind: 'dashboard', kind: 'chart', operation: 'move' }),
  ]) as SaveGroup[];

  expect(classifySaveGroup(group)).toBe('edit');
});

test('mergeActivityPages appends new rows and drops duplicates', () => {
  const pageOne = [
    record({ transaction_id: 14, issued_at: '2025-12-07T09:00:00' }),
    record({ transaction_id: 12, issued_at: '2025-12-06T10:00:00' }),
  ];
  const pageTwo = [
    // duplicate of the last row of page one (offset shifted by a new save)
    record({ transaction_id: 12, issued_at: '2025-12-06T10:00:00' }),
    record({ transaction_id: 10 }),
  ];

  const merged = mergeActivityPages(pageOne, pageTwo);

  expect(merged).toHaveLength(3);
  expect(new Set(merged.map(recordKey)).size).toBe(3);
});

test('recordKey distinguishes records within one transaction', () => {
  const a = record({ path: ['params', 'metrics', 'Revenue'] });
  const b = record({ path: ['params', 'metrics', 'Profit'] });
  expect(recordKey(a)).not.toBe(recordKey(b));
});
