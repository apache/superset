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
import { t } from '@apache-superset/core/translation';
import { ActivityRecord, ChangedBy } from '../types';

/** A save container: one or more ``source:'self'`` records sharing the
 * same ``transaction_id``. Roughly equivalent to the old ``Version`` row,
 * but assembled from leaf-level Shape B records. */
export interface ActivitySaveRow {
  type: 'save';
  version_uuid: string;
  transaction_id: number;
  issued_at: string;
  changed_by: ChangedBy | null;
  /** Rolled-up records (Shape B leaves collapsed by common path prefix). */
  changes: ActivityRecord[];
}

/** A standalone upstream/related entity change — rendered inline in the
 * timeline but NOT inside a save container. */
export interface ActivityRelatedRow {
  type: 'related';
  record: ActivityRecord;
}

export type ActivityRow = ActivitySaveRow | ActivityRelatedRow;

export interface ActivityDateBucket {
  label: string;
  rows: ActivityRow[];
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Per Figma audit: prefer concrete absolute dates over relative
// "Today" / "Yesterday" labels — relative labels are confusing in
// version-history context because they shift meaning across timezones
// and a returning user can't tell whether "Today" is today-for-them or
// today-for-the-author. Both args kept for caller-symmetry with the
// earlier API + in case design wants relative labels back later.
function bucketDayKey(iso: string): string {
  // YYYY-MM-DD slice keeps rows from the same calendar day together
  // regardless of the time-of-day suffix used in the user-visible label.
  return iso.slice(0, 10);
}

function bucketLabel(
  iso: string,
  _todayMs: number,
  _yesterdayMs: number,
): string {
  try {
    const lang = document.documentElement.lang || undefined;
    return new Date(iso).toLocaleString(lang, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Prefix length used to roll up Shape B leaves within a save container.
 * Tuned per top-level path segment so user-visible chunks survive (one
 * row per chart-edit, one per ``json_metadata`` subsection, etc.) without
 * flattening every leaf. */
function rollupPrefixLength(path: string[]): number {
  if (path.length === 0) return 0;
  const head = path[0];
  if (head === 'edit') return 3; // edit/<kind>/<id>
  if (head === 'json_metadata' || head === 'params') return 2;
  return 1;
}

function rollupKey(record: ActivityRecord): string {
  const len = rollupPrefixLength(record.path);
  return `${record.kind}|${record.path.slice(0, len).join('/')}`;
}

/** Collapse leaf records that share a common path prefix into a single
 * representative record per prefix. Preserves order of first appearance. */
export function rollupSelfRecords(records: ActivityRecord[]): ActivityRecord[] {
  const seen = new Map<string, ActivityRecord>();
  for (const r of records) {
    const key = rollupKey(r);
    if (!seen.has(key)) {
      seen.set(key, r);
    }
  }
  return Array.from(seen.values());
}

/**
 * Group activity records into a date-bucketed timeline. Self records are
 * grouped by ``transaction_id`` into save containers (with leaf-rollup
 * applied within each container); related records render standalone.
 *
 * Input records are assumed to be returned newest-first by the backend.
 * Re-sorts defensively to be resilient against future ordering changes.
 */
export function groupActivity(records: ActivityRecord[]): ActivityDateBucket[] {
  if (!records.length) return [];

  const sorted = [...records].sort((a, b) => {
    const ax = a.issued_at;
    const bx = b.issued_at;
    if (ax < bx) return 1;
    if (ax > bx) return -1;
    return 0;
  });

  // First pass — collapse consecutive self records sharing transaction_id
  // into save groups. Related records pass through as standalone rows.
  const rows: ActivityRow[] = [];
  let currentSave: ActivitySaveRow | null = null;
  const flushSave = () => {
    if (currentSave) {
      currentSave.changes = rollupSelfRecords(currentSave.changes);
      rows.push(currentSave);
      currentSave = null;
    }
  };

  for (const r of sorted) {
    if (r.source === 'self') {
      if (currentSave && currentSave.transaction_id === r.transaction_id) {
        currentSave.changes.push(r);
      } else {
        flushSave();
        currentSave = {
          type: 'save',
          version_uuid: r.version_uuid,
          transaction_id: r.transaction_id,
          issued_at: r.issued_at,
          changed_by: r.changed_by,
          changes: [r],
        };
      }
    } else {
      flushSave();
      rows.push({ type: 'related', record: r });
    }
  }
  flushSave();

  // Second pass — bucket by calendar day. When the newest row is a self
  // save it becomes the "Current version" pinned bucket so consumers can
  // render it with a distinct treatment. A leading related row would be
  // mislabeled by that pin (it's not a version of the path entity), so
  // we fall through to plain day-bucketing instead.
  const today = startOfDay(new Date());
  const yesterday = today - 24 * 60 * 60 * 1000;
  const buckets: ActivityDateBucket[] = [];
  let startIdx = 0;
  if (rows[0].type === 'save') {
    buckets.push({ label: t('Current version'), rows: [rows[0]] });
    startIdx = 1;
  }

  // Bucket by calendar day, but render each bucket's header using the
  // newest row's timestamp inside it — so the date+time the user sees is
  // when the most recent save in that day happened, not midnight.
  let active: ActivityDateBucket | null = null;
  let activeDayKey: string | null = null;
  for (let i = startIdx; i < rows.length; i += 1) {
    const row = rows[i];
    const iso = row.type === 'save' ? row.issued_at : row.record.issued_at;
    const dayKey = bucketDayKey(iso);
    if (!active || activeDayKey !== dayKey) {
      // ``rows`` is newest-first within a day, so the first row we see
      // for a new day-key is the one whose timestamp labels the bucket.
      active = { label: bucketLabel(iso, today, yesterday), rows: [] };
      activeDayKey = dayKey;
      buckets.push(active);
    }
    active.rows.push(row);
  }

  return buckets;
}
