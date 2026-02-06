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
import { styled, t } from '@apache-superset/core/ui';
import { Button, Empty, Loading } from '@superset-ui/core/components';

import ActivityItem from './ActivityItem';
import { ActivityItem as ActivityItemType } from './types';

const TimelineContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.colorBorder};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  overflow: hidden;
`;

const Actions = styled.div`
  display: flex;
  justify-content: center;
  padding: ${({ theme }) => theme.sizeUnit * 3}px;
`;

const EmptyWrap = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 6}px;
`;

interface ActivityTimelineProps {
  activities: ActivityItemType[];
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  onRetry: () => void;
  onLoadMore: () => void;
}

export default function ActivityTimeline({
  activities,
  loading,
  hasMore,
  error,
  onRetry,
  onLoadMore,
}: ActivityTimelineProps) {
  if (loading && activities.length === 0) {
    return <Loading />;
  }

  if (error && activities.length === 0) {
    return (
      <EmptyWrap>
        <Empty
          description={error}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          data-test="dashboard-activity-empty-error"
        >
          <Button onClick={onRetry} buttonStyle="secondary">
            {t('Retry')}
          </Button>
        </Empty>
      </EmptyWrap>
    );
  }

  if (activities.length === 0) {
    return (
      <EmptyWrap>
        <Empty
          description={t('No activity found')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          data-test="dashboard-activity-empty"
        />
      </EmptyWrap>
    );
  }

  return (
    <TimelineContainer>
      {activities.map(item => (
        <ActivityItem key={item.id} item={item} />
      ))}
      {(hasMore || loading) && (
        <Actions>
          <Button
            loading={loading}
            onClick={onLoadMore}
            buttonStyle="secondary"
            disabled={loading}
          >
            {hasMore ? t('Load more') : t('Loading...')}
          </Button>
        </Actions>
      )}
    </TimelineContainer>
  );
}
