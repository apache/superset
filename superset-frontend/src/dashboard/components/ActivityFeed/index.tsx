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
import { t } from '@apache-superset/core/ui';
import { Button, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';

import { fetchDashboardActivitySummary } from './api';
import ActivityFeedDrawer from './ActivityFeedDrawer';
import { ActivitySummary } from './types';

interface ActivityFeedProps {
  dashboardId: number;
}

export default function ActivityFeed({ dashboardId }: ActivityFeedProps) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await fetchDashboardActivitySummary(dashboardId);
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const summaryLabel = summary
    ? t('%s views today', summary.views_today)
    : t('Activity');

  return (
    <>
      <Tooltip title={summaryLabel}>
        <Button
          buttonStyle="secondary"
          onClick={() => setOpen(true)}
          loading={loadingSummary}
          data-test="dashboard-activity-button"
          aria-label={summaryLabel}
        >
          <Icons.HistoryOutlined iconSize="m" />
          {summaryLabel}
        </Button>
      </Tooltip>
      <ActivityFeedDrawer
        dashboardId={dashboardId}
        open={open}
        summary={summary}
        onClose={() => {
          setOpen(false);
          loadSummary();
        }}
      />
    </>
  );
}
