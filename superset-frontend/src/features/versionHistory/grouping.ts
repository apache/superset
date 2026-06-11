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

/**
 * Build the timeline from a flat newest-first activity stream:
 * `source='self'` records are grouped into one save container per
 * transaction, `source='related'` records stay as standalone entries.
 * The result is ordered newest first.
 */
export function buildTimeline(records: ActivityRecord[]): TimelineEntry[] {
  const groupsByTransaction = new Map<number, SaveGroup>();
  const entries: TimelineEntry[] = [];

  records.forEach(record => {
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
      entries.push({ type: 'related', record });
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
 * Dashboard saves render as compact containers: a save whose records
 * are all dashboard-level filter changes is a "Filters" save, anything
 * else is an "Edit mode" save.
 */
export function classifySaveGroup(group: SaveGroup): DashboardGroupCategory {
  return group.records.length > 0 &&
    group.records.every(record => record.kind === 'filter')
    ? 'filters'
    : 'edit';
}
