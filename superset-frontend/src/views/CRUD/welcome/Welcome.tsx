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
import { styled, t } from '@superset-ui/core';
import Collapse from 'src/components/Collapse';
import { User } from 'src/types/bootstrapTypes';
import { reject } from 'lodash';
import {
  getItem,
  dangerouslyGetItemDoNotUse,
  setItem,
  dangerouslySetItemDoNotUse,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';
import ListViewCard from 'src/components/ListViewCard';
import withToasts from 'src/components/MessageToasts/withToasts';
import {
  createErrorHandler,
  getRecentAcitivtyObjs,
  mq,
  CardContainer,
  getUserOwnedObjects,
  loadingCardCount,
} from 'src/views/CRUD/utils';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { AntdSwitch } from 'src/components';

import ActivityTable from './ActivityTable';
import ChartTable from './ChartTable';
import SavedQueries from './SavedQueries';
import DashboardTable from './DashboardTable';

interface WelcomeProps {
  user: User;
  addDangerToast: (arg0: string) => void;
}

export interface ActivityData {
  Created?: Array<object>;
  Edited?: Array<object>;
  Viewed?: Array<object>;
  Examples?: Array<object>;
}

interface LoadingProps {
  cover?: boolean;
}

const DEFAULT_TAB_ARR = ['2', '3'];

const WelcomeContainer = styled.div`
  background-color: ${({ theme }) => theme.colors.grayscale.light4};
  .ant-row.menu {
    margin-top: -15px;
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
    &:after {
      content: '';
      display: block;
      border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
      margin: 0px ${({ theme }) => theme.gridUnit * 6}px;
      position: relative;
      width: 100%;
      ${mq[1]} {
        margin-top: 5px;
        margin: 0px 2px;
      }
    }
    .ant-menu.ant-menu-light.ant-menu-root.ant-menu-horizontal {
      padding-left: ${({ theme }) => theme.gridUnit * 8}px;
    }
    button {
      padding: 3px 21px;
    }
  }
  .ant-card-meta-description {
    margin-top: ${({ theme }) => theme.gridUnit}px;
  }
  .ant-card.ant-card-bordered {
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }
  .ant-collapse-item .ant-collapse-content {
    margin-bottom: ${({ theme }) => theme.gridUnit * -6}px;
  }
  div.ant-collapse-item:last-child.ant-collapse-item-active
    .ant-collapse-header {
    padding-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  }
  div.ant-collapse-item:last-child .ant-collapse-header {
    padding-bottom: ${({ theme }) => theme.gridUnit * 9}px;
  }
  .loading-cards {
    margin-top: ${({ theme }) => theme.gridUnit * 8}px;
    .ant-card-cover > div {
      height: 168px;
    }
  }
`;

const WelcomeNav = styled.div`
  height: 50px;
  background-color: white;
  .navbar-brand {
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
  .switch {
    float: right;
    margin: ${({ theme }) => theme.gridUnit * 5}px;
    display: flex;
    flex-direction: row;
    span {
      display: block;
      margin: ${({ theme }) => theme.gridUnit * 1}px;
      line-height: 1;
    }
  }
`;

export const LoadingCards = ({ cover }: LoadingProps) => (
  <CardContainer showThumbnails={cover} className="loading-cards">
    {[...new Array(loadingCardCount)].map(() => (
      <ListViewCard cover={cover ? false : <></>} description="" loading />
    ))}
  </CardContainer>
);

function Welcome({ user, addDangerToast }: WelcomeProps) {
  const userid = user.userId;
  const id = userid.toString();
  const recent = `/superset/recent_activity/${user.userId}/?limit=6`;
  const [activeChild, setActiveChild] = useState('Loading');
  const userKey = dangerouslyGetItemDoNotUse(id, null);
  let defaultChecked = false;
  if (isFeatureEnabled(FeatureFlag.THUMBNAILS)) {
    defaultChecked =
      userKey?.thumbnails === undefined ? true : userKey?.thumbnails;
  }
  const [checked, setChecked] = useState(defaultChecked);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [chartData, setChartData] = useState<Array<object> | null>(null);
  const [queryData, setQueryData] = useState<Array<object> | null>(null);
  const [dashboardData, setDashboardData] = useState<Array<object> | null>(
    null,
  );
  const [loadedCount, setLoadedCount] = useState(0);

  const collapseState = getItem(LocalStorageKeys.homepage_collapse_state, []);
  const [activeState, setActiveState] = useState<Array<string>>(collapseState);

  const handleCollapse = (state: Array<string>) => {
    setActiveState(state);
    setItem(LocalStorageKeys.homepage_collapse_state, state);
  };

  useEffect(() => {
    const activeTab = getItem(LocalStorageKeys.homepage_activity_filter, null);
    setActiveState(collapseState.length > 0 ? collapseState : DEFAULT_TAB_ARR);
    getRecentAcitivtyObjs(user.userId, recent, addDangerToast)
      .then(res => {
        const data: ActivityData | null = {};
        data.Examples = res.examples;
        if (res.viewed) {
          const filtered = reject(res.viewed, ['item_url', null]).map(r => r);
          data.Viewed = filtered;
          if (!activeTab && data.Viewed) {
            setActiveChild('Viewed');
          } else if (!activeTab && !data.Viewed) {
            setActiveChild('Created');
          } else setActiveChild(activeTab || 'Created');
        } else if (!activeTab) setActiveChild('Created');
        else setActiveChild(activeTab);
        setActivityData(activityData => ({ ...activityData, ...data }));
      })
      .catch(
        createErrorHandler((errMsg: unknown) => {
          setActivityData(activityData => ({ ...activityData, Viewed: [] }));
          addDangerToast(
            t('There was an issue fetching your recent activity: %s', errMsg),
          );
        }),
      );

    // Sets other activity data in parallel with recents api call

    getUserOwnedObjects(id, 'dashboard')
      .then(r => {
        setDashboardData(r);
        setLoadedCount(loadedCount => loadedCount + 1);
      })
      .catch((err: unknown) => {
        setDashboardData([]);
        setLoadedCount(loadedCount => loadedCount + 1);
        addDangerToast(
          t('There was an issues fetching your dashboards: %s', err),
        );
      });
    getUserOwnedObjects(id, 'chart')
      .then(r => {
        setChartData(r);
        setLoadedCount(loadedCount => loadedCount + 1);
      })
      .catch((err: unknown) => {
        setChartData([]);
        setLoadedCount(loadedCount => loadedCount + 1);
        addDangerToast(t('There was an issues fetching your chart: %s', err));
      });
    getUserOwnedObjects(id, 'saved_query')
      .then(r => {
        setQueryData(r);
        setLoadedCount(loadedCount => loadedCount + 1);
      })
      .catch((err: unknown) => {
        setQueryData([]);
        setLoadedCount(loadedCount => loadedCount + 1);
        addDangerToast(
          t('There was an issues fetching your saved queries: %s', err),
        );
      });
  }, []);

  const handleToggle = () => {
    setChecked(!checked);
    dangerouslySetItemDoNotUse(id, { thumbnails: !checked });
  };

  useEffect(() => {
    if (!collapseState && queryData?.length) {
      setActiveState(activeState => [...activeState, '4']);
    }
    setActivityData(activityData => ({
      ...activityData,
      Created: [
        ...(chartData?.slice(0, 3) || []),
        ...(dashboardData?.slice(0, 3) || []),
        ...(queryData?.slice(0, 3) || []),
      ],
    }));
  }, [chartData, queryData, dashboardData]);

  useEffect(() => {
    if (!collapseState && activityData?.Viewed?.length) {
      setActiveState(activeState => ['1', ...activeState]);
    }
  }, [activityData]);

  const isRecentActivityLoading =
    !activityData?.Examples && !activityData?.Viewed;
  return (
    <WelcomeContainer>
      <WelcomeNav>
        <span className="navbar-brand">Home</span>
        {isFeatureEnabled(FeatureFlag.THUMBNAILS) ? (
          <div className="switch">
            <AntdSwitch checked={checked} onChange={handleToggle} />
            <span>Thumbnails</span>
          </div>
        ) : null}
      </WelcomeNav>
      <Collapse activeKey={activeState} onChange={handleCollapse} ghost bigger>
        <Collapse.Panel header={t('Recents')} key="1">
          {activityData &&
          (activityData.Viewed ||
            activityData.Examples ||
            activityData.Created) &&
          activeChild !== 'Loading' ? (
            <ActivityTable
              user={user}
              activeChild={activeChild}
              setActiveChild={setActiveChild}
              activityData={activityData}
              loadedCount={loadedCount}
            />
          ) : (
            <LoadingCards />
          )}
        </Collapse.Panel>
        <Collapse.Panel header={t('Dashboards')} key="2">
          {!dashboardData || isRecentActivityLoading ? (
            <LoadingCards cover={checked} />
          ) : (
            <DashboardTable
              user={user}
              mine={dashboardData}
              showThumbnails={checked}
              examples={activityData?.Examples}
            />
          )}
        </Collapse.Panel>
        <Collapse.Panel header={t('Charts')} key="3">
          {!chartData || isRecentActivityLoading ? (
            <LoadingCards cover={checked} />
          ) : (
            <ChartTable
              showThumbnails={checked}
              user={user}
              mine={chartData}
              examples={activityData?.Examples}
            />
          )}
        </Collapse.Panel>
        <Collapse.Panel header={t('Saved queries')} key="4">
          {!queryData ? (
            <LoadingCards cover={checked} />
          ) : (
            <SavedQueries
              showThumbnails={checked}
              user={user}
              mine={queryData}
              featureFlag={isFeatureEnabled(FeatureFlag.THUMBNAILS)}
            />
          )}
        </Collapse.Panel>
      </Collapse>
    </WelcomeContainer>
  );
}

export default withToasts(Welcome);
