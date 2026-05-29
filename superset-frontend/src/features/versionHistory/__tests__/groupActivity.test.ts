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
import { groupActivity, rollupSelfRecords } from '../utils/groupActivity';
import { ActivityRecord } from '../types';

function rec(over: Partial<ActivityRecord>): ActivityRecord {
  return {
    version_uuid: 'v',
    entity_kind: 'dashboard',
    entity_uuid: 'e',
    entity_name: 'X',
    entity_deleted: false,
    entity_deletion_state: null,
    source: 'self',
    transaction_id: 1,
    issued_at: new Date().toISOString(),
    changed_by: null,
    kind: 'field',
    path: ['dashboard_title'],
    from_value: null,
    to_value: 'X',
    summary: '',
    impact: null,
    ...over,
  };
}

test('groupActivity returns an empty array for no records', () => {
  expect(groupActivity([])).toEqual([]);
});

test('groupActivity groups consecutive self records by transaction_id into one save', () => {
  const now = new Date().toISOString();
  const buckets = groupActivity([
    rec({ transaction_id: 1, version_uuid: 'a', issued_at: now }),
    rec({
      transaction_id: 1,
      version_uuid: 'a',
      issued_at: now,
      path: ['description'],
    }),
    rec({
      transaction_id: 1,
      version_uuid: 'a',
      issued_at: now,
      path: ['slug'],
    }),
  ]);
  const allRows = buckets.flatMap(b => b.rows);
  expect(allRows).toHaveLength(1);
  expect(allRows[0].type).toBe('save');
  if (allRows[0].type === 'save') {
    expect(allRows[0].changes).toHaveLength(3);
  }
});

test('groupActivity keeps related records as standalone rows', () => {
  const now = new Date().toISOString();
  const buckets = groupActivity([
    rec({ source: 'self', transaction_id: 1, issued_at: now }),
    rec({
      source: 'related',
      transaction_id: 2,
      issued_at: now,
      version_uuid: 'related-1',
      entity_kind: 'dataset',
      summary: 'Dataset updated: cleaned_sales_data',
    }),
  ]);
  const rows = buckets.flatMap(b => b.rows);
  expect(rows.some(r => r.type === 'related')).toBe(true);
  expect(rows.some(r => r.type === 'save')).toBe(true);
});

test('groupActivity puts the latest row into the Current version bucket', () => {
  const now = new Date().toISOString();
  const older = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const buckets = groupActivity([
    rec({ transaction_id: 2, version_uuid: 'newest', issued_at: now }),
    rec({ transaction_id: 1, version_uuid: 'oldest', issued_at: older }),
  ]);
  expect(buckets[0].label).toMatch(/Current version/);
  expect(buckets[0].rows).toHaveLength(1);
});

test('groupActivity sorts by issued_at DESC even if the input is reversed', () => {
  const now = new Date().toISOString();
  const older = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const buckets = groupActivity([
    rec({ transaction_id: 1, version_uuid: 'oldest', issued_at: older }),
    rec({ transaction_id: 2, version_uuid: 'newest', issued_at: now }),
  ]);
  const first = buckets[0].rows[0];
  expect(first.type).toBe('save');
  if (first.type === 'save') expect(first.version_uuid).toBe('newest');
});

test('rollupSelfRecords collapses leaves sharing a path prefix', () => {
  // Shape B: edit/<kind>/<id>/... — prefix length 3 means all four leaves
  // under the same chart edit collapse to one representative.
  const leaves = [
    rec({
      path: ['edit', 'chart', 'chart-1', 'meta', 'sliceName'],
      transaction_id: 1,
    }),
    rec({
      path: ['edit', 'chart', 'chart-1', 'meta', 'width'],
      transaction_id: 1,
    }),
    rec({
      path: ['edit', 'chart', 'chart-1', 'meta', 'height'],
      transaction_id: 1,
    }),
    rec({
      path: ['edit', 'chart', 'chart-2', 'meta', 'sliceName'],
      transaction_id: 1,
    }),
  ];
  const rolled = rollupSelfRecords(leaves);
  // chart-1 collapses to one row, chart-2 stays separate.
  expect(rolled).toHaveLength(2);
});

test('rollupSelfRecords uses prefix length 2 for json_metadata / params', () => {
  const leaves = [
    rec({ path: ['json_metadata', 'global', 'cross_filters'] }),
    rec({ path: ['json_metadata', 'global', 'colors'] }),
    rec({ path: ['json_metadata', 'other', 'foo'] }),
  ];
  // ``json_metadata/global`` collapses, ``json_metadata/other`` stays distinct.
  expect(rollupSelfRecords(leaves)).toHaveLength(2);
});
