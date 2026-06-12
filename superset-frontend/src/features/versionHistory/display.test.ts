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
  describeRecord,
  formatAuthor,
  formatVersionDateTime,
  formatVersionDateTimeShort,
  formatVersionMonthDay,
  groupHeadline,
  relatedHeadline,
} from './display';
import type { ActivityRecord, SaveGroup } from './types';

const record = (overrides: Partial<ActivityRecord> = {}): ActivityRecord => ({
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
  ...overrides,
});

const group = (overrides: Partial<SaveGroup> = {}): SaveGroup => ({
  type: 'group',
  transactionId: 10,
  versionUuid: 'v-1',
  issuedAt: '2025-12-05T17:18:00',
  changedBy: { id: 1, first_name: 'Ada', last_name: 'Lovelace' },
  actionKind: null,
  records: [record()],
  ...overrides,
});

test('timestamps are parsed as UTC and rendered in the local timezone', () => {
  // jest pins TZ=America/New_York (UTC-5 in December)
  expect(formatVersionDateTime('2025-12-05T17:18:00')).toBe(
    'Dec 5, 2025, 12:18 PM',
  );
  expect(formatVersionMonthDay('2025-12-05T17:18:00')).toBe('Dec 5');
  expect(formatVersionDateTimeShort('2025-12-05T17:18:00')).toBe(
    '12/5/2025 12:18PM',
  );
});

test('describeRecord labels metric changes with the metric name', () => {
  expect(describeRecord(record())).toBe("Applied 'Revenue' metric");
  expect(describeRecord(record({ operation: 'remove' }))).toBe(
    "Removed 'Revenue' metric",
  );
});

test('describeRecord labels dimension changes', () => {
  const dimension = record({
    kind: 'dimension',
    path: ['params', 'groupby', 'country'],
    to_value: { column_name: 'country' },
  });
  expect(describeRecord(dimension)).toBe("Added 'country' dimension");
  expect(describeRecord({ ...dimension, operation: 'remove' })).toBe(
    "Removed 'country' dimension",
  );
});

test('describeRecord labels filter changes with their subject', () => {
  const filter = record({
    kind: 'filter',
    path: ['params', 'adhoc_filters', 'country'],
    to_value: { subject: 'country' },
  });
  expect(describeRecord(filter)).toBe("Added filter on 'country'");
});

test('describeRecord labels time range and color palette changes', () => {
  expect(
    describeRecord(
      record({
        kind: 'time_range',
        operation: 'edit',
        path: ['params', 'time_range'],
        to_value: 'Last month',
      }),
    ),
  ).toBe("Changed time range to 'Last month'");
  expect(
    describeRecord(
      record({
        kind: 'color_palette',
        operation: 'edit',
        path: ['params', 'color_scheme'],
        to_value: 'supersetColors',
      }),
    ),
  ).toBe('Changed color palette');
});

test('describeRecord labels dashboard layout changes', () => {
  expect(
    describeRecord(
      record({
        kind: 'chart',
        operation: 'move',
        path: ['position_json', 'CHART-1'],
        to_value: null,
        from_value: null,
      }),
    ),
  ).toBe("Moved chart 'CHART-1'");
  expect(
    describeRecord(
      record({
        kind: 'tab',
        operation: 'add',
        path: ['position_json', 'TAB-1'],
        to_value: { label: 'Overview' },
      }),
    ),
  ).toBe("Added tab 'Overview'");
});

test('describeRecord falls back to a humanized field name', () => {
  expect(
    describeRecord(
      record({
        kind: 'field',
        operation: 'edit',
        path: ['params', 'row_limit'],
        to_value: 100,
        from_value: 10,
      }),
    ),
  ).toBe("Changed 'row limit'");
  expect(
    describeRecord(
      record({
        kind: 'field',
        operation: 'remove',
        path: ['description'],
        to_value: null,
        from_value: 'old',
      }),
    ),
  ).toBe("Cleared 'description'");
});

test('describeRecord humanizes camelCase field names', () => {
  expect(
    describeRecord(
      record({
        kind: 'field',
        operation: 'edit',
        path: ['params', 'markerSize'],
        to_value: 8,
        from_value: 4,
      }),
    ),
  ).toBe("Changed 'marker size'");
});

test('groupHeadline prefers the transaction action kind', () => {
  expect(groupHeadline('chart', group({ actionKind: 'restore' }))).toBe(
    'Restored version',
  );
  expect(groupHeadline('dashboard', group({ actionKind: 'import' }))).toBe(
    'Imported version',
  );
  expect(groupHeadline('chart', group({ actionKind: 'clone' }))).toBe(
    'Cloned version',
  );
});

test('groupHeadline uses the save date for charts', () => {
  expect(groupHeadline('chart', group())).toBe('Dec 5, 2025, 12:18 PM');
});

test('groupHeadline classifies dashboard saves as filters or edit mode', () => {
  const filterRecord = record({
    entity_kind: 'dashboard',
    kind: 'filter',
    path: ['json_metadata', 'native_filter_configuration', 'NATIVE_1'],
  });
  expect(
    groupHeadline(
      'dashboard',
      group({ records: [filterRecord, filterRecord] }),
    ),
  ).toBe('Filters · 2 changes');
  expect(
    groupHeadline(
      'dashboard',
      group({
        records: [
          filterRecord,
          record({ entity_kind: 'dashboard', kind: 'chart' }),
        ],
      }),
    ),
  ).toBe('Edit mode · 2 changes');
  expect(groupHeadline('dashboard', group({ records: [filterRecord] }))).toBe(
    'Filters · 1 change',
  );
});

test('relatedHeadline prefers impact-aware phrasing for shared datasets', () => {
  expect(
    relatedHeadline(
      record({
        source: 'related',
        entity_kind: 'dataset',
        entity_name: 'Sales',
        summary: 'Dataset updated: Sales',
        impact: { charts: 4 },
      }),
    ),
  ).toBe('Dataset used by 4 charts updated: Sales');
  expect(
    relatedHeadline(
      record({
        source: 'related',
        entity_kind: 'dataset',
        entity_name: 'Sales',
        summary: 'Dataset updated: Sales',
        impact: { charts: 1 },
      }),
    ),
  ).toBe('Dataset updated: Sales');
});

test('relatedHeadline falls back when the server summary is empty', () => {
  expect(
    relatedHeadline(
      record({
        source: 'related',
        entity_kind: 'chart',
        entity_name: 'Trend',
        summary: '',
      }),
    ),
  ).toBe('Item updated: Trend');
});

test('formatAuthor handles system, named, and nameless users', () => {
  expect(formatAuthor(null)).toBe('System');
  expect(
    formatAuthor({ id: 1, first_name: 'Ada', last_name: 'Lovelace' }),
  ).toBe('Ada Lovelace');
  expect(formatAuthor({ id: 2, first_name: 'Ada', last_name: null })).toBe(
    'Ada',
  );
  expect(formatAuthor({ id: 3, first_name: null, last_name: null })).toBe(
    'Unknown user',
  );
});
