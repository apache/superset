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
import { useEffect, useState } from 'react';
import moment from 'moment';
import { styled, t } from '@superset-ui/core';
import { setItem, LocalStorageKeys } from 'src/utils/localStorageHelpers';
import { Link } from 'react-router-dom';
import ListViewCard from 'src/components/ListViewCard';
import { Dashboard, SavedQueryObject, TableTab } from 'src/views/CRUD/types';
import { ActivityData, LoadingCards } from 'src/pages/Home';
import {
  CardContainer,
  CardStyles,
  getEditedObjects,
} from 'src/views/CRUD/utils';
import { Chart } from 'src/types/Chart';
import Icons from 'src/components/Icons';
import SubMenu from './SubMenu';
import EmptyState from './EmptyState';
import { WelcomeTable } from './types';

/**
 * Return result from /api/v1/log/recent_activity/
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
 * Recent activity objects fetched by `getRecentActivityObjs`.
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
  isFetchingActivityData: boolean;
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
  if ('sql' in entity) return `/sqllab?savedQueryId=${entity.id}`;
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
  isFetchingActivityData,
}: ActivityProps) {
  const [editedCards, setEditedCards] = useState<ActivityData[]>();
  const [isFetchingEditedCards, setIsFetchingEditedCards] = useState(false);

  const getEditedCards = () => {
    setIsFetchingEditedCards(true);
    getEditedObjects(user.userId).then(r => {
      setEditedCards([...r.editedChart, ...r.editedDash]);
      setIsFetchingEditedCards(false);
    });
  };

  useEffect(() => {
    if (activeChild === TableTab.Edited) {
      getEditedCards();
    }
  }, [activeChild]);

  const tabs = [
    {
      name: TableTab.Edited,
      label: t('Edited'),
      onClick: () => {
        setActiveChild(TableTab.Edited);
        setItem(LocalStorageKeys.HomepageActivityFilter, TableTab.Edited);
      },
    },
    {
      name: TableTab.Created,
      label: t('Created'),
      onClick: () => {
        setActiveChild(TableTab.Created);
        setItem(LocalStorageKeys.HomepageActivityFilter, TableTab.Created);
      },
    },
  ];

  if (activityData?.[TableTab.Viewed]) {
    tabs.unshift({
      name: TableTab.Viewed,
      label: t('Viewed'),
      onClick: () => {
        setActiveChild(TableTab.Viewed);
        setItem(LocalStorageKeys.HomepageActivityFilter, TableTab.Viewed);
      },
    });
  }
  const renderActivity = () =>
    (activeChild === TableTab.Edited
      ? editedCards
      : activityData[activeChild]
    ).map((entity: ActivityObject) => {
      const url = getEntityUrl(entity);
      const lastActionOn = getEntityLastActionOn(entity);
      return (
        <CardStyles key={url}>
          <Link to={url}>
            <ListViewCard
              cover={<></>}
              url={url}
              title={getEntityTitle(entity)}
              description={lastActionOn}
              avatar={getEntityIcon(entity)}
              actions={null}
            />
          </Link>
        </CardStyles>
      );
    });

  if ((isFetchingEditedCards && !editedCards) || isFetchingActivityData) {
    return <LoadingCards />;
  }
  return (
    <Styles>
      <SubMenu activeChild={activeChild} tabs={tabs} />
      {activityData[activeChild]?.length > 0 ||
      (activeChild === TableTab.Edited && editedCards?.length) ? (
        <CardContainer className="recentCards">
          {renderActivity()}
        </CardContainer>
      ) : (
        <EmptyState tableName={WelcomeTable.Recents} tab={activeChild} />
      )}
    </Styles>
  );
}
