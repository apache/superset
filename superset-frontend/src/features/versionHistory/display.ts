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
import { t, tn } from '@apache-superset/core/translation';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import type {
  ActivityChangedBy,
  ActivityEntityKind,
  ActivityRecord,
  SaveGroup,
  VersionedEntityType,
} from './types';

/** Activity timestamps are naive UTC; parse as UTC, render local. */
export function parseIssuedAt(issuedAt: string) {
  return extendedDayjs.utc(issuedAt).local();
}

/** e.g. "Dec 5, 2025, 5:18 PM" */
export function formatVersionDateTime(issuedAt: string): string {
  return parseIssuedAt(issuedAt).format('MMM D, YYYY, h:mm A');
}

/** e.g. "Dec 5" — used for fork (copy) names. */
export function formatVersionMonthDay(issuedAt: string): string {
  return parseIssuedAt(issuedAt).format('MMM D');
}

/** Compact datetime for row meta lines, per design spec. */
export const SHORT_DATETIME_FORMAT = 'M/D/YYYY h:mmA';

/** e.g. "12/5/2025 2:35PM" */
export function formatVersionDateTimeShort(issuedAt: string): string {
  return parseIssuedAt(issuedAt).format(SHORT_DATETIME_FORMAT);
}

export function formatAuthor(changedBy: ActivityChangedBy | null): string {
  if (!changedBy) {
    return t('System');
  }
  const name = [changedBy.first_name, changedBy.last_name]
    .filter(Boolean)
    .join(' ');
  return name || t('Unknown user');
}

/**
 * Synthetic identifiers that carry no meaning for a reader: dashboard
 * layout node ids (`CHART-xyz`, `ROW-abc`, …) and bare UUIDs (e.g. an
 * M2M slice-membership record whose value is just the chart's uuid).
 * These must never surface as a record's subject.
 */
const OPAQUE_ID =
  /^(CHART|ROW|COLUMN|TAB|TABS|HEADER|MARKDOWN|DIVIDER|GRID|ROOT)-|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isOpaqueId(value: string): boolean {
  return OPAQUE_ID.test(value);
}

/** A human name nested in a layout node's `meta`, if any. */
function metaLabel(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object') {
    return null;
  }
  const candidate = meta as Record<string, unknown>;
  for (const key of ['sliceName', 'text', 'code']) {
    const value = candidate[key];
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  return null;
}

function valueLabel(value: unknown): string | null {
  if (typeof value === 'string' && value) {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.label === 'string' && candidate.label) {
      return candidate.label;
    }
    // Dashboard layout chart nodes carry the chart title as `name`.
    if (typeof candidate.name === 'string' && candidate.name) {
      return candidate.name;
    }
    if (
      typeof candidate.column_name === 'string' &&
      candidate.column_name !== ''
    ) {
      return candidate.column_name;
    }
    if (typeof candidate.subject === 'string' && candidate.subject !== '') {
      return candidate.subject;
    }
    return metaLabel(candidate.meta);
  }
  return null;
}

/**
 * The natural key of the changed item is the last path segment for
 * list-diff records (e.g. ['params', 'metrics', 'Revenue']). Opaque
 * identifiers (layout node ids, bare UUIDs) are rejected so the caller
 * falls back to the kind-only phrasing ("Added a chart") rather than
 * rendering "Added chart 'CHART-hyUmCv…'".
 */
function recordSubject(record: ActivityRecord): string | null {
  const fromValues =
    valueLabel(record.to_value) ?? valueLabel(record.from_value);
  if (fromValues && !isOpaqueId(fromValues)) {
    return fromValues;
  }
  const last = record.path[record.path.length - 1];
  if (typeof last === 'string' && last !== '' && !isOpaqueId(last)) {
    return last;
  }
  return null;
}

/** e.g. "color_scheme" → "color scheme", "markerSize" → "marker size". */
function humanizeFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(
      /([a-z\d])([A-Z])/g,
      (_, before, upper) => `${before} ${upper.toLowerCase()}`,
    );
}

function fieldSubject(record: ActivityRecord): string {
  const path = record.path.filter(
    (segment): segment is string => typeof segment === 'string',
  );
  const meaningful =
    path[0] === 'params' || path[0] === 'json_metadata' ? path[1] : path[0];
  return humanizeFieldName(String(meaningful ?? t('setting')));
}

function layoutKindLabel(kind: string): string | null {
  switch (kind) {
    case 'chart':
      return t('chart');
    case 'row':
      return t('row');
    case 'column':
      return t('column');
    case 'tab':
      return t('tab');
    case 'tabs':
      return t('tabs');
    case 'header':
      return t('header');
    case 'markdown':
      return t('markdown');
    case 'divider':
      return t('divider');
    default:
      return null;
  }
}

/**
 * Human-readable label for a `source='self'` activity record. The
 * backend leaves `summary` empty for self records, so the client
 * renders one from kind / operation / path / values.
 */
/**
 * A change to the entity's own name/title reads better as a rename than as
 * a generic field edit ("Changed 'slice name'"). Returns the friendly
 * headline, or null when the record isn't a top-level name change.
 */
function renameHeadline(record: ActivityRecord): string | null {
  const field = record.path.length === 1 ? record.path[0] : null;
  const to = valueLabel(record.to_value);
  switch (field) {
    case 'slice_name':
      return to ? t("Chart renamed to '%s'", to) : t('Chart renamed');
    case 'dashboard_title':
      return to ? t("Dashboard renamed to '%s'", to) : t('Dashboard renamed');
    case 'table_name':
      return to ? t("Dataset renamed to '%s'", to) : t('Dataset renamed');
    default:
      return null;
  }
}

export function describeRecord(record: ActivityRecord): string {
  const { kind, operation } = record;
  const subject = recordSubject(record);

  const renamed = renameHeadline(record);
  if (renamed) {
    return renamed;
  }

  if (kind === 'metric') {
    if (operation === 'add') {
      return subject
        ? t("Applied '%s' metric", subject)
        : t('Applied a metric');
    }
    if (operation === 'remove') {
      return subject
        ? t("Removed '%s' metric", subject)
        : t('Removed a metric');
    }
    return subject ? t("Changed '%s' metric", subject) : t('Changed a metric');
  }

  if (kind === 'dimension') {
    if (operation === 'add') {
      return subject
        ? t("Added '%s' dimension", subject)
        : t('Added a dimension');
    }
    if (operation === 'remove') {
      return subject
        ? t("Removed '%s' dimension", subject)
        : t('Removed a dimension');
    }
    return subject
      ? t("Changed '%s' dimension", subject)
      : t('Changed a dimension');
  }

  if (kind === 'filter') {
    if (operation === 'add') {
      return subject ? t("Added filter on '%s'", subject) : t('Added a filter');
    }
    if (operation === 'remove') {
      return subject
        ? t("Removed filter on '%s'", subject)
        : t('Removed a filter');
    }
    return subject
      ? t("Changed filter on '%s'", subject)
      : t('Changed a filter');
  }

  if (kind === 'time_range') {
    const to = valueLabel(record.to_value);
    return to
      ? t("Changed time range to '%s'", to)
      : t('Changed the time range');
  }

  if (kind === 'color_palette') {
    return t('Changed color palette');
  }

  const label = layoutKindLabel(kind);
  if (label) {
    if (operation === 'add') {
      return subject
        ? t("Added %s '%s'", label, subject)
        : t('Added a %s', label);
    }
    if (operation === 'remove') {
      return subject
        ? t("Removed %s '%s'", label, subject)
        : t('Removed a %s', label);
    }
    if (operation === 'move') {
      return subject
        ? t("Moved %s '%s'", label, subject)
        : t('Moved a %s', label);
    }
    return subject
      ? t("Changed %s '%s'", label, subject)
      : t('Changed a %s', label);
  }

  // Generic scalar ("field") changes and unknown kinds.
  const field = fieldSubject(record);
  if (operation === 'add') {
    return t("Set '%s'", field);
  }
  if (operation === 'remove') {
    return t("Cleared '%s'", field);
  }
  return t("Changed '%s'", field);
}

/**
 * Headline for a save container, identical across entity types (sc-107283
 * model. The transaction `action_kind` drives an action-specific
 * headline; otherwise the save's date/time heads the group and the descriptive
 * per-change rows render beneath it. `entityType` is retained for the shared
 * signature but no longer changes the headline.
 */
export function groupHeadline(
  entityType: VersionedEntityType,
  group: SaveGroup,
): string {
  if (group.actionKind === 'restore') {
    return group.restoredToVersion != null
      ? t('Restored to version %s', group.restoredToVersion)
      : t('Restored version');
  }
  if (group.actionKind === 'import') {
    return t('Imported');
  }
  if (group.actionKind === 'clone') {
    return t('Cloned');
  }
  // The entity's first tracked save replays a params-normalization flood
  // that isn't meaningful user edits — collapse it under one label.
  if (group.firstTrackedSave) {
    return t('First tracked save');
  }
  // A save whose only changes were layout-container scaffolding (dropped
  // from the change list) reads as a layout rearrangement.
  if (group.records.length === 0 && group.hasSuppressedLayout) {
    return t('Rearranged layout');
  }
  // Defensive: a save that produced no renderable change records
  // (e.g. properties-only metadata edits) still deserves a label.
  if (group.records.length === 0) {
    return t('Properties updated');
  }
  return formatVersionDateTime(group.issuedAt);
}

/** Entity name with a fallback for records that arrive without one. */
export function entityDisplayName(record: ActivityRecord): string {
  if (record.entity_name) {
    return record.entity_name;
  }
  switch (record.entity_kind) {
    case 'chart':
      return t('Untitled chart');
    case 'dashboard':
      return t('Untitled dashboard');
    case 'dataset':
      return t('Untitled dataset');
    default:
      return t('Untitled');
  }
}

/**
 * Headline for a related row that rolled up several distinct entities
 * of one kind from a single transaction, e.g. "10 charts updated".
 */
export function relatedRollupHeadline(
  kind: ActivityEntityKind,
  count: number,
): string {
  switch (kind) {
    case 'chart':
      return tn('%s chart updated', '%s charts updated', count, count);
    case 'dashboard':
      return tn('%s dashboard updated', '%s dashboards updated', count, count);
    case 'dataset':
    default:
      return tn('%s dataset updated', '%s datasets updated', count, count);
  }
}

/**
 * Text for a `source='related'` row. The server renders `summary`
 * ("Dataset metric changed: Sales"); when a dashboard-path dataset
 * change affects multiple charts, prefer the impact-aware phrasing.
 */
export function relatedHeadline(record: ActivityRecord): string {
  const chartCount = record.impact?.charts ?? 0;
  if (record.entity_kind === 'dataset' && chartCount > 1) {
    return t(
      'Dataset used by %s charts updated: %s',
      chartCount,
      entityDisplayName(record),
    );
  }
  return (
    record.summary || t('%s updated: %s', t('Item'), entityDisplayName(record))
  );
}
