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
const NOISE_PATHS: ReadonlyArray<readonly string[]> = [
  ['json_metadata', 'shared_label_colors'],
];

function isNoiseRecord(record: ActivityRecord): boolean {
  const stringPath = record.path.filter(
    (segment): segment is string => typeof segment === 'string',
  );
  return NOISE_PATHS.some(noisePath =>
    noisePath.every((segment, index) => stringPath[index] === segment),
  );
}

/**
 * Build the timeline from a flat newest-first activity stream:
 * `source='self'` records are grouped into one save container per
 * transaction, `source='related'` records collapse into a single entry
 * per (transaction, entity). Machine-written noise records are dropped
 * first, so saves consisting only of noise never appear and change
 * counts reflect real edits. The result is ordered newest first.
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

  return entries.sort((a, b) => {
    const issuedA = a.type === 'group' ? a.issuedAt : a.record.issued_at;
    const issuedB = b.type === 'group' ? b.issuedAt : b.record.issued_at;
    if (issuedA !== issuedB) {
      return issuedA < issuedB ? 1 : -1;
    }
    const txA = a.type === 'group' ? a.transactionId : a.record.transaction_id;
    const txB = b.type === 'group' ? b.transactionId : b.record.transaction_id;
    return txB - txA;
  });
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
