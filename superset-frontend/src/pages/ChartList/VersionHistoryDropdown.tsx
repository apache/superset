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

function formatChangeTitle(changes: Change[]): string {
  if (!changes.length) return t('No changes recorded');

  // Pick the first change record as the headline. If multiple changes
  // share the same kind, summarise as "Edited N <kind>s".
  const first = changes[0];
  const sameKind = changes.every(c => c.kind === first.kind);

  const verb = (() => {
    if (first.from_value == null && first.to_value != null) return t('Added');
    if (first.from_value != null && first.to_value == null) return t('Removed');
    return t('Changed');
  })();

  const subject = (() => {
    // For child kinds (filter, metric, etc.) the path is e.g.
    // ["params", "adhoc_filters", <subject>]; the trailing segment is
    // the natural key.
    if (first.path.length >= 2) {
      return `${first.kind} ${first.path[first.path.length - 1]}`;
    }
    if (first.path.length === 1) {
      return first.path[0];
    }
    return first.kind;
  })();

  if (sameKind && changes.length > 1) {
    return t('%(verb)s %(count)s %(kind)ss', {
      verb,
      count: changes.length,
      kind: first.kind,
    });
  }
  return `${verb} ${subject}`;
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
    return new Date(iso).toLocaleString();
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
      // eslint-disable-next-line no-alert
      if (
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
