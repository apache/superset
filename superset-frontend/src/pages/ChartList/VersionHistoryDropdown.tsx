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

// TEMP: Demo aid for sc-103156 entity-versioning. Lets a user open a
// dropdown of recent versions on a chart and restore one. Not part
// of the merged feature scope (ADR-005 limits v1 to backend); revert
// before pushing the versioning branch.

import { useState, useCallback } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Dropdown, Tooltip, Icons } from '@superset-ui/core/components';

interface Change {
  kind: string;
  path: string[];
  from_value: unknown;
  to_value: unknown;
}

interface ChangedBy {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
}

interface Version {
  version_uuid: string;
  version_number: number;
  transaction_id: number;
  operation_type: string;
  issued_at: string;
  changed_by: ChangedBy | null;
  changes: Change[];
}

interface Props {
  chartUuid: string;
  onRestored?: () => void;
}

// Layout-record path verbs (set by ``diff_dashboard_layout`` on the
// backend): path = [verb, kind, id]. Same shape across the three
// debug widgets so chart/dataset dropdowns also recognise them — even
// though they don't normally produce layout records, the formatter
// stays uniform.
const LAYOUT_VERBS = new Set(['add', 'remove', 'move', 'edit']);

// Localized labels for the kinds emitted by the backend (layout walker
// + dataset child diff). Defined statically so xgettext can extract them.
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

function summarizeChange(c: Change): string {
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
    const fieldLabel: string =
      fieldName === 'dashboard_title'
        ? t('title')
        : fieldName === 'slice_name'
          ? t('chart name')
          : fieldName === 'table_name'
            ? t('table name')
            : fieldName;
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
    if (isRemove) return t('Removed %(field)s', { field: fieldLabel });
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

function formatChangeTitle(changes: Change[]): string {
  if (!changes.length) return t('Baseline');
  const first = summarizeChange(changes[0]);
  if (changes.length === 1) return first;
  return t('%(first)s (+%(more)s more)', {
    first,
    more: changes.length - 1,
  });
}

function formatUser(by: ChangedBy | null): string {
  if (!by) return t('system');
  if (by.first_name || by.last_name) {
    return `${by.first_name ?? ''} ${by.last_name ?? ''}`.trim();
  }
  return by.username;
}

function formatDate(iso: string): string {
  try {
    // Match the Superset locale set in src/views/App.tsx on
    // ``document.documentElement.lang`` rather than the browser default.
    const lang = document.documentElement.lang || undefined;
    return new Date(iso).toLocaleString(lang);
  } catch {
    return iso;
  }
}

export default function VersionHistoryDropdown({
  chartUuid,
  onRestored,
}: Props) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [loading, setLoading] = useState(false);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/chart/${chartUuid}/versions/`,
      });
      const result = (json as { result: Version[] }).result || [];
      // Newest first (API returns oldest-first)
      setVersions([...result].reverse().slice(0, 20));
    } catch (e) {
      console.error('Failed to load versions', e);
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [chartUuid]);

  const handleRestore = useCallback(
    async (version: Version) => {
      const summary = formatChangeTitle(version.changes);
      if (
        // eslint-disable-next-line no-alert
        !window.confirm(
          t(
            'Restore this chart to version %(num)s (%(summary)s)? This will overwrite the current state.',
            { num: version.version_number, summary },
          ),
        )
      ) {
        return;
      }
      try {
        await SupersetClient.post({
          endpoint: `/api/v1/chart/${chartUuid}/versions/${version.version_uuid}/restore`,
        });
        // eslint-disable-next-line no-alert
        window.alert(t('Restored. Reload the page to see the change.'));
        if (onRestored) onRestored();
      } catch (e) {
        console.error('Restore failed', e);
        // eslint-disable-next-line no-alert
        window.alert(t('Restore failed — see browser console for details.'));
      }
    },
    [chartUuid, onRestored],
  );

  const items = (() => {
    if (loading) {
      return [{ key: 'loading', label: t('Loading…'), disabled: true }];
    }
    if (!versions) {
      return [
        { key: 'empty', label: t('Click to load versions'), disabled: true },
      ];
    }
    if (versions.length === 0) {
      return [{ key: 'empty', label: t('No versions yet'), disabled: true }];
    }
    // versions is already newest-first, so [0] is the live/current version.
    return versions.map((v, idx) => {
      const isCurrent = idx === 0;
      return {
        key: String(v.transaction_id),
        // antd's `disabled: true` greys the item and blocks default
        // click handling; combined with the inner div NOT having an
        // onClick when current, the row becomes informational only.
        disabled: isCurrent,
        label: (
          <div
            style={{ minWidth: 280, lineHeight: 1.4, padding: '4px 0' }}
            onClick={isCurrent ? undefined : () => handleRestore(v)}
          >
            <div style={{ fontWeight: 600 }}>
              #{v.version_number} — {formatChangeTitle(v.changes)}
              {isCurrent && (
                <span
                  style={{
                    marginLeft: 8,
                    fontWeight: 400,
                    fontSize: 12,
                    opacity: 0.7,
                  }}
                >
                  {t('(current)')}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {formatUser(v.changed_by)} · {formatDate(v.issued_at)}
            </div>
            {v.changes.length > 1 && (
              <ul
                style={{
                  margin: '4px 0 0 18px',
                  padding: 0,
                  fontSize: 12,
                  opacity: 0.85,
                  listStyle: 'disc',
                }}
              >
                {v.changes.slice(0, 5).map((c, i) => (
                  <li key={i}>{summarizeChange(c)}</li>
                ))}
                {v.changes.length > 5 && (
                  <li style={{ opacity: 0.6 }}>
                    {t('+%(n)s more', { n: v.changes.length - 5 })}
                  </li>
                )}
              </ul>
            )}
          </div>
        ),
      };
    });
  })();

  return (
    <Dropdown
      trigger={['click']}
      menu={{ items }}
      onOpenChange={open => {
        if (open && versions === null && !loading) loadVersions();
      }}
    >
      <Tooltip
        id="version-history-tooltip"
        title={t('Version history (demo)')}
        placement="bottom"
      >
        <span role="button" tabIndex={0} className="action-button">
          <Icons.HistoryOutlined iconSize="l" />
        </span>
      </Tooltip>
    </Dropdown>
  );
}
