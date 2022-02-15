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
import React, { useEffect, useState } from 'react';
import moment from 'moment';
import { styled, t } from '@superset-ui/core';
import { setItem, LocalStorageKeys } from 'src/utils/localStorageHelpers';

import ListViewCard from 'src/components/ListViewCard';
import SubMenu from 'src/views/components/SubMenu';
import { ActivityData, LoadingCards } from 'src/views/CRUD/welcome/Welcome';
import {
  CardContainer,
  CardStyles,
  getEditedObjects,
} from 'src/views/CRUD/utils';
import { Chart } from 'src/types/Chart';
import { Dashboard, SavedQueryObject } from 'src/views/CRUD/types';

import Icons from 'src/components/Icons';

import EmptyState from './EmptyState';
import { WelcomeTable } from './types';

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

export enum SetTabType {
  EDITED = 'Edited',
  CREATED = 'Created',
  VIEWED = 'Viewed',
  EXAMPLE = 'Examples',
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
  activityData: ActivityData;
  loadedCount: number;
}

const Styles = styled.div`
  .recentCards {
    max-height: none;
    grid-gap: ${({ theme }) => `${theme.gridUnit * 4}px`};
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

const getEntityIcon = (entity: ActivityObject) => {
  if ('sql' in entity) return <Icons.Sql />;
  const url = 'item_url' in entity ? entity.item_url : entity.url;
  if (url?.includes('dashboard')) {
    return <Icons.NavDashboard />;
  }
  if (url?.includes('explore')) {
    return <Icons.NavCharts />;
  }
  return null;
};

const getEntityUrl = (entity: ActivityObject) => {
  if ('sql' in entity) return `/superset/sqllab?savedQueryId=${entity.id}`;
  if ('url' in entity) return entity.url;
  return entity.item_url;
};

const getEntityLastActionOn = (entity: ActivityObject) => {
  if ('time' in entity) {
    return t('Viewed %s', moment(entity.time).fromNow());
  }

  let time: number | string | undefined | null;
  if ('changed_on' in entity) time = entity.changed_on;
  if ('changed_on_utc' in entity) time = entity.changed_on_utc;
  return t('Modified %s', time == null ? UNKNOWN_TIME : moment(time).fromNow());
};

export default function ActivityTable({
  activeChild,
  setActiveChild,
  activityData,
  user,
  loadedCount,
}: ActivityProps) {
  const [editedObjs, setEditedObjs] = useState<Array<ActivityData>>();
  const [loadingState, setLoadingState] = useState(false);

  const getEditedCards = () => {
    setLoadingState(true);
    getEditedObjects(user.userId).then(r => {
      setEditedObjs([...r.editedChart, ...r.editedDash]);
      setLoadingState(false);
    });
  };

  useEffect(() => {
    if (activeChild === 'Edited') {
      setLoadingState(true);
      getEditedCards();
    }
  }, [activeChild]);

  const tabs = [
    {
      name: 'Edited',
      label: t('Edited'),
      onClick: () => {
        setActiveChild('Edited');
        setItem(LocalStorageKeys.homepage_activity_filter, SetTabType.EDITED);
      },
    },
    {
      name: 'Created',
      label: t('Created'),
      onClick: () => {
        setActiveChild('Created');
        setItem(LocalStorageKeys.homepage_activity_filter, SetTabType.CREATED);
      },
    },
  ];

  if (activityData?.Viewed) {
    tabs.unshift({
      name: 'Viewed',
      label: t('Viewed'),
      onClick: () => {
        setActiveChild('Viewed');
        setItem(LocalStorageKeys.homepage_activity_filter, SetTabType.VIEWED);
      },
    });
  }
  const renderActivity = () =>
    (activeChild !== 'Edited' ? activityData[activeChild] : editedObjs).map(
      (entity: ActivityObject) => {
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
              cover={<></>}
              url={url}
              title={getEntityTitle(entity)}
              description={lastActionOn}
              avatar={getEntityIcon(entity)}
              actions={null}
            />
          </CardStyles>
        );
      },
    );

  const doneFetching = loadedCount < 3;

  if ((loadingState && !editedObjs) || doneFetching) {
    return <LoadingCards />;
  }
  return (
    <Styles>
      <SubMenu activeChild={activeChild} tabs={tabs} />
      {activityData[activeChild]?.length > 0 ||
      (activeChild === 'Edited' && editedObjs && editedObjs.length > 0) ? (
        <CardContainer className="recentCards">
          {renderActivity()}
        </CardContainer>
      ) : (
        <EmptyState tableName={WelcomeTable.Recents} tab={activeChild} />
      )}
    </Styles>
  );
}
