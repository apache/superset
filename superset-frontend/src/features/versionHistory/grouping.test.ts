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
  relatedEntryKey,
} from './grouping';
import type { ActivityRecord, RelatedEntry, SaveGroup } from './types';

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

  expect(entries.map(entry => (entry as SaveGroup).transactionId)).toEqual([
    14, 12, 10,
  ]);
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

test('classifySaveGroup treats native-filter field records as filter changes', () => {
  // The backend emits native-filter changes as kind="field" under
  // json_metadata.native_filter_configuration until kind promotion lands.
  const [group] = buildTimeline([
    record({
      entity_kind: 'dashboard',
      kind: 'field',
      path: [
        'json_metadata',
        'native_filter_configuration',
        'NATIVE_1',
        'defaultDataMask',
      ],
    }),
    record({
      entity_kind: 'dashboard',
      kind: 'field',
      path: ['json_metadata', 'native_filter_configuration', 'NATIVE_2'],
      operation: 'remove',
    }),
  ]) as SaveGroup[];

  expect(classifySaveGroup(group)).toBe('filters');
});

test('classifySaveGroup returns edit for non-filter json_metadata field records', () => {
  const [group] = buildTimeline([
    record({
      entity_kind: 'dashboard',
      kind: 'field',
      path: ['json_metadata', 'color_scheme'],
    }),
  ]) as SaveGroup[];

  expect(classifySaveGroup(group)).toBe('edit');
});

test('classifySaveGroup returns edit when any record is not a filter change', () => {
  const [group] = buildTimeline([
    record({ entity_kind: 'dashboard', kind: 'filter' }),
    record({ entity_kind: 'dashboard', kind: 'chart', operation: 'move' }),
  ]) as SaveGroup[];

  expect(classifySaveGroup(group)).toBe('edit');
});

test('buildTimeline collapses one related save into a single entry', () => {
  // One dataset save can fan out into many change records; the panel
  // should show one row per (transaction, entity), upgraded with the
  // most informative summary/impact across its records.
  const entries = buildTimeline(
    Array.from({ length: 5 }, (_, index) =>
      record({
        source: 'related',
        entity_kind: 'dataset',
        entity_uuid: 'ds-1',
        entity_name: 'Sales',
        transaction_id: 13,
        issued_at: `2025-12-06T12:00:0${index}`,
        kind: 'metric',
        path: ['metrics', `metric_${index}`],
        summary: index === 2 ? 'Dataset metric changed: Sales' : '',
        impact: index === 3 ? { charts: 4 } : null,
      }),
    ),
  );

  expect(entries).toHaveLength(1);
  const [entry] = entries as RelatedEntry[];
  expect(entry.type).toBe('related');
  expect(entry.record.summary).toBe('Dataset metric changed: Sales');
  expect(entry.record.impact).toEqual({ charts: 4 });
  expect(entry.record.issued_at).toBe('2025-12-06T12:00:04');
  // every collapsed record is retained so search can match summaries
  // that only appear on non-representative records
  expect(entry.records).toHaveLength(5);
});

test('buildTimeline keeps distinct related entities apart within one transaction', () => {
  const entries = buildTimeline([
    record({
      source: 'related',
      entity_kind: 'dataset',
      entity_uuid: 'ds-1',
      entity_name: 'Sales',
      transaction_id: 13,
      issued_at: '2025-12-06T12:00:00',
    }),
    record({
      source: 'related',
      entity_kind: 'chart',
      entity_uuid: 'ch-1',
      entity_name: 'Revenue trend',
      transaction_id: 13,
      issued_at: '2025-12-06T12:00:00',
    }),
  ]) as RelatedEntry[];

  expect(entries).toHaveLength(2);
  const keys = entries.map(entry => relatedEntryKey(entry.record));
  expect(new Set(keys).size).toBe(2);
});

test('buildTimeline drops saves consisting only of machine-written noise', () => {
  // Viewing a dashboard rewrites json_metadata.shared_label_colors,
  // producing phantom "Edit mode · 1 change" saves.
  const noise = (transactionId: number, issuedAt: string) =>
    record({
      entity_kind: 'dashboard',
      kind: 'field',
      transaction_id: transactionId,
      issued_at: issuedAt,
      path: ['json_metadata', 'shared_label_colors'],
    });

  const entries = buildTimeline([
    noise(41, '2025-12-09T10:00:00'),
    record({
      entity_kind: 'dashboard',
      kind: 'field',
      transaction_id: 42,
      issued_at: '2025-12-09T09:00:00',
      path: ['dashboard_title'],
    }),
    noise(42, '2025-12-09T09:00:00'),
    noise(40, '2025-12-08T10:00:00'),
    record({ transaction_id: 10 }),
  ]);

  // Phantom-only transactions 41 and 40 disappear entirely; the rename
  // save keeps only its real record; the chart save survives untouched.
  expect(entries.map(entry => (entry as SaveGroup).transactionId)).toEqual([
    42, 10,
  ]);
  expect((entries[0] as SaveGroup).records).toHaveLength(1);
  expect((entries[0] as SaveGroup).records[0].path).toEqual([
    'dashboard_title',
  ]);
});

test('noise suppression tolerates non-string and trailing path segments', () => {
  const entries = buildTimeline([
    record({
      transaction_id: 50,
      path: ['json_metadata', 'shared_label_colors', 'Revenue', 0],
    }),
    record({
      transaction_id: 51,
      // a leading numeric segment must not break prefix matching
      path: [0, 'json_metadata', 'shared_label_colors'],
    }),
    record({
      transaction_id: 52,
      path: ['json_metadata', 'color_scheme'],
    }),
  ]);

  expect(entries.map(entry => (entry as SaveGroup).transactionId)).toEqual([
    52,
  ]);
});

test('noise suppression also applies to related-source records', () => {
  const entries = buildTimeline([
    record({
      source: 'related',
      entity_kind: 'dashboard',
      entity_uuid: 'd-1',
      transaction_id: 60,
      path: ['json_metadata', 'shared_label_colors'],
      summary: 'Dashboard updated: Sales overview',
    }),
  ]);

  expect(entries).toHaveLength(0);
});

test('buildTimeline merges adjacent related entries from one split save', () => {
  // The backend split one logical dataset save into two transactions
  // with the same timestamp; the panel must show a single row whose
  // records union both saves (so search keeps matching all of them).
  const related = (transactionId: number, field: string) =>
    record({
      source: 'related',
      entity_kind: 'dataset',
      entity_uuid: 'ds-1',
      entity_name: 'birth_names',
      transaction_id: transactionId,
      issued_at: '2026-06-12T14:50:35',
      kind: 'metric',
      path: ['metrics', field],
      summary: 'Dataset used by 11 charts updated: birth_names',
    });

  const entries = buildTimeline([
    related(50, 'a'),
    related(50, 'b'),
    related(49, 'c'),
    related(49, 'd'),
  ]) as RelatedEntry[];

  expect(entries).toHaveLength(1);
  expect(entries[0].type).toBe('related');
  // the newer transaction stays representative (stable React key)
  expect(entries[0].record.transaction_id).toBe(50);
  expect(entries[0].records).toHaveLength(4);
});

test('buildTimeline keeps related entries for the same entity apart when issued far apart', () => {
  const related = (transactionId: number, issuedAt: string) =>
    record({
      source: 'related',
      entity_kind: 'dataset',
      entity_uuid: 'ds-1',
      entity_name: 'birth_names',
      transaction_id: transactionId,
      issued_at: issuedAt,
    });

  const entries = buildTimeline([
    related(50, '2026-06-12T16:50:35'),
    related(49, '2026-06-12T14:50:35'),
  ]);

  expect(entries).toHaveLength(2);
});

test('buildTimeline keeps simultaneous related entries for different entities apart', () => {
  const entries = buildTimeline([
    record({
      source: 'related',
      entity_kind: 'dataset',
      entity_uuid: 'ds-1',
      entity_name: 'birth_names',
      transaction_id: 50,
      issued_at: '2026-06-12T14:50:35',
    }),
    record({
      source: 'related',
      entity_kind: 'dataset',
      entity_uuid: 'ds-2',
      entity_name: 'cleaned_sales',
      transaction_id: 49,
      issued_at: '2026-06-12T14:50:35',
    }),
  ]);

  expect(entries).toHaveLength(2);
});

test('buildTimeline rolls up same-transaction related entries per entity kind', () => {
  // One dataset save cascades into a related record for every chart
  // built on it; the panel should show one pluralized row, not ten.
  const entries = buildTimeline(
    Array.from({ length: 10 }, (_, i) =>
      record({
        source: 'related',
        entity_kind: 'chart',
        entity_uuid: `c-${i}`,
        entity_name: `Chart ${i}`,
        transaction_id: 53,
        issued_at: '2026-06-12T15:00:00',
        summary: `Chart updated: Chart ${i}`,
      }),
    ),
  ) as RelatedEntry[];

  expect(entries).toHaveLength(1);
  expect(entries[0].type).toBe('related');
  expect(entries[0].rollupEntityNames).toHaveLength(10);
  expect(entries[0].rollupEntityNames).toContain('Chart 0');
  expect(entries[0].rollupEntityNames).toContain('Chart 9');
  // every absorbed entry's records are retained for search
  expect(entries[0].records).toHaveLength(10);
});

test('buildTimeline leaves single-entity related transactions un-rolled', () => {
  const entries = buildTimeline([
    record({
      source: 'related',
      entity_kind: 'dataset',
      entity_uuid: 'ds-1',
      entity_name: 'Sales',
      transaction_id: 53,
      issued_at: '2026-06-12T15:00:00',
      summary: 'Dataset updated: Sales',
    }),
  ]) as RelatedEntry[];

  expect(entries).toHaveLength(1);
  expect(entries[0].rollupEntityNames).toBeUndefined();
});

test('buildTimeline rolls up mixed kinds in one transaction per kind', () => {
  const related = (
    kind: 'chart' | 'dataset',
    uuid: string,
    name: string,
  ): ActivityRecord =>
    record({
      source: 'related',
      entity_kind: kind,
      entity_uuid: uuid,
      entity_name: name,
      transaction_id: 53,
      issued_at: '2026-06-12T15:00:00',
    });

  const entries = buildTimeline([
    related('chart', 'c-1', 'Trend'),
    related('chart', 'c-2', 'Breakdown'),
    related('dataset', 'ds-1', 'Sales'),
    related('dataset', 'ds-2', 'Costs'),
  ]) as RelatedEntry[];

  expect(entries).toHaveLength(2);
  const byKind = new Map(
    entries.map(entry => [entry.record.entity_kind, entry]),
  );
  expect(byKind.get('chart')?.rollupEntityNames).toEqual([
    'Trend',
    'Breakdown',
  ]);
  expect(byKind.get('dataset')?.rollupEntityNames).toEqual(['Sales', 'Costs']);
});

test('a self save between two related entries blocks their merge', () => {
  const related = (transactionId: number, issuedAt: string) =>
    record({
      source: 'related',
      entity_kind: 'dataset',
      entity_uuid: 'ds-1',
      entity_name: 'birth_names',
      transaction_id: transactionId,
      issued_at: issuedAt,
    });

  const entries = buildTimeline([
    related(30, '2026-06-12T10:00:50'),
    record({ transaction_id: 29, issued_at: '2026-06-12T10:00:30' }),
    related(28, '2026-06-12T10:00:10'),
  ]);

  expect(entries.map(entry => entry.type)).toEqual([
    'related',
    'group',
    'related',
  ]);
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
