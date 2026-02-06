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
import { styled, t } from '@apache-superset/core/ui';
import {
  Button,
  Drawer,
  Select,
  Tooltip,
  Typography,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';

import { fetchDashboardActivity } from './api';
import ActivityTimeline from './ActivityTimeline';
import { ActionTypeFilter, ActivityItem, ActivitySummary } from './types';

const Controls = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;
  align-items: center;
`;

const Summary = styled.div`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 3}px;
  color: ${({ theme }) => theme.colorTextDescription};
`;

interface ActivityFeedDrawerProps {
  dashboardId: number;
  open: boolean;
  summary: ActivitySummary | null;
  onClose: () => void;
}

export default function ActivityFeedDrawer({
  dashboardId,
  open,
  summary,
  onClose,
}: ActivityFeedDrawerProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [actionType, setActionType] = useState<ActionTypeFilter>('all');
  const [days, setDays] = useState(30);

  const loadActivity = useCallback(
    async ({
      reset = false,
      pageToLoad = 0,
    }: {
      reset?: boolean;
      pageToLoad?: number;
    }) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchDashboardActivity(dashboardId, {
          page: pageToLoad,
          pageSize: 25,
          actionType,
          days,
        });

        setActivities(prev =>
          reset ? response.activities : [...prev, ...response.activities],
        );
        setHasMore(response.has_more ?? (pageToLoad + 1) * 25 < response.count);
        setPage(pageToLoad);
      } catch {
        setError(t('Failed to load dashboard activity'));
      } finally {
        setLoading(false);
      }
    },
    [actionType, dashboardId, days],
  );

  useEffect(() => {
    if (open) {
      loadActivity({ reset: true, pageToLoad: 0 });
    }
  }, [open, actionType, days, loadActivity]);

  const handleLoadMore = useCallback(() => {
    if (loading) {
      return;
    }
    const nextPage = page + 1;
    loadActivity({ pageToLoad: nextPage });
  }, [loadActivity, loading, page]);

  const actionOptions = useMemo(
    () => [
      { label: t('All activity'), value: 'all' },
      { label: t('Views'), value: 'view' },
      { label: t('Edits'), value: 'edit' },
      { label: t('Exports'), value: 'export' },
      { label: t('Chart interactions'), value: 'chart_interaction' },
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

  return (
    <Drawer
      title={t('Dashboard activity')}
      placement="right"
      width={460}
      open={open}
      onClose={onClose}
      extra={
        <Tooltip title={t('Refresh activity')}>
          <Button
            buttonStyle="secondary"
            onClick={() => loadActivity({ reset: true, pageToLoad: 0 })}
            loading={loading}
            aria-label={t('Refresh activity')}
          >
            <Icons.ReloadOutlined iconSize="m" />
          </Button>
        </Tooltip>
      }
    >
      {summary && (
        <Summary data-test="dashboard-activity-summary">
          <Typography.Text>
            {t(
              '%s views today, %s unique viewers in %s days',
              summary.views_today,
              summary.unique_viewers,
              summary.period_days,
            )}
          </Typography.Text>
        </Summary>
      )}
      <Controls>
        <Select
          value={actionType}
          onChange={(value: ActionTypeFilter) => setActionType(value)}
          options={actionOptions}
          ariaLabel={t('Activity type')}
          style={{ minWidth: 190 }}
        />
        <Select
          value={days}
          onChange={(value: number) => setDays(value)}
          options={dayOptions}
          ariaLabel={t('Time range')}
          style={{ minWidth: 130 }}
        />
      </Controls>

      <ActivityTimeline
        activities={activities}
        loading={loading}
        hasMore={hasMore}
        error={error}
        onRetry={() => loadActivity({ reset: true, pageToLoad: 0 })}
        onLoadMore={handleLoadMore}
      />
    </Drawer>
  );
}
