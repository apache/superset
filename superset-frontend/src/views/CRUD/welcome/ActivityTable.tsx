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
import React from 'react';
import moment from 'moment';
import { styled, t } from '@superset-ui/core';

import Loading from 'src/components/Loading';
import ListViewCard from 'src/components/ListViewCard';
import SubMenu from 'src/components/Menu/SubMenu';
import { Chart } from 'src/types/Chart';
import { Dashboard, SavedQueryObject } from 'src/views/CRUD/types';
import { mq, CardStyles } from 'src/views/CRUD/utils';

import { ActivityData } from './Welcome';
import EmptyState from './EmptyState';

/**
 * Return result from /superset/recent_activity/{user_id}
 */
interface RecentActivity {
  action: string;
  item_type: 'slice' | 'dashboard';
  item_url: string;
  item_title: string;
  time: number;
  time_delta_humanized?: string;
}

interface RecentSlice extends RecentActivity {
  item_type: 'slice';
}

interface RecentDashboard extends RecentActivity {
  item_type: 'dashboard';
}

/**
 * Recent activity objects fetched by `getRecentAcitivtyObjs`.
 */
type ActivityObject =
  | RecentSlice
  | RecentDashboard
  | Chart
  | Dashboard
  | SavedQueryObject;

interface ActivityProps {
  user: {
    userId: string | number;
  };
  activeChild: string;
  setActiveChild: (arg0: string) => void;
  loading: boolean;
  activityData: ActivityData;
}

const ActivityContainer = styled.div`
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  margin-top: ${({ theme }) => theme.gridUnit * -4}px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(31%, max-content));
  ${[mq[3]]} {
    grid-template-columns: repeat(auto-fit, minmax(31%, max-content));
  }
  ${[mq[2]]} {
    grid-template-columns: repeat(auto-fit, minmax(42%, max-content));
  }
  ${[mq[1]]} {
    grid-template-columns: repeat(auto-fit, minmax(63%, max-content));
  }
  grid-gap: ${({ theme }) => theme.gridUnit * 8}px;
  justify-content: left;
  padding: ${({ theme }) => theme.gridUnit * 6}px;
  padding-top: ${({ theme }) => theme.gridUnit * 2}px;
  .ant-card-meta-avatar {
    margin-top: ${({ theme }) => theme.gridUnit * 3}px;
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  }
  .ant-card-meta-title {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
`;

const UNTITLED = t('[Untitled]');
const UNKNOWN_TIME = t('Unknown');

const getEntityTitle = (entity: ActivityObject) => {
  if ('dashboard_title' in entity) return entity.dashboard_title || UNTITLED;
  if ('slice_name' in entity) return entity.slice_name || UNTITLED;
  if ('label' in entity) return entity.label || UNTITLED;
  return entity.item_title || UNTITLED;
};

const getEntityIconName = (entity: ActivityObject) => {
  if ('sql' in entity) return 'sql';
  const url = 'item_url' in entity ? entity.item_url : entity.url;
  if (url?.includes('dashboard')) {
    return 'nav-dashboard';
  }
  if (url?.includes('explore')) {
    return 'nav-charts';
  }
  return '';
};

const getEntityUrl = (entity: ActivityObject) => {
  if ('sql' in entity) return `/superset/sqllab?savedQueryId=${entity.id}`;
  if ('url' in entity) return entity.url;
  return entity.item_url;
};

const getEntityLastActionOn = (entity: ActivityObject) => {
  // translation keys for last action on
  const LAST_VIEWED = `Last viewed %s`;
  const LAST_MODIFIED = `Last modified %s`;

  // for Recent viewed items
  if ('time_delta_humanized' in entity) {
    return t(LAST_VIEWED, entity.time_delta_humanized);
  }

  if ('changed_on_delta_humanized' in entity) {
    return t(LAST_MODIFIED, entity.changed_on_delta_humanized);
  }

  let time: number | string | undefined | null;
  let translationKey = LAST_MODIFIED;
  if ('time' in entity) {
    // eslint-disable-next-line prefer-destructuring
    time = entity.time;
    translationKey = LAST_VIEWED;
  }
  if ('changed_on' in entity) time = entity.changed_on;
  if ('changed_on_utc' in entity) time = entity.changed_on_utc;

  return t(
    translationKey,
    time == null ? UNKNOWN_TIME : moment(time).fromNow(),
  );
};

export default function ActivityTable({
  loading,
  activeChild,
  setActiveChild,
  activityData,
}: ActivityProps) {
  const tabs = [
    {
      name: 'Edited',
      label: t('Edited'),
      onClick: () => {
        setActiveChild('Edited');
      },
    },
    {
      name: 'Created',
      label: t('Created'),
      onClick: () => {
        setActiveChild('Created');
      },
    },
  ];

  if (activityData?.Viewed) {
    tabs.unshift({
      name: 'Viewed',
      label: t('Viewed'),
      onClick: () => {
        setActiveChild('Viewed');
      },
    });
  } else {
    tabs.unshift({
      name: 'Examples',
      label: t('Examples'),
      onClick: () => {
        setActiveChild('Examples');
      },
    });
  }

  const renderActivity = () =>
    activityData[activeChild].map((entity: ActivityObject) => {
      const url = getEntityUrl(entity);
      const lastActionOn = getEntityLastActionOn(entity);
      return (
        <CardStyles
          onClick={() => {
            window.location.href = url;
          }}
          key={url}
        >
          <ListViewCard
            loading={loading}
            cover={<></>}
            url={url}
            title={getEntityTitle(entity)}
            description={lastActionOn}
            avatar={getEntityIconName(entity)}
            actions={null}
          />
        </CardStyles>
      );
    });

  if (loading) return <Loading position="inline" />;
  return (
    <>
      <SubMenu
        activeChild={activeChild}
        // eslint-disable-next-line react/no-children-prop
        tabs={tabs}
      />
      <>
        {activityData[activeChild]?.length > 0 ? (
          <ActivityContainer>{renderActivity()}</ActivityContainer>
        ) : (
          <EmptyState tableName="RECENTS" tab={activeChild} />
        )}
      </>
    </>
  );
}
