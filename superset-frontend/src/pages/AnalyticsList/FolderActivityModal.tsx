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
import React, { useCallback, useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Drawer } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';

interface ActivityEvent {
  id: number;
  action: string;
  target_type: string | null;
  target_name: string | null;
  details: Record<string, unknown> | null;
  created_on: string | null;
  folder_name: string | null;
  folder_uuid: string | null;
  user: { id: number; first_name: string; last_name: string } | null;
}

interface FolderActivityDrawerProps {
  open: boolean;
  onClose: () => void;
}

const Timeline = styled.div`
  display: flex;
  flex-direction: column;
`;

const EventRow = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: flex-start;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px 0;
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

const AssetTag = styled.a`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit / 2}px ${theme.sizeUnit}px;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorBgContainer};
    color: ${theme.colorText};
    text-decoration: none;
    max-width: 180px;
    font-size: ${theme.fontSizeSM}px;
    vertical-align: middle;
    cursor: pointer;
    transition: border-color 0.2s;

    &:hover {
      border-color: ${theme.colorPrimary};
      color: ${theme.colorPrimary};
    }
  `}
`;

const TagName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

const LoadMoreButton = styled.div`
  ${({ theme }) => `
    text-align: center;
    padding: ${theme.sizeUnit * 2}px;
    color: ${theme.colorPrimary};
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  `}
`;

function assetIcon(type: string | null) {
  switch (type) {
    case 'dashboard':
      return <Icons.LayoutOutlined iconSize="s" />;
    case 'chart':
    case 'slice':
      return <Icons.LineChartOutlined iconSize="s" />;
    default:
      return <Icons.FolderOutlined iconSize="s" />;
  }
}

function folderTag(name: string, uuid: string | null) {
  return (
    <AssetTag href={uuid ? `/analytics/${uuid}/` : '#'}>
      <Icons.FolderOutlined iconSize="s" />
      <TagName>{name}</TagName>
    </AssetTag>
  );
}

function targetTag(type: string | null, name: string | null) {
  if (!name) return null;
  return (
    <AssetTag as="span">
      {assetIcon(type)}
      <TagName>{name}</TagName>
    </AssetTag>
  );
}

function describeEvent(event: ActivityEvent): React.ReactNode {
  const userName = event.user
    ? `${event.user.first_name} ${event.user.last_name}`
    : t('Unknown user');

  const folder = event.folder_name
    ? folderTag(event.folder_name, event.folder_uuid)
    : null;

  switch (event.action) {
    case 'created':
      return (
        <>
          {userName} {t('created folder')} {folder}
        </>
      );
    case 'renamed': {
      const oldName = event.details?.old_name as string | undefined;
      return oldName ? (
        <>
          {userName} {t('renamed')} {folderTag(oldName, null)} {t('to')}{' '}
          {folder}
        </>
      ) : (
        <>
          {userName} {t('renamed folder')} {folder}
        </>
      );
    }
    case 'moved':
      return (
        <>
          {userName} {t('moved folder')} {folder}
        </>
      );
    case 'deleted':
      return (
        <>
          {userName} {t('deleted subfolder')}{' '}
          {targetTag('folder', event.target_name)}
          {folder && (
            <>
              {' '}
              {t('in')} {folder}
            </>
          )}
        </>
      );
    case 'permission_changed': {
      const detail = event.details;
      if (detail?.sync_permissions) {
        return (
          <>
            {userName} {t('synced permissions with parent on')} {folder}
          </>
        );
      }
      const targetEmail = event.target_name;
      if (detail?.action === 'added') {
        return (
          <>
            {userName} {t('added')} {targetEmail} {t('as')}{' '}
            {String(detail.permission)} {t('on')} {folder}
          </>
        );
      }
      if (detail?.action === 'updated') {
        return (
          <>
            {userName} {t('changed')} {targetEmail} {t('to')}{' '}
            {String(detail.permission)} {t('on')} {folder}
          </>
        );
      }
      if (detail?.action === 'removed') {
        return (
          <>
            {userName} {t('removed')} {targetEmail} {t('from')} {folder}
          </>
        );
      }
      return (
        <>
          {userName} {t('changed permissions on')} {folder}
        </>
      );
    }
    case 'asset_added':
      return (
        <>
          {userName} {t('added')}{' '}
          {targetTag(event.target_type, event.target_name)}
          {folder && (
            <>
              {' '}
              {t('to')} {folder}
            </>
          )}
        </>
      );
    case 'asset_removed':
      return (
        <>
          {userName} {t('removed')}{' '}
          {targetTag(event.target_type, event.target_name)}
          {folder && (
            <>
              {' '}
              {t('from')} {folder}
            </>
          )}
        </>
      );
    case 'description_updated':
      return (
        <>
          {userName} {t('updated the description of')} {folder}
        </>
      );
    default:
      return (
        <>
          {userName} {event.action} {folder}
        </>
      );
  }
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

export default function FolderActivityDrawer({
  open,
  onClose,
}: FolderActivityDrawerProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const fetchActivity = useCallback((pageNum: number) => {
    setLoading(true);
    SupersetClient.get({
      endpoint: `/api/v1/folders/activity?page=${pageNum}&page_size=25`,
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
  }, []);

  useEffect(() => {
    if (open) {
      setPage(0);
      setEvents([]);
      fetchActivity(0);
    }
  }, [open, fetchActivity]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchActivity(nextPage);
  };

  const hasMore = events.length < total;

  return (
    <Drawer
      title={t('Activity')}
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      {events.length === 0 && !loading ? (
        <EmptyState>{t('No activity recorded')}</EmptyState>
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
            <LoadMoreButton onClick={handleLoadMore}>
              {loading ? t('Loading...') : t('Load more')}
            </LoadMoreButton>
          )}
        </Timeline>
      )}
    </Drawer>
  );
}
