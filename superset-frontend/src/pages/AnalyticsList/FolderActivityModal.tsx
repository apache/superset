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
import { useCallback, useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components/Icons';
import { StandardModal } from 'src/components/Modal';

interface ActivityEvent {
  id: number;
  action: string;
  target_type: string | null;
  target_name: string | null;
  details: Record<string, unknown> | null;
  created_on: string | null;
  user: { id: number; first_name: string; last_name: string } | null;
}

interface FolderActivityModalProps {
  folderUuid: string;
  folderName: string;
  show: boolean;
  onHide: () => void;
}

const Timeline = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    max-height: 400px;
    overflow-y: auto;
  `}
`;

const EventRow = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: flex-start;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};

    &:last-child {
      border-bottom: none;
    }
  `}
`;

const EventDot = styled.div`
  ${({ theme }) => `
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${theme.colorPrimary};
    margin-top: 6px;
    flex-shrink: 0;
  `}
`;

const EventContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const EventDescription = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSize}px;
    color: ${theme.colorText};
  `}
`;

const EventMeta = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSizeXS}px;
    color: ${theme.colorTextSecondary};
    margin-top: 2px;
  `}
`;

const EmptyState = styled.div`
  ${({ theme }) => `
    text-align: center;
    padding: ${theme.sizeUnit * 6}px;
    color: ${theme.colorTextSecondary};
  `}
`;

const ACTION_LABELS: Record<string, string> = {
  created: 'created this folder',
  renamed: 'renamed this folder',
  moved: 'moved this folder',
  deleted: 'deleted a subfolder',
  permission_changed: 'changed permissions',
};

function describeEvent(event: ActivityEvent): string {
  const userName = event.user
    ? `${event.user.first_name} ${event.user.last_name}`
    : t('Unknown user');
  const actionLabel = ACTION_LABELS[event.action] ?? event.action;

  let suffix = '';
  if (event.target_name && event.action === 'renamed') {
    const oldName = event.details?.old_name;
    suffix = oldName ? ` from "${oldName}" to "${event.target_name}"` : '';
  } else if (event.target_name && event.action === 'deleted') {
    suffix = ` "${event.target_name}"`;
  } else if (event.action === 'permission_changed' && event.details) {
    const detail = event.details;
    if (detail.action === 'added') {
      suffix = ` (added user as ${detail.permission})`;
    } else if (detail.action === 'updated') {
      suffix = ` (changed to ${detail.permission})`;
    } else if (detail.action === 'removed') {
      suffix = ' (removed user)';
    } else if (detail.sync_permissions) {
      suffix = ' (synced with parent)';
    }
  }

  return `${userName} ${actionLabel}${suffix}`;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return t('just now');
  if (diffMins < 60) return t('%s min ago', diffMins);
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t('%s hours ago', diffHours);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return t('%s days ago', diffDays);
  return date.toLocaleDateString();
}

export default function FolderActivityModal({
  folderUuid,
  folderName,
  show,
  onHide,
}: FolderActivityModalProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const fetchActivity = useCallback(
    (pageNum: number) => {
      setLoading(true);
      SupersetClient.get({
        endpoint: `/api/v1/folders/${folderUuid}/activity?page=${pageNum}&page_size=25`,
      }).then(
        ({ json }) => {
          const newEvents = (json?.result ?? []) as ActivityEvent[];
          setEvents(prev =>
            pageNum === 0 ? newEvents : [...prev, ...newEvents],
          );
          setTotal(json?.count ?? 0);
          setLoading(false);
        },
        () => {
          setLoading(false);
        },
      );
    },
    [folderUuid],
  );

  useEffect(() => {
    if (show && folderUuid) {
      setPage(0);
      setEvents([]);
      fetchActivity(0);
    }
  }, [show, folderUuid, fetchActivity]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchActivity(nextPage);
  };

  const hasMore = events.length < total;

  return (
    <StandardModal
      title={`${folderName} — ${t('Activity')}`}
      icon={<Icons.HistoryOutlined />}
      show={show}
      onHide={onHide}
      onSave={onHide}
      saveText={t('Close')}
      contentLoading={loading && events.length === 0}
      width={600}
    >
      {events.length === 0 && !loading ? (
        <EmptyState>{t('No activity recorded for this folder')}</EmptyState>
      ) : (
        <Timeline>
          {events.map(event => (
            <EventRow key={event.id}>
              <EventDot />
              <EventContent>
                <EventDescription>{describeEvent(event)}</EventDescription>
                <EventMeta>{formatTime(event.created_on)}</EventMeta>
              </EventContent>
            </EventRow>
          ))}
          {hasMore && (
            <EventRow
              style={{ cursor: 'pointer', justifyContent: 'center' }}
              onClick={handleLoadMore}
            >
              <EventDescription>
                {loading ? t('Loading...') : t('Load more')}
              </EventDescription>
            </EventRow>
          )}
        </Timeline>
      )}
    </StandardModal>
  );
}
