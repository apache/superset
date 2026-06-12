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
  ActivityRecord,
  SaveGroup,
  VersionedEntityType,
} from './types';
import { classifySaveGroup } from './grouping';

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

export function formatRelativeTime(issuedAt: string): string {
  return parseIssuedAt(issuedAt).fromNow();
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
    if (
      typeof candidate.column_name === 'string' &&
      candidate.column_name !== ''
    ) {
      return candidate.column_name;
    }
    if (typeof candidate.subject === 'string' && candidate.subject !== '') {
      return candidate.subject;
    }
  }
  return null;
}

/**
 * The natural key of the changed item is the last path segment for
 * list-diff records (e.g. ['params', 'metrics', 'Revenue']).
 */
function recordSubject(record: ActivityRecord): string | null {
  const fromValues =
    valueLabel(record.to_value) ?? valueLabel(record.from_value);
  if (fromValues) {
    return fromValues;
  }
  const last = record.path[record.path.length - 1];
  if (typeof last === 'string' && last !== '') {
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
export function describeRecord(record: ActivityRecord): string {
  const { kind, operation } = record;
  const subject = recordSubject(record);

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
 * Headline for a save container. Charts use the save date/time;
 * dashboards use the Filters / Edit-mode classification. A transaction
 * `action_kind` overrides both.
 */
export function groupHeadline(
  entityType: VersionedEntityType,
  group: SaveGroup,
): string {
  if (group.actionKind === 'restore') {
    return t('Restored version');
  }
  if (group.actionKind === 'import') {
    return t('Imported version');
  }
  if (group.actionKind === 'clone') {
    return t('Cloned version');
  }
  // Defensive: a save that produced no renderable change records
  // (e.g. properties-only metadata edits) still deserves a label.
  if (group.records.length === 0) {
    return t('Properties updated');
  }
  if (entityType === 'dashboard') {
    const changes = group.records.length;
    return classifySaveGroup(group) === 'filters'
      ? t('Filters · %s', tn('%s change', '%s changes', changes, changes))
      : t('Edit mode · %s', tn('%s change', '%s changes', changes, changes));
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
