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
import { useDeferredValue, useMemo, useState } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import {
  Input,
  Loading,
  EmptyState,
  Icons,
  Select,
} from '@superset-ui/core/components';
import { EntityType, Version } from '../types';
import { groupVersionsByDate } from '../utils/groupVersionsByDate';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import { formatVersionUser } from '../utils/formatVersionUser';
import VersionGroup from './VersionGroup';

interface Props {
  entityType: EntityType;
  versions: Version[] | null;
  loading: boolean;
  error: string | null;
  selectedVersionUuid: string | null;
  onSelect: (versionUuid: string) => void;
  onRestore: (version: Version) => void;
  onOpenAsNew?: (version: Version) => void;
}

// The "filter by scope" select next to the search input. External /
// related-items rows aren't surfaced in MVP, so the non-default options
// are visual-only — they render but don't change which rows are shown.
const SCOPE_FILTER_OPTIONS = [
  { value: 'all', label: t('All changes') },
  { value: 'this', label: t('This chart only') },
  { value: 'related', label: t('Related items only') },
];

const VersionList = ({
  entityType,
  versions,
  loading,
  error,
  selectedVersionUuid,
  onSelect,
  onRestore,
  onOpenAsNew,
}: Props) => {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const deferredQuery = useDeferredValue(query);
  // Entity-aware scope filter label — "This chart only" vs
  // "This dashboard only".
  const thisEntityLabel =
    entityType === 'chart' ? t('This chart only') : t('This dashboard only');

  const filtered = useMemo(() => {
    if (!versions) return null;
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return versions;
    return versions.filter(v => {
      // Match both the change summary and the author name so users can
      // narrow by who made the change.
      if (formatChangeTitle(v.changes).toLowerCase().includes(q)) return true;
      if (formatVersionUser(v.changed_by).toLowerCase().includes(q))
        return true;
      return false;
    });
  }, [versions, deferredQuery]);

  const groups = useMemo(
    () => (filtered ? groupVersionsByDate(filtered) : []),
    [filtered],
  );
  const currentVersionUuid = versions?.[0]?.version_uuid ?? null;

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        height: 100%;
      `}
    >
      <div
        css={css`
          display: flex;
          gap: ${theme.sizeUnit * 2}px;
          padding: ${theme.sizeUnit * 3}px;
          border-bottom: 1px solid ${theme.colorBorder};
        `}
      >
        <Input
          allowClear
          placeholder={t('Search actions')}
          prefix={<Icons.SearchOutlined iconSize="m" />}
          value={query}
          onChange={e => setQuery(e.currentTarget.value)}
        />
        <Select
          value={scopeFilter}
          onChange={(v: string) => setScopeFilter(v)}
          aria-label={t('Filter versions by scope')}
          data-test="version-list-scope-filter"
          options={SCOPE_FILTER_OPTIONS.map(o =>
            o.value === 'this' ? { ...o, label: thisEntityLabel } : o,
          )}
          css={css`
            min-width: 160px;
          `}
        />
      </div>

      <div
        // Single-select list of historical versions. The rows below use
        // ``role="option"`` + ``aria-selected``; this wrapper provides
        // the listbox context.
        role="listbox"
        aria-label={t('Version history')}
        css={css`
          flex: 1;
          overflow-y: auto;
        `}
      >
        {loading && !versions && <Loading position="inline-centered" />}
        {error && (
          <EmptyState
            size="small"
            title={t('Failed to load version history')}
            description={error}
            image="error.svg"
          />
        )}
        {!loading && filtered && filtered.length === 0 && (
          <EmptyState
            size="small"
            title={t('No versions match')}
            description={t(
              'Try clearing the search or filter to see all versions.',
            )}
            image="empty.svg"
          />
        )}
        {groups.map(group => (
          <VersionGroup
            key={group.label}
            entityType={entityType}
            label={group.label}
            versions={group.versions}
            selectedVersionUuid={selectedVersionUuid}
            currentVersionUuid={currentVersionUuid}
            onSelect={onSelect}
            onRestore={onRestore}
            onOpenAsNew={onOpenAsNew}
          />
        ))}
      </div>
    </div>
  );
};

export default VersionList;
