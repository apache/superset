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
} from '@superset-ui/core/components';
import { Version } from '../types';
import { groupVersionsByDate } from '../utils/groupVersionsByDate';
import { formatChangeTitle } from '../utils/formatChangeTitle';
import VersionGroup from './VersionGroup';

interface Props {
  versions: Version[] | null;
  loading: boolean;
  error: string | null;
  selectedVersionUuid: string | null;
  onSelect: (versionUuid: string) => void;
  onRestore: (version: Version) => void;
  onOpenAsNew?: (version: Version) => void;
}

const VersionList = ({
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
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    if (!versions) return null;
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return versions;
    return versions.filter(v =>
      formatChangeTitle(v.changes).toLowerCase().includes(q),
    );
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
          placeholder={t('Search versions')}
          prefix={<Icons.SearchOutlined iconSize="m" />}
          value={query}
          onChange={e => setQuery(e.currentTarget.value)}
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
