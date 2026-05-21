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
import { Change } from '../types';

// Layout-record path verbs (set by ``diff_dashboard_layout`` on the
// backend): path = [verb, kind, id].
const LAYOUT_VERBS = new Set(['add', 'remove', 'move', 'edit']);

// Localized labels for the kinds emitted by the backend. Defined statically
// so xgettext can extract them.
const KIND_LABELS: Record<string, string> = {
  chart: t('chart'),
  row: t('row'),
  column: t('column'),
  tab: t('tab'),
  tabs: t('tabs'),
  header: t('header'),
  markdown: t('markdown'),
  divider: t('divider'),
  metric: t('metric'),
};

const localizedKind = (k: string): string => KIND_LABELS[k] ?? k;

export function summarizeChange(c: Change): string {
  if (c.path.length === 3 && LAYOUT_VERBS.has(String(c.path[0]))) {
    const verb = String(c.path[0]);
    const kind = localizedKind(String(c.path[1]));
    const payload =
      ((c.to_value ?? c.from_value) as { name?: string } | null) ?? null;
    const name = payload?.name;
    if (verb === 'add') {
      return name
        ? t('Added %(kind)s "%(name)s"', { kind, name })
        : t('Added %(kind)s', { kind });
    }
    if (verb === 'remove') {
      return name
        ? t('Removed %(kind)s "%(name)s"', { kind, name })
        : t('Removed %(kind)s', { kind });
    }
    if (verb === 'move') {
      return name
        ? t('Moved %(kind)s "%(name)s"', { kind, name })
        : t('Moved %(kind)s', { kind });
    }
    return name
      ? t('Edited %(kind)s "%(name)s"', { kind, name })
      : t('Edited %(kind)s', { kind });
  }

  const isAdd = c.from_value == null && c.to_value != null;
  const isRemove = c.from_value != null && c.to_value == null;

  if (c.path.length === 2 && (c.kind === 'column' || c.kind === 'metric')) {
    const kind = localizedKind(c.kind);
    const name = String(c.path[1]);
    if (isAdd) return t('Added %(kind)s "%(name)s"', { kind, name });
    if (isRemove) return t('Removed %(kind)s "%(name)s"', { kind, name });
    return t('Changed %(kind)s "%(name)s"', { kind, name });
  }

  if (c.path[0] === 'slices') {
    const id = String(c.path[1] ?? '');
    if (isAdd) return t('Added chart %(id)s', { id }).trim();
    if (isRemove) return t('Removed chart %(id)s', { id }).trim();
    return t('Changed chart %(id)s', { id }).trim();
  }

  if (c.kind === 'field') {
    const fieldName = String(c.path[c.path.length - 1]);
    let fieldLabel: string;
    if (fieldName === 'dashboard_title') {
      fieldLabel = t('title');
    } else if (fieldName === 'slice_name') {
      fieldLabel = t('chart name');
    } else if (fieldName === 'table_name') {
      fieldLabel = t('table name');
    } else {
      fieldLabel = fieldName;
    }
    const isShortScalar =
      c.to_value !== null &&
      c.to_value !== undefined &&
      (typeof c.to_value === 'string' ||
        typeof c.to_value === 'number' ||
        typeof c.to_value === 'boolean') &&
      String(c.to_value).length <= 80;
    if (!isAdd && !isRemove && isShortScalar) {
      return t('Changed %(field)s to "%(value)s"', {
        field: fieldLabel,
        value: String(c.to_value),
      });
    }
    if (isRemove) {
      return t('Cleared %(field)s', { field: fieldLabel });
    }
    if (isAdd && isShortScalar) {
      return t('Set %(field)s to "%(value)s"', {
        field: fieldLabel,
        value: String(c.to_value),
      });
    }
    if (isAdd) return t('Added %(field)s', { field: fieldLabel });
    return t('Changed %(field)s', { field: fieldLabel });
  }

  const kind = localizedKind(c.kind);
  if (c.path.length) {
    const detail = String(c.path[c.path.length - 1]);
    if (isAdd) return t('Added %(kind)s %(detail)s', { kind, detail });
    if (isRemove) return t('Removed %(kind)s %(detail)s', { kind, detail });
    return t('Changed %(kind)s %(detail)s', { kind, detail });
  }
  if (isAdd) return t('Added %(kind)s', { kind });
  if (isRemove) return t('Removed %(kind)s', { kind });
  return t('Changed %(kind)s', { kind });
}
