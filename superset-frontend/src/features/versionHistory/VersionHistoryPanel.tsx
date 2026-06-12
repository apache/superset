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
import { useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  EmptyState,
  Icons,
  Input,
  Select,
  Skeleton,
} from '@superset-ui/core/components';
import type {
  ActivityInclude,
  ActivityRecord,
  SaveGroup,
  SessionLogEntry,
  TimelineEntry,
  VersionedEntityType,
} from './types';
import type { UseVersionActivityResult } from './useVersionActivity';
import { relatedEntryKey } from './grouping';
import {
  describeRecord,
  formatAuthor,
  formatVersionDateTime,
  groupHeadline,
  relatedHeadline,
} from './display';
import SaveGroupItem from './SaveGroupItem';
import RelatedUpdateRow from './RelatedUpdateRow';
import CurrentVersionSection from './CurrentVersionSection';

export const VERSION_HISTORY_PANEL_WIDTH = 320;

const Panel = styled.div`
  ${({ theme }) => `
    width: ${VERSION_HISTORY_PANEL_WIDTH}px;
    min-width: ${VERSION_HISTORY_PANEL_WIDTH}px;
    height: 100%;
    display: flex;
    flex-direction: column;
    border-left: 1px solid ${theme.colorSplit};
    background-color: ${theme.colorBgContainer};
  `}
`;

const PanelHeader = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    border-bottom: 1px solid ${theme.colorSplit};
  `}
`;

const PanelTitle = styled.span`
  ${({ theme }) => `
    font-size: ${theme.fontSize}px;
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const Controls = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    border-bottom: 1px solid ${theme.colorSplit};
  `}
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const Footer = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 2}px;
    text-align: center;
  `}
`;

const PaddedContent = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 4}px;
  `}
`;

function matchesQuery(
  entityType: VersionedEntityType,
  entry: TimelineEntry,
  query: string,
): boolean {
  if (entry.type === 'related') {
    const { record } = entry;
    return (
      relatedHeadline(record).toLowerCase().includes(query) ||
      formatAuthor(record.changed_by).toLowerCase().includes(query)
    );
  }
  return (
    groupHeadline(entityType, entry).toLowerCase().includes(query) ||
    formatAuthor(entry.changedBy).toLowerCase().includes(query) ||
    entry.records.some(record =>
      describeRecord(record).toLowerCase().includes(query),
    )
  );
}

export interface VersionHistoryPanelProps {
  entityType: VersionedEntityType;
  activity: UseVersionActivityResult;
  include: ActivityInclude;
  onIncludeChange: (include: ActivityInclude) => void;
  previewedTransactionId: number | null;
  onClose: () => void;
  onPreview: (group: SaveGroup) => void;
  onRestore: (group: SaveGroup) => void;
  onOpenAsNew: (group: SaveGroup) => void;
  onOpenRelated?: (record: ActivityRecord) => void;
  sessionEntries?: SessionLogEntry[];
}

export default function VersionHistoryPanel({
  entityType,
  activity,
  include,
  onIncludeChange,
  previewedTransactionId,
  onClose,
  onPreview,
  onRestore,
  onOpenAsNew,
  onOpenRelated,
  sessionEntries = [],
}: VersionHistoryPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { timeline, isLoading, error, hasMore, loadMore } = activity;

  const includeOptions = useMemo(
    () => [
      { value: 'all', label: t('All changes') },
      {
        value: 'self',
        label:
          entityType === 'chart'
            ? t('This chart only')
            : t('This dashboard only'),
      },
      { value: 'related', label: t('Related items only') },
    ],
    [entityType],
  );

  const query = searchTerm.trim().toLowerCase();
  const visibleTimeline = useMemo(
    () =>
      query
        ? timeline.filter(entry => matchesQuery(entityType, entry, query))
        : timeline,
    [entityType, timeline, query],
  );

  // The newest save being a restore means the live entity matches an
  // older version; surface that in the "Current version" section.
  const restoreNotice = useMemo(() => {
    const newestGroup = timeline.find(
      (entry): entry is SaveGroup => entry.type === 'group',
    );
    return newestGroup?.actionKind === 'restore'
      ? t('Restored version · %s', formatVersionDateTime(newestGroup.issuedAt))
      : null;
  }, [timeline]);

  const isInitialLoading = isLoading && timeline.length === 0;

  return (
    <Panel role="complementary" aria-label={t('Version history')}>
      <PanelHeader>
        <PanelTitle>{t('Version history')}</PanelTitle>
        <Button
          buttonSize="xsmall"
          buttonStyle="link"
          aria-label={t('Close version history')}
          onClick={onClose}
        >
          <Icons.CloseOutlined iconSize="m" />
        </Button>
      </PanelHeader>
      <Controls>
        <Input
          allowClear
          placeholder={t('Search actions')}
          prefix={<Icons.SearchOutlined iconSize="m" />}
          value={searchTerm}
          onChange={event => setSearchTerm(event.target.value)}
          aria-label={t('Search actions')}
        />
        <Select
          ariaLabel={t('Filter version history')}
          value={include}
          onChange={value => onIncludeChange(value as ActivityInclude)}
          options={includeOptions}
        />
      </Controls>
      <Body>
        <CurrentVersionSection
          entries={sessionEntries}
          restoreNotice={restoreNotice}
        />
        {error && (
          <PaddedContent>
            <Alert type="error" message={error} closable={false} />
          </PaddedContent>
        )}
        {isInitialLoading && (
          <PaddedContent>
            <Skeleton active />
          </PaddedContent>
        )}
        {!isInitialLoading && !error && visibleTimeline.length === 0 && (
          <EmptyState
            image="empty.svg"
            size="small"
            title={query ? t('No actions found') : t('No history yet')}
            description={
              query
                ? t('Try a different search term')
                : t('Saved changes will appear here')
            }
          />
        )}
        {visibleTimeline.map(entry =>
          entry.type === 'group' ? (
            <SaveGroupItem
              key={`group-${entry.transactionId}`}
              entityType={entityType}
              group={entry}
              isPreviewed={entry.transactionId === previewedTransactionId}
              onPreview={onPreview}
              onRestore={onRestore}
              onOpenAsNew={onOpenAsNew}
            />
          ) : (
            <RelatedUpdateRow
              key={`related-${relatedEntryKey(entry.record)}`}
              record={entry.record}
              onOpen={onOpenRelated}
            />
          ),
        )}
        {hasMore && (
          <Footer>
            <Button
              buttonStyle="link"
              onClick={loadMore}
              loading={isLoading && timeline.length > 0}
            >
              {t('Load more')}
            </Button>
          </Footer>
        )}
      </Body>
    </Panel>
  );
}
