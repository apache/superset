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
import type {
  ActivityRecord,
  DashboardGroupCategory,
  RelatedEntry,
  SaveGroup,
  TimelineEntry,
} from './types';

/**
 * Stable identity for one activity record, used to deduplicate rows
 * when merging pages (offset pagination can re-serve rows if a new
 * save lands between page fetches).
 */
export function recordKey(record: ActivityRecord): string {
  return [
    record.transaction_id,
    record.entity_kind,
    record.entity_uuid ?? record.entity_name,
    record.source,
    record.kind,
    record.operation,
    JSON.stringify(record.path),
  ].join('|');
}

/** Merge a newly fetched page into already loaded records, deduplicated. */
export function mergeActivityPages(
  existing: ActivityRecord[],
  incoming: ActivityRecord[],
): ActivityRecord[] {
  const seen = new Set(existing.map(recordKey));
  const merged = [...existing];
  incoming.forEach(record => {
    const key = recordKey(record);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(record);
    }
  });
  return merged;
}

/** One related row per save of a related entity, regardless of how many
 * change records that save produced. */
export function relatedEntryKey(record: ActivityRecord): string {
  return [
    record.transaction_id,
    record.entity_kind,
    record.entity_uuid ?? record.entity_name,
  ].join('|');
}

/**
 * Paths the server machine-writes on actions that are not meaningful
 * user edits (e.g. viewing a dashboard rewrites `shared_label_colors`).
 * Records under these paths are suppressed before grouping so they
 * never produce phantom save rows or inflate change counts. Extend the
 * list as more machine-written paths surface.
 */
// TODO(version-history): backend workaround — remove when upstream stops
// emitting machine-written paths (e.g. shared_label_colors, schema_perm)
// as activity.
const NOISE_PATHS: ReadonlyArray<readonly string[]> = [
  ['json_metadata', 'shared_label_colors'],
  // Permission strings rewritten whenever a datasource/schema changes;
  // they cascade phantom "updated" records onto every affected chart.
  ['schema_perm'],
  ['catalog_perm'],
];

function isNoiseRecord(record: ActivityRecord): boolean {
  const stringPath = record.path.filter(
    (segment): segment is string => typeof segment === 'string',
  );
  return NOISE_PATHS.some(noisePath =>
    noisePath.every((segment, index) => stringPath[index] === segment),
  );
}

/** Identity of the entity a related record belongs to, ignoring the
 * transaction. */
function relatedEntityKey(record: ActivityRecord): string {
  return [record.entity_kind, record.entity_uuid ?? record.entity_name].join(
    '|',
  );
}

const RELATED_MERGE_WINDOW_MS = 60_000;

/**
 * The backend can split one logical save of a related entity into
 * several transactions issued at (nearly) the same instant, which
 * would render as duplicate-looking rows. Collapse adjacent related
 * entries — no self save between them — for the same entity issued
 * within a short window into the newer entry: its representative
 * record is kept and the older save's records are absorbed so search
 * over collapsed records keeps working.
 */
// TODO(version-history): backend workaround — remove when upstream emits
// one transaction per logical save.
function mergeAdjacentRelatedEntries(
  entries: TimelineEntry[],
): TimelineEntry[] {
  const merged: TimelineEntry[] = [];
  entries.forEach(entry => {
    const previous = merged[merged.length - 1];
    if (
      entry.type === 'related' &&
      previous?.type === 'related' &&
      relatedEntityKey(previous.record) === relatedEntityKey(entry.record) &&
      Math.abs(
        Date.parse(previous.record.issued_at) -
          Date.parse(entry.record.issued_at),
      ) <= RELATED_MERGE_WINDOW_MS
    ) {
      previous.records.push(...entry.records);
    } else {
      merged.push(entry);
    }
  });
  return merged;
}

/**
 * One save can cascade into related records for many distinct entities
 * of the same kind within a single transaction (e.g. a dataset edit
 * touching every chart built on it), which would render one row per
 * entity. Roll those entries up into one row per (transaction, kind):
 * the newest entry keeps the row, absorbed entries contribute their
 * entity names (for the tooltip) and records (so search keeps
 * matching). Single-entity transactions are left untouched.
 */
// TODO(version-history): backend workaround — remove when upstream emits
// a dataset-level impact record instead of per-chart cascade records.
function rollupSameTransactionRelated(
  entries: TimelineEntry[],
): TimelineEntry[] {
  const buckets = new Map<string, RelatedEntry[]>();
  entries.forEach(entry => {
    if (entry.type !== 'related') {
      return;
    }
    const key = `${entry.record.transaction_id}|${entry.record.entity_kind}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      buckets.set(key, [entry]);
    }
  });

  const absorbed = new Set<RelatedEntry>();
  buckets.forEach(bucket => {
    if (bucket.length < 2) {
      return;
    }
    // Entries are ordered newest-first; the first one keeps the row.
    const [head, ...rest] = bucket;
    head.rollupEntityNames = bucket.map(entry => entry.record.entity_name);
    rest.forEach(entry => {
      head.records.push(...entry.records);
      absorbed.add(entry);
    });
  });

  return absorbed.size > 0
    ? entries.filter(entry => entry.type !== 'related' || !absorbed.has(entry))
    : entries;
}

/**
 * Build the timeline from a flat newest-first activity stream:
 * `source='self'` records are grouped into one save container per
 * transaction, `source='related'` records collapse into a single entry
 * per (transaction, entity), adjacent related entries from one split
 * save merge into a single row, and multi-entity cascades roll up into
 * one row per (transaction, kind). Machine-written noise records are
 * dropped first, so saves consisting only of noise never appear and
 * change counts reflect real edits. The result is ordered newest
 * first.
 */
export function buildTimeline(records: ActivityRecord[]): TimelineEntry[] {
  const groupsByTransaction = new Map<number, SaveGroup>();
  const relatedByKey = new Map<string, RelatedEntry>();
  const entries: TimelineEntry[] = [];

  records.forEach(record => {
    if (isNoiseRecord(record)) {
      return;
    }
    if (record.source === 'self') {
      let group = groupsByTransaction.get(record.transaction_id);
      if (!group) {
        group = {
          type: 'group',
          transactionId: record.transaction_id,
          versionUuid: record.version_uuid,
          issuedAt: record.issued_at,
          changedBy: record.changed_by,
          actionKind: record.action_kind,
          records: [],
        };
        groupsByTransaction.set(record.transaction_id, group);
        entries.push(group);
      }
      group.records.push(record);
      if (record.issued_at > group.issuedAt) {
        group.issuedAt = record.issued_at;
      }
      group.versionUuid = group.versionUuid ?? record.version_uuid;
      group.changedBy = group.changedBy ?? record.changed_by;
      group.actionKind = group.actionKind ?? record.action_kind;
    } else {
      const key = relatedEntryKey(record);
      const existing = relatedByKey.get(key);
      if (!existing) {
        const entry: RelatedEntry = {
          type: 'related',
          record,
          records: [record],
        };
        relatedByKey.set(key, entry);
        entries.push(entry);
      } else {
        existing.records.push(record);
        // Keep the row, upgrading it with the most informative fields
        // seen across the save's records.
        const current = existing.record;
        existing.record = {
          ...current,
          summary: current.summary || record.summary,
          impact: current.impact ?? record.impact,
          issued_at:
            record.issued_at > current.issued_at
              ? record.issued_at
              : current.issued_at,
        };
      }
    }
  });

  entries.sort((a, b) => {
    const issuedA = a.type === 'group' ? a.issuedAt : a.record.issued_at;
    const issuedB = b.type === 'group' ? b.issuedAt : b.record.issued_at;
    if (issuedA !== issuedB) {
      return issuedA < issuedB ? 1 : -1;
    }
    const txA = a.type === 'group' ? a.transactionId : a.record.transaction_id;
    const txB = b.type === 'group' ? b.transactionId : b.record.transaction_id;
    return txB - txA;
  });

  return rollupSameTransactionRelated(mergeAdjacentRelatedEntries(entries));
}

/**
 * Native-filter changes arrive as `kind="field"` records under
 * `json_metadata.native_filter_configuration` until the backend
 * promotes them to `kind="filter"` (deferred per spec); accept both
 * shapes.
 */
function isFilterRecord(record: ActivityRecord): boolean {
  return (
    record.kind === 'filter' ||
    (record.kind === 'field' &&
      record.path[0] === 'json_metadata' &&
      record.path[1] === 'native_filter_configuration')
  );
}

/**
 * Dashboard saves render as compact containers: a save whose records
 * are all dashboard-level filter changes is a "Filters" save, anything
 * else is an "Edit mode" save.
 */
export function classifySaveGroup(group: SaveGroup): DashboardGroupCategory {
  return group.records.length > 0 && group.records.every(isFilterRecord)
    ? 'filters'
    : 'edit';
}
