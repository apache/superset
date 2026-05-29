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
import { ActivityInclude, ActivityRecord, EntityType } from '../types';
import {
  ActivityRow,
  ActivitySaveRow,
  groupActivity,
} from '../utils/groupActivity';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import { formatVersionUser } from '../utils/formatVersionUser';
import VersionGroup from './VersionGroup';

interface Props {
  entityType: EntityType;
  records: ActivityRecord[] | null;
  loading: boolean;
  error: string | null;
  selectedVersionUuid: string | null;
  scopeFilter: ActivityInclude;
  onScopeFilterChange: (value: ActivityInclude) => void;
  onSelect: (versionUuid: string) => void;
  onRestore: (save: ActivitySaveRow) => void;
  onOpenAsNew?: (save: ActivitySaveRow) => void;
}

const SCOPE_FILTER_VALUES: ActivityInclude[] = ['all', 'self', 'related'];

function rowMatchesQuery(row: ActivityRow, q: string): boolean {
  if (row.type === 'related') {
    if (row.record.summary.toLowerCase().includes(q)) return true;
    if (row.record.entity_name.toLowerCase().includes(q)) return true;
    if (formatVersionUser(row.record.changed_by).toLowerCase().includes(q))
      return true;
    return false;
  }
  if (formatChangeTitle(row.changes).toLowerCase().includes(q)) return true;
  if (formatVersionUser(row.changed_by).toLowerCase().includes(q)) return true;
  return false;
}

const VersionList = ({
  entityType,
  records,
  loading,
  error,
  selectedVersionUuid,
  scopeFilter,
  onScopeFilterChange,
  onSelect,
  onRestore,
  onOpenAsNew,
}: Props) => {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const thisEntityLabel =
    entityType === 'chart' ? t('This chart only') : t('This dashboard only');
  const scopeOptions = useMemo(
    () =>
      SCOPE_FILTER_VALUES.map(value => ({
        value,
        label:
          value === 'all'
            ? t('All changes')
            : value === 'self'
              ? thisEntityLabel
              : t('Related items only'),
      })),
    [thisEntityLabel],
  );

  const buckets = useMemo(
    () => (records ? groupActivity(records) : []),
    [records],
  );

  const filteredBuckets = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return buckets;
    return buckets
      .map(bucket => ({
        label: bucket.label,
        rows: bucket.rows.filter(row => rowMatchesQuery(row, q)),
      }))
      .filter(bucket => bucket.rows.length > 0);
  }, [buckets, deferredQuery]);

  // Surface the latest self-save's uuid so VersionItem can render it with
  // the "current" affordance — related rows above it don't count.
  const currentVersionUuid = useMemo(() => {
    if (!records) return null;
    const firstSelf = records.find(r => r.source === 'self');
    return firstSelf?.version_uuid ?? null;
  }, [records]);

  const isEmpty =
    !loading && records !== null && filteredBuckets.length === 0;

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
          onChange={(v: ActivityInclude) => onScopeFilterChange(v)}
          aria-label={t('Filter versions by scope')}
          data-test="version-list-scope-filter"
          options={scopeOptions}
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
        {loading && !records && <Loading position="inline-centered" />}
        {error && (
          <EmptyState
            size="small"
            title={t('Failed to load version history')}
            description={error}
            image="error.svg"
          />
        )}
        {isEmpty && (
          <EmptyState
            size="small"
            title={t('No versions match')}
            description={t(
              'Try clearing the search or filter to see all versions.',
            )}
            image="empty.svg"
          />
        )}
        {filteredBuckets.map(bucket => (
          <VersionGroup
            key={bucket.label}
            entityType={entityType}
            label={bucket.label}
            rows={bucket.rows}
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
