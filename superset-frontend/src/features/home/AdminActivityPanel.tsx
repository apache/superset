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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core';
import { styled } from '@apache-superset/core/ui';
import { getClientErrorObject } from '@superset-ui/core';
import {
  Button,
  Empty,
  ListViewCard,
  Loading,
  Select,
} from '@superset-ui/core/components';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { Icons } from '@superset-ui/core/components/Icons';

import { CardContainer, CardStyles } from 'src/views/CRUD/utils';
import {
  AdminActionFilter,
  fetchAdminActivity,
  AdminActivityResponse,
} from './adminActivityApi';
import { AdminActivityItem } from './types';

const Controls = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;
  align-items: center;
`;

const LoadMore = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${({ theme }) => theme.sizeUnit * 4}px;
`;

function getActorName(item: AdminActivityItem): string {
  const firstName = item.actor.first_name?.trim();
  const lastName = item.actor.last_name?.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  return fullName || item.actor.username || t('Anonymous');
}

function getDescription(item: AdminActivityItem): string {
  const relativeTime = extendedDayjs(item.timestamp).fromNow();
  const countSuffix =
    item.event_count > 1 ? t(' (%s times)', item.event_count) : '';
  return t('%s · %s%s · %s', getActorName(item), item.action, countSuffix, relativeTime);
}

interface AdminActivityPanelProps {
  showThumbnails: boolean;
}

export default function AdminActivityPanel({
  showThumbnails,
}: AdminActivityPanelProps) {
  const [items, setItems] = useState<AdminActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canAccess, setCanAccess] = useState(true);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [actionType, setActionType] = useState<AdminActionFilter>('all');
  const [days, setDays] = useState(7);

  const hasMore = items.length < count;

  const load = useCallback(
    async (nextPage = 0, reset = false) => {
      setLoading(true);
      setError(null);
      try {
        const response: AdminActivityResponse = await fetchAdminActivity({
          page: nextPage,
          pageSize: 20,
          days,
          actionType,
          coalesce: true,
        });

        setCanAccess(true);
        setItems(prev => (reset ? response.result : [...prev, ...response.result]));
        setCount(response.count);
        setPage(nextPage);
      } catch (caught) {
        const errorObject = await getClientErrorObject(caught);
        if (errorObject.status === 403) {
          setCanAccess(false);
        } else {
          setError(t('Failed to load admin activity'));
        }
      } finally {
        setLoading(false);
      }
    },
    [actionType, days],
  );

  useEffect(() => {
    load(0, true);
  }, [load]);

  const actionOptions = useMemo(
    () => [
      { label: t('All activity'), value: 'all' },
      { label: t('Views'), value: 'view' },
      { label: t('Edits'), value: 'edit' },
      { label: t('Exports'), value: 'export' },
    ],
    [],
  );

  const dayOptions = useMemo(
    () => [
      { label: t('7 days'), value: 7 },
      { label: t('30 days'), value: 30 },
      { label: t('90 days'), value: 90 },
    ],
    [],
  );

  if (!canAccess) {
    return null;
  }

  if (loading && items.length === 0) {
    return <Loading />;
  }

  if (error && items.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={error}
        data-test="admin-activity-error"
      />
    );
  }

  return (
    <>
      <Controls>
        <Select
          value={actionType}
          onChange={(value: AdminActionFilter) => {
            setActionType(value);
          }}
          options={actionOptions}
          ariaLabel={t('Admin activity type')}
          style={{ minWidth: 190 }}
        />
        <Select
          value={days}
          onChange={(value: number) => {
            setDays(value);
          }}
          options={dayOptions}
          ariaLabel={t('Admin activity time range')}
          style={{ minWidth: 130 }}
        />
        <Button
          buttonStyle="secondary"
          onClick={() => load(0, true)}
          loading={loading}
          aria-label={t('Refresh admin activity')}
        >
          <Icons.ReloadOutlined iconSize="m" />
        </Button>
      </Controls>

      {items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('No admin activity found')}
          data-test="admin-activity-empty"
        />
      ) : (
        <CardContainer showThumbnails={showThumbnails}>
          {items.map(item => (
            <CardStyles key={`${item.id}-${item.timestamp}`}>
              <ListViewCard
                cover={<></>}
                title={item.object_title || t('[Untitled]')}
                description={getDescription(item)}
                avatar={
                  item.object_type === 'dashboard' ? (
                    <Icons.DashboardOutlined />
                  ) : (
                    <Icons.BarChartOutlined />
                  )
                }
                url={item.object_url || undefined}
              />
            </CardStyles>
          ))}
        </CardContainer>
      )}

      {hasMore && (
        <LoadMore>
          <Button
            buttonStyle="secondary"
            onClick={() => load(page + 1, false)}
            loading={loading}
            disabled={loading}
          >
            {t('Load more')}
          </Button>
        </LoadMore>
      )}
    </>
  );
}
